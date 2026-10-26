const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "dev-secret";

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing token" });
  try {
    const claims = jwt.verify(token, SECRET);
    req.userId = String(claims.sub);
    req.userEmail = claims.email;
    next();
  } catch (err) {
    res.status(401).json({ error: "invalid token" });
  }
}

module.exports = { requireAuth };
