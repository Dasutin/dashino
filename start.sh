#!/bin/sh
set -e

echo "[dashino] REBUILD_ON_START=${REBUILD_ON_START:-0}"

maybe_rebuild() {
  if [ "$REBUILD_ON_START" = "1" ] || [ "$REBUILD_ON_START" = "true" ]; then
    echo "[dashino] Rebuilding client on start"
    chmod u+w /app/vite.config.ts || true
    node scripts/sync-controllers.mjs
    npm run build:client
    echo "[dashino] Client rebuild complete"
  else
    echo "[dashino] Skipping client rebuild (set REBUILD_ON_START=1 to enable)"
  fi
}

maybe_rebuild

echo "[dashino] Starting server"
exec node dist/server/server.js
