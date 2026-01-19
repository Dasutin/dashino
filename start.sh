#!/bin/sh
set -e

echo "[dashino] REBUILD_ON_START=${REBUILD_ON_START:-0}"

maybe_rebuild() {
  if [ "$REBUILD_ON_START" = "1" ] || [ "$REBUILD_ON_START" = "true" ]; then
    echo "[dashino] Rebuilding client on start"
    chown node:node /app /app/vite.config.ts /app/tsconfig.json /app/package.json /app/package-lock.json 2>/dev/null || true
    chmod u+w /app /app/vite.config.ts /app/tsconfig.json /app/package.json /app/package-lock.json 2>/dev/null || true
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
