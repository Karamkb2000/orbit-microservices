const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.PGHOST || "auth-db",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || "orbit",
  password: process.env.PGPASSWORD || "orbit",
  database: process.env.PGDATABASE || "auth",
});

async function init() {
  for (let i = 0; i < 30; i++) {
    try {
      await pool.query(
        "CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer', created_at TIMESTAMPTZ NOT NULL DEFAULT now())"
      );
      return;
    } catch (err) {
      console.log("auth waiting for db:", err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error("auth db not reachable");
}

module.exports = { pool, init };
