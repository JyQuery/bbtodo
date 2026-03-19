import "dotenv/config";

import { SQLITE_DATABASE_PATH, createDatabase } from "./db.js";

const services = createDatabase(SQLITE_DATABASE_PATH);
services.database.close();
