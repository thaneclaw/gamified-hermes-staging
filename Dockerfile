# syntax=docker/dockerfile:1.7
#
# Two-stage build: compile the Vite client bundle, then drop into a
# slim Node runtime that serves the bundle + Socket.IO out of one
# process. The TS server runs via tsx at boot (same entry point as
# dev), which keeps this Dockerfile close to how we develop locally.

# ── build stage ─────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Install deps deterministically. Copying lockfile separately gives
# Docker a cacheable layer when only source changes.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the repo (minus what .dockerignore excludes) and
# run the production Vite build. The build also runs tsc on the client
# via the root `build` script.
COPY . .
RUN npm run build

# ── runtime stage ───────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
# Serve the Vite build from the Socket.IO server (see server/index.ts).
ENV SERVE_STATIC=1
# Persist producer-authored settings + overlay layout on a mounted
# volume. fly.toml mounts the app's volume at /data.
ENV DATA_DIR=/data
# Fly.io defaults to listening on :8080 for the internal port we map
# to :80/:443. Match that so we don't have to override PORT in fly.toml.
ENV PORT=8080

# tsx is a devDependency; we need it at runtime because the server
# still executes TypeScript directly. Copy node_modules from the
# build stage so we don't re-install.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/package.json ./package.json

EXPOSE 8080

# Guarantee /data exists even if the volume is a fresh mount. The
# app will create the files inside on first write.
RUN mkdir -p /data

CMD ["npx", "tsx", "--env-file-if-exists=.env", "server/index.ts"]
