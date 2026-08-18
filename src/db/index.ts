import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Vercel/production me DATABASE_URL env se aati hai.
// 🔒 Deploy fix: production me DATABASE_URL na ho to localhost fallback
// mat do — warna har query ECONNREFUSED 500 degi. Ab db = null hota hai
// aur app keyless/guest mode me graceful chalti hai (har jagah `if (!db)`
// check hai). Local dev me fallback theek hai.
const databaseUrl =
  process.env.DATABASE_URL ||
  (process.env.NODE_ENV === "production" ? "" : "postgresql://postgres:postgres@127.0.0.1:5432/app_db");

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
