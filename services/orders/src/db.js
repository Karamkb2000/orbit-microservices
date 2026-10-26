const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.PGHOST || "orders-db",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || "orbit",
  password: process.env.PGPASSWORD || "orbit",
  database: process.env.PGDATABASE || "orders",
});

async function init() {
  for (let i = 0; i < 30; i++) {
    try {
      await pool.query(
        "CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, email TEXT, items JSONB NOT NULL, total NUMERIC(10,2) NOT NULL, status TEXT NOT NULL DEFAULT 'created', created_at TIMESTAMPTZ NOT NULL DEFAULT now())"
      );
      return;
    } catch (err) {
      console.log("orders waiting for db:", err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error("orders db not reachable");
}

module.exports = { pool, init };
