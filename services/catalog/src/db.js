const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.PGHOST || "catalog-db",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || "orbit",
  password: process.env.PGPASSWORD || "orbit",
  database: process.env.PGDATABASE || "catalog",
});

const SEED = [
  ["Aurora Headphones", "Wireless over-ear with active noise cancelling", 199.0, "https://picsum.photos/seed/aurora/600/400", 40],
  ["Nimbus Keyboard", "Low-profile mechanical keyboard, hot-swappable", 129.0, "https://picsum.photos/seed/nimbus/600/400", 60],
  ["Vertex Mouse", "Ergonomic wireless mouse, 8 buttons", 69.0, "https://picsum.photos/seed/vertex/600/400", 120],
  ["Lumen Monitor", "27-inch 4K USB-C display", 429.0, "https://picsum.photos/seed/lumen/600/400", 25],
  ["Pulse Webcam", "1080p webcam with privacy shutter", 59.0, "https://picsum.photos/seed/pulse/600/400", 80],
  ["Cobalt Dock", "11-in-1 USB-C docking station", 149.0, "https://picsum.photos/seed/cobalt/600/400", 35],
];

async function init() {
  for (let i = 0; i < 30; i++) {
    try {
      await pool.query(
        "CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, price NUMERIC(10,2) NOT NULL, image_url TEXT, stock INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now())"
      );
      const existing = await pool.query("SELECT COUNT(*)::int AS n FROM products");
      if (existing.rows[0].n === 0) {
        for (const p of SEED) {
          await pool.query(
            "INSERT INTO products (name, description, price, image_url, stock) VALUES ($1,$2,$3,$4,$5)",
            p
          );
        }
      }
      return;
    } catch (err) {
      console.log("catalog waiting for db:", err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error("catalog db not reachable");
}

module.exports = { pool, init };
