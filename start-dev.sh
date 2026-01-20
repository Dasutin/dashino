#!/bin/sh
set -e

# Dev entrypoint: optional client rebuild, then npm run dev (tsx + Vite) with predev sync.
echo "[dashino] REBUILD_ON_START=${REBUILD_ON_START:-0}"

maybe_rebuild() {
	if [ "$REBUILD_ON_START" = "1" ] || [ "$REBUILD_ON_START" = "true" ]; then
		echo "[dashino] Rebuilding client on dev start"
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

echo "[dashino] Starting dev servers (npm run dev)"
exec npm run dev
