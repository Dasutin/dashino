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

FROM base AS runner
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/dashboards ./dashboards
COPY --from=build /app/widgets ./widgets
COPY --from=build /app/themes ./themes
COPY --from=build /app/assets ./assets
COPY --from=build /app/jobs ./jobs
COPY --from=build /app/job-runner.mjs ./job-runner.mjs

# Make runtime content writable; users can bind mount these to override.
RUN mkdir -p dashboards widgets themes assets jobs logs \
	&& chown -R node:node dashboards widgets themes assets jobs logs dist \
	&& touch .env && chown node:node .env

USER node

VOLUME ["/app/assets","/app/dashboards","/app/jobs","/app/themes","/app/widgets"]

EXPOSE 4040
CMD ["node", "dist/server/server.js"]
