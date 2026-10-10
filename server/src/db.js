import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { config } from "./config.js";

// Single connection pool shared by the whole app.
// All SQL uses parameterized queries ($1, $2, ...) to prevent SQL injection.

// Render's *external* Postgres URLs append ?sslmode=require (the internal URL
// provided by render.yaml's fromDatabase has no sslmode and is used as-is).
// Two problems with passing that straight to pg:
//   1. values parsed from the connection string override an explicit `ssl`
//      option (pg/lib/connection-parameters.js), and
//   2. pg then verifies the server certificate against the system CA store —
//      effectively sslmode=verify-full — which fails against Render's
//      certificates ("self signed certificate in certificate chain").
// libpq's sslmode=require only means "encrypt, don't verify", so the param is
// stripped here and the equivalent ssl option is passed explicitly.
// Stricter modes (verify-ca / verify-full) are left untouched.
function buildPoolConfig(connectionString) {
  if (!/[?&]sslmode=/.test(connectionString)) return { connectionString };
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    return { connectionString };
  }
  const mode = url.searchParams.get("sslmode");
  if (mode !== "require" && mode !== "prefer") return { connectionString };
  url.searchParams.delete("sslmode");
  return { connectionString: url.toString(), ssl: { rejectUnauthorized: false } };
}

export const pool = new pg.Pool({
  ...buildPoolConfig(config.databaseUrl),
  max: 10,
  idleTimeoutMillis: 30_000
});

pool.on("error", (err) => {
  console.error("[db] Unexpected error on idle client:", err.message);
});

export async function checkConnection() {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1 AS ok");
  } finally {
    client.release();
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "..", "migrations");

// Applies pending .sql migrations in order. Each migration runs in a
// transaction and is recorded in `schema_migrations` so it only runs once.
// Migrations are idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS) and
// never drop or modify existing data.
export async function runMigrations({ verbose = true } = {}) {
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const applied = new Set(
      (await client.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name)
    );
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of files) {
      if (applied.has(file)) {
        if (verbose) console.log(`[migrate] skip ${file} (already applied)`);
        continue;
      }
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      if (verbose) console.log(`[migrate] applying ${file} ...`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
    if (verbose) console.log("[migrate] All migrations applied.");
  } finally {
    client.release();
  }
}
