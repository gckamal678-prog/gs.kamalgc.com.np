
"use strict";

const PRODUCT_KEY = "gs_products";

const $ = (id) => document.getElementById(id);

function getProducts() {
  try {
    const data = JSON.parse(localStorage.getItem(PRODUCT_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Product data पढ्न समस्या:", error);
    alert("Product data पढ्न सकिएन। कृपया ब्राउजरको डेटा नहटाउनुहोस्।");
    return [];
  }
}

function saveProducts(products) {
  try {
    localStorage.setItem(PRODUCT_KEY, JSON.stringify(products));
    return true;
  } catch (error) {
    console.error("Product data Save गर्न समस्या:", error);
    alert("Product Save भएन। Browser storage उपलब्ध छ कि जाँच गर्नुहोस्।");
    return false;
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function money(value) {
  const number = Number(value) || 0;
  return "रु " + number.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function getStockStatus(product) {
  const stock = Number(product.stock) || 0;
  const minStock = Number(product.minStock) || 0;

  if (stock <= 0) return "out";
  if (stock <= minStock) return "low";
  return "in";
}

function statusHTML(status) {
  const statuses = {
    in: ["status-in", "Stock उपलब्ध"],
    low: ["status-low", "Low Stock"],
    out: ["status-out", "Out of Stock"]
  };

  const item = statuses[status] || statuses.out;
  return `<span class="status ${item[0]}">${item[1]}</span>`;
}

function updateSummary(products) {
  const total = products.length;
  const inStock = products.filter(p => getStockStatus(p) === "in").length;
  const lowStock = products.filter(p => getStockStatus(p) === "low").length;

  const stockValue = products.reduce((sum, product) => {
    const stock = Math.max(0, Number(product.stock) || 0);
    const cost = Math.max(0, Number(product.purchasePrice) || 0);
    return sum + stock * cost;
  }, 0);

  $("totalProducts").textContent = total;
  $("inStockProducts").textContent = inStock;
  $("lowStockProducts").textContent = lowStock;
  $("stockValue").textContent = money(stockValue);
}

function getSearchTerm() {
  return ($("productSearch").value || $("inventorySearch").value || "")
    .trim()
    .toLowerCase();
}

function renderProducts() {
  const products = getProducts();
  updateSummary(products);

  const search = getSearchTerm();
  const category = $("categoryFilter").value;
  const stockFilter = $("stockFilter").value;

  const filtered = products.filter(product => {
    const searchable = [
      product.name,
      product.brand,
      product.category,
      product.size,
      product.unit
    ].join(" ").toLowerCase();

    const matchesSearch = searchable.includes(search);
    const matchesCategory = !category || (product.category || "Other") === category;
    const matchesStock = !stockFilter || getStockStatus(product) === stockFilter;

    return matchesSearch && matchesCategory && matchesStock;
  });

  $("productCount").textContent =
    `${filtered.length} / ${products.length} Products`;

  const tbody = $("productTableBody");

  if (!filtered.length) {
    const message = products.length
      ? "खोजसँग मिल्ने Product भेटिएन।"
      : "अहिलेसम्म Product थपिएको छैन। “＋ नयाँ Product” थिचेर सुरु गर्नुहोस्।";

    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">${message}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(product => {
    const id = escapeHTML(product.id);
    const name = escapeHTML(product.name || "नाम छैन");
    const brand = escapeHTML(product.brand || "Brand छैन");
    const categoryName = escapeHTML(product.category || "Other");
    const unit = escapeHTML(product.unit || "pcs");
    const size = escapeHTML(product.size || "—");
    const purchasePrice = money(product.purchasePrice);
    const salePrice = money(product.salePrice);
    const stock = Number(product.stock) || 0;
    const status = getStockStatus(product);

    return `
      <tr>
        <td>
          <div class="product-name">${name}</div>
          <div class="product-sub">${brand}</div>
        </td>
        <td>${categoryName}</td>
        <td>${unit} / ${size}</td>
        <td>${purchasePrice}</td>
        <td>${salePrice}</td>
        <td><strong>${stock.toLocaleString("en-IN")} ${unit}</strong></td>
        <td>${statusHTML(status)}</td>
        <td><button class="action-btn" type="button" data-view-product="${id}">विवरण हेर्नुहोस्</button></td>
      </tr>`;
  }).join("");
}

function openModal(id) {
  const modal = $(id);
  if (!modal) return;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal(id) {
  const modal = $(id);
  if (!modal) return;

  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");

  if (!$("productModal").classList.contains("show") &&
      !$("productViewModal").classList.contains("show")) {
    document.body.style.overflow = "";
  }
}

function openProductModal() {
  $("productForm").reset();
  $("productCategory").value = "Grocery";
  $("productUnit").value = "pcs";
  $("minStock").value = "5";
  $("targetStock").value = "20";
  openModal("productModal");
  setTimeout(() => $("productName").focus(), 50);
}

function closeProductModalFunc() {
  closeModal("productModal");
  $("productForm").reset();
}

function addProduct(event) {
  event.preventDefault();

  const name = $("productName").value.trim();
  const unit = $("productUnit").value;
  const purchasePrice = Number($("purchasePrice").value);
  const salePrice = Number($("salePrice").value);
  const minStock = Number($("minStock").value || 0);
  const targetStock = Number($("targetStock").value || 0);

  if (!name) {
    alert("Product Name लेख्नुहोस्।");
    $("productName").focus();
    return;
  }

  if (
    !Number.isFinite(purchasePrice) || purchasePrice < 0 ||
    !Number.isFinite(salePrice) || salePrice < 0
  ) {
    alert("Purchase Price र Sale Price सही रूपमा लेख्नुहोस्।");
    return;
  }

  if (
    !Number.isFinite(minStock) || minStock < 0 ||
    !Number.isFinite(targetStock) || targetStock < 0
  ) {
    alert("Minimum Stock र Target Stock शून्य वा त्यसभन्दा बढी हुनुपर्छ।");
    return;
  }

  const products = getProducts();

  const duplicate = products.some(product =>
    String(product.name || "").trim().toLowerCase() === name.toLowerCase() &&
    String(product.brand || "").trim().toLowerCase() ===
      $("productBrand").value.trim().toLowerCase()
  );

  if (duplicate && !confirm("यस्तै नाम र Brand भएको Product पहिले नै छ। फेरि थप्ने?")) {
    return;
  }

  const product = {
    id: "P-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    name,
    category: $("productCategory").value || "Other",
    brand: $("productBrand").value.trim(),
    size: $("productSize").value.trim(),
    unit,
    purchasePrice,
    salePrice,
    minStock,
    targetStock,
    expiryApplicable: $("expiryApplicable").checked,
    stock: 0,
    active: true,
    createdAt: new Date().toISOString()
  };

  products.push(product);

  if (!saveProducts(products)) return;

  closeProductModalFunc();
  renderProducts();
  alert("Product सफलतापूर्वक Save भयो। अब Purchase बाट Stock थप्न सक्नुहुन्छ।");
}

function viewProduct(productId) {
  const product = getProducts().find(item => String(item.id) === String(productId));

  if (!product) {
    alert("यो Product भेटिएन।");
    renderProducts();
    return;
  }

  const details = [
    ["Product Name", product.name],
    ["Product ID", product.id],
    ["Category", product.category || "Other"],
    ["Brand", product.brand || "—"],
    ["Size", product.size || "—"],
    ["Unit", product.unit || "pcs"],
    ["Purchase Price", money(product.purchasePrice)],
    ["Sale Price", money(product.salePrice)],
    ["Current Stock", `${Number(product.stock) || 0} ${product.unit || "pcs"}`],
    ["Minimum Stock", product.minStock ?? 0],
    ["Target Stock", product.targetStock ?? 0],
    ["Stock Status", getStockStatus(product) === "in"
      ? "Stock उपलब्ध"
      : getStockStatus(product) === "low"
        ? "Low Stock"
        : "Out of Stock"],
    ["Expiry Applicable", product.expiryApplicable ? "हो" : "होइन"],
    ["Created At", product.createdAt
      ? new Date(product.createdAt).toLocaleDateString()
      : "—"]
  ];

  $("productViewTitle").textContent = product.name || "Product Details";

  $("productDetails").innerHTML = details.map(([label, value]) => `
    <div class="detail-item">
      <div class="detail-label">${escapeHTML(label)}</div>
      <div class="detail-value">${escapeHTML(value)}</div>
    </div>
  `).join("");

  openModal("productViewModal");
}

function setupSearch() {
  $("productSearch").addEventListener("input", () => {
    $("inventorySearch").value = $("productSearch").value;
    renderProducts();
  });

  $("inventorySearch").addEventListener("input", () => {
    $("productSearch").value = $("inventorySearch").value;
    renderProducts();
  });
}

function setupFilters() {
  $("categoryFilter").addEventListener("change", renderProducts);
  $("stockFilter").addEventListener("change", renderProducts);
}

function setupModal() {
  $("addProductBtn").addEventListener("click", openProductModal);
  $("closeProductModal").addEventListener("click", closeProductModalFunc);
  $("cancelProductBtn").addEventListener("click", closeProductModalFunc);
  $("productForm").addEventListener("submit", addProduct);

  $("closeProductView").addEventListener("click", () => closeModal("productViewModal"));
  $("closeProductViewBtn").addEventListener("click", () => closeModal("productViewModal"));

  $("productTableBody").addEventListener("click", event => {
    const button = event.target.closest("[data-view-product]");
    if (button) viewProduct(button.getAttribute("data-view-product"));
  });

  ["productModal", "productViewModal"].forEach(id => {
    $(id).addEventListener("click", event => {
      if (event.target === $(id)) {
        if (id === "productModal") closeProductModalFunc();
        else closeModal(id);
      }
    });
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeProductModalFunc();
      closeModal("productViewModal");
    }
  });
}

function setupMobileSidebar() {
  const sidebar = $("inventorySidebar");
  const menuButton = $("inventoryMenuBtn");
  const overlay = $("inventoryMobileOverlay");

  function closeSidebar() {
    sidebar.classList.remove("open");
    overlay.style.display = "none";
  }

  menuButton.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("open");
    overlay.style.display = isOpen ? "block" : "none";
  });

  overlay.addEventListener("click", closeSidebar);

  sidebar.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", closeSidebar);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupSearch();
  setupFilters();
  setupModal();
  setupMobileSidebar();
  renderProducts();

  console.log("Inventory Module ready.");
});
