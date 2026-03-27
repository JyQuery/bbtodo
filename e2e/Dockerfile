FROM node:24.14.1-bookworm-slim

WORKDIR /app/e2e

COPY e2e/package.json e2e/package-lock.json ./

RUN npm ci
RUN npx playwright install --with-deps chromium

COPY e2e/playwright.config.ts ./playwright.config.ts
COPY e2e/tests ./tests

CMD ["npm", "test"]
