# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: build the game.
#
# Node is only ever present in this stage. The image that actually runs has no
# Node, no npm, no source and no node_modules in it.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS build

WORKDIR /app

# Copy the manifests first so a change to the game does not re-run the install.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src

# `npm run build` type-checks before it bundles, so a type error fails the image.
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: serve it.
#
# Static files and nginx, and nothing else.
# ---------------------------------------------------------------------------
FROM nginx:1.29-alpine AS runtime

LABEL org.opencontainers.image.title="The Peculiar House" \
      org.opencontainers.image.description="An original retro single-screen platform game."

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# Busybox wget is already in the image, so this costs nothing to add.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
