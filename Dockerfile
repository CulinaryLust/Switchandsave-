# Produktions-Image für Switchandsave (Next.js + node:sqlite)
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/switchandsave.db \
    NODE_NO_WARNINGS=1
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/next.config.ts ./
RUN mkdir -p /data
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
