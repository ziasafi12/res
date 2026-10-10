import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load the environment file next to the backend regardless of whether the
// command is run from the repository root or from server/.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    console.error(`[config] Missing required environment variable: ${name}`);
    console.error("[config] Copy server/.env.example to server/.env and fill in the values.");
    process.exit(1);
  }
  return value.trim();
}

export const config = {
  databaseUrl: requireEnv("DATABASE_URL"),
  jwtSecret: requireEnv("JWT_SECRET"),
  port: Number(process.env.PORT || 4000),
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  isProd: process.env.NODE_ENV === "production"
};
