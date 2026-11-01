# syntax=docker/dockerfile:1
# Production image of the app. Built by CI (.github/workflows/deploy.yml), not locally.
# The same image runs the app, the one-off migrations (drizzle-kit) and the demo seed (tsx),
# so it keeps dev dependencies.

FROM node:24-slim AS build
ENV NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --store-dir /pnpm-store

COPY . .
# The app reads database settings when its modules load, but connects only on the first query.
# Pages are rendered per request, so the build never queries: placeholders are enough here.
RUN POSTGRES_USER=build POSTGRES_PASSWORD=build POSTGRES_DB=build pnpm build

FROM node:24-slim
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
# Inside the container listen on all interfaces; the host publishes the port on 127.0.0.1 only
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
