import { sql } from "drizzle-orm";
import { db } from "@/db";

export interface ClaimedJob {
  id: string;
  type: string;
  payload: any;
  attempts: number;
}

const MAX_ATTEMPTS = 3;

export async function enqueue(type: string, payload: unknown): Promise<void> {
  await db.execute(
    sql`INSERT INTO jobs (type, payload) VALUES (${type}, ${JSON.stringify(payload)}::jsonb)`,
  );
}

/** Atomically claim the next queued job (FOR UPDATE SKIP LOCKED). */
export async function claimNext(): Promise<ClaimedJob | null> {
  const res = await db.execute(sql`
    UPDATE jobs SET status = 'running', updated_at = now()
    WHERE id = (
      SELECT id FROM jobs WHERE status = 'queued'
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, type, payload, attempts
  `);
  const row = (res as any).rows?.[0];
  if (!row) return null;
  return { id: row.id, type: row.type, payload: row.payload, attempts: row.attempts };
}

export async function completeJob(id: string): Promise<void> {
  await db.execute(sql`UPDATE jobs SET status = 'done', updated_at = now() WHERE id = ${id}`);
}

export async function failJob(id: string, attempts: number, error: string): Promise<void> {
  const nextStatus = attempts + 1 >= MAX_ATTEMPTS ? "error" : "queued";
  await db.execute(sql`
    UPDATE jobs
    SET status = ${nextStatus}, attempts = ${attempts + 1}, last_error = ${error}, updated_at = now()
    WHERE id = ${id}
  `);
}
