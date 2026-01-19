# syntax=docker/dockerfile:1

FROM node:20-slim AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM deps AS build
RUN mkdir -p dashboards widgets themes assets jobs
COPY . .
RUN node scripts/sync-controllers.mjs
RUN npm run build

# Dev runtime (slim: prod deps only, built assets, no rebuild-on-start)
FROM base AS runner-dev
ENV NODE_ENV=development
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/dashboards ./dashboards
COPY --from=build /app/widgets ./widgets
COPY --from=build /app/themes ./themes
COPY --from=build /app/assets ./assets
COPY --from=build /app/jobs ./jobs
COPY --from=build /app/job-runner.mjs ./job-runner.mjs

RUN mkdir -p dashboards widgets themes assets jobs logs \
	&& chown -R node:node /app \
	&& touch .env && chown node:node .env

USER node

VOLUME ["/app/assets","/app/dashboards","/app/jobs","/app/themes","/app/widgets"]

EXPOSE 4040
CMD ["node", "dist/server/server.js"]

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
COPY --from=build /app/job-runner.mjs ./job-runner.mjs
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/web ./web
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/vite.config.ts ./vite.config.ts
COPY --from=build /app/start.sh ./start.sh

# Make runtime content writable; users can bind mount these to override.
RUN mkdir -p dashboards widgets themes assets jobs logs \
	&& mkdir -p scripts \
	&& chown -R node:node /app \
	&& chown -R node:node dashboards widgets themes assets jobs logs dist scripts web src \
	&& chown -R node:node /app/vite.config.ts /app/tsconfig.json /app/package.json /app/package-lock.json /app/start.sh \
	&& touch .env && chown node:node .env \
	&& chmod +x ./start.sh

USER node

VOLUME ["/app/assets","/app/dashboards","/app/jobs","/app/themes","/app/widgets"]

EXPOSE 4040
CMD ["sh", "./start.sh"]
