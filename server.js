// server.js
// Farmer's Buddy backend - NO DATABASE.
// All data (users, products, carts) is stored in plain JavaScript arrays
// in memory. This means data resets every time you restart the server -
// that's expected and fine for a college project demo.

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

const SECRET = "farmers_buddy_secret_key";

// ---------- IN-MEMORY "DATABASE" ----------

let users = [];        // { id, name, email, password }
let nextUserId = 1;

let cart = [];          // { id, userId, productId, quantity }
let nextCartId = 1;

let orders = [];        // { id, userId, items, total, placedAt }
let nextOrderId = 1;

const products = [
  // Seeds
  { id: 1, name: "Tomato Seeds", category: "Seeds", price: 199, image: "🍅" },
  { id: 2, name: "Wheat Seeds", category: "Seeds", price: 899, image: "🌾" },
  { id: 3, name: "Rice Seeds (Basmati)", category: "Seeds", price: 749, image: "🌾" },
  { id: 4, name: "Chilli Seeds", category: "Seeds", price: 149, image: "🌶️" },
  { id: 5, name: "Onion Seeds", category: "Seeds", price: 179, image: "🧅" },
  { id: 6, name: "Cotton Seeds (BT)", category: "Seeds", price: 899, image: "☁️" },

  // Fertilizers
  { id: 7, name: "NPK Fertilizer 25kg", category: "Fertilizers", price: 1299, image: "🧪" },
  { id: 8, name: "Vermicompost 10kg", category: "Fertilizers", price: 449, image: "🪱" },
  { id: 9, name: "Urea 45kg Bag", category: "Fertilizers", price: 599, image: "🧴" },
  { id: 10, name: "DAP Fertilizer 50kg", category: "Fertilizers", price: 1499, image: "🌿" },
  { id: 11, name: "Organic Bio Compost 5kg", category: "Fertilizers", price: 299, image: "🍂" },

  // Equipment
  { id: 12, name: "Backpack Sprayer", category: "Equipment", price: 999, image: "🎒" },
  { id: 13, name: "Mini Power Tiller", category: "Equipment", price: 42999, image: "🚜" },
  { id: 14, name: "Hand Weeder Tool", category: "Equipment", price: 249, image: "🛠️" },
  { id: 15, name: "Sickle (Farming Knife)", category: "Equipment", price: 149, image: "🔪" },
  { id: 16, name: "Wheelbarrow", category: "Equipment", price: 2499, image: "🛒" },
  { id: 17, name: "Solar Powered Insect Trap", category: "Equipment", price: 3499, image: "💡" },

  // Irrigation
  { id: 18, name: "Drip Irrigation Kit", category: "Irrigation", price: 5999, image: "💧" },
  { id: 19, name: "Submersible Water Pump", category: "Irrigation", price: 5499, image: "⚙️" },
  { id: 20, name: "Sprinkler System Set", category: "Irrigation", price: 2999, image: "🌦️" },
  { id: 21, name: "Garden Hose Pipe (50m)", category: "Irrigation", price: 899, image: "🚿" }
];

// ---------- HELPERS ----------

function hashPassword(password, email) {
  return crypto.createHash("sha256").update(password + email).digest("hex");
}

function checkLogin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Please log in first." });

  try {
    req.userId = jwt.verify(authHeader.split(" ")[1], SECRET).id;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired login." });
  }
}

// ---------- AUTH ----------

app.post("/api/register", (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email and password are required." });
  }
  if (users.find((u) => u.email === email)) {
    return res.status(400).json({ error: "Email already registered." });
  }

  const user = { id: nextUserId++, name, email, password: hashPassword(password, email) };
  users.push(user);

  const token = jwt.sign({ id: user.id }, SECRET);
  res.json({ message: "Account created!", token, name: user.name });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const user = users.find((u) => u.email === email);

  if (!user || user.password !== hashPassword(password, email)) {
    return res.status(401).json({ error: "Wrong email or password." });
  }

  const token = jwt.sign({ id: user.id }, SECRET);
  res.json({ message: "Logged in!", token, name: user.name });
});

// ---------- PRODUCTS ----------

app.get("/api/products", (req, res) => {
  const { category } = req.query;
  const result = category ? products.filter((p) => p.category === category) : products;
  res.json(result);
});

app.get("/api/products/:id", (req, res) => {
  const product = products.find((p) => p.id === Number(req.params.id));
  if (!product) return res.status(404).json({ error: "Product not found." });
  res.json(product);
});

// ---------- CART (must be logged in) ----------

app.get("/api/cart", checkLogin, (req, res) => {
  const items = cart
    .filter((c) => c.userId === req.userId)
    .map((c) => ({ ...c, product: products.find((p) => p.id === c.productId) }));

  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  res.json({ items, total });
});

app.post("/api/cart", checkLogin, (req, res) => {
  const { productId, quantity } = req.body;

  const existing = cart.find((c) => c.userId === req.userId && c.productId === productId);
  if (existing) {
    existing.quantity += quantity || 1;
  } else {
    cart.push({ id: nextCartId++, userId: req.userId, productId, quantity: quantity || 1 });
  }

  res.json({ message: "Added to cart!" });
});

app.delete("/api/cart/:id", checkLogin, (req, res) => {
  cart = cart.filter((c) => !(c.id === Number(req.params.id) && c.userId === req.userId));
  res.json({ message: "Removed from cart." });
});

// ---------- ORDERS (must be logged in) ----------

// Place an order using everything currently in the cart.
// This "checks out": it snapshots the cart into an order, then empties the cart.
app.post("/api/orders", checkLogin, (req, res) => {
  const myCartItems = cart
    .filter((c) => c.userId === req.userId)
    .map((c) => ({ ...c, product: products.find((p) => p.id === c.productId) }));

  if (myCartItems.length === 0) {
    return res.status(400).json({ error: "Your cart is empty." });
  }

  const total = myCartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const order = {
    id: nextOrderId++,
    userId: req.userId,
    items: myCartItems.map((item) => ({
      productId: item.productId,
      name: item.product.name,
      price: item.product.price,
      quantity: item.quantity
    })),
    total,
    placedAt: new Date().toISOString()
  };

  orders.push(order);

  // Empty the cart now that the order has been placed
  cart = cart.filter((c) => c.userId !== req.userId);

  res.status(201).json({ message: "Order placed successfully!", order });
});

// Buy a single product right now, skipping the cart entirely.
app.post("/api/orders/buy-now", checkLogin, (req, res) => {
  const { product_id, quantity = 1 } = req.body;

  const product = products.find((p) => p.id === product_id);
  if (!product) return res.status(404).json({ error: "Product not found." });
  if (quantity < 1) return res.status(400).json({ error: "quantity must be at least 1." });

  const order = {
    id: nextOrderId++,
    userId: req.userId,
    items: [
      {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity
      }
    ],
    total: product.price * quantity,
    placedAt: new Date().toISOString()
  };

  orders.push(order);

  res.status(201).json({ message: "Order placed successfully!", order });
});

// View my past orders
app.get("/api/orders", checkLogin, (req, res) => {
  const myOrders = orders.filter((o) => o.userId === req.userId);
  res.json(myOrders);
});

// ---------- START SERVER ----------
app.listen(5000, () => {
  console.log("Farmer's Buddy API running on http://localhost:5000");
});