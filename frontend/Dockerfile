# ---------- Stage 1: build the Vite app ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# VITE_ variables are baked into the JS bundle at build time.
# Dokploy passes these in from "Build-time Arguments" (Environment tab).
ARG VITE_API_URL
ARG VITE_API_BASE_URL
ARG VITE_ENABLE_SOCKET
ARG VITE_GOCAR_THANK_YOU_URL
ARG VITE_SENTRY_DSN
ARG VITE_SENTRY_ENVIRONMENT
ENV VITE_API_URL=$VITE_API_URL \
    VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_ENABLE_SOCKET=$VITE_ENABLE_SOCKET \
    VITE_GOCAR_THANK_YOU_URL=$VITE_GOCAR_THANK_YOU_URL \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    VITE_SENTRY_ENVIRONMENT=$VITE_SENTRY_ENVIRONMENT

RUN npm run build

# ---------- Stage 2: serve the static files with nginx ----------
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
