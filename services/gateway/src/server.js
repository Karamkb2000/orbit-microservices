const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
app.use(cors());
app.use(morgan("dev"));

const routes = {
  "/api/auth": process.env.AUTH_URL || "http://auth:4001",
  "/api/catalog": process.env.CATALOG_URL || "http://catalog:4002",
  "/api/cart": process.env.CART_URL || "http://cart:4003",
  "/api/orders": process.env.ORDERS_URL || "http://orders:4004",
};

app.get("/health", (req, res) => res.json({ status: "ok", service: "gateway" }));

for (const [path, target] of Object.entries(routes)) {
  app.use(
    path,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: { [`^${path}`]: "" },
    })
  );
}

const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () => console.log(`gateway listening on ${PORT}`));
