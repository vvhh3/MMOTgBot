FROM node:22-slim AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
RUN npm ci --include=dev
RUN npm run build:prod

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps ./apps
COPY --from=build /app/packages ./packages
COPY --from=build /app/package.json ./package.json
CMD ["node", "apps/server/dist/index.js"]
