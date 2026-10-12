
"use strict";

(function () {
  const KEY = "gs_products";
  const $ = id => document.getElementById(id);

  /* =========================
     Toast notification
  ========================= */
  function showToast(message, type = "info") {
    let region = document.getElementById("inventoryToastRegion");

    if (!region) {
      region = document.createElement("div");
      region.id = "inventoryToastRegion";
      region.setAttribute("aria-live", "polite");

      Object.assign(region.style, {
        position: "fixed",
        top: "14px",
        right: "14px",
        zIndex: "99999",
        width: "min(380px, calc(100vw - 28px))",
        display: "grid",
        gap: "8px"
      });

      document.body.appendChild(region);
    }

    const item = document.createElement("div");
    const background = {
      success: "#166534",
      error: "#991b1b",
      warning: "#92400e",
      info: "#1d4ed8"
    }[type] || "#1d4ed8";

    Object.assign(item.style, {
      background,
      color: "#fff",
      padding: "13px 16px",
      borderRadius: "12px",
      boxShadow: "0 8px 24px #0003",
      fontSize: "14px",
      lineHeight: "1.5",
      overflowWrap: "anywhere"
    });

    item.textContent = String(message ?? "");
    region.appendChild(item);

    window.setTimeout(() => item.remove(), 4200);
  }

  /* =========================
     Custom confirmation modal
  ========================= */
  function confirmInApp(message) {
    return new Promise(resolve => {
      const overlay = document.createElement("div");

      Object.assign(overlay.style, {
        position: "fixed",
        inset: "0",
        zIndex: "100000",
        display: "grid",
        placeItems: "center",
        padding: "18px",
        background: "#0009"
      });

      const box = document.createElement("section");

      Object.assign(box.style, {
        width: "min(430px, 100%)",
        padding: "22px",
        borderRadius: "18px",
        background: "var(--card-bg, #fff)",
        color: "var(--text-color, #172033)",
        boxShadow: "0 20px 60px #0004"
      });

      const title = document.createElement("h2");
      title.textContent = "पुष्टि गर्नुहोस्";
      title.style.marginTop = "0";

      const text = document.createElement("p");
      text.textContent = message;
      text.style.lineHeight = "1.6";

      const actions = document.createElement("div");

      Object.assign(actions.style, {
        display: "flex",
        justifyContent: "flex-end",
        gap: "10px",
        flexWrap: "wrap",
        marginTop: "22px"
      });

      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = "रद्द गर्नुहोस्";

      const accept = document.createElement("button");
      accept.type = "button";
      accept.textContent = "जारी राख्नुहोस्";

      [cancel, accept].forEach(button => {
        Object.assign(button.style, {
          padding: "11px 14px",
          borderRadius: "9px",
          border: "1px solid #cbd5e1",
          cursor: "pointer",
          font: "inherit"
        });
      });

      accept.style.background = "#166534";
      accept.style.color = "#fff";
      accept.style.borderColor = "#166534";

      let finished = false;

      function finish(value) {
        if (finished) return;
        finished = true;
        document.removeEventListener("keydown", onKey);
        overlay.remove();
        resolve(value);
      }

      function onKey(event) {
        if (event.key === "Escape") finish(false);
        if (event.key === "Enter") finish(true);
      }

      cancel.addEventListener("click", () => finish(false));
      accept.addEventListener("click", () => finish(true));

      overlay.addEventListener("click", event => {
        if (event.target === overlay) finish(false);
      });

      document.addEventListener("keydown", onKey);

      actions.append(cancel, accept);
      box.append(title, text, actions);
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      cancel.focus();
    });
  }

  /* =========================
     Existing product storage
  ========================= */
  function getProducts() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || "[]");

      if (!Array.isArray(data)) {
        throw new Error("Product data format मिलेन");
      }

      return data;
    } catch (error) {
      console.error(error);
      showToast(
        "Product data पढ्न सकिएन। Browser data नहटाउनुहोस्।",
        "error"
      );
      return null;
    }
  }

  function saveProducts(products) {
    try {
      localStorage.setItem(KEY, JSON.stringify(products));
      return true;
    } catch (error) {
      console.error(error);
      showToast(
        "Product Save भएन। Browser storage जाँच गर्नुहोस्।",
        "error"
      );
      return false;
    }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);
  }

  function money(value) {
    const amount = Number(value) || 0;

    try {
      const saved = JSON.parse(
        localStorage.getItem("gs_settings") || "{}"
      );

      const currency = saved.currency || "NPR";
      const symbol = {
        NPR: "रु. ",
        INR: "₹",
        USD: "$"
      }[currency] || (currency + " ");

      return symbol + new Intl.NumberFormat(
        currency === "USD" ? "en-US" :
        currency === "INR" ? "en-IN" : "en-NP",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }
      ).format(amount);
    } catch (_) {
      return "Rs. " + amount.toFixed(2);
    }
  }

  /* =========================
     Barcode generation
     Generated barcode is EAN-13
  ========================= */
  function eanCheckDigit(first12) {
    const digits = String(first12);

    if (!/^\d{12}$/.test(digits)) return null;

    let sum = 0;

    for (let i = 0; i < 12; i++) {
      sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
    }

    return String((10 - (sum % 10)) % 10);
  }

  function isValidEAN13(value) {
    const code = String(value || "").trim();

    if (!/^\d{13}$/.test(code)) return false;

    return eanCheckDigit(code.slice(0, 12)) === code[12];
  }

  function generateBarcode(products) {
    const used = new Set(
      products.map(p => String(p.barcode || "").trim())
    );

    for (let attempt = 0; attempt < 100; attempt++) {
      /*
       * 200 is used here for an internal store code.
       * Do not treat generated internal codes as official
       * manufacturer-issued GTIN numbers.
       */
      const base =
        "200" +
        String(Date.now()).slice(-6) +
        String(Math.floor(Math.random() * 1000)).padStart(3, "0");

      const code = base + eanCheckDigit(base);

      if (!used.has(code)) return code;
    }

    throw new Error("Unique Barcode बनाउन सकिएन। फेरि प्रयास गर्नुहोस्।");
  }

  /*
   * EAN-13 को मान्य Barcode लाई SVG मा देखाउने।
   * अन्य Barcode format भए नम्बर सुरक्षित रहन्छ,
   * तर यस SVG ले EAN-13 मात्र चित्रण गर्छ।
   */
  function barcodeSVG(value) {
    const code = String(value || "").trim();

    if (!isValidEAN13(code)) return "";

    const L = [
      "0001101", "0011001", "0010011", "0111101", "0100011",
      "0110001", "0101111", "0111011", "0110111", "0001011"
    ];

    const G = [
      "0100111", "0110011", "0011011", "0100001", "0011101",
      "0111001", "0000101", "0010001", "0001001", "0010111"
    ];

    const R = [
      "1110010", "1100110", "1101100", "1000010", "1011100",
      "1001110", "1010000", "1000100", "1001000", "1110100"
    ];

    const parity = [
      "LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG",
      "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"
    ];

    let bits = "101";
    const first = Number(code[0]);
    const pattern = parity[first];

    for (let i = 1; i <= 6; i++) {
      const digit = Number(code[i]);
      bits += pattern[i - 1] === "L" ? L[digit] : G[digit];
    }

    bits += "01010";

    for (let i = 7; i <= 12; i++) {
      bits += R[Number(code[i])];
    }

    bits += "101";

    let bars = "";

    for (let i = 0; i < bits.length; i++) {
      if (bits[i] !== "1") continue;

      const guard =
        i < 3 ||
        (i >= 45 && i < 50) ||
        i >= 92;

      bars += `<rect x="${i + 4}" y="2" width="1" height="${guard ? 62 : 54}" fill="#111"/>`;
    }

    return `
      <svg xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 105 76" width="315" height="228"
        role="img" aria-label="Barcode ${code}">
        <rect width="105" height="76" fill="#fff"/>
        ${bars}
        <text x="52.5" y="73" text-anchor="middle"
          font-family="Arial,sans-serif" font-size="7" fill="#111">${code}</text>
      </svg>
    `;
  }

  /* =========================
     Barcode field injection
     inventory.html remains unchanged
  ========================= */
  function ensureBarcodeUI() {
    const brand = $("productBrand");

    if (!brand) return;

    const field = brand.closest(".inventory-field");

    if (!field || $("productBarcode")) return;

    const wrap = document.createElement("div");
    wrap.className = "inventory-field inventory-barcode-field";

    wrap.innerHTML = `
      <label for="productBarcode">Barcode नम्बर</label>
      <input id="productBarcode" type="text"
        inputmode="numeric" maxlength="80"
        autocomplete="off"
        placeholder="Barcode Scan/लेख्नुहोस्">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" id="generateBarcodeBtn"
          class="inventory-btn">Barcode बनाउनुहोस्</button>
        <button type="button" id="clearBarcodeBtn"
          class="inventory-btn">खाली गर्नुहोस्</button>
      </div>
      <p style="margin:0;color:var(--inv-muted);font-size:12px">
        खाली छोडेमा नयाँ सामान Save गर्दा आन्तरिक Barcode बनाइनेछ।
      </p>
    `;

    field.insertAdjacentElement("afterend", wrap);

    $("generateBarcodeBtn").addEventListener("click", () => {
      try {
        const products = getProducts();
        if (products === null) return;

        $("productBarcode").value = generateBarcode(products);
        showToast("नयाँ Barcode तयार भयो।", "success");
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    $("clearBarcodeBtn").addEventListener("click", () => {
      $("productBarcode").value = "";
      $("productBarcode").focus();
    });
  }

  /* =========================
     Stock status and summary
  ========================= */
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
      sum +
      Math.max(0, Number(p.stock) || 0) *
      Math.max(0, Number(p.purchasePrice) || 0), 0
    );

    $("stockValue").textContent = money(value);
  }

  function ensureBarcodeColumn() {
    const table = document.querySelector(".inventory-table");
    const header = table && table.querySelector("thead tr");

    if (!header || header.querySelector("[data-barcode-heading]")) {
      return;
    }

    const th = document.createElement("th");
    th.textContent = "Barcode";
    th.setAttribute("data-barcode-heading", "true");

    header.insertBefore(th, header.children[1]);
  }

  function renderProducts() {
    const products = getProducts();

    if (products === null) return;

    updateSummary(products);
    ensureBarcodeColumn();

    const search = $("productSearch").value.trim().toLowerCase();
    const category = $("categoryFilter").value;
    const filter = $("stockFilter").value;

    const filtered = products.filter(p => {
      const words = [
        p.name,
        p.brand,
        p.category,
        p.size,
        p.unit,
        p.barcode
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
        `<tr><td colspan="9" class="inventory-empty">${message}</td></tr>`;

      return;
    }

    const labels = {
      in: "In Stock",
      low: "Low Stock",
      out: "Out of Stock"
    };

    $("productTableBody").innerHTML = filtered.map(p => {
      const id = escapeHTML(p.id);
      const name = escapeHTML(p.name || "Unnamed Product");
      const brand = escapeHTML(p.brand || "—");
      const cat = escapeHTML(p.category || "Other");
      const unit = escapeHTML(p.unit || "pcs");
      const size = escapeHTML(p.size || "—");
      const barcode = escapeHTML(p.barcode || "—");
      const stock = Number(p.stock) || 0;
      const status = stockStatus(p);

      return `<tr>
        <td>
          <div class="inventory-product-name">${name}</div>
          <div class="inventory-subtext">${brand}</div>
        </td>
        <td>${barcode}</td>
        <td>${cat}</td>
        <td>${unit} / ${size}</td>
        <td>${money(p.purchasePrice)}</td>
        <td>${money(p.salePrice)}</td>
        <td>${stock.toLocaleString("en-IN")} ${unit}</td>
        <td><span class="inventory-status ${status}">${labels[status]}</span></td>
        <td>
          <button type="button" class="inventory-btn view"
            data-view-product="${id}">View</button>
        </td>
      </tr>`;
    }).join("");
  }

  /* =========================
     Existing modal functions
  ========================= */
  function openModal(id) {
    const modal = $(id);

    if (!modal) {
      showToast("Modal भेटिएन: " + id, "error");
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

    if ($("productBarcode")) $("productBarcode").value = "";

    openModal("productModal");
    $("productName").focus();
  }

  function closeProductModal() {
    closeModal("productModal");
    $("productForm").reset();
  }

  /* =========================
     Save product
  ========================= */
  async function addProduct(event) {
    event.preventDefault();

    const name = $("productName").value.trim();
    const brand = $("productBrand").value.trim();
    const purchasePrice = Number($("purchasePrice").value);
    const salePrice = Number($("salePrice").value);
    const minStock = Number($("minStock").value || 0);
    const targetStock = Number($("targetStock").value || 0);

    if (!name) {
      showToast("Product Name लेख्नुहोस्।", "warning");
      $("productName").focus();
      return;
    }

    if (![purchasePrice, salePrice].every(v =>
      Number.isFinite(v) && v >= 0)) {
      showToast("Purchase Price र Sale Price सही रूपमा लेख्नुहोस्।", "warning");
      return;
    }

    if (![minStock, targetStock].every(v =>
      Number.isFinite(v) && v >= 0)) {
      showToast("Minimum Stock र Target Stock सही रूपमा लेख्नुहोस्।", "warning");
      return;
    }

    const products = getProducts();

    if (products === null) return;

    const duplicate = products.some(p =>
      String(p.name || "").trim().toLowerCase() === name.toLowerCase() &&
      String(p.brand || "").trim().toLowerCase() === brand.toLowerCase()
    );

    if (duplicate) {
      const accepted = await confirmInApp(
        "यस्तै नाम र Brand भएको Product पहिले नै छ। फेरि थप्ने?"
      );

      if (!accepted) return;
    }

    let barcode = String(
      $("productBarcode")?.value || ""
    ).trim();

    if (!barcode) {
      try {
        barcode = generateBarcode(products);
      } catch (error) {
        showToast(error.message, "error");
        return;
      }
    }

    const duplicateBarcode = products.some(p =>
      String(p.barcode || "").trim().toLowerCase() ===
      barcode.toLowerCase()
    );

    if (duplicateBarcode) {
      showToast(
        "यो Barcode अर्को सामानमा प्रयोग भएको छ। फरक Barcode राख्नुहोस्।",
        "error"
      );

      $("productBarcode")?.focus();
      return;
    }

    const product = {
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
      barcode,
      stock: 0,
      active: true,
      createdAt: new Date().toISOString()
    };

    products.push(product);

    if (!saveProducts(products)) return;

    closeProductModal();
    renderProducts();

    showToast(
      "Product र Barcode सुरक्षित भयो। वास्तविक Stock Purchase बाट थप्नुहोस्।",
      "success"
    );
  }

  /* =========================
     Product details
  ========================= */
  function viewProduct(id) {
    const products = getProducts();

    if (products === null) return;

    const p = products.find(item => String(item.id) === String(id));

    if (!p) {
      showToast("Product भेटिएन।", "error");
      renderProducts();
      return;
    }

    const labels = {
      in: "In Stock",
      low: "Low Stock",
      out: "Out of Stock"
    };

    const details = [
      ["Product Name", p.name],
      ["Product ID", p.id],
      ["Barcode", p.barcode || "—"],
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
        ? new Date(p.createdAt).toLocaleDateString()
        : "—"]
    ];

    $("productViewTitle").textContent = p.name || "Product Details";

    const barcodeImage = barcodeSVG(p.barcode);

    $("productDetails").innerHTML =
      details.map(([label, value]) =>
        `<div class="inventory-detail">
          <span>${escapeHTML(label)}</span>
          <strong>${escapeHTML(value)}</strong>
        </div>`
      ).join("") +
      (barcodeImage
        ? `<div class="inventory-detail inventory-full">
            <span>Barcode Label (EAN-13)</span>
            <div style="max-width:100%;overflow:auto;margin-top:8px">
              ${barcodeImage}
            </div>
            <button type="button" class="inventory-btn"
              id="printBarcodeBtn">Barcode Print गर्नुहोस्</button>
          </div>`
        : "");

    openModal("productViewModal");

    const printButton = $("printBarcodeBtn");

    if (printButton) {
      printButton.addEventListener("click", () => {
        const win = window.open("", "_blank");

        if (!win) {
          showToast("Print खोल्न Browser Popup अनुमति दिनुहोस्।", "warning");
          return;
        }

        win.document.write(`
          <!DOCTYPE html>
          <html lang="ne">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <title>Barcode ${escapeHTML(p.barcode)}</title>
            <style>
              body{font-family:Arial,sans-serif;text-align:center;padding:20px}
              svg{max-width:100%;height:auto}
              h3{font-size:16px;margin:0 0 10px}
            </style>
          </head>
          <body>
            <h3>${escapeHTML(p.name)}</h3>
            ${barcodeImage}
            <script>window.onload=function(){window.print();};<\/script>
          </body>
          </html>
        `);

        win.document.close();
      });
    }
  }

  /* =========================
     Setup
  ========================= */
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

      showToast(
        "HTML मा आवश्यक ID भेटिएन: " + missing.join(", "),
        "error"
      );

      return;
    }

    ensureBarcodeUI();

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
      showToast("Inventory मा त्रुटि आयो: " + error.message, "error");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
