# Dashino

Node.js and React based framework that lets you build excellent dashboards.

- Use the premade widgets, or fully create your own with HTML, CSS, and TypeScript.
- API to push data to your dashboards
- JavaScript jobs fetching data from online resources or databases.
- Rotate through a set of dashboards automatically with Playlists
- Supports deploying from Docker or locally.

Dashino is the spiritual successor to Dashing and Smashing.

## Quick start

- Build image: `docker build -t dashino .`
- Run with editable content mounted:
  
```bash
docker run -d --name dashino \
 -p 4040:4040 \
 -v ./dashboards:/app/dashboards \
 -v ./widgets:/app/widgets \
 -v ./themes:/app/themes \
 -v ./jobs:/app/jobs \
 -v ./playlists:/app/playlists \
 -v ./logs:/app/logs \
 -v ./.env:/app/.env \
 dashino:latest
```

## Create a dashboard

1) Copy a dashboard JSON: duplicate `dashboards/demotv.json` to `dashboards/`.

   1) Fields:
   - `slug`: URL path and selector value (e.g., `kitchen`).
   - `name`: Dashboard display name.
   - `theme`: Optional CSS file in `/themes/<theme>.css` to load.
   - `className`: Optional body class to toggle (e.g., `theme-main`).
   - `maxRows`: Grid height. Defaults to 3.
   - `maxColumns`: Grid width. Defaults to 4.
   - `gutter`: Spacing between widgets. Defaults to 16px.
   - `columnWidth` / `rowHeight`: Optional pixel sizes for grid cells. Defaults to 300x360 when omitted.
   - `widgets`: Array of widget placements `{ id, type, position { w, h, x, y } }`.

### Example dashboard JSON

```json
{
  "slug": "kitchen",
  "name": "Kitchen",
  "theme": "main",
  "className": "theme-main",
  "maxRows": 10,
  "maxColumns": 8,
  "gutter": 8,
  "columnWidth": 400,
  "rowHeight": 450,
  "widgets": [
    { "id": "clock", "type": "clock", "position": { "w": 2, "h": 1, "x": 1, "y": 1 } },
    { "id": "forecast", "type": "forecast", "position": { "w": 2, "h": 1, "x": 3, "y": 1 } }
  ]
}
```

## Folders

- `dashboards/`: JSON definitions for each dashboard (layout, widget placements).
- `themes/`: CSS stylesheets for each dashboard.
- `widgets/<name>/`: Each widget has `widget.html`, `widget.css`, and `widget.ts` (placeholder) used by the client to render.
- `jobs/`: Scheduled jobs (`*.js`) to send events targeted at widget IDs.
- `playlists/`: Automatically rotate a set of dashboards.
- `assets/`: Images or icons for use with widgets.
- `logs/`: The log folder.
- `.env`: File for environment variables and secrets.

## Events

- Widgets receive data over the SSE stream when you broadcast an event.
- Use `POST /api/events` with JSON: `{ "widgetId": "<id>", "type": "<type>", "data": { ... } }`. If `widgetId` matches a widget on the current dashboard, the client renders it immediately. If only `type` is provided, widgets listening for that type will render it.
- Quick curl example targeting a widget:

```bash
curl -X POST http://localhost:4040/api/events \
  -H "Content-Type: application/json" \
  -d '{"widgetId":"tomorrow","type":"tomorrow","data":{"current":{"temperature":72,"summary":"Sunny","dew_point":60}}}'
```

- Jobs can emit events on intervals; see `jobs/*.js` for examples of sending `{ widgetId, type, data }` via `emit()`.

## Event testing

- The Tools section on the main page has an Event Testing panel. The Event Testing panel lets you pick a widget ID and send JSON or plain text. Select a widget ID, paste a payload, and click Send. If the text parses as JSON, it will send that JSON's `type` and `data`; otherwise it wraps your text as `{ message: "..." }`.

## Layout editing

- Pressing `E` on your keyboard enables the layout editing mode.
- When enabled, widgets can be moved or resized.
- After after resizing or dragging a widget, a banner at the top of the page asks what to do with the new layout:
  - **Save temporarily**: Stores the layout in your browser `localStorage` (per dashboard) and applies it on reload.
  - **Save permanently**: Calls `POST /api/dashboards/:slug/layout` to write the positions back to the dashboard JSON on disk and also saves to `localStorage`.
  - **Revert**: Discards pending changes and restores the last saved layout.

## Webhooks

Events can be sent as Webhooks to your Dashino dashboards.

- Declare sources with `WEBHOOK_SOURCES` (comma separated). Each source name becomes the `:source` path segment.
- Secrets live in `WEBHOOK_SECRET_<SOURCE>` (name uppercased, non-alphanumeric become `_`). Requests must send the secret in the `X-Webhook-Secret` header.
- Optional defaults per source:
  - `WEBHOOK_<SOURCE>_WIDGET_ID`: Force events to a widget ID (payload `widgetId` overrides only if present).
  - `WEBHOOK_<SOURCE>_TYPE`: Force an event type (payload `type` overrides only if present; default is the source name).
- Payload rules: JSON only (default 256kb limit). If the body has a `data` field it is broadcast; otherwise the remaining top-level fields are sent as `data`. Either `widgetId` or `type` must resolve after defaults.

### Webhook example payload

```bash
curl -X POST http://localhost:4040/api/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET_GITHUB" \
  -d '{"data":{"message":"hello from webhook"}}'
```

## Troubleshooting (widgets/controllers)

- If you mount custom widgets/controllers at runtime, mount them to `/app/widgets` and start with `REBUILD_ON_START=1` so the client rebuilds on boot.
- Watch the startup log for `Client rebuild complete`; if you don’t see it, the rebuild didn’t run.
- Check if jobs that require secrets either have them hardcoded in the job or are in the .env file.
- Verify all files Dashino uses have the correct permissions.
- Verify controllers in the image with `node scripts/check-controllers-runtime.mjs` (inside the container) after startup.
- Ensure event payloads include `widgetId` matching the dashboard entries; otherwise updates are ignored client-side.

## Development

1. Clone this repo in VS Code.
2. Wait for `npm install`.
3. Start everything in dev mode: `npm run dev` (starts Express on 4040 and Vite on 4173 with proxying). If you want to bypass the proxy, set `VITE_API_ORIGIN=http://localhost:4040` in `web/.env.local`.
4. Visit the client at [http://localhost:4173]. The page loads the dashboard layout from `dashboards/` and widgets from `widgets/`, connects to `/events`, and shows live widget data. Use the "Send event" button to push a custom event through the backend.

## Scripts

- `npm run dev`: Run server (tsx watch) and client (Vite) together.
- `npm run dev:server`: Run only the API and SSE server.
- `npm run dev:client`: Run only the React app with proxying to the server.
- `npm run build`: Build server (tsc) and client (Vite) into `dist`.
- `npm start`: Run the built server from `dist` and serve the built client from `dist/web`.

## API endpoints

- `GET /events`: Subscribe to the SSE stream. Sends a `ready` event immediately and keeps the connection open.
- `POST /api/events`: Broadcast a custom event body `{ type, data, widgetId }` to all listeners (optionally target a widget).
- `POST /api/dashboards/:slug/layout`: Persist widget positions for the dashboard to the JSON file on disk.
- `POST /api/webhooks/:source`: Validates `X-Webhook-Secret` and broadcasts the JSON body (or `body.data`) to the configured widget/type for that source.
- `GET /api/health`: Basic readiness endpoint.
- `GET /api/dashboards`: Returns available dashboards and layout metadata.

## License

MIT © Dustin Dembrosky
