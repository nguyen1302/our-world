import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import { getConfig } from "@/lib/config";

export async function seed() {
  const config = getConfig();
  const pool = new Pool({ connectionString: config.databaseUrl });
  const db = drizzle(pool, { schema });

  // Default space (fixed id so all rows share it in v1).
  await db.execute(sql`
    INSERT INTO spaces (id, name) VALUES (${config.defaultSpaceId}, 'We Were Here')
    ON CONFLICT (id) DO NOTHING
  `);

  for (const u of config.users) {
    await db.execute(sql`
      INSERT INTO users (space_id, username, password_hash, role)
      VALUES (${config.defaultSpaceId}, ${u.username}, ${u.passwordHash}, ${u.role})
      ON CONFLICT (username) DO UPDATE
        SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
    `);
  }

  console.log(`Seeded space + ${config.users.length} user(s).`);
  await pool.end();
}

if (require.main === module) {
  seed().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
