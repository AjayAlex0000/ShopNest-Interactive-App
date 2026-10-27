"use strict";

const CART_STORAGE_KEY = "shopnest-cart";
const CATEGORIES = new Set(["Electronics", "Clothing", "Footwear", "Books"]);
const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const state = {
  products: [],
  selectedCategory: "All",
  searchQuery: "",
  cart: [],
};

const elements = {
  cartCount: document.querySelector("#cart-count"),
  cartHeadingCount: document.querySelector("#cart-heading-count"),
  cartItems: document.querySelector("#cart-items"),
  cartPanel: document.querySelector("#cart-panel"),
  cartToggle: document.querySelector("#cart-toggle"),
  cartTotal: document.querySelector("#cart-total"),
  checkoutButton: document.querySelector("#checkout-button"),
  emptyCart: document.querySelector("#empty-cart"),
  errorState: document.querySelector("#error-state"),
  loadingState: document.querySelector("#loading-state"),
  noResults: document.querySelector("#no-results"),
  productGrid: document.querySelector("#product-grid"),
  productSearch: document.querySelector("#product-search"),
  resultCount: document.querySelector("#result-count"),
  retryButton: document.querySelector("#retry-button"),
  storageNotice: document.querySelector("#storage-notice"),
};

function formatCurrency(amount) {
  return currencyFormatter.format(amount);
}

function isValidProduct(product) {
  return (
    product !== null &&
    typeof product === "object" &&
    (typeof product.id === "string" || typeof product.id === "number") &&
    String(product.id).trim().length > 0 &&
    typeof product.name === "string" &&
    product.name.trim().length > 0 &&
    CATEGORIES.has(product.category) &&
    Number.isFinite(product.price) &&
    product.price >= 0 &&
    Number.isFinite(product.originalPrice) &&
    product.originalPrice >= product.price &&
    Number.isFinite(product.rating) &&
    product.rating >= 1 &&
    product.rating <= 5 &&
    typeof product.imageUrl === "string" &&
    product.imageUrl.trim().length > 0
  );
}

function validateProducts(products) {
  if (
    !Array.isArray(products) ||
    products.length === 0 ||
    !products.every(isValidProduct)
  ) {
    throw new Error("The product catalogue is not valid.");
  }

  const productIds = products.map((product) => String(product.id));
  if (new Set(productIds).size !== productIds.length) {
    throw new Error("The product catalogue contains duplicate IDs.");
  }

  return products;
}

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createProductCard(product) {
  const card = createElement("article", "product-card");
  const imageWrap = createElement("div", "product-image-wrap");
  const image = createElement("img", "product-image");
  image.src = product.imageUrl;
  image.alt = product.name;
  image.loading = "lazy";
  image.addEventListener(
    "error",
    () => {
      image.hidden = true;
      imageWrap.append(
        createElement("span", "image-fallback", "Image unavailable"),
      );
    },
    { once: true },
  );

  const category = createElement("span", "product-category", product.category);
  imageWrap.append(image, category);

  const info = createElement("div", "product-info");
  const rating = createElement(
    "p",
    "product-rating",
    `${product.rating.toFixed(1)} / 5 rating`,
  );
  const name = createElement("h3", "product-name", product.name);
  const priceRow = createElement("div", "product-price-row");
  const price = createElement(
    "span",
    "product-price",
    formatCurrency(product.price),
  );
  const originalPrice = createElement(
    "del",
    "original-price",
    formatCurrency(product.originalPrice),
  );
  originalPrice.hidden = product.originalPrice <= product.price;
  priceRow.append(price, originalPrice);

  const addButton = createElement("button", "add-button");
  addButton.type = "button";
  addButton.dataset.action = "add";
  addButton.dataset.productId = String(product.id);
  addButton.setAttribute("aria-label", `Add ${product.name} to cart`);
  addButton.append(
    createElement("span", "", "Add to bag"),
    createElement("span", "", "+"),
  );
  info.append(rating, name, priceRow, addButton);
  card.append(imageWrap, info);
  return card;
}

function renderProducts(productsToRender) {
  const cards = productsToRender.map(createProductCard);
  elements.productGrid.replaceChildren(...cards);
  elements.productGrid.setAttribute("aria-busy", "false");
}

function getFilteredProducts() {
  const query = state.searchQuery.trim().toLocaleLowerCase();
  return state.products.filter((product) => {
    const matchesCategory =
      state.selectedCategory === "All" ||
      product.category === state.selectedCategory;
    const matchesSearch = product.name.toLocaleLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });
}

function updateProductView() {
  const filteredProducts = getFilteredProducts();
  renderProducts(filteredProducts);
  elements.noResults.hidden = filteredProducts.length > 0;
  elements.resultCount.textContent = `${filteredProducts.length} ${filteredProducts.length === 1 ? "item" : "items"}`;
}

function getProduct(productId) {
  return state.products.find(
    (product) => String(product.id) === String(productId),
  );
}

function getCartUnitCount() {
  return state.cart.reduce((sum, item) => sum + item.quantity, 0);
}

function getCartTotal() {
  return state.cart.reduce((sum, item) => {
    const product = getProduct(item.productId);
    return product ? sum + product.price * item.quantity : sum;
  }, 0);
}

function updateCartSummary() {
  const unitCount = getCartUnitCount();
  elements.cartCount.textContent = String(unitCount);
  elements.cartCount.setAttribute(
    "aria-label",
    `${unitCount} ${unitCount === 1 ? "item" : "items"} in cart`,
  );
  elements.cartHeadingCount.textContent = `(${unitCount})`;
  elements.cartTotal.textContent = formatCurrency(getCartTotal());
  elements.checkoutButton.disabled = state.cart.length === 0;
  elements.emptyCart.hidden = state.cart.length > 0;
}

function createCartItem(item) {
  const product = getProduct(item.productId);
  if (!product) return null;

  const row = createElement("article", "cart-item");
  row.dataset.productId = String(product.id);
  const main = createElement("div", "cart-item-main");
  main.append(
    createElement("span", "cart-item-name", product.name),
    createElement(
      "span",
      "cart-item-unit",
      `${formatCurrency(product.price)} each`,
    ),
  );
  const subtotal = createElement(
    "span",
    "cart-item-subtotal",
    formatCurrency(product.price * item.quantity),
  );
  const controls = createElement("div", "cart-item-controls");
  const quantityControl = createElement("div", "quantity-control");

  const decreaseButton = createElement("button", "quantity-button", "−");
  decreaseButton.type = "button";
  decreaseButton.dataset.action = "decrease";
  decreaseButton.dataset.productId = String(product.id);
  decreaseButton.setAttribute(
    "aria-label",
    `Decrease ${product.name} quantity`,
  );

  const quantity = createElement(
    "span",
    "quantity-value",
    String(item.quantity),
  );
  quantity.setAttribute("aria-label", `Quantity: ${item.quantity}`);

  const increaseButton = createElement("button", "quantity-button", "+");
  increaseButton.type = "button";
  increaseButton.dataset.action = "increase";
  increaseButton.dataset.productId = String(product.id);
  increaseButton.setAttribute(
    "aria-label",
    `Increase ${product.name} quantity`,
  );
  quantityControl.append(decreaseButton, quantity, increaseButton);

  const removeButton = createElement("button", "remove-button", "Remove");
  removeButton.type = "button";
  removeButton.dataset.action = "remove";
  removeButton.dataset.productId = String(product.id);
  removeButton.setAttribute("aria-label", `Remove ${product.name} from cart`);
  controls.append(quantityControl, removeButton);
  row.append(main, subtotal, controls);
  return row;
}

function renderCart() {
  const cartItems = state.cart.map(createCartItem).filter(Boolean);
  elements.cartItems.replaceChildren(...cartItems);
  updateCartSummary();
}

function saveCart() {
  try {
    const savedItems = state.cart.map(({ productId, quantity }) => ({
      productId,
      quantity,
    }));
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(savedItems));
    elements.storageNotice.hidden = true;
  } catch {
    elements.storageNotice.textContent =
      "Your bag is available for this visit, but couldn't be saved on this device.";
    elements.storageNotice.hidden = false;
  }
}

function restoreCart() {
  state.cart = [];
  try {
    const savedValue = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!savedValue) return;

    const savedItems = JSON.parse(savedValue);
    if (!Array.isArray(savedItems)) return;

    const restoredItems = new Map();
    savedItems.forEach((item) => {
      if (
        !item ||
        (typeof item.productId !== "string" &&
          typeof item.productId !== "number")
      )
        return;
      if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) return;
      const product = getProduct(item.productId);
      if (!product) return;
      const productId = String(product.id);
      restoredItems.set(
        productId,
        (restoredItems.get(productId) || 0) + item.quantity,
      );
    });

    state.cart = Array.from(restoredItems, ([productId, quantity]) => ({
      productId,
      quantity,
    }));
  } catch {
    state.cart = [];
  }
}

function addToCart(productId) {
  const product = getProduct(productId);
  if (!product) return;

  const existingItem = state.cart.find(
    (item) => String(item.productId) === String(product.id),
  );
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    state.cart.push({ productId: String(product.id), quantity: 1 });
  }
  saveCart();
  renderCart();
}

function changeQuantity(productId, delta) {
  const item = state.cart.find(
    (cartItem) => String(cartItem.productId) === String(productId),
  );
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    state.cart = state.cart.filter(
      (cartItem) => String(cartItem.productId) !== String(productId),
    );
  }
  saveCart();
  renderCart();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter(
    (item) => String(item.productId) !== String(productId),
  );
  saveCart();
  renderCart();
}

async function loadProducts() {
  elements.loadingState.hidden = false;
  elements.errorState.hidden = true;
  elements.noResults.hidden = true;
  elements.resultCount.textContent = "";
  elements.productGrid.replaceChildren();
  elements.productGrid.setAttribute("aria-busy", "true");

  try {
    const response = await fetch("data/products.json");
    if (!response.ok) {
      throw new Error(`Product request failed with status ${response.status}.`);
    }

    state.products = validateProducts(await response.json());
    restoreCart();
    updateProductView();
    renderCart();
    elements.loadingState.hidden = true;
  } catch {
    elements.loadingState.hidden = true;
    elements.errorState.hidden = false;
    elements.productGrid.setAttribute("aria-busy", "false");
    elements.resultCount.textContent = "";
    renderCart();
  }
}

function updateActiveCategory(category) {
  state.selectedCategory = category;
  document.querySelectorAll(".filter-button").forEach((button) => {
    const isActive = button.dataset.category === category;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  updateProductView();
}

function handleCartToggle() {
  if (window.matchMedia("(max-width: 720px)").matches) {
    const isOpen = elements.cartPanel.classList.toggle("is-open");
    elements.cartToggle.setAttribute("aria-expanded", String(isOpen));
    if (isOpen)
      elements.cartPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  elements.cartPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function initialize() {
  elements.productSearch.addEventListener("input", (event) => {
    state.searchQuery = event.currentTarget.value;
    updateProductView();
  });

  document
    .querySelector(".category-filters")
    .addEventListener("click", (event) => {
      const button = event.target.closest("button[data-category]");
      if (button) updateActiveCategory(button.dataset.category);
    });

  elements.productGrid.addEventListener("click", (event) => {
    const button = event.target.closest('button[data-action="add"]');
    if (button) addToCart(button.dataset.productId);
  });

  elements.cartItems.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    if (button.dataset.action === "increase")
      changeQuantity(button.dataset.productId, 1);
    if (button.dataset.action === "decrease")
      changeQuantity(button.dataset.productId, -1);
    if (button.dataset.action === "remove")
      removeFromCart(button.dataset.productId);
  });

  elements.retryButton.addEventListener("click", loadProducts);
  elements.cartToggle.addEventListener("click", handleCartToggle);
  loadProducts();
}

document.addEventListener("DOMContentLoaded", initialize, { once: true });
