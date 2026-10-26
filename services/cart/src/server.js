const express = require("express");
const cors = require("cors");
const { createClient } = require("redis");
const { requireAuth } = require("./auth");

const app = express();
app.use(cors());
app.use(express.json());

const redis = createClient({ url: process.env.REDIS_URL || "redis://cart-cache:6379" });
redis.on("error", (err) => console.error("redis error", err.message));

const key = (userId) => `cart:${userId}`;

app.get("/health", (req, res) => res.json({ status: "ok", service: "cart" }));

app.get("/", requireAuth, async (req, res) => {
  try {
    const raw = await redis.get(key(req.userId));
    res.json(raw ? JSON.parse(raw) : { items: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/items", requireAuth, async (req, res) => {
  const { productId, name, price, qty } = req.body || {};
  if (!productId || price == null) {
    return res.status(400).json({ error: "productId and price are required" });
  }
  try {
    const raw = await redis.get(key(req.userId));
    const cart = raw ? JSON.parse(raw) : { items: [] };
    const found = cart.items.find((i) => i.productId === productId);
    if (found) {
      found.qty += Number(qty || 1);
    } else {
      cart.items.push({ productId, name, price: Number(price), qty: Number(qty || 1) });
    }
    await redis.set(key(req.userId), JSON.stringify(cart));
    res.status(201).json(cart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/items/:productId", requireAuth, async (req, res) => {
  try {
    const raw = await redis.get(key(req.userId));
    const cart = raw ? JSON.parse(raw) : { items: [] };
    cart.items = cart.items.filter((i) => String(i.productId) !== String(req.params.productId));
    await redis.set(key(req.userId), JSON.stringify(cart));
    res.json(cart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/clear", requireAuth, async (req, res) => {
  try {
    await redis.del(key(req.userId));
    res.json({ items: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = Number(process.env.PORT || 4003);
redis
  .connect()
  .then(() => app.listen(PORT, () => console.log(`cart listening on ${PORT}`)))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
