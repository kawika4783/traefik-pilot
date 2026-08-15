FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --filter @pilot/api... --frozen-lockfile=false
COPY apps/api apps/api
RUN pnpm --filter @pilot/api build
FROM node:22-alpine
RUN addgroup -S pilot && adduser -S pilot -G pilot
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/src/db/migrations ./dist/db/migrations
USER pilot
EXPOSE 4000
CMD ["node","dist/index.js"]
