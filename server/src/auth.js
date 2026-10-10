import jwt from "jsonwebtoken";
import { pool } from "./db.js";
import { config } from "./config.js";

export const COOKIE_NAME = "shahjee_token";
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), username: user.username, role: user.role },
    config.jwtSecret,
    { expiresIn: "7d" }
  );
}

// Loads the user from the database for every request so that deleted
// accounts stop working immediately (a valid token alone is not enough).
export async function requireAuth(req, res, next) {
  const token = req.cookies ? req.cookies[COOKIE_NAME] : null;
  if (!token) {
    return res.status(401).json({ error: "Authentication required. Please sign in." });
  }
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
  try {
    const { rows } = await pool.query("SELECT id, username, role FROM users WHERE id = $1", [
      payload.sub
    ]);
    if (!rows[0]) {
      return res.status(401).json({ error: "Account not found. Please sign in again." });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

// Role-based authorization: only admins may pass.
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required. Please sign in." });
  }
  if (req.user.role === "admin") return next();
  return res.status(403).json({ error: "Admin access required." });
}

// Session is an httpOnly cookie: JavaScript on the page (and thus XSS-prone
// code) cannot read it, and it is only sent to this site.
export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProd,
    path: "/",
    maxAge: COOKIE_MAX_AGE_MS
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProd,
    path: "/"
  });
}
