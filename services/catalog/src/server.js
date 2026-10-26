const express = require("express");
const cors = require("cors");
const { pool, init } = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok", service: "catalog" }));

app.get("/products", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM products ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/products/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: "not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/products", async (req, res) => {
  const { name, description, price, image_url, stock } = req.body || {};
  if (!name || !description || price == null) {
    return res.status(400).json({ error: "name, description and price are required" });
  }
  try {
    const result = await pool.query(
      "INSERT INTO products (name, description, price, image_url, stock) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [name, description, price, image_url || null, stock || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = Number(process.env.PORT || 4002);
init()
  .then(() => app.listen(PORT, () => console.log(`catalog listening on ${PORT}`)))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
