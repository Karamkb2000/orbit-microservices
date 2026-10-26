const express = require("express");
const cors = require("cors");
const { pool, init } = require("./db");
const { connect, publish } = require("./broker");
const { requireAuth } = require("./auth");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok", service: "orders" }));

app.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, items, total, status, created_at FROM orders WHERE user_id = $1 ORDER BY id DESC",
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/", requireAuth, async (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items are required" });
  }
  const total = items.reduce((sum, i) => sum + Number(i.price) * Number(i.qty), 0);
  try {
    const result = await pool.query(
      "INSERT INTO orders (user_id, email, items, total) VALUES ($1,$2,$3,$4) RETURNING id, items, total, status, created_at",
      [req.userId, req.userEmail || null, JSON.stringify(items), total]
    );
    const order = result.rows[0];
    publish("order.created", { orderId: order.id, userId: req.userId, email: req.userEmail, total });
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = Number(process.env.PORT || 4004);
Promise.all([init(), connect()])
  .then(() => app.listen(PORT, () => console.log(`orders listening on ${PORT}`)))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
