import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { getConfig } from "@/lib/config";

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: getConfig().databaseUrl });
  }
  return _pool;
}

export const db = drizzle(getPool(), { schema });
export { schema };
