# Dashino

Node.js and React based framework that lets you build excellent dashboards.

- Use the premade widgets, or fully create your own with HTML, CSS, and TypeScript.
- API to push data to your dashboards
- JavaScript jobs fetching data from online resources or databases.
- Supports deploying from Docker or locally.

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
 -v ./logs:/app/logs \
 -v ./.env:/app/.env \
 dashino:latest
```

## Create a dashboard

1) Copy a dashboard JSON: duplicate `dashboards/demo.json` to `dashboards/`.

   1) Fields:
   - `slug`: URL path and selector value (e.g., `kitchen`).
   - `name`: Display name in the selector.
   - `theme`: Optional CSS file in `web/themes/<theme>.css` to load.
   - `className`: Optional body class to toggle (e.g., `theme-main`).
   - `columns` / `gutter`: Grid sizing (each widget uses column/row spans).
   - `widgets`: Array of placements `{ id, type, title?, position { w, h, x, y } }`.

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

- `dashboards/`: JSON definitions for each dashboard (layout, widget placements).
- `themes/`: CSS stylesheets for each dashboard.
- `widgets/<name>/`: Each widget has `widget.html`, `widget.css`, and `widget.ts` (placeholder) used by the client to render.
- `jobs/`: Scheduled jobs (`*.js`) to send events targeted at widget IDs.
- `assets/`: Images or icons for use with widgets.
- `logs/`: The log folder.
- `.env`: File for environment variables and secrets.

## Event testing

- The main page has an Event Testing panel. Select a widget ID, paste a payload, and click Send. If the text parses as JSON, it will send that JSON's `type` and `data`; otherwise it wraps your text as `{ message: "..." }`.

### Example test event (from the main page or curl)

```bash
curl -X POST http://localhost:4040/api/events \
  -H "Content-Type: application/json" \
  -d '{"widgetId":"tomorrow","type":"tomorrow","data":{"current":{"temperature":72,"summary":"Sunny","dew_point":60}}}'
```

## Troubleshooting (widgets/controllers)

- If you mount custom widgets/controllers at runtime, mount them to `/app/widgets` and start with `REBUILD_ON_START=1` so the client rebuilds on boot.
- Watch the startup log for `Client rebuild complete`; if you don’t see it, the rebuild didn’t run (.env missing or permission issue).
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
- `GET /api/health`: Basic readiness endpoint.
- `GET /api/dashboards`: Returns available dashboards and layout metadata.
