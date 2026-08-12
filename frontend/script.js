// script.js
// Connects the Farmer's Buddy frontend to the backend API at localhost:5000.
const API = "https://farmers-buddy.onrender.com/api";

// Keep track of login state in the browser's localStorage so it survives a page refresh
let token = localStorage.getItem("token");
let userName = localStorage.getItem("userName");

// ---------- ELEMENT REFERENCES ----------
const productGrid = document.getElementById("productGrid");
const sectionTitle = document.getElementById("sectionTitle");
const cartCount = document.getElementById("cartCount");

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userNameSpan = document.getElementById("userName");
const cartBtn = document.getElementById("cartBtn");

const authModal = document.getElementById("authModal");
const cartModal = document.getElementById("cartModal");
const orderConfirmModal = document.getElementById("orderConfirmModal");
const ordersModal = document.getElementById("ordersModal");
const ordersBtn = document.getElementById("ordersBtn");
const placeOrderBtn = document.getElementById("placeOrderBtn");

// ---------- INIT ----------
updateHeaderForLoginState();
loadProducts();

// ---------- CATEGORY FILTER ----------
document.querySelectorAll(".cat-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".cat-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const category = btn.dataset.category;
    sectionTitle.textContent = category ? category : "All Products";
    loadProducts(category);
  });
});

// ---------- LOAD PRODUCTS ----------
async function loadProducts(category = "") {
  const url = category ? `${API}/products?category=${encodeURIComponent(category)}` : `${API}/products`;
  const res = await fetch(url);
  const products = await res.json();

  productGrid.innerHTML = "";
  products.forEach((product) => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <div class="product-emoji">${product.image}</div>
      <div class="product-name">${product.name}</div>
      <div class="product-category">${product.category}</div>
      <div class="product-price">₹${product.price}</div>
      <div class="product-buttons">
        <button class="add-to-cart-btn" data-id="${product.id}">Add to Cart</button>
        <button class="buy-now-btn" data-id="${product.id}">Buy Now</button>
      </div>
    `;
    productGrid.appendChild(card);
  });

  // Wire up "Add to Cart" buttons
  document.querySelectorAll(".add-to-cart-btn").forEach((btn) => {
    btn.addEventListener("click", () => addToCart(Number(btn.dataset.id)));
  });

  // Wire up "Buy Now" buttons
  document.querySelectorAll(".buy-now-btn").forEach((btn) => {
    btn.addEventListener("click", () => buyNow(Number(btn.dataset.id)));
  });
}

// ---------- AUTH: MODAL OPEN/CLOSE ----------
loginBtn.addEventListener("click", () => authModal.classList.remove("hidden"));
cartBtn.addEventListener("click", openCart);
ordersBtn.addEventListener("click", openOrders);
placeOrderBtn.addEventListener("click", placeOrder);

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.getElementById(btn.dataset.close).classList.add("hidden");
  });
});

// ---------- AUTH: TAB SWITCHING ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".auth-form").forEach((f) => f.classList.add("hidden"));
    document.getElementById(btn.dataset.tab).classList.remove("hidden");
  });
});

// ---------- REGISTER ----------
document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("registerName").value;
  const email = document.getElementById("registerEmail").value;
  const password = document.getElementById("registerPassword").value;
  const messageEl = document.getElementById("registerMessage");

  const res = await fetch(`${API}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password })
  });
  const data = await res.json();

  if (!res.ok) {
    messageEl.textContent = data.error;
    return;
  }

  loginSuccess(data.token, data.name);
});

// ---------- LOGIN ----------
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  const messageEl = document.getElementById("loginMessage");

  const res = await fetch(`${API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();

  if (!res.ok) {
    messageEl.textContent = data.error;
    return;
  }

  loginSuccess(data.token, data.name);
});

function loginSuccess(newToken, name) {
  token = newToken;
  userName = name;
  localStorage.setItem("token", token);
  localStorage.setItem("userName", userName);
  authModal.classList.add("hidden");
  updateHeaderForLoginState();
}

// ---------- LOGOUT ----------
logoutBtn.addEventListener("click", () => {
  token = null;
  userName = null;
  localStorage.removeItem("token");
  localStorage.removeItem("userName");
  updateHeaderForLoginState();
});

function updateHeaderForLoginState() {
  if (token) {
    loginBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
    userNameSpan.classList.remove("hidden");
    userNameSpan.textContent = `Hi, ${userName}`;
  } else {
    loginBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
    userNameSpan.classList.add("hidden");
  }
}

// ---------- CART ----------
async function addToCart(productId) {
  if (!token) {
    alert("Please log in first.");
    authModal.classList.remove("hidden");
    return;
  }

  await fetch(`${API}/cart`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ productId, quantity: 1 })
  });

  refreshCartCount();
}

// Buy a single product instantly, skipping the cart entirely
async function buyNow(productId) {
  if (!token) {
    alert("Please log in first.");
    authModal.classList.remove("hidden");
    return;
  }

  const res = await fetch(`${API}/orders/buy-now`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ product_id: productId, quantity: 1 })
  });
  const data = await res.json();

  if (!res.ok) {
    alert(data.error);
    return;
  }

  document.getElementById("orderConfirmText").textContent =
    `Order #${data.order.id} placed successfully — total ₹${data.order.total}.`;
  orderConfirmModal.classList.remove("hidden");
}

async function openCart() {
  if (!token) {
    alert("Please log in first.");
    authModal.classList.remove("hidden");
    return;
  }

  const res = await fetch(`${API}/cart`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();

  const cartItemsEl = document.getElementById("cartItems");
  cartItemsEl.innerHTML = "";

  if (data.items.length === 0) {
    cartItemsEl.innerHTML = `<p class="empty-message">Your cart is empty.</p>`;
  } else {
    data.items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "cart-item";
      row.innerHTML = `
        <div class="cart-item-info">
          ${item.product.image} ${item.product.name} × ${item.quantity} — ₹${item.product.price * item.quantity}
        </div>
        <button class="cart-item-remove" data-id="${item.id}">Remove</button>
      `;
      cartItemsEl.appendChild(row);
    });
  }

  document.getElementById("cartTotal").textContent = data.total;

  document.querySelectorAll(".cart-item-remove").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await fetch(`${API}/cart/${btn.dataset.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      openCart(); // refresh the list
      refreshCartCount();
    });
  });

  cartModal.classList.remove("hidden");
}

async function refreshCartCount() {
  if (!token) return;
  const res = await fetch(`${API}/cart`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  cartCount.textContent = data.items.reduce((sum, item) => sum + item.quantity, 0);
}

if (token) refreshCartCount();

// ---------- PLACE ORDER ----------
async function placeOrder() {
  if (!token) {
    alert("Please log in first.");
    authModal.classList.remove("hidden");
    return;
  }

  const messageEl = document.getElementById("orderMessage");
  messageEl.textContent = "";
  placeOrderBtn.disabled = true;
  placeOrderBtn.textContent = "Placing order...";

  try {
    const res = await fetch(`${API}/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (!res.ok) {
      messageEl.textContent = data.error;
      return;
    }

    // Show confirmation
    const itemCount = data.order.items.reduce((sum, i) => sum + i.quantity, 0);
    document.getElementById("orderConfirmText").textContent =
      `Order #${data.order.id} placed successfully — ${itemCount} item(s), total ₹${data.order.total}.`;

    cartModal.classList.add("hidden");
    orderConfirmModal.classList.remove("hidden");

    refreshCartCount();
  } finally {
    placeOrderBtn.disabled = false;
    placeOrderBtn.textContent = "Place Order";
  }
}

// ---------- MY ORDERS ----------
async function openOrders() {
  if (!token) {
    alert("Please log in first.");
    authModal.classList.remove("hidden");
    return;
  }

  const res = await fetch(`${API}/orders`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const ordersData = await res.json();

  const ordersListEl = document.getElementById("ordersList");
  ordersListEl.innerHTML = "";

  if (ordersData.length === 0) {
    ordersListEl.innerHTML = `<p class="empty-message">You haven't placed any orders yet.</p>`;
  } else {
    // Show most recent orders first
    [...ordersData].reverse().forEach((order) => {
      const itemsText = order.items
        .map((i) => `${i.name} × ${i.quantity}`)
        .join(", ");
      const placedDate = new Date(order.placedAt).toLocaleString();

      const card = document.createElement("div");
      card.className = "order-card";
      card.innerHTML = `
        <div class="order-card-header">
          <span>Order #${order.id}</span>
          <span>${placedDate}</span>
        </div>
        <div class="order-card-items">${itemsText}</div>
        <div class="order-card-total">Total: ₹${order.total}</div>
      `;
      ordersListEl.appendChild(card);
    });
  }

  ordersModal.classList.remove("hidden");
}
