
"use strict";

(function () {
  const KEY = "gs_products";
  const $ = id => document.getElementById(id);

  function getProducts() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || "[]");
      if (!Array.isArray(data)) throw new Error("Product data format मिलेन");
      return data;
    } catch (error) {
      console.error(error);
      alert("Product data पढ्न सकिएन। Browser data नहटाउनुहोस्।");
      return null;
    }
  }

  function saveProducts(products) {
    try {
      localStorage.setItem(KEY, JSON.stringify(products));
      return true;
    } catch (error) {
      console.error(error);
      alert("Product Save भएन। Browser storage जाँच गर्नुहोस्।");
      return false;
    }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  function money(value) {
    return "Rs. " + (Number(value) || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function stockStatus(p) {
    const stock = Number(p.stock) || 0;
    const min = Number(p.minStock) || 0;
    if (stock <= 0) return "out";
    if (stock <= min) return "low";
    return "in";
  }

  function updateSummary(products) {
    $("totalProducts").textContent = products.length;
    $("inStockProducts").textContent =
      products.filter(p => stockStatus(p) === "in").length;
    $("lowStockProducts").textContent =
      products.filter(p => stockStatus(p) === "low").length;

    const value = products.reduce((sum, p) =>
      sum + Math.max(0, Number(p.stock) || 0) *
      Math.max(0, Number(p.purchasePrice) || 0), 0);

    $("stockValue").textContent = money(value);
  }

  function renderProducts() {
    const products = getProducts();
    if (products === null) return;

    updateSummary(products);

    const search = $("productSearch").value.trim().toLowerCase();
    const category = $("categoryFilter").value;
    const filter = $("stockFilter").value;

    const filtered = products.filter(p => {
      const words = [
        p.name, p.brand, p.category, p.size, p.unit
      ].join(" ").toLowerCase();

      return words.includes(search) &&
        (!category || (p.category || "Other") === category) &&
        (!filter || stockStatus(p) === filter);
    });

    $("productCount").textContent =
      `${filtered.length} / ${products.length} Products`;

    if (!filtered.length) {
      const message = products.length
        ? "खोजसँग मिल्ने Product भेटिएन।"
        : "Product छैन। + New Product थिचेर पहिलो सामान थप्नुहोस्।";

      $("productTableBody").innerHTML =
        `<tr><td colspan="8" class="inventory-empty">${message}</td></tr>`;
      return;
    }

    $("productTableBody").innerHTML = filtered.map(p => {
      const id = escapeHTML(p.id);
      const name = escapeHTML(p.name || "Unnamed Product");
      const brand = escapeHTML(p.brand || "—");
      const cat = escapeHTML(p.category || "Other");
      const unit = escapeHTML(p.unit || "pcs");
      const size = escapeHTML(p.size || "—");
      const stock = Number(p.stock) || 0;
      const status = stockStatus(p);
      const labels = {
        in: "In Stock", low: "Low Stock", out: "Out of Stock"
      };

      return `<tr>
        <td><div class="inventory-product-name">${name}</div>
          <div class="inventory-subtext">${brand}</div></td>
        <td>${cat}</td>
        <td>${unit} / ${size}</td>
        <td>${money(p.purchasePrice)}</td>
        <td>${money(p.salePrice)}</td>
        <td>${stock.toLocaleString("en-IN")} ${unit}</td>
        <td><span class="inventory-status ${status}">${labels[status]}</span></td>
        <td><button type="button" class="inventory-btn view"
          data-view-product="${id}">View</button></td>
      </tr>`;
    }).join("");
  }

  function openModal(id) {
    const modal = $(id);
    if (!modal) {
      alert("Modal भेटिएन: " + id);
      return;
    }
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
    $("productName").focus();
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

    if (![purchasePrice, salePrice].every(v =>
      Number.isFinite(v) && v >= 0)) {
      alert("Purchase Price र Sale Price सही रूपमा लेख्नुहोस्।");
      return;
    }

    if (![minStock, targetStock].every(v =>
      Number.isFinite(v) && v >= 0)) {
      alert("Minimum Stock र Target Stock सही रूपमा लेख्नुहोस्।");
      return;
    }

    const products = getProducts();
    if (products === null) return;

    const duplicate = products.some(p =>
      String(p.name || "").trim().toLowerCase() === name.toLowerCase() &&
      String(p.brand || "").trim().toLowerCase() === brand.toLowerCase()
    );

    if (duplicate &&
        !confirm("यस्तै नाम र Brand भएको Product पहिले नै छ। फेरि थप्ने?")) {
      return;
    }

    products.push({
      id: "P-" + Date.now() + "-" +
        Math.random().toString(36).slice(2, 7),
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
    });

    if (!saveProducts(products)) return;

    closeProductModal();
    renderProducts();
    alert("Product Save भयो। वास्तविक Stock Purchase बाट थप्नुहोस्।");
  }

  function viewProduct(id) {
    const products = getProducts();
    if (products === null) return;

    const p = products.find(item => String(item.id) === String(id));
    if (!p) {
      alert("Product भेटिएन।");
      renderProducts();
      return;
    }

    const labels = {
      in: "In Stock", low: "Low Stock", out: "Out of Stock"
    };

    const details = [
      ["Product Name", p.name],
      ["Product ID", p.id],
      ["Category", p.category || "Other"],
      ["Brand", p.brand || "—"],
      ["Size / Weight", p.size || "—"],
      ["Unit", p.unit || "pcs"],
      ["Purchase Price", money(p.purchasePrice)],
      ["Sale Price", money(p.salePrice)],
      ["Current Stock", `${Number(p.stock) || 0} ${p.unit || "pcs"}`],
      ["Minimum Stock", p.minStock ?? 0],
      ["Target Stock", p.targetStock ?? 0],
      ["Stock Status", labels[stockStatus(p)]],
      ["Expiry Applicable", p.expiryApplicable ? "Yes" : "No"],
      ["Created At", p.createdAt
        ? new Date(p.createdAt).toLocaleDateString() : "—"]
    ];

    $("productViewTitle").textContent = p.name || "Product Details";
    $("productDetails").innerHTML = details.map(([label, value]) =>
      `<div class="inventory-detail">
        <span>${escapeHTML(label)}</span>
        <strong>${escapeHTML(value)}</strong>
      </div>`
    ).join("");

    openModal("productViewModal");
  }

  function setupInventory() {
    const required = [
      "addProductBtn", "productModal", "productForm", "productName",
      "productCategory", "productBrand", "productSize", "productUnit",
      "purchasePrice", "salePrice", "minStock", "targetStock",
      "expiryApplicable", "closeProductModal", "cancelProductBtn",
      "productSearch", "categoryFilter", "stockFilter", "productTableBody",
      "totalProducts", "inStockProducts", "lowStockProducts", "stockValue",
      "productCount", "productViewModal", "productViewTitle",
      "productDetails", "closeProductView", "closeProductViewBtn"
    ];

    const missing = required.filter(id => !$(id));
    if (missing.length) {
      console.error("Missing Inventory HTML IDs:", missing);
      alert("HTML मा आवश्यक ID भेटिएन: " + missing.join(", "));
      return;
    }

    $("addProductBtn").addEventListener("click", openProductModal);
    $("closeProductModal").addEventListener("click", closeProductModal);
    $("cancelProductBtn").addEventListener("click", closeProductModal);
    $("productForm").addEventListener("submit", addProduct);

    $("productSearch").addEventListener("input", renderProducts);
    $("categoryFilter").addEventListener("change", renderProducts);
    $("stockFilter").addEventListener("change", renderProducts);

    $("closeProductView").addEventListener("click", () =>
      closeModal("productViewModal"));
    $("closeProductViewBtn").addEventListener("click", () =>
      closeModal("productViewModal"));

    $("productTableBody").addEventListener("click", event => {
      const button = event.target.closest("[data-view-product]");
      if (button) viewProduct(button.getAttribute("data-view-product"));
    });

    ["productModal", "productViewModal"].forEach(id => {
      $(id).addEventListener("click", event => {
        if (event.target !== $(id)) return;
        if (id === "productModal") closeProductModal();
        else closeModal("productViewModal");
      });
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeProductModal();
        closeModal("productViewModal");
      }
    });

    renderProducts();
  }

  function start() {
    try {
      setupInventory();
    } catch (error) {
      console.error("Inventory error:", error);
      alert("Inventory मा त्रुटि आयो: " + error.message);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
