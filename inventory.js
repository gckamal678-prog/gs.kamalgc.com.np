
"use strict";

const PRODUCT_KEY = "gs_products";
const $ = id => document.getElementById(id);

function getProducts() {
  try {
    const data = JSON.parse(localStorage.getItem(PRODUCT_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Product data error:", error);
    alert("Product data पढ्न सकिएन। Browser data नहटाउनुहोस्।");
    return [];
  }
}

function saveProducts(products) {
  try {
    localStorage.setItem(PRODUCT_KEY, JSON.stringify(products));
    return true;
  } catch (error) {
    console.error("Product save error:", error);
    alert("Product Save भएन। Browser storage जाँच गर्नुहोस्।");
    return false;
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function money(value) {
  const amount = Number(value) || 0;
  return "Rs. " + amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function stockStatus(product) {
  const stock = Number(product.stock) || 0;
  const minimum = Number(product.minStock) || 0;

  if (stock <= 0) return "out";
  if (stock <= minimum) return "low";
  return "in";
}

function statusLabel(status) {
  const labels = {
    in: "In Stock",
    low: "Low Stock",
    out: "Out of Stock"
  };

  return `<span class="inventory-status ${status}">${labels[status] || labels.out}</span>`;
}

function updateSummary(products) {
  $("totalProducts").textContent = products.length;

  $("inStockProducts").textContent =
    products.filter(product => stockStatus(product) === "in").length;

  $("lowStockProducts").textContent =
    products.filter(product => stockStatus(product) === "low").length;

  const value = products.reduce((total, product) => {
    const stock = Math.max(0, Number(product.stock) || 0);
    const cost = Math.max(0, Number(product.purchasePrice) || 0);
    return total + stock * cost;
  }, 0);

  $("stockValue").textContent = money(value);
}

function renderProducts() {
  const products = getProducts();
  updateSummary(products);

  const search = $("productSearch").value.trim().toLowerCase();
  const category = $("categoryFilter").value;
  const filter = $("stockFilter").value;

  const filtered = products.filter(product => {
    const searchable = [
      product.name,
      product.brand,
      product.category,
      product.size,
      product.unit
    ].join(" ").toLowerCase();

    return searchable.includes(search) &&
      (!category || (product.category || "Other") === category) &&
      (!filter || stockStatus(product) === filter);
  });

  $("productCount").textContent = `${filtered.length} / ${products.length} Products`;

  if (!filtered.length) {
    const message = products.length
      ? "खोजसँग मिल्ने Product भेटिएन।"
      : "Product छैन। + New Product थिचेर पहिलो सामान थप्नुहोस्।";

    $("productTableBody").innerHTML =
      `<tr><td colspan="8" class="inventory-empty">${message}</td></tr>`;
    return;
  }

  $("productTableBody").innerHTML = filtered.map(product => {
    const id = escapeHTML(product.id);
    const name = escapeHTML(product.name || "Unnamed Product");
    const brand = escapeHTML(product.brand || "—");
    const categoryName = escapeHTML(product.category || "Other");
    const unit = escapeHTML(product.unit || "pcs");
    const size = escapeHTML(product.size || "—");
    const stock = Number(product.stock) || 0;

    return `
      <tr>
        <td>
          <div class="inventory-product-name">${name}</div>
          <div class="inventory-subtext">${brand}</div>
        </td>
        <td>${categoryName}</td>
        <td>${unit} / ${size}</td>
        <td>${money(product.purchasePrice)}</td>
        <td>${money(product.salePrice)}</td>
        <td>${stock.toLocaleString("en-IN")} ${unit}</td>
        <td>${statusLabel(stockStatus(product))}</td>
        <td>
          <button type="button" class="inventory-btn view"
            data-view-product="${id}">View</button>
        </td>
      </tr>`;
  }).join("");
}

function openModal(id) {
  const modal = $(id);
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal(id) {
  const modal = $(id);
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

function closeProductModal() {
  closeModal("productModal");
  $("productForm").reset();
}

function addProduct(event) {
  event.preventDefault();

  const name = $("productName").value.trim();
  const brand = $("productBrand").value.trim();
  const purchasePrice = Number($("purchasePrice").value);
  const salePrice = Number($("salePrice").value);
  const minStock = Number($("minStock").value || 0);
  const targetStock = Number($("targetStock").value || 0);

  if (!name) {
    alert("Product Name लेख्नुहोस्।");
    $("productName").focus();
    return;
  }

  if (![purchasePrice, salePrice].every(value =>
    Number.isFinite(value) && value >= 0)) {
    alert("Purchase Price र Sale Price सही रूपमा लेख्नुहोस्।");
    return;
  }

  if (![minStock, targetStock].every(value =>
    Number.isFinite(value) && value >= 0)) {
    alert("Minimum Stock र Target Stock सही रूपमा लेख्नुहोस्।");
    return;
  }

  const products = getProducts();

  const duplicate = products.some(product =>
    String(product.name || "").trim().toLowerCase() === name.toLowerCase() &&
    String(product.brand || "").trim().toLowerCase() === brand.toLowerCase()
  );

  if (duplicate &&
      !confirm("यस्तै नाम र Brand भएको Product पहिले नै छ। फेरि थप्ने?")) {
    return;
  }

  const product = {
    id: "P-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    name,
    category: $("productCategory").value || "Other",
    brand,
    size: $("productSize").value.trim(),
    unit: $("productUnit").value,
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

  closeProductModal();
  renderProducts();

  alert("Product Save भयो। वास्तविक Stock Purchase बाट थप्नुहोस्।");
}

function viewProduct(productId) {
  const product = getProducts().find(item =>
    String(item.id) === String(productId)
  );

  if (!product) {
    alert("Product भेटिएन।");
    renderProducts();
    return;
  }

  const status = stockStatus(product);
  const statusText = {
    in: "In Stock",
    low: "Low Stock",
    out: "Out of Stock"
  }[status];

  const details = [
    ["Product Name", product.name],
    ["Product ID", product.id],
    ["Category", product.category || "Other"],
    ["Brand", product.brand || "—"],
    ["Size / Weight", product.size || "—"],
    ["Unit", product.unit || "pcs"],
    ["Purchase Price", money(product.purchasePrice)],
    ["Sale Price", money(product.salePrice)],
    ["Current Stock", `${Number(product.stock) || 0} ${product.unit || "pcs"}`],
    ["Minimum Stock", product.minStock ?? 0],
    ["Target Stock", product.targetStock ?? 0],
    ["Stock Status", statusText],
    ["Expiry Applicable", product.expiryApplicable ? "Yes" : "No"],
    ["Created At", product.createdAt
      ? new Date(product.createdAt).toLocaleDateString()
      : "—"]
  ];

  $("productViewTitle").textContent = product.name || "Product Details";

  $("productDetails").innerHTML = details.map(([label, value]) => `
    <div class="inventory-detail">
      <span>${escapeHTML(label)}</span>
      <strong>${escapeHTML(value)}</strong>
    </div>
  `).join("");

  openModal("productViewModal");
}

function setupInventory() {
  $("addProductBtn").addEventListener("click", openProductModal);
  $("closeProductModal").addEventListener("click", closeProductModal);
  $("cancelProductBtn").addEventListener("click", closeProductModal);
  $("productForm").addEventListener("submit", addProduct);

  $("productSearch").addEventListener("input", renderProducts);
  $("categoryFilter").addEventListener("change", renderProducts);
  $("stockFilter").addEventListener("change", renderProducts);

  $("closeProductView").addEventListener("click", () =>
    closeModal("productViewModal")
  );

  $("closeProductViewBtn").addEventListener("click", () =>
    closeModal("productViewModal")
  );

  $("productTableBody").addEventListener("click", event => {
    const button = event.target.closest("[data-view-product]");
    if (button) {
      viewProduct(button.getAttribute("data-view-product"));
    }
  });

  ["productModal", "productViewModal"].forEach(id => {
    $(id).addEventListener("click", event => {
      if (event.target !== $(id)) return;

      if (id === "productModal") {
        closeProductModal();
      } else {
        closeModal("productViewModal");
      }
    });
  });

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    closeProductModal();
    closeModal("productViewModal");
  });

  renderProducts();
}

document.addEventListener("DOMContentLoaded", setupInventory);
