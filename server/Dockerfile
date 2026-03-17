FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json

RUN npm ci

COPY server server

RUN npm run build --workspace @bbtodo/server

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json

RUN npm ci --omit=dev --workspace @bbtodo/server --include-workspace-root=false

COPY --from=builder /app/server/dist server/dist

VOLUME ["/data"]
EXPOSE 3000

CMD ["node", "server/dist/index.js"]
