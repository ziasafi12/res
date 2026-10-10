import { Router } from "express";
import { pool } from "../db.js";
import { requireAdmin, requireAuth } from "../auth.js";
import { foodInput } from "../validate.js";

const router = Router();

const toFood = (r) => ({ ...r, price: Number(r.price), availability: !!r.availability });

function validId(id) {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// GET /api/foods — public, so the menu page can render without a login.
router.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM foods ORDER BY category, name, id");
    res.json({ foods: rows.map(toFood) });
  } catch (err) {
    next(err);
  }
});

// GET /api/foods/:id — public.
router.get("/:id", async (req, res, next) => {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid food id." });
    const { rows } = await pool.query("SELECT * FROM foods WHERE id = $1", [id]);
    if (!rows[0]) return res.status(404).json({ error: "Food not found." });
    res.json({ food: toFood(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// POST /api/foods — admin only.
router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { errors, value } = foodInput(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(" ") });
    const { rows } = await pool.query(
      `INSERT INTO foods (name, description, price, category, image, availability)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [value.name, value.description, value.price, value.category, value.image, value.availability]
    );
    res.status(201).json({ food: toFood(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/foods/:id — admin only.
router.put("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid food id." });
    const { errors, value } = foodInput(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(" ") });
    const { rows } = await pool.query(
      `UPDATE foods
       SET name = $1, description = $2, price = $3, category = $4, image = $5, availability = $6
       WHERE id = $7
       RETURNING *`,
      [value.name, value.description, value.price, value.category, value.image, value.availability, id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Food not found." });
    res.json({ food: toFood(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/foods/:id — admin only.
router.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid food id." });
    const result = await pool.query("DELETE FROM foods WHERE id = $1", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Food not found." });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
