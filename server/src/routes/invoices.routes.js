import { Router } from "express";
import * as XLSX from "xlsx";
import { pool } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { invoiceInput } from "../validate.js";

const router = Router();

const toInvoice = (r) => ({
  ...r,
  price: Number(r.price),
  total: Number(r.total),
  quantity: Number(r.quantity)
});

// Formats a timestamp as e.g. "09/10/2026, 14:30" (UK style) for exports.
function formatDateTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value ?? "");
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// POST /api/invoices — signed-in client or admin.
// The invoice number, price, total and date all come from the database so
// they can never be forged or duplicated by the client.
router.post("/", requireAuth, async (req, res, next) => {
  const { errors, value } = invoiceInput(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(" ") });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock the food row so the price cannot change mid-invoice.
    const foodRes = await client.query(
      "SELECT id, name, price, availability FROM foods WHERE id = $1 FOR UPDATE",
      [value.foodId]
    );
    const food = foodRes.rows[0];
    if (!food || !food.availability) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Selected food is no longer available." });
    }

    // Atomic, duplicate-proof invoice number from a PostgreSQL sequence.
    const seqRes = await client.query(`SELECT nextval('invoice_num_seq') AS n`);
    const invoiceNumber = `INV-${String(seqRes.rows[0].n).padStart(4, "0")}`;

    const price = Number(food.price);
    const total = Math.round(price * value.quantity * 100) / 100;

    const ins = await client.query(
      `INSERT INTO invoices
         (invoice_number, user_id, customer_name, food_id, food_name, price, quantity, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        invoiceNumber,
        req.user.id,
        value.customerName,
        food.id,
        food.name,
        price,
        value.quantity,
        total
      ]
    );

    await client.query("COMMIT");
    res.status(201).json({ invoice: toInvoice(ins.rows[0]) });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

// GET /api/invoices — signed-in client or admin.
// Admins see all invoices; clients only see their own.
router.get("/", requireAuth, async (req, res, next) => {
  try {
    let query;
    let params;
    if (req.user.role === "admin") {
      query = "SELECT * FROM invoices ORDER BY id DESC LIMIT 500";
      params = [];
    } else {
      query = "SELECT * FROM invoices WHERE user_id = $1 ORDER BY id DESC LIMIT 500";
      params = [req.user.id];
    }
    const { rows } = await pool.query(query, params);
    res.json({ invoices: rows.map(toInvoice) });
  } catch (err) {
    next(err);
  }
});

// GET /api/invoices/export — admin only.
// Returns the COMPLETE invoice list (not the 500-row dashboard page) as a
// proper .xlsx workbook. Registered before "/:id" so "export" is never parsed
// as an invoice id. Only the server touches the database — the browser never
// sees any credentials.
router.get("/export", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.id, i.invoice_number, i.created_at, i.customer_name,
              i.food_name, i.quantity, i.price, i.total,
              u.username AS client_username
         FROM invoices i
         LEFT JOIN users u ON u.id = i.user_id
        ORDER BY i.id ASC`
    );

    const header = [
      "Invoice #",
      "Date",
      "Client",
      "Customer Name",
      "Item",
      "Quantity",
      "Unit Price (£)",
      "Subtotal (£)",
      "Total (£)"
    ];

    const data = rows.map((r) => [
      r.invoice_number,
      formatDateTime(r.created_at),
      r.client_username || "",
      r.customer_name,
      r.food_name,
      Number(r.quantity),
      Number(r.price),
      Math.round(Number(r.price) * Number(r.quantity) * 100) / 100,
      Number(r.total)
    ]);

    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    // Reasonable column widths so the file is readable without manual resizing.
    ws["!cols"] = [
      { wch: 14 }, // Invoice #
      { wch: 18 }, // Date
      { wch: 16 }, // Client
      { wch: 26 }, // Customer Name
      { wch: 30 }, // Item
      { wch: 10 }, // Quantity
      { wch: 14 }, // Unit Price
      { wch: 14 }, // Subtotal
      { wch: 12 } // Total
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoices");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="invoices-${today}.xlsx"`
    );
    res.setHeader("Cache-Control", "no-store");
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// GET /api/invoices/:id — owner or admin only.
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const n = Number(req.params.id);
    if (!Number.isInteger(n) || n <= 0) return res.status(400).json({ error: "Invalid invoice id." });
    const { rows } = await pool.query("SELECT * FROM invoices WHERE id = $1", [n]);
    const invoice = rows[0];
    if (!invoice || (req.user.role !== "admin" && invoice.user_id !== req.user.id)) {
      return res.status(404).json({ error: "Invoice not found." });
    }
    res.json({ invoice: toInvoice(invoice) });
  } catch (err) {
    next(err);
  }
});

export default router;
