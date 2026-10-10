import { checkConnection, pool, runMigrations } from "./src/db.js";

try {
  await checkConnection();
  console.log("[db] Connected to PostgreSQL.");
  await runMigrations();
} catch (err) {
  console.error("[migrate] Failed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
