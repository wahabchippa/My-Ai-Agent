import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Fallback DB URL so the app always connects (even if .env is stripped by the
// platform at runtime). Vercel/production overrides via DATABASE_URL env var.
const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

function makePool(): Pool | null {
  if (!databaseUrl) return null;
  return (
    globalForDb.__arenaNextJsPostgresqlPool ??
    (globalForDb.__arenaNextJsPostgresqlPool = new Pool({
      connectionString: databaseUrl,
    }))
  );
}

export const pool = makePool();

if (pool && process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = pool ? drizzle(pool) : null;
