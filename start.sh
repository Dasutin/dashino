#!/bin/sh
set -e

# Optional: rebuild client on start when controllers are provided via mounted widgets
if [ "$REBUILD_ON_START" = "1" ] || [ "$REBUILD_ON_START" = "true" ]; then
  echo "[dashino] Rebuilding client on start (REBUILD_ON_START=$REBUILD_ON_START)"
  node scripts/sync-controllers.mjs
  npm run build:client
else
  echo "[dashino] Skipping client rebuild on start (set REBUILD_ON_START=1 to enable)"
fi

exec node dist/server/server.js
