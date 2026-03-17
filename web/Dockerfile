FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json

RUN npm ci

COPY web web

RUN npm run build --workspace @bbtodo/web

FROM nginx:1.29-alpine AS runner

COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/web/dist /usr/share/nginx/html

EXPOSE 80
