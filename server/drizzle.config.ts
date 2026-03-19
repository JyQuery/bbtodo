import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db.ts",
  dbCredentials: {
    url: "./dev.sqlite"
  },
  out: "./drizzle",
  strict: true,
  verbose: true
});
