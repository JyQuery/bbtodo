FROM mcr.microsoft.com/playwright:v1.58.2-noble

WORKDIR /app/e2e

COPY e2e/package.json e2e/package-lock.json ./

RUN npm ci

COPY e2e/playwright.config.ts ./playwright.config.ts
COPY e2e/tests ./tests

CMD ["npm", "test"]
