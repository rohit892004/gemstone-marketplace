# syntax=docker/dockerfile:1
#
# Production image for the app and the worker (same image, different command). NOT BUILT in the M6 platform
# phase: Docker was not available on the build machine. First build on the server with:
#   docker build -t gemstone-marketplace:latest .
#
# Base: bookworm-slim (glibc). sharp ships prebuilt glibc binaries and Prisma's query engine needs OpenSSL,
# so both are installed explicitly. Alpine (musl) would also work for sharp, but glibc is the safer default.
#
# No secrets are baked in. Nothing from .env is copied (see .dockerignore). Runtime values come from the env file
# passed by docker-compose. The build stage uses a placeholder DATABASE_URL that never reaches the runtime image.

ARG NODE_VERSION=22

# ---- deps: install all dependencies (dev included) for the build ----
FROM node:${NODE_VERSION}-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json prisma7.config.ts ./
COPY prisma ./prisma
RUN npm ci
# npm may skip dependency install scripts that need approval, so generate the Prisma client explicitly.
RUN npx prisma generate

# ---- build: compile the Next.js app ----
FROM deps AS build
COPY . .
RUN npx prisma generate
# Placeholder values for build-time module evaluation only. Real values are supplied at runtime.
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" \
    APP_URL="https://build.invalid" \
    AUTH_SECRET="build-only-placeholder-not-used-at-runtime-0123456789" \
    EMAIL_PROVIDER=console SMS_PROVIDER=console ALLOW_NON_DELIVERING_PROVIDERS=true \
    npm run build

# ---- prod-deps: production dependencies only (plus tsx, which the worker runs) ----
FROM node:${NODE_VERSION}-bookworm-slim AS prod-deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json prisma7.config.ts ./
COPY prisma ./prisma
RUN npm ci --omit=dev \
 \
 && npx prisma generate \
 && npm cache clean --force

# ---- runtime ----
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tini && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app

# Standalone server (server.js and its traced node_modules), static assets and public files.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

# Full production node_modules (Prisma CLI for migrations, tsx for the worker). Overlays identical files.
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules

# Sources the worker and the migration step need at runtime.
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/tsconfig.json ./tsconfig.json
COPY --from=build --chown=node:node /app/prisma7.config.ts ./prisma7.config.ts
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/app/generated ./app/generated
COPY --from=build --chown=node:node /app/lib ./lib
COPY --from=build --chown=node:node /app/scripts ./scripts

# Writable state directories (local uploads when STORAGE_PROVIDER=local, worker state). Mount volumes here.
RUN mkdir -p /app/.data/uploads && chown -R node:node /app/.data

USER node
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
# Default: the web app. The worker and the migration job override this command in docker-compose.prod.yml.
CMD ["node", "server.js"]
