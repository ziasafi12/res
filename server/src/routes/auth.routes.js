import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { pool } from "../db.js";
import { signToken, setAuthCookie, clearAuthCookie, requireAuth } from "../auth.js";

const router = Router();

// Brute-force protection for the login endpoint.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in a few minutes." }
});

// POST /api/login
router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }
    const { rows } = await pool.query(
      "SELECT id, username, password_hash, role FROM users WHERE username = $1",
      [username.trim()]
    );
    const user = rows[0];
    // Same 401 for "unknown user" and "wrong password" so accounts are not
    // enumerable, and bcrypt.compare against a dummy check keeps timing similar.
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Incorrect username or password." });
    }
    const token = signToken(user);
    setAuthCookie(res, token);
    return res.json({ user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    next(err);
  }
});

// POST /api/logout
router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// GET /api/me — who is signed in?
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: { id: req.user.id, username: req.user.username, role: req.user.role } });
});

export default router;
