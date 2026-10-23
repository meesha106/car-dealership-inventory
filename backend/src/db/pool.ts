import { Pool } from "pg";
import { getDatabaseUrl, type DatabaseTarget } from "./database-config.js";

export type { DatabaseTarget } from "./database-config.js";

export function createDatabasePool(target: DatabaseTarget): Pool {
  return new Pool({
    connectionString: getDatabaseUrl(target),
    application_name: `car-dealership-${target}`,
  });
}
