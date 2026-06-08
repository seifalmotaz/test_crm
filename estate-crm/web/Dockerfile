# ────────────────────────────────────────────
# Estate CRM Web (Vite + React SPA)
# ────────────────────────────────────────────
FROM oven/bun:1-slim AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
ARG VITE_API_URL
RUN bun run build

# ────────────────────────────────────────────
# Runtime: serve static files with nginx
# ────────────────────────────────────────────
FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
