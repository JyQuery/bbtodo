import "dotenv/config";

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const SERVER_HOST = "0.0.0.0";
const SERVER_PORT = 3000;

const config = loadConfig();
const clientDistPath = process.env.BBTODO_CLIENT_DIST?.trim() || undefined;
const app = buildApp({ config, clientDistPath });

app.listen({ host: SERVER_HOST, port: SERVER_PORT }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
