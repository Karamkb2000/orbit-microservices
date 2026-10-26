const API = "/api";
let token = localStorage.getItem("orbit_token") || null;
let user = JSON.parse(localStorage.getItem("orbit_user") || "null");
let authMode = "login";

const $ = (id) => document.getElementById(id);
const productsEl = $("products");
const cartItemsEl = $("cart-items");
const cartCountEl = $("cart-count");
const cartTotalEl = $("cart-total");
const userAreaEl = $("user-area");
const toastsEl = $("toasts");

function toast(message, kind) {
  const el = document.createElement("div");
  el.className = "toast " + (kind || "");
  el.textContent = message;
  toastsEl.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .25s, transform .25s";
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    setTimeout(() => el.remove(), 250);
  }, 2600);
}

function authHeaders() {
  return token ? { Authorization: "Bearer " + token } : {};
}

function money(n) {
  return "$" + Number(n).toFixed(2);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderUser() {
  if (user) {
    userAreaEl.innerHTML =
      '<span class="user-chip">Hi, ' + escapeHtml(user.name.split(" ")[0]) + '</span>' +
      '<button class="btn btn-ghost" id="logout-btn">Sign out</button>';
    $("logout-btn").onclick = logout;
  } else {
    userAreaEl.innerHTML = '<button class="btn" id="signin-btn">Sign in</button>';
    $("signin-btn").onclick = () => openAuth("login");
  }
}

async function loadProducts() {
  productsEl.innerHTML = Array.from({ length: 6 })
    .map(() => '<div class="skeleton"><div class="sk-img"></div><div class="sk-line" style="width:60%"></div><div class="sk-line" style="width:85%"></div></div>')
    .join("");
  try {
    const res = await fetch(API + "/catalog/products");
    const items = await res.json();
    productsEl.innerHTML = items
      .map(
        (p) =>
          '<div class="card">' +
          '<img class="card-img" src="' + escapeHtml(p.image_url || "") + '" alt="" loading="lazy" />' +
          '<div class="card-body">' +
          '<div class="card-name">' + escapeHtml(p.name) + "</div>" +
          '<div class="card-desc">' + escapeHtml(p.description) + "</div>" +
          '<div class="card-foot">' +
          '<span class="card-price">' + money(p.price) + "</span>" +
          '<button class="add-btn" data-id="' + p.id + '" data-name="' + escapeHtml(p.name) + '" data-price="' + p.price + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Add</button>' +
          "</div>" +
          '<div class="stock">' + p.stock + " in stock</div>" +
          "</div></div>"
      )
      .join("");
    document.querySelectorAll(".add-btn").forEach((b) => {
      b.onclick = () => addToCart({ productId: Number(b.dataset.id), name: b.dataset.name, price: Number(b.dataset.price) });
    });
  } catch (err) {
    productsEl.innerHTML = '<p style="color:var(--muted)">Could not load products.</p>';
  }
}

async function addToCart(item) {
  if (!token) {
    openAuth("login");
    toast("Sign in to add items.", "err");
    return;
  }
  try {
    const res = await fetch(API + "/cart/items", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ ...item, qty: 1 }),
    });
    if (!res.ok) throw new Error("failed");
    const cart = await res.json();
    renderCart(cart);
    toast("Added to cart", "ok");
  } catch (err) {
    toast("Could not add to cart.", "err");
  }
}

function renderCart(cart) {
  const items = (cart && cart.items) || [];
  const count = items.reduce((s, i) => s + i.qty, 0);
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  cartCountEl.textContent = count;
  cartTotalEl.textContent = money(total);
  if (!items.length) {
    cartItemsEl.innerHTML = '<div class="cart-empty">Your cart is empty.</div>';
    return;
  }
  cartItemsEl.innerHTML = items
    .map(
      (i) =>
        '<div class="cart-item">' +
        '<div class="ci-info"><div class="ci-name">' + escapeHtml(i.name) + "</div>" +
        '<div class="ci-meta">' + i.qty + " × " + money(i.price) + "</div></div>" +
        '<span>' + money(i.price * i.qty) + "</span>" +
        '<button class="ci-remove" data-id="' + i.productId + '">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button>' +
        "</div>"
    )
    .join("");
  cartItemsEl.querySelectorAll(".ci-remove").forEach((b) => {
    b.onclick = () => removeFromCart(b.dataset.id);
  });
}

async function loadCart() {
  if (!token) return renderCart({ items: [] });
  try {
    const res = await fetch(API + "/cart", { headers: authHeaders() });
    renderCart(await res.json());
  } catch (err) {
    renderCart({ items: [] });
  }
}

async function removeFromCart(productId) {
  try {
    const res = await fetch(API + "/cart/items/" + productId, { method: "DELETE", headers: authHeaders() });
    renderCart(await res.json());
  } catch (err) {
    toast("Could not remove item.", "err");
  }
}

async function checkout() {
  try {
    const cartRes = await fetch(API + "/cart", { headers: authHeaders() });
    const cart = await cartRes.json();
    if (!cart.items || !cart.items.length) return toast("Your cart is empty.", "err");
    const res = await fetch(API + "/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ items: cart.items }),
    });
    if (!res.ok) throw new Error("failed");
    const order = await res.json();
    await fetch(API + "/cart/clear", { method: "POST", headers: authHeaders() });
    renderCart({ items: [] });
    closeCart();
    toast("Order #" + order.id + " placed! Total " + money(order.total), "ok");
  } catch (err) {
    toast("Checkout failed.", "err");
  }
}

function openCart() { $("cart-drawer").classList.add("open"); $("overlay").classList.add("show"); loadCart(); }
function closeCart() { $("cart-drawer").classList.remove("open"); $("overlay").classList.remove("show"); }

function openAuth(mode) {
  authMode = mode;
  $("auth-title").textContent = mode === "login" ? "Sign in" : "Create account";
  $("auth-submit").textContent = mode === "login" ? "Sign in" : "Create account";
  $("auth-name").style.display = mode === "login" ? "none" : "block";
  $("auth-switch-text").textContent = mode === "login" ? "New here?" : "Already have an account?";
  $("auth-switch").textContent = mode === "login" ? "Create an account" : "Sign in";
  $("auth-error").textContent = "";
  $("auth-modal").classList.add("open");
}
function closeAuth() { $("auth-modal").classList.remove("open"); }

async function submitAuth(e) {
  e.preventDefault();
  const name = $("auth-name").value.trim();
  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  const path = authMode === "login" ? "/auth/login" : "/auth/register";
  const body = authMode === "login" ? { email, password } : { name, email, password };
  try {
    const res = await fetch(API + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "failed");
    token = data.token;
    user = data.user;
    localStorage.setItem("orbit_token", token);
    localStorage.setItem("orbit_user", JSON.stringify(user));
    closeAuth();
    renderUser();
    loadCart();
    toast("Welcome, " + user.name.split(" ")[0] + "!", "ok");
  } catch (err) {
    $("auth-error").textContent = err.message;
  }
}

function logout() {
  token = null;
  user = null;
  localStorage.removeItem("orbit_token");
  localStorage.removeItem("orbit_user");
  renderUser();
  renderCart({ items: [] });
  toast("Signed out.", "ok");
}

$("cart-btn").onclick = openCart;
$("cart-close").onclick = closeCart;
$("overlay").onclick = closeCart;
$("checkout").onclick = checkout;
$("auth-close").onclick = closeAuth;
$("auth-form").onsubmit = submitAuth;
$("auth-switch").onclick = (e) => { e.preventDefault(); openAuth(authMode === "login" ? "register" : "login"); };

renderUser();
loadProducts();
loadCart();
