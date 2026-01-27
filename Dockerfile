# syntax=docker/dockerfile:1

FROM node:24-slim AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM deps AS build
RUN mkdir -p dashboards widgets themes assets jobs stacks playlists backups logs
COPY . .
RUN node scripts/sync-controllers.mjs
RUN npm run build

# Dev runtime (full deps, uses start-dev.sh to honor REBUILD_ON_START then run npm run dev)
FROM base AS runner-dev
ENV NODE_ENV=development

COPY package*.json ./
COPY tsconfig.json vite.config.ts ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dashboards ./dashboards
COPY --from=build /app/widgets ./widgets
COPY --from=build /app/themes ./themes
COPY --from=build /app/assets ./assets
COPY --from=build /app/jobs ./jobs
COPY --from=build /app/stacks ./stacks
COPY --from=build /app/playlists ./playlists
COPY --from=build /app/backups ./backups
COPY --from=build /app/logs ./logs
COPY --from=build /app/job-runner.mjs ./job-runner.mjs
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/web ./web
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/vite.config.ts ./vite.config.ts
COPY --from=build /app/start.sh ./start.sh
COPY --from=build /app/start-dev.sh ./start-dev.sh

# ---- NEW: bake defaults into a non-volume path ----
COPY --from=build /app/dashboards /defaults/dashboards
COPY --from=build /app/widgets    /defaults/widgets
COPY --from=build /app/themes     /defaults/themes
COPY --from=build /app/assets     /defaults/assets
COPY --from=build /app/jobs       /defaults/jobs
COPY --from=build /app/stacks     /defaults/stacks
COPY --from=build /app/playlists  /defaults/playlists
COPY --from=build /app/backups    /defaults/backups
COPY --from=build /app/logs       /defaults/logs

# ---- NEW: entrypoint that seeds volumes on first run ----
COPY entrypoint.sh /entrypoint.sh

RUN mkdir -p dashboards widgets themes assets jobs stacks playlists backups logs scripts \
	&& chown -R node:node /app \
	&& chown -R node:node dashboards widgets themes assets jobs stacks playlists backups logs dist scripts web src \
	&& chown -R node:node /app/vite.config.ts /app/tsconfig.json /app/package.json /app/package-lock.json /app/start.sh /app/start-dev.sh \
	&& touch .env && chown node:node .env \
	&& chmod +x ./start.sh ./start-dev.sh /entrypoint.sh

# IMPORTANT: run entrypoint as root so it can chown fresh volumes, then drop to node internally
USER root

VOLUME ["/app/assets","/app/dashboards","/app/stacks","/app/jobs","/app/themes","/app/widgets","/app/playlists","/app/backups","/app/logs"]

EXPOSE 4040 4173
ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh", "./start-dev.sh"]

# Prod runtime (default final stage; keeps current config with rebuild-on-start)
FROM base AS runner-prod
ENV NODE_ENV=production

COPY package*.json ./
COPY tsconfig.json vite.config.ts ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dashboards ./dashboards
COPY --from=build /app/widgets ./widgets
COPY --from=build /app/themes ./themes
COPY --from=build /app/assets ./assets
COPY --from=build /app/jobs ./jobs
COPY --from=build /app/stacks ./stacks
COPY --from=build /app/playlists ./playlists
COPY --from=build /app/backups ./backups
COPY --from=build /app/logs ./logs
COPY --from=build /app/job-runner.mjs ./job-runner.mjs
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/web ./web
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/vite.config.ts ./vite.config.ts
COPY --from=build /app/start.sh ./start.sh

# ---- NEW: bake defaults into a non-volume path ----
COPY --from=build /app/dashboards /defaults/dashboards
COPY --from=build /app/widgets    /defaults/widgets
COPY --from=build /app/themes     /defaults/themes
COPY --from=build /app/assets     /defaults/assets
COPY --from=build /app/jobs       /defaults/jobs
COPY --from=build /app/stacks     /defaults/stacks
COPY --from=build /app/playlists  /defaults/playlists
COPY --from=build /app/backups    /defaults/backups
COPY --from=build /app/logs       /defaults/logs

# ---- NEW: entrypoint that seeds volumes on first run ----
COPY entrypoint.sh /entrypoint.sh

# Make runtime content writable; users can bind mount these to override.
RUN mkdir -p dashboards widgets themes assets jobs stacks playlists backups logs \
	&& mkdir -p scripts \
	&& chown -R node:node /app \
	&& chown -R node:node dashboards widgets themes assets jobs stacks playlists backups logs dist scripts web src \
	&& chown -R node:node /app/vite.config.ts /app/tsconfig.json /app/package.json /app/package-lock.json /app/start.sh \
	&& touch .env && chown node:node .env \
	&& chmod +x ./start.sh /entrypoint.sh

# IMPORTANT: run entrypoint as root so it can chown fresh volumes, then drop to node internally
USER root

VOLUME ["/app/assets","/app/dashboards","/app/stacks","/app/jobs","/app/themes","/app/widgets","/app/playlists","/app/backups","/app/logs"]

EXPOSE 4040
ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh", "./start.sh"]

