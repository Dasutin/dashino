# Dashino

Node and React based framework that lets you build excellent dashboards.
- Use the premade widgets, or fully create your own with html, css, and typescript.
- API to push data to your dashboards
- JavaScript jobs fetching data from online resources or databases.
- Supports deploying from Docker or locally using Node.js.

## Quick start

1. Open this folder in VS Code and reopen in the dev container.
2. Wait for `npm install` (runs from the devcontainer post-create hook). If you prefer locally, run `npm install`.
3. Start everything in dev mode: `npm run dev` (starts Express on 4040 and Vite on 4173 with proxying). If you want to bypass the proxy, set `VITE_API_ORIGIN=http://localhost:4040` in `web/.env.local`.
4. Visit the client at http://localhost:4173. The page loads the dashboard layout from `dashboards/` and widgets from `widgets/`, connects to `/events`, and shows live widget data. Use the "Send demo event" button to push a custom event through the backend.

## Production

- Build: `npm run build` (outputs server + client to `dist/`).
- Run built server: `npm start` (serves `dist/web` assets and SSE API on 4040 by default).
- Env: set `VITE_API_ORIGIN` for the client if you serve the API from a different host/port. Set `CACHE_DISABLE=true` to bypass server-side caches for dashboards/widgets/themes (debug-only).

## Docker (optional)

- Build image: `docker build -t dashino .`
- Run with editable content mounted:
	```
	docker run -d --name dashino \
		-p 4040:4040 \
		-v ./dashboards:/app/dashboards:ro \
		-v ./widgets:/app/widgets:ro \
		-v ./web/themes:/app/web/themes \
		-v ./jobs:/app/jobs \
		-e VITE_API_ORIGIN=http://localhost:4040 \
		dashino:latest
	```

- Mounts: make them read-only (`:ro`) unless you need to edit in-place; themes/jobs often stay writable for quick tweaks.

## Deployment checklist (widgets/controllers)

- If you mount custom widgets/controllers at runtime, mount them to `/app/widgets` and start with `REBUILD_ON_START=1` so the client rebuilds on boot.
- Watch the startup log for `Client rebuild complete`; if you don’t see it, the rebuild didn’t run (env missing or permission issue).
- Verify controllers in the image with `node scripts/check-controllers-runtime.mjs` (inside the container) after startup.
- Ensure SSE payloads include `widgetId` matching the dashboard entries; otherwise updates are ignored client-side.
- When possible, bake widgets/controllers into the image (build from a context that already has them) to skip rebuild-on-boot and speed startup.

## Scripts

- `npm run dev`: Run server (tsx watch) and client (Vite) together.
- `npm run dev:server`: Run only the API and SSE server.
- `npm run dev:client`: Run only the React app with proxying to the server.
- `npm run build`: Build server (tsc) and client (Vite) into `dist`.
- `npm start`: Run the built server from `dist` and serve the built client from `dist/web`.

## API endpoints

- `GET /events`: Subscribe to the SSE stream. Sends a `ready` event immediately and keeps the connection open.
- `POST /api/events`: Broadcast a custom event body `{ type, data, widgetId }` to all listeners (optionally target a widget).
- `GET /api/health`: Basic readiness endpoint.
- `GET /api/dashboards`: Returns available dashboards and layout metadata.

## Architecture notes

- `dashboards/`: JSON definitions for each dashboard (layout, widget placements).
- `widgets/<name>/`: Each widget has `widget.html`, `widget.css`, and `widget.ts` (placeholder) used by the client to render.
- `jobs/`: Scheduled jobs (`*.js`) that emit SSE payloads targeted at widget IDs.
- Express handles SSE connections, dashboard + widget serving, and job scheduling. A background ticker still broadcasts a heartbeat every 5 seconds.
- Vite builds the React client in `web/`; the server serves the built assets from `dist/web` in production and proxies widget assets in dev.

## Create a dashboard

1) Copy a dashboard JSON: duplicate `dashboards/main.json` to `dashboards/<your-slug>.json`. Fields:
	 - `slug`: URL path and selector value (e.g., `kitchen`).
	 - `name`: Display name in the selector.
	 - `theme`: Optional CSS file in `web/themes/<theme>.css` to load.
	 - `className`: Optional body class to toggle (e.g., `theme-main`).
	 - `columns` / `gutter`: Grid sizing (each widget uses column/row spans).
	 - `widgets`: Array of placements `{ id, type, title?, position { w, h, x, y } }`.

2) Add (or reuse) a theme: create `themes/<theme>.css` (served at `/themes/<theme>.css`) and set `theme` to that filename (without `.css`). Add `className` to the dashboard if you want a body class for extra styling.

3) Add widgets referenced by `type`: each lives in `widgets/<type>/` with `widget.html`, `widget.css`, and optional `widget.ts` controller. The HTML receives templated data from SSE payloads; the TS controller can manage dynamic behavior.

4) (Optional) Add jobs to feed data: place scripts in `jobs/` that emit events via the server helper to specific `widgetId`s. You can also hit `POST /api/events` manually to test.

5) Run dev and select your dashboard:
	 - `npm run dev` then open http://localhost:4173 and pick your `slug` from the selector on the landing page.

### Root page event testing

- The root page has an Event Testing panel. Select a widget ID, paste a payload, and click Send. If the text parses as JSON, it will send that JSON's `type` and `data`; otherwise it wraps your text as `{ message: "..." }`.

### Example dashboard JSON

```json
{
	"slug": "kitchen",
	"name": "Kitchen",
	"theme": "main",
	"className": "theme-main",
	"columns": 8,
	"gutter": 8,
	"widgets": [
		{ "id": "clock", "type": "clock", "position": { "w": 2, "h": 1, "x": 1, "y": 1 } },
		{ "id": "forecast", "type": "forecast", "position": { "w": 2, "h": 1, "x": 3, "y": 1 } }
	]
}
```

### Example test event (from root page or curl)

```
curl -X POST http://localhost:4040/api/events \
	-H "Content-Type: application/json" \
	-d '{"widgetId":"forecast","type":"forecast","data":{"current":{"temperature":72,"summary":"Sunny","dew_point":60}}}'
```
