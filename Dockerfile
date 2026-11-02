# Stages: deps -> test (lint, type-check, unit tests) | build -> runtime (nginx).
# Jenkins builds `--target test`, then `--target runtime`.

FROM node:22-alpine AS deps

WORKDIR /app

# husky (the `prepare` script) is only needed for local git hooks
COPY package*.json ./
RUN npm pkg delete scripts.prepare && npm ci

# --- Lint, type check and unit tests ---
FROM deps AS test

COPY . .
RUN npm run lint && npm run type-check && npm run test:run

# --- Build ---
FROM deps AS build

COPY . .
# The API is served from the same origin under /api (nginx below proxies it),
# so no domain is baked into the bundle.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- Production image: static files + /api proxy, unprivileged, port 8080 ---
FROM nginxinc/nginx-unprivileged:alpine AS runtime

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.inc /etc/nginx/security-headers.inc
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
