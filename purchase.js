
/* =========================================================
   GS GENERAL STORE MANAGEMENT SYSTEM
   PURCHASE MODULE
   Barcode lookup + camera scan + FIFO lots + expiry dates
   Existing LocalStorage keys and legacy records preserved.
   ========================================================= */

(() => {
  "use strict";

  const PURCHASE_KEY = "gs_purchases";
  const PRODUCT_KEY = "gs_products";
  const SUPPLIER_KEY = "gs_suppliers";
  const FINANCE_KEY = "gs_finance";
  const LOT_KEY = "gs_stock_lots";
  const SETTINGS_KEY = "gs_settings";

  const $ = id => document.getElementById(id);

  const els = {
    newBtn: $("newPurchaseBtn"),
    modal: $("purchaseModal"),
    closeBtn: $("closePurchaseModal"),
    cancelBtn: $("cancelPurchaseBtn"),
    form: $("purchaseForm"),
    date: $("purchaseDate"),
    bill: $("billNumber"),
    supplier: $("supplierName"),
    taxType: $("supplierTaxType"),
    taxNumber: $("supplierTaxNumber"),
    payment: $("paymentMethod"),
    itemsBody: $("purchaseItemsBody"),
    addItem: $("addPurchaseItemBtn"),
    vat: $("purchaseVat"),
    paid: $("paidAmount"),
    note: $("purchaseNote"),
    search: $("purchaseSearch"),
    table: $("purchaseTableBody"),
    totalBills: $("totalPurchases"),
    totalValue: $("purchaseValue"),
    totalPaid: $("paidValue"),
    totalPayable: $("payableValue"),
    previewItems: $("previewItemAmount"),
    previewDiscount: $("previewDiscount"),
    previewVat: $("previewVat"),
    previewTotal: $("previewTotal"),
    previewPaid: $("previewPaid"),
    previewBalance: $("previewBalance")
  };

  let cameraStream = null;
  let scanTimer = null;
  let detector = null;
  let scanning = false;
  let lastScanCode = "";
  let lastScanAt = 0;

  /* ---------------- Storage ---------------- */

  function read(key, fallback = []) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;

      const value = JSON.parse(raw);
      return value === null || value === undefined ? fallback : value;
    } catch (error) {
      console.error("Storage read error:", key, error);
      throw new Error(key + " को Data पढ्न सकिएन।");
    }
  }

  function readArray(key) {
    const value = read(key, []);
    if (!Array.isArray(value)) {
      throw new Error(key + " को Data संरचना मिलेन।");
    }
    return value;
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function settings() {
    const value = read(SETTINGS_KEY, {});
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  }

  function money(value) {
    const currency = String(settings().currency || "NPR").toUpperCase();

    const symbols = {
      NPR: "Rs.",
      RS: "Rs.",
      INR: "₹",
      USD: "$",
      GBP: "£",
      EUR: "€"
    };

    return (symbols[currency] || currency) + " " +
      num(value).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function today() {
    const d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function makeId(prefix) {
    return prefix + "-" + Date.now() + "-" +
      Math.floor(Math.random() * 1000000);
  }

  function makePurchaseId() {
    const prefix = String(settings().purchasePrefix || "PUR")
      .trim()
      .replace(/\s+/g, "-");

    return makeId(prefix || "PUR");
  }

  function getProducts() {
    return readArray(PRODUCT_KEY);
  }

  function getSuppliers() {
    return readArray(SUPPLIER_KEY);
  }

  function getPurchases() {
    return readArray(PURCHASE_KEY);
  }

  function getFinance() {
    return readArray(FINANCE_KEY);
  }

  function getLots() {
    return readArray(LOT_KEY);
  }

  function setText(element, value) {
    if (element) element.textContent = value;
  }

  /* ---------------- In-page messages ---------------- */

  function toast(message, type = "success") {
    let box = $("purchaseToast");

    if (!box) {
      box = document.createElement("div");
      box.id = "purchaseToast";
      box.setAttribute("role", "status");
      box.setAttribute("aria-live", "polite");

      Object.assign(box.style, {
        position: "fixed",
        left: "50%",
        bottom: "20px",
        transform: "translateX(-50%)",
        zIndex: "10010",
        width: "max-content",
        maxWidth: "calc(100% - 28px)",
        padding: "13px 17px",
        borderRadius: "12px",
        color: "#fff",
        background: "#166534",
        boxShadow: "0 6px 24px #0003",
        fontSize: "14px",
        lineHeight: "1.5",
        whiteSpace: "pre-wrap",
        display: "none"
      });

      document.body.appendChild(box);
    }

    box.style.background = type === "error"
      ? "#b91c1c"
      : type === "info"
        ? "#1d4ed8"
        : "#166534";

    box.textContent = message;
    box.style.display = "block";

    clearTimeout(box._hideTimer);
    box._hideTimer = setTimeout(() => {
      box.style.display = "none";
    }, 4500);
  }

  /* ---------------- Modal ---------------- */

  function openModal() {
    if (!els.modal || !els.form || !els.itemsBody) {
      toast("Purchase Form भेटिएन। purchase.html जाँच्नुहोस्।", "error");
      return;
    }

    stopCamera();
    els.form.reset();
    els.itemsBody.innerHTML = "";

    if (els.date) els.date.value = today();
    if (els.vat) els.vat.value = "0";
    if (els.paid) els.paid.value = "0";

    loadSuppliers();
    applySettings();
    updateSupplierTax();
    addItemRow();

    els.modal.classList.add("show");
    els.modal.style.display = "block";
    els.modal.hidden = false;
    els.modal.setAttribute("aria-hidden", "false");

    calculate();
  }

  function closeModal() {
    stopCamera();

    if (!els.modal) return;

    els.modal.classList.remove("show");
    els.modal.style.display = "none";
    els.modal.hidden = true;
    els.modal.setAttribute("aria-hidden", "true");
  }

  /* ---------------- Suppliers ---------------- */

  function loadSuppliers() {
    if (!els.supplier) return;

    const suppliers = getSuppliers();
    const active = suppliers
      .filter(s => s && s.active !== false)
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

    els.supplier.innerHTML =
      '<option value="">Supplier छान्नुहोस्</option>';

    active.forEach(supplier => {
      const option = document.createElement("option");
      option.value = supplier.id;
      option.textContent = supplier.name || "Unnamed Supplier";
      els.supplier.appendChild(option);
    });

    if (!active.length) {
      els.supplier.innerHTML =
        '<option value="">पहिले Suppliers मा Supplier बनाउनुहोस्</option>';
    }
  }

  function updateSupplierTax() {
    if (!els.supplier) return;

    const supplier = getSuppliers().find(
      s => String(s.id) === String(els.supplier.value)
    );

    if (els.taxType) {
      els.taxType.value = supplier?.taxType || "NON_TAX";
    }

    if (els.taxNumber) {
      els.taxNumber.value = supplier?.taxNumber || "";
    }
  }

  function applySettings() {
    const config = settings();

    if (els.payment && config.defaultPayment) {
      const wanted = String(config.defaultPayment).toUpperCase();
      const option = [...els.payment.options].find(
        o => o.value.toUpperCase() === wanted
      );

      if (option) els.payment.value = option.value;
    }
  }

  /* ---------------- Products and rows ---------------- */

  function productOptions(selectedId = "") {
    return '<option value="">Product छान्नुहोस्</option>' +
      getProducts()
        .filter(p => p && p.active !== false)
        .map(p => `
          <option
            value="${esc(p.id)}"
            data-rate="${num(p.purchasePrice)}"
            data-unit="${esc(p.unit || "Unit")}"
            data-barcode="${esc(p.barcode || "")}"
            ${String(p.id) === String(selectedId) ? "selected" : ""}
          >
            ${esc(p.name || "Product")} (${esc(p.unit || "Unit")})
            ${p.barcode ? " — " + esc(p.barcode) : ""}
          </option>
        `).join("");
  }

  function rowProduct(row) {
    const productId = row.querySelector(".item-product")?.value;
    return getProducts().find(
      p => String(p.id) === String(productId)
    ) || null;
  }

  function updateRowBarcode(row) {
    const product = rowProduct(row);
    const barcodeInput = row.querySelector(".item-barcode");

    if (barcodeInput && product) {
      barcodeInput.value = product.barcode || "";
    }
  }

  function addItemRow(item = {}) {
    if (!els.itemsBody) return null;

    const tr = document.createElement("tr");
    tr.className = "purchase-item-row";

    tr.innerHTML = `
      <td>
        <div style="display:grid;gap:6px;min-width:190px">
          <input
            class="item-barcode"
            type="search"
            autocomplete="off"
            placeholder="Barcode"
            aria-label="Product Barcode"
            style="width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--border-color,#d1d5db);border-radius:7px;background:var(--input-bg,transparent);color:var(--text-color,inherit)"
          >
          <button type="button" class="purchase-btn item-barcode-find">
            Find Barcode
          </button>
          <select class="item-product" required>
            ${productOptions(item.productId || "")}
          </select>
        </div>
      </td>
      <td>
        <input class="item-qty" type="number" min="0.001"
          step="any" value="${item.qty ?? 1}" required>
      </td>
      <td>
        <input class="item-free" type="number" min="0"
          step="any" value="${item.freeQty ?? 0}">
      </td>
      <td>
        <input class="item-rate" type="number" min="0"
          step="0.01" value="${item.rate ?? ""}" required>
      </td>
      <td>
        <input class="item-discount" type="number" min="0"
          step="0.01" value="${item.discount ?? 0}">
      </td>
      <td>
        <input class="item-expiry" type="date"
          value="${esc(item.expiryDate || "")}"
          aria-label="Expiry Date"
          title="Expiry Date (optional)"
          style="min-width:135px">
      </td>
      <td class="item-total">${money(0)}</td>
      <td>
        <button type="button" class="purchase-btn danger remove-item">
          Remove
        </button>
      </td>
    `;

    els.itemsBody.appendChild(tr);

    const productSelect = tr.querySelector(".item-product");
    const rateInput = tr.querySelector(".item-rate");
    const barcodeInput = tr.querySelector(".item-barcode");

    productSelect.addEventListener("change", () => {
      const product = rowProduct(tr);
      if (product) {
        rateInput.value = num(product.purchasePrice);
        updateRowBarcode(tr);
      }
      calculate();
    });

    tr.querySelector(".item-barcode-find").addEventListener("click", () => {
      lookupBarcode(barcodeInput.value, tr);
    });

    barcodeInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        lookupBarcode(barcodeInput.value, tr);
      }
    });

    barcodeInput.addEventListener("change", () => {
      const code = barcodeInput.value.trim();
      if (code) lookupBarcode(code, tr);
    });

    tr.querySelectorAll("input").forEach(input => {
      input.addEventListener("input", calculate);
      input.addEventListener("change", calculate);
    });

    tr.querySelector(".remove-item").addEventListener("click", () => {
      if (els.itemsBody.querySelectorAll(".purchase-item-row").length <= 1) {
        toast("कम्तीमा एउटा Product Row राख्नुपर्छ।", "error");
        return;
      }

      tr.remove();
      calculate();
    });

    if (item.productId) updateRowBarcode(tr);

    calculate();
    return tr;
  }

  function lookupBarcode(rawCode, targetRow) {
    const code = String(rawCode || "").trim();

    if (!code) {
      toast("Barcode नम्बर राख्नुहोस्।", "error");
      return;
    }

    const product = getProducts().find(p =>
      p &&
      p.active !== false &&
      String(p.barcode || "").trim() === code
    );

    if (!product) {
      toast("यो Barcode भएको Active Product भेटिएन।", "error");
      return;
    }

    let row = targetRow;

    // यदि यही Product अर्को Row मा छ भने Quantity बढाउने।
    const existingRow = [...els.itemsBody.querySelectorAll(".purchase-item-row")]
      .find(r =>
        r !== targetRow &&
        String(r.querySelector(".item-product")?.value) === String(product.id)
      );

    if (existingRow) {
      const qtyInput = existingRow.querySelector(".item-qty");
      qtyInput.value = String(num(qtyInput.value) + 1);

      if (targetRow && !targetRow.querySelector(".item-product")?.value) {
        if (els.itemsBody.querySelectorAll(".purchase-item-row").length > 1) {
          targetRow.remove();
        }
      }

      toast(`${product.name} को Quantity 1 ले बढाइयो।`);
      calculate();
      return;
    }

    if (!row) {
      row = [...els.itemsBody.querySelectorAll(".purchase-item-row")]
        .find(r => !r.querySelector(".item-product")?.value);

      if (!row) row = addItemRow();
    }

    const select = row?.querySelector(".item-product");
    if (!select) return;

    select.value = String(product.id);

    if (select.value !== String(product.id)) {
      toast("Product Select गर्न सकिएन।", "error");
      return;
    }

    row.querySelector(".item-barcode").value = code;
    row.querySelector(".item-rate").value = num(product.purchasePrice);

    if (!row.querySelector(".item-qty").value) {
      row.querySelector(".item-qty").value = "1";
    }

    toast(`${product.name} खरिद सूचीमा थपियो।`);
    calculate();
  }

  /* ---------------- Mobile camera scanner ---------------- */

  function ensureScannerUI() {
    if ($("purchaseScannerPanel")) return;

    const panel = document.createElement("section");
    panel.id = "purchaseScannerPanel";
    panel.className = "purchase-section";

    panel.innerHTML = `
      <div style="border:1px solid var(--border-color,#d1d5db);border-radius:12px;padding:12px">
        <strong>Barcode Camera Scanner</strong>
        <p>क्यामेरा Scan ले नयाँ खाली Product Row मा सामान थप्छ।</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input id="purchaseCameraBarcode" type="search"
            placeholder="Scan गरिएको Barcode..."
            autocomplete="off"
            style="flex:1;min-width:150px;padding:10px;border:1px solid var(--border-color,#d1d5db);border-radius:8px;background:var(--input-bg,transparent);color:var(--text-color,inherit)">
          <button id="purchaseCameraStart" type="button" class="purchase-btn">
            📷 Scan
          </button>
          <button id="purchaseCameraFind" type="button" class="purchase-btn">
            Find / Add
          </button>
        </div>
        <div id="purchaseCameraArea" hidden style="margin-top:10px">
          <video id="purchaseCameraVideo" playsinline autoplay muted
            style="width:100%;max-width:480px;max-height:320px;background:#111;border-radius:10px">
          </video>
          <p id="purchaseCameraStatus" aria-live="polite"></p>
          <button id="purchaseCameraStop" type="button" class="purchase-btn danger">
            Stop Camera
          </button>
        </div>
      </div>
    `;

    const firstSection = els.itemsBody?.closest(".purchase-section");
    if (firstSection) {
      firstSection.parentNode.insertBefore(panel, firstSection);
    } else if (els.form) {
      els.form.prepend(panel);
    }

    $("purchaseCameraFind")?.addEventListener("click", () => {
      lookupBarcode($("purchaseCameraBarcode")?.value);
    });

    $("purchaseCameraBarcode")?.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        lookupBarcode(event.target.value);
      }
    });

    $("purchaseCameraStart")?.addEventListener("click", startCamera);
    $("purchaseCameraStop")?.addEventListener("click", stopCamera);
  }

  async function startCamera() {
    if (scanning) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      toast("यो Browser मा Camera उपलब्ध छैन। Manual Barcode प्रयोग गर्नुहोस्।", "error");
      return;
    }

    if (!("BarcodeDetector" in window)) {
      toast(
        "यो Browser ले Barcode Camera Scan समर्थन गर्दैन। Manual Barcode प्रयोग गर्नुहोस्।",
        "info"
      );
      return;
    }

    try {
      try {
        detector = new BarcodeDetector({
          formats: [
            "ean_13", "ean_8", "upc_a", "upc_e",
            "code_128", "code_39", "codabar", "itf", "qr_code"
          ]
        });
      } catch (_) {
        detector = new BarcodeDetector();
      }

      const area = $("purchaseCameraArea");
      const video = $("purchaseCameraVideo");
      if (!area || !video) return;

      area.hidden = false;
      scanning = true;

      if ($("purchaseCameraStatus")) {
        $("purchaseCameraStatus").textContent =
          "क्यामेरा Permission दिनुहोस् र Barcode देखाउनुहोस्।";
      }

      cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } }
      });

      video.srcObject = cameraStream;
      await video.play();

      scanTimer = setInterval(scanFrame, 300);
    } catch (error) {
      console.error("Purchase camera error:", error);
      stopCamera();
      toast("क्यामेरा खोल्न सकिएन। Browser Permission र HTTPS जाँच्नुहोस्।", "error");
    }
  }

  async function scanFrame() {
    if (!scanning || !detector) return;

    const video = $("purchaseCameraVideo");
    if (!video || video.readyState < 2) return;

    try {
      const codes = await detector.detect(video);
      if (!codes?.length) return;

      const code = String(codes[0].rawValue || "").trim();
      if (!code) return;

      const now = Date.now();
      if (code === lastScanCode && now - lastScanAt < 1600) return;

      lastScanCode = code;
      lastScanAt = now;

      if ($("purchaseCameraBarcode")) {
        $("purchaseCameraBarcode").value = code;
      }

      stopCamera();
      lookupBarcode(code);
    } catch (error) {
      console.debug("Purchase barcode frame skipped:", error);
    }
  }

  function stopCamera() {
    scanning = false;

    if (scanTimer) {
      clearInterval(scanTimer);
      scanTimer = null;
    }

    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }

    const video = $("purchaseCameraVideo");
    if (video) video.srcObject = null;

    const area = $("purchaseCameraArea");
    if (area) area.hidden = true;
  }

  /* ---------------- Collect and calculate ---------------- */

  function collectItems() {
    if (!els.itemsBody) return [];

    return [...els.itemsBody.querySelectorAll(".purchase-item-row")].map(row => {
      const productId = row.querySelector(".item-product")?.value || "";
      const product = getProducts().find(
        p => String(p.id) === String(productId)
      );

      const qty = num(row.querySelector(".item-qty")?.value);
      const freeQty = num(row.querySelector(".item-free")?.value);
      const rate = num(row.querySelector(".item-rate")?.value);
      const discount = num(row.querySelector(".item-discount")?.value);
      const gross = qty * rate;
      const received = qty + freeQty;

      return {
        productId,
        productName: product?.name || "",
        barcode: product?.barcode || "",
        unit: product?.unit || "Unit",
        qty,
        freeQty,
        totalReceivedQty: received,
        rate,
        discount,
        gross,
        lineTotal: Math.max(0, gross - discount),
        expiryDate: row.querySelector(".item-expiry")?.value || "",
        effectiveCost: received > 0
          ? Math.max(0, gross - discount) / received
          : 0
      };
    });
  }

  function calculate() {
    if (!els.itemsBody) {
      return {
        items: [], subtotal: 0, discount: 0,
        vat: 0, total: 0, paid: 0, balance: 0
      };
    }

    const items = collectItems();
    const subtotal = items.reduce((sum, item) => sum + item.gross, 0);
    const discount = items.reduce((sum, item) => sum + item.discount, 0);
    const vat = Math.max(0, num(els.vat?.value));
    const total = Math.max(0, subtotal - discount) + vat;
    const paid = Math.max(0, num(els.paid?.value));
    const balance = Math.max(0, total - paid);

    items.forEach((item, index) => {
      const row = els.itemsBody.querySelectorAll(".purchase-item-row")[index];
      if (row) {
        setText(row.querySelector(".item-total"), money(item.lineTotal));
      }
    });

    setText(els.previewItems, money(subtotal));
    setText(els.previewDiscount, money(discount));
    setText(els.previewVat, money(vat));
    setText(els.previewTotal, money(total));
    setText(els.previewPaid, money(paid));
    setText(els.previewBalance, money(balance));

    return { items, subtotal, discount, vat, total, paid, balance };
  }

  /* ---------------- Purchase history ---------------- */

  function purchaseItems(purchase) {
    if (Array.isArray(purchase.items) && purchase.items.length) {
      return purchase.items;
    }

    // Compatibility for existing one-product purchase records.
    if (purchase.productId) {
      return [{
        productId: purchase.productId,
        productName: purchase.productName || "",
        barcode: purchase.barcode || "",
        unit: purchase.unit || "Unit",
        qty: num(purchase.qty),
        freeQty: num(purchase.freeQty),
        totalReceivedQty: num(purchase.totalReceivedQty) ||
          (num(purchase.qty) + num(purchase.freeQty)),
        rate: num(purchase.rate),
        discount: num(purchase.discount),
        effectiveCost: num(purchase.effectiveCost),
        expiryDate: purchase.expiryDate || ""
      }];
    }

    return [];
  }

  function updateSummary(purchases = getPurchases()) {
    setText(els.totalBills, purchases.length);
    setText(els.totalValue, money(
      purchases.reduce((sum, p) => sum + num(p.total), 0)
    ));
    setText(els.totalPaid, money(
      purchases.reduce((sum, p) => sum + num(p.paidAmount), 0)
    ));
    setText(els.totalPayable, money(
      purchases.reduce((sum, p) => sum + num(p.balance), 0)
    ));
  }

  function renderPurchases() {
    if (!els.table) return;

    const purchases = getPurchases();
    updateSummary(purchases);

    const search = (els.search?.value || "").trim().toLowerCase();

    const filtered = purchases.filter(p => {
      const items = purchaseItems(p);
      const names = items.map(i => i.productName).join(" ");
      const barcodes = items.map(i => i.barcode || "").join(" ");

      const haystack = [
        p.billNumber, p.supplierName, p.supplierTaxNumber,
        names, barcodes, p.date, p.id
      ].join(" ").toLowerCase();

      return !search || haystack.includes(search);
    });

    if (!filtered.length) {
      els.table.innerHTML = `
        <tr>
          <td colspan="8" class="purchase-empty">
            ${purchases.length ? "Purchase भेटिएन।" : "अहिलेसम्म Purchase छैन।"}
          </td>
        </tr>
      `;
      return;
    }

    els.table.innerHTML = filtered.map(p => {
      const items = purchaseItems(p);
      const itemNames = items.map(i => i.productName).filter(Boolean).join(", ");

      return `
        <tr>
          <td>${esc(p.date || "-")}</td>
          <td>${esc(p.billNumber || "-")}</td>
          <td>${esc(p.supplierName || "-")}</td>
          <td title="${esc(itemNames)}">${items.length} item(s)</td>
          <td>${money(p.total)}</td>
          <td>${money(p.paidAmount)}</td>
          <td>${money(p.balance)}</td>
          <td>${esc(p.paymentMethod || "-")}</td>
        </tr>
      `;
    }).join("");
  }

  /* ---------------- Validation ---------------- */

  function validate(values) {
    if (!els.date?.value || !els.bill?.value.trim() || !els.supplier?.value) {
      toast("Date, Supplier Bill Number र Supplier अनिवार्य छन्।", "error");
      return false;
    }

    const supplier = getSuppliers().find(
      s => String(s.id) === String(els.supplier.value)
    );

    if (!supplier || supplier.active === false) {
      toast("सक्रिय Supplier छान्नुहोस्।", "error");
      return false;
    }

    if (!values.items.length) {
      toast("कम्तीमा एउटा Product राख्नुहोस्।", "error");
      return false;
    }

    const products = getProducts();
    const seen = new Set();

    for (const item of values.items) {
      if (!item.productId ||
          !products.some(p =>
            String(p.id) === String(item.productId) &&
            p.active !== false
          )) {
        toast("हरेक Row मा सही Product छान्नुहोस्।", "error");
        return false;
      }

      if (item.qty <= 0 || item.freeQty < 0 ||
          item.rate < 0 || item.discount < 0) {
        toast("Quantity, Free Qty, Rate र Discount सही राख्नुहोस्।", "error");
        return false;
      }

      if (item.discount > item.gross) {
        toast("कुनै Product को Discount त्यसको रकमभन्दा बढी छ।", "error");
        return false;
      }

      if (seen.has(String(item.productId))) {
        toast("एउटै Product धेरै Row मा छ। एउटै Row को Quantity बढाउनुहोस्।", "error");
        return false;
      }

      seen.add(String(item.productId));
    }

    if (values.vat < 0 || values.paid < 0) {
      toast("VAT र Paid Amount ऋणात्मक हुन सक्दैन।", "error");
      return false;
    }

    if (values.paid > values.total) {
      toast("Paid Amount कुल रकमभन्दा बढी हुन सक्दैन।", "error");
      return false;
    }

    if (els.payment?.value === "CREDIT" && values.paid > 0) {
      toast("Credit Payment मा अहिले तिरेको रकम 0 राख्नुहोस्।", "error");
      return false;
    }

    for (const item of values.items) {
      if (item.expiryDate && item.expiryDate < els.date.value) {
        toast("Expiry Date खरिद मितिभन्दा अगाडिको छ। जाँच गर्नुहोस्।", "error");
        return false;
      }
    }

    return true;
  }

  /* ---------------- Finance transaction ---------------- */

  function makeFinanceTransaction(purchase) {
    if (purchase.paidAmount <= 0) return null;

    return {
      id: "FIN-" + purchase.id,
      source: "PURCHASE",
      sourceId: purchase.id,
      date: purchase.date,
      type: "PAYMENT",
      category: "PURCHASE_PAYMENT",
      account: purchase.paymentMethod,
      amount: purchase.paidAmount,
      reference: purchase.billNumber,
      note: "Purchase payment - " + purchase.supplierName,
      createdAt: purchase.createdAt
    };
  }

  /* ---------------- Atomic-ish save and rollback ---------------- */

  function saveStores(changes) {
    const before = {};

    Object.keys(changes).forEach(key => {
      before[key] = localStorage.getItem(key);
    });

    try {
      // Purchase record is written last.
      [PRODUCT_KEY, SUPPLIER_KEY, LOT_KEY, FINANCE_KEY, PURCHASE_KEY]
        .forEach(key => {
          if (Object.prototype.hasOwnProperty.call(changes, key)) {
            write(key, changes[key]);
          }
        });
    } catch (error) {
      Object.keys(before).forEach(key => {
        try {
          if (before[key] === null) localStorage.removeItem(key);
          else localStorage.setItem(key, before[key]);
        } catch (rollbackError) {
          console.error("Rollback error:", key, rollbackError);
        }
      });

      throw new Error(
        "Purchase सुरक्षित गर्न सकिएन। Storage मा ठाउँ छ कि छैन जाँच गर्नुहोस्।"
      );
    }
  }

  function savePurchase(event) {
    event.preventDefault();

    let purchases, products, suppliers, finance, lots;

    try {
      purchases = getPurchases();
      products = getProducts();
      suppliers = getSuppliers();
      finance = getFinance();
      lots = getLots();
    } catch (error) {
      toast(error.message, "error");
      return;
    }

    const values = calculate();
    if (!validate(values)) return;

    const supplier = suppliers.find(
      s => String(s.id) === String(els.supplier.value)
    );

    const bill = els.bill.value.trim();

    const duplicate = purchases.some(p =>
      String(p.billNumber || "").trim().toLowerCase() === bill.toLowerCase() &&
      String(p.supplierId || "") === String(supplier.id)
    );

    if (duplicate) {
      toast("यो Supplier को Bill Number पहिले नै सुरक्षित छ।", "error");
      return;
    }

    // Re-check barcode/product mapping and calculate stock from fresh data.
    for (const item of values.items) {
      const product = products.find(
        p => String(p.id) === String(item.productId)
      );

      if (!product || product.active === false) {
        toast("एउटा Product उपलब्ध छैन। Form फेरि जाँच्नुहोस्।", "error");
        return;
      }

      if (item.barcode &&
          String(product.barcode || "").trim() !== String(item.barcode).trim()) {
        toast("Product Barcode परिवर्तन भएको छ। फेरि खोज्नुहोस्।", "error");
        return;
      }
    }

    const purchaseId = makePurchaseId();
    const createdAt = new Date().toISOString();

    const purchase = {
      id: purchaseId,
      date: els.date.value,
      billNumber: bill,
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierTaxType: els.taxType?.value || "NON_TAX",
      supplierTaxNumber: els.taxNumber?.value.trim() || "",
      items: values.items.map(item => ({ ...item })),

      // Legacy compatibility fields for older reports/modules.
      productId: values.items.length === 1 ? values.items[0].productId : "",
      productName: values.items.length === 1 ? values.items[0].productName : "",
      barcode: values.items.length === 1 ? values.items[0].barcode : "",
      unit: values.items.length === 1 ? values.items[0].unit : "",
      qty: values.items.length === 1 ? values.items[0].qty : 0,
      freeQty: values.items.length === 1 ? values.items[0].freeQty : 0,
      totalReceivedQty: values.items.length === 1
        ? values.items[0].totalReceivedQty
        : 0,
      rate: values.items.length === 1 ? values.items[0].rate : 0,
      expiryDate: values.items.length === 1
        ? values.items[0].expiryDate
        : "",
      discount: values.discount,
      vat: values.vat,
      subtotal: values.subtotal,
      total: values.total,
      paidAmount: values.paid,
      balance: values.balance,
      paymentMethod: els.payment?.value || "CASH",
      note: els.note?.value.trim() || "",
      createdAt
    };

    const financeTransaction = makeFinanceTransaction(purchase);

    try {
      // Update each Product stock only after all validation succeeds.
      const updatedProducts = products.map(p => ({ ...p }));

      values.items.forEach(item => {
        const product = updatedProducts.find(
          p => String(p.id) === String(item.productId)
        );

        product.stock = num(product.stock) + item.totalReceivedQty;
        product.purchasePrice = item.rate;
      });

      // Update supplier balance. Positive balance means payable.
      const updatedSuppliers = suppliers.map(s => ({ ...s }));
      const supplierIndex = updatedSuppliers.findIndex(
        s => String(s.id) === String(supplier.id)
      );

      const updatedSupplier = updatedSuppliers[supplierIndex];
      updatedSupplier.currentBalance =
        num(updatedSupplier.currentBalance) + purchase.balance;
      updatedSupplier.purchaseTotal =
        num(updatedSupplier.purchaseTotal) + purchase.total;
      updatedSupplier.updatedAt = createdAt;

      // One FIFO Lot for each purchased Product row.
      const updatedLots = lots.map(lot => ({ ...lot }));

      values.items.forEach((item, index) => {
        updatedLots.push({
          id: "LOT-" + purchaseId + "-" + (index + 1),
          purchaseId,
          purchaseItemIndex: index,
          date: purchase.date,
          productId: item.productId,
          productName: item.productName,
          barcode: item.barcode || "",
          supplierName: purchase.supplierName,
          supplierId: purchase.supplierId,
          billNumber: purchase.billNumber,
          receivedQty: item.totalReceivedQty,
          remainingQty: item.totalReceivedQty,
          effectiveCost: item.effectiveCost,
          expiryDate: item.expiryDate || "",
          source: "PURCHASE",
          createdAt
        });
      });

      const updatedPurchases = [...purchases, purchase];
      const updatedFinance = finance.map(entry => ({ ...entry }));

      if (financeTransaction) {
        updatedFinance.push(financeTransaction);
      }

      saveStores({
        [PRODUCT_KEY]: updatedProducts,
        [SUPPLIER_KEY]: updatedSuppliers,
        [LOT_KEY]: updatedLots,
        [FINANCE_KEY]: updatedFinance,
        [PURCHASE_KEY]: updatedPurchases
      });
    } catch (error) {
      console.error("Purchase save failed:", error);
      toast(error.message || "Purchase सुरक्षित गर्न सकिएन।", "error");
      return;
    }

    closeModal();
    renderPurchases();

    toast(
      "Purchase सुरक्षित भयो। Product Stock, FIFO Lots र Supplier Payable अपडेट भए।" +
      (financeTransaction ? " Finance Payment पनि सुरक्षित भयो।" : "")
    );
  }

  /* ---------------- Events ---------------- */

  function bindEvents() {
    els.newBtn?.addEventListener("click", openModal);
    els.closeBtn?.addEventListener("click", closeModal);
    els.cancelBtn?.addEventListener("click", closeModal);

    els.modal?.addEventListener("click", event => {
      if (event.target === els.modal) closeModal();
    });

    els.addItem?.addEventListener("click", () => addItemRow());

    els.supplier?.addEventListener("change", updateSupplierTax);

    [els.vat, els.paid].forEach(input => {
      input?.addEventListener("input", calculate);
    });

    els.payment?.addEventListener("change", () => {
      if (els.payment.value === "CREDIT" && els.paid) {
        els.paid.value = "0";
      }
      calculate();
    });

    els.form?.addEventListener("submit", savePurchase);
    els.search?.addEventListener("input", renderPurchases);

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && els.modal?.classList.contains("show")) {
        closeModal();
      }
    });
  }

  /* ---------------- Initialize ---------------- */

  function init() {
    if (!els.form || !els.itemsBody || !els.modal) {
      console.error("Purchase module: आवश्यक HTML elements भेटिएनन्।");
      return;
    }

    ensureScannerUI();
    bindEvents();
    renderPurchases();

    console.log("Purchase module loaded.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
