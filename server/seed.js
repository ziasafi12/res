import bcrypt from "bcryptjs";
import { checkConnection, pool, runMigrations } from "./src/db.js";
import { flattenMenu } from "./src/seed/menu-data.js";

// Safe, idempotent seeder:
//  - Users: only created when they do not exist yet (existing accounts and
//    their passwords are never touched).
//  - Foods: inserted with ON CONFLICT DO NOTHING, so any foods already in the
//    database are preserved.
// Passwords are stored as bcrypt hashes — never plain text.

try {
  await checkConnection();
  await runMigrations();

  // Login accounts are only seeded when passwords are provided explicitly.
  // Locally the fallbacks below (or server/.env) are fine; in production the
  // defaults are publicly known from this repository, so user seeding is
  // skipped unless SEED_ADMIN_PASSWORD and SEED_CLIENT_PASSWORD are set —
  // the menu still seeds either way. (The service runs this script on boot.)
  const isProd = process.env.NODE_ENV === "production";
  const seedUsers = Boolean(
    !isProd || (process.env.SEED_ADMIN_PASSWORD && process.env.SEED_CLIENT_PASSWORD)
  );
  if (!seedUsers) {
    console.warn(
      "[seed] SEED_ADMIN_PASSWORD / SEED_CLIENT_PASSWORD not set — skipping login accounts.\n" +
        "[seed] The menu is still seeded. Set both environment variables to create users."
    );
  }
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Administrator@24";
  const clientPassword = process.env.SEED_CLIENT_PASSWORD || "client@25";

  if (seedUsers) {
    const adminHash = bcrypt.hashSync(adminPassword, 10);
    const clientHash = bcrypt.hashSync(clientPassword, 10);

    const usersRes = await pool.query(
      `INSERT INTO users (username, password_hash, role)
       VALUES ('admin', $1, 'admin'), ('client', $2, 'client')
       ON CONFLICT (username) DO NOTHING`,
      [adminHash, clientHash]
    );
    console.log(
      `[seed] users: ${usersRes.rowCount} created, ${2 - usersRes.rowCount} already existed (left untouched).`
    );
  }

  const rows = flattenMenu();
  const placeholders = rows
    .map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`)
    .join(", ");
  const values = rows.flatMap((r) => [r.name, r.price, r.description, r.category]);
  const foodsRes = await pool.query(
    `INSERT INTO foods (name, price, description, category)
     VALUES ${placeholders}
     ON CONFLICT (name, category) DO NOTHING`,
    values
  );
  console.log(
    `[seed] foods: ${foodsRes.rowCount} inserted, ${rows.length - foodsRes.rowCount} already existed (left untouched).`
  );
  if (seedUsers) {
    console.log("[seed] Done. Login accounts: admin (admin role) and client (client role).");
  } else {
    console.log(
      "[seed] Done (menu only). Set SEED_ADMIN_PASSWORD and SEED_CLIENT_PASSWORD to create login accounts."
    );
  }
} catch (err) {
  console.error("[seed] Failed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
