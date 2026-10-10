import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config.js";
import { pool } from "./db.js";
import authRoutes from "./routes/auth.routes.js";
import foodRoutes from "./routes/foods.routes.js";
import invoiceRoutes from "./routes/invoices.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Built frontend (Vite output) at the repository root. Served by this server
// in production (e.g. Render) so one service delivers both the SPA and the API.
const distDir = path.resolve(__dirname, "..", "..", "dist");

export function createApp() {
  const app = express();
  app.disable("x-powered-by");

  // In production the app sits behind a proxy/load balancer (e.g. Render's
  // router), so req.ip is taken from X-Forwarded-For instead of the proxy's
  // IP — without this, every visitor would share one rate-limit bucket.
  if (config.isProd) app.set("trust proxy", 1);

  // CORS: only explicitly allowed origins (and same-origin requests, which
  // carry no Origin header in dev when Vite proxies /api to this server).
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type"]
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "100kb" }));

  // Health check (used by scripts and for verifying the DB connection).
  app.get("/api/health", async (req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ ok: true, db: "up" });
    } catch {
      res.status(503).json({ ok: false, db: "down" });
    }
  });

  app.use("/api", authRoutes);
  app.use("/api/foods", foodRoutes);
  app.use("/api/invoices", invoiceRoutes);

  // Unknown /api routes.
  app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

  // --- Static frontend (production, e.g. Render) --------------------------------
  // In dev, Vite serves the UI on :5173 and proxies /api here; in production the
  // built SPA in dist/ is served from this same origin, so no CORS setup or
  // VITE_API_BASE is needed. Skipped when dist/ has not been built yet.
  const indexHtml = path.join(distDir, "index.html");
  if (fs.existsSync(indexHtml)) {
    app.use(
      express.static(distDir, {
        setHeaders(res, filePath) {
          if (filePath.endsWith("index.html")) {
            // Always revalidate the entry point so new deploys show up at once.
            res.setHeader("Cache-Control", "no-cache");
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            // Vite fingerprints these filenames — safe to cache forever.
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          } else {
            res.setHeader("Cache-Control", "public, max-age=3600");
          }
        }
      })
    );

    // SPA fallback: any non-API GET/HEAD (react-router BrowserRouter routes like
    // /menu or /contact) returns index.html so deep links and refreshes work.
    app.use((req, res, next) => {
      if ((req.method === "GET" || req.method === "HEAD") && !req.path.startsWith("/api")) {
        res.setHeader("Cache-Control", "no-cache");
        return res.sendFile(indexHtml);
      }
      return next();
    });
  }

  // Central error handler — never leaks internal details to the client.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err && (err.type === "entity.parse.failed" || err instanceof SyntaxError)) {
      return res.status(400).json({ error: "Invalid JSON body." });
    }
    if (err && err.code === "23505") {
      return res.status(409).json({ error: "A food with this name already exists in this category." });
    }
    if (err && err.code === "23503") {
      return res.status(400).json({ error: "Invalid reference." });
    }
    console.error("[api] Unhandled error:", err);
    res.status(500).json({ error: "Something went wrong on our side. Please try again." });
  });

  return app;
}
