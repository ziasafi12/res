import { createApp } from "./app.js";
import { config } from "./config.js";
import { checkConnection, pool, runMigrations } from "./db.js";

async function main() {
  try {
    await checkConnection();
    console.log("[db] Connected to PostgreSQL.");
    // Migrations are idempotent and non-destructive, so it is safe to run
    // them on every start (a new DB gets its tables; an existing one keeps
    // its data).
    await runMigrations();
  } catch (err) {
    console.error("[db] Cannot connect to PostgreSQL:", err.message);
    console.error("[db] Check DATABASE_URL in server/.env and make sure PostgreSQL is running.");
    process.exit(1);
  }

  const app = createApp();
  // Render (and most PaaS) injects the port to listen on via $PORT and routes
  // traffic to 0.0.0.0 — binding only to localhost would make the service
  // unreachable. Locally $PORT is usually unset, so config.port (server/.env
  // PORT or 4000, matching the Vite dev proxy) is used instead.
  const PORT = process.env.PORT || config.port;
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[api] Server running on port ${PORT} (bound to 0.0.0.0)`);
  });

  const shutdown = async () => {
    server.close();
    await pool.end().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
