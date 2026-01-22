# copilot-instructions.md — Dashino

These instructions are for GitHub Copilot / Codex-style agents working inside this repo.

Dashino is a spiritual successor to Dashing/Smashing: realtime dashboards powered by Express + SSE + React/Vite, with widgets defined by folders containing HTML/CSS templates and optional TS/JS controllers.

---

## High-level architecture

Dashino has 2 main parts:

### 1) Backend (Express server)
- Source: `src/server.ts`
- Default port: `4040`
- Responsibilities:
  - Serve the built web client from `dist/web`
  - Serve runtime content from disk:
    - dashboards: `/dashboards/*.json`
    - widgets: `/widgets/<type>/widget.html` and `/widget.css`
    - themes: `/themes/<name>.css`
    - assets: `/assets/*`
  - Provide realtime updates via SSE:
    - `GET /events` (EventSource stream)
    - caches last message per widgetId/type and replays on connect
  - Accept events:
    - `POST /api/events` broadcasts `{widgetId,type,data,at}`
    - `POST /api/webhooks/:source` validates `X-Webhook-Secret` and broadcasts
  - Run scheduled jobs:
    - forks `job-runner.mjs` per file in `/jobs`
    - jobs emit messages back via IPC
  - Layout persistence:
    - `POST /api/dashboards/:slug/layout` writes updated widget positions into the dashboard JSON file

### 2) Frontend (React + Vite)
- Source: `web/src`
- Main entry: `web/src/App.tsx`
- Dashboard renderer: `web/src/DashboardView.tsx`
- Responsibilities:
  - Load dashboard list from `GET /api/dashboards`
  - Route dashboards by URL path `/<slug>`
  - Connect to SSE at `${apiOrigin}/events`
  - Fetch widget templates per type:
    - `/widgets/<type>/widget.html`
    - `/widgets/<type>/widget.css`
  - Inject widget CSS into `<head>` once per type
  - Optionally load theme CSS from `/themes/<theme>.css`
  - Render a CSS grid dashboard and widget cards
  - Instantiate a widget controller per widget type (if available)
  - Support drag-to-reposition layout editing:
    - Save temporarily (localStorage)
    - Save permanently (POST layout to server)
    - Revert

---

## Repo layout (important folders)

```
/dashboards/              Dashboard JSON definitions
/widgets/<type>/          Widget templates + controller sources
  widget.html
  widget.css
  widget.ts|js            Optional widget controller (bundled)
/themes/                  Theme CSS files
/assets/                  Static assets served by server
/jobs/                    Scheduled job modules that emit events
/web/                     Vite + React client
/src/                     Express server (TypeScript)
job-runner.mjs            Job runner forked by server
scripts/sync-controllers.mjs
```

---

## Widget system

### Widget templates (runtime)
Each widget type has:
- `widgets/<type>/widget.html`
- `widgets/<type>/widget.css`

The client fetches these at runtime and renders HTML with simple template interpolation:
- placeholders like `{{current.temperature}}`
- template rendering is implemented in `DashboardView.tsx` (`renderTemplate()` + `get()`)

### Widget controllers (bundle-time)
Widgets may optionally include a controller file:
- `widgets/<type>/widget.ts` or `widget.js`

Controllers are bundled into the client via:
- `scripts/sync-controllers.mjs`

This script:
- copies controllers into `web/src/controllers/<type>.ts`
- generates `web/src/controllers/generated.ts` which exports a `controllersMap`

`DashboardView.tsx` imports:
- `controllersMap from "./controllers/generated"`

Controller factories must match:
```ts
export type WidgetFactory = (args: {
  root: HTMLElement;
  widget: WidgetPlacement;
  template?: WidgetTemplate;
}) => WidgetController;
```

Controller interface:
```ts
update?: (payload?: StreamPayload) => void;
resize?: (rect: DOMRectReadOnly) => void; // recently added
destroy?: () => void;
```

---

## Events and data flow

### Emitting events
Events are broadcast server-side as:
```json
{
  "widgetId": "forecast",
  "type": "forecast",
  "data": { ... },
  "at": "2026-01-21T00:00:00.000Z"
}
```

Sources of events:
- jobs (scheduled emitters)
- `/api/events` manual events
- `/api/webhooks/:source` authenticated webhooks

### Receiving events (client)
The client connects via:
- `new EventSource(`${apiOrigin}/events`)`

Events update widget data by `widgetId`.
Reload events are supported:
- `type: "reload"` or `"reload-dashboard"` or `data.reload === true`

---

## Jobs

Jobs live in `/jobs/*.js` and export default:

```js
export default {
  interval: 60_000,
  widgetId: "ev",
  type: "ev",
  run: async (emit) => {
    emit({ widgetId: "ev", type: "ev", data: { ... } });
  }
};
```

Jobs are run by `job-runner.mjs`:
- dynamic import by file URL
- sends meta defaults to server
- runs immediately once, then on interval
- uses IPC to send emitted payloads

Jobs commonly poll Home Assistant using:
- `HA_BASE_URL`
- `HA_TOKEN`

---

## Dev workflow

### Local dev
```bash
npm ci
npm run dev
```

This runs:
- server: `tsx watch src/server.ts` on port 4040
- client: Vite dev server on port 4173 (after wait-on server)

Vite proxies these paths to Express:
- `/events`
- `/api`
- `/widgets`
- `/themes`
- `/assets`

Vite also full-reloads when files in `/widgets` or `/assets` change.

### Build
```bash
npm run build
```

Builds:
- server to `dist/server`
- client to `dist/web`

### Start
```bash
npm start
```

Runs:
- `node dist/server/server.js`

---

## Docker workflow

Dockerfile supports:
- `runner-dev` (dev runtime)
- `runner-prod` (prod runtime)

Mutable runtime content is intended to be bind-mounted:
- `/app/dashboards`
- `/app/widgets`
- `/app/themes`
- `/app/jobs`
- `/app/assets`

Optional rebuild behavior:
- `REBUILD_ON_START=1` rebuilds the client bundle on container start:
  - runs `scripts/sync-controllers.mjs`
  - runs `npm run build:client`

Use this if widget controller code changes and you need the client bundle to match.

---

## Coding conventions (important)

- Use **camelCase** for variables and functions.
- Keep changes minimal and aligned with existing patterns.
- Avoid adding dependencies unless necessary.
- Prefer small, readable utilities over heavy abstractions.
- The server should remain “mostly stateless” aside from:
  - last-event cache for SSE replay
  - file-based dashboards/widgets/themes/assets/jobs

---

## How to make changes safely

### When editing DashboardView.tsx
Be careful with:
- SSE lifecycle and cleanup
- template fetching + CSS injection
- controller lifecycle (`destroy` on unmount)
- layout editing state (localStorage vs permanent save)
- avoiding unnecessary rerenders

### When adding a new widget
Create:
- `widgets/<type>/widget.html`
- `widgets/<type>/widget.css`
Optional:
- `widgets/<type>/widget.ts`

Then run:
```bash
node scripts/sync-controllers.mjs
```

Or rely on:
- `npm run dev` (predev runs sync)
- `npm run build` (prebuild:client runs sync)

### When adding a new job
Add:
- `jobs/<name>.js`
Ensure it exports `{ interval, run }`.
If polling external APIs, include timeouts and error handling.
Emit a stable payload shape.

---

## What NOT to do
- Do not replace SSE with websockets.
- Do not introduce a database requirement.
- Do not move widgets into the React bundle (HTML/CSS templates must remain runtime-loadable).
- Do not break existing dashboard JSON formats.
- Do not require rebuilds for HTML/CSS changes.

---

## Useful endpoints (for testing)

- `GET /api/health`
- `GET /api/dashboards`
- `POST /api/events`
- `POST /api/webhooks/:source`
- `GET /events`
- `GET /widgets/<type>/widget.html`
- `GET /widgets/<type>/widget.css`
- `GET /themes/<name>.css`
- `GET /assets/*`

Example event:
```bash
curl -X POST http://localhost:4040/api/events   -H "Content-Type: application/json"   -d '{"widgetId":"forecast","type":"forecast","data":{"current":{"temperature":32,"summary":"Snow","dew_point":18}}}'
```

---

## Agent behavior guidelines
When implementing features:
1) Make the smallest possible change that fits the existing architecture.
2) Prefer adding optional behavior rather than breaking changes.
3) Always handle cleanup (EventSource, observers, timers).
4) Keep UI changes non-invasive and easy to disable.
5) If adding new conventions, keep backward compatibility.

If unsure about a decision, ask before refactoring major components.
