const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool, init } = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

const SECRET = process.env.JWT_SECRET || "dev-secret";

function sign(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, SECRET, {
    expiresIn: "12h",
  });
}

app.get("/health", (req, res) => res.json({ status: "ok", service: "auth" }));

app.post("/register", async (req, res) => {
  const { email, name, password } = req.body || {};
  if (!email || !name || !password) {
    return res.status(400).json({ error: "email, name and password are required" });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name, role",
      [email, name, hash]
    );
    const user = result.rows[0];
    res.status(201).json({ token: sign(user), user });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "email already registered" });
    res.status(500).json({ error: err.message });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password || "", user.password_hash))) {
      return res.status(401).json({ error: "invalid credentials" });
    }
    const safe = { id: user.id, email: user.email, name: user.name, role: user.role };
    res.json({ token: sign(safe), user: safe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/me", async (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing token" });
  try {
    const claims = jwt.verify(token, SECRET);
    const result = await pool.query("SELECT id, email, name, role FROM users WHERE id = $1", [claims.sub]);
    if (!result.rows[0]) return res.status(404).json({ error: "not found" });
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(401).json({ error: "invalid token" });
  }
});

const PORT = Number(process.env.PORT || 4001);
init()
  .then(() => app.listen(PORT, () => console.log(`auth listening on ${PORT}`)))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
