ल/* =========================================================
   GS GENERAL STORE MANAGEMENT SYSTEM
   SALE MODULE — MULTI-PRODUCT A4 INVOICE
   Barcode + FIFO + Daily Invoice Prefix + Signature
   ========================================================= */

(() => {
  "use strict";

  const PRODUCT_KEY = "gs_products";
  const SALE_KEY = "gs_sales";
  const LOT_KEY = "gs_stock_lots";
  const SETTINGS_KEY = "gs_settings";
  const $ = id => document.getElementById(id);

  let cameraStream = null;
  let scanTimer = null;
  let detector = null;
  let scannerOpen = false;
  let lastScannedCode = "";
  let lastScanTime = 0;
  let billItems = [];

  /* ---------------- Storage ---------------- */

  function read(key, fallback = []) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const value = JSON.parse(raw);
      return value == null ? fallback : value;
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

  function readSettings() {
    const value = read(SETTINGS_KEY, {});
    return value && typeof value === "object" && !Array.isArray(value)
      ? value : {};
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function money(value) {
    const currency = String(readSettings().currency || "NPR").toUpperCase();
    const symbols = {
      NPR: "Rs.", RS: "Rs.", INR: "₹",
      USD: "$", GBP: "£", EUR: "€"
    };

    return (symbols[currency] || currency) + " " +
      num(value).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  function today() {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("-");
  }

  function newId(prefix) {
    return prefix + "-" + Date.now() + "-" +
      Math.floor(Math.random() * 1000000);
  }

  /* ---------------- Daily Invoice Number ---------------- */

  function billNumberDetails(dateValue = $("saleDate")?.value || today()) {
    const settings = readSettings();
    const prefix = String(settings.invoicePrefix || "INV")
      .trim().replace(/\s+/g, "-") || "INV";

    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(dateValue || ""))
      ? new Date(dateValue + "T00:00:00") : new Date();

    const datePart = [
      String(date.getDate()).padStart(2, "0"),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getFullYear())
    ].join("");

    const counterKey = "gs_invoice_counter_" + datePart;
    const counter = (Number(localStorage.getItem(counterKey)) || 0) + 1;

    return {
      billNumber: prefix + "-" + datePart +
        String(counter).padStart(2, "0"),
      counterKey,
      counter
    };
  }

  function newBillNumber(dateValue) {
    return billNumberDetails(dateValue).billNumber;
  }

  /* ---------------- Notifications ---------------- */

  function toast(message, type = "success") {
    let box = $("saleToast");

    if (!box) {
      box = document.createElement("div");
      box.id = "saleToast";
      box.setAttribute("role", "status");
      box.setAttribute("aria-live", "polite");

      Object.assign(box.style, {
        position: "fixed",
        left: "50%",
        bottom: "20px",
        transform: "translateX(-50%)",
        zIndex: "10010",
        maxWidth: "calc(100% - 32px)",
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
      ? "#b91c1c" : type === "info" ? "#1d4ed8" : "#166534";

    box.textContent = message;
    box.style.display = "block";
    clearTimeout(box._hideTimer);

    box._hideTimer = setTimeout(() => {
      box.style.display = "none";
    }, 4200);
  }

  /* ---------------- Sale Modal ---------------- */

  const modal = $("saleModal");
  const form = $("saleForm");

  function openSaleModal() {
    if (!modal) {
      toast("Sale Modal भेटिएन। sale.html जाँच्नुहोस्।", "error");
      return;
    }

    modal.hidden = false;
    modal.style.display = "block";
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");

    if ($("saleDate") && !$("saleDate").value) {
      $("saleDate").value = today();
    }

    if ($("billNumber")) {
      $("billNumber").readOnly = true;
      $("billNumber").value = newBillNumber($("saleDate")?.value);
    }

    loadProducts();
    applySaleDefaults();
    renderBillItems();
    calculateSale();
  }

  function closeSaleModal() {
    stopCamera();
    if (!modal) return;

    modal.classList.remove("show");
    modal.style.display = "none";
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }

  $("newSaleBtn")?.addEventListener("click", openSaleModal);
  $("closeSaleModal")?.addEventListener("click", closeSaleModal);
  $("cancelSaleBtn")?.addEventListener("click", closeSaleModal);

  modal?.addEventListener("click", e => {
    if (e.target === modal) closeSaleModal();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeSaleModal();
  });

  /* ---------------- Products ---------------- */

  function getProducts() {
    return readArray(PRODUCT_KEY);
  }

  function isActive(p) {
    return p && p.active !== false && p.status !== "INACTIVE";
  }

  function selectedProduct() {
    const id = $("saleProduct")?.value;
    if (!id) return null;

    return getProducts().find(p => String(p.id) === String(id)) || null;
  }

  function findProductByBarcode(code) {
    const barcode = String(code || "").trim();
    if (!barcode) return null;

    return getProducts().find(p =>
      isActive(p) && String(p.barcode || "").trim() === barcode
    ) || null;
  }

  function loadProducts() {
    const select = $("saleProduct");
    if (!select) return;

    const previous = select.value;
    const products = getProducts();

    select.innerHTML = '<option value="">Product छान्नुहोस्</option>';

    products.filter(isActive).forEach(p => {
      const option = document.createElement("option");
      option.value = p.id;
      option.textContent =
        `${p.name || "Product"} — Stock: ${num(p.stock)} ${p.unit || ""}` +
        (p.barcode ? ` — ${p.barcode}` : "");
      select.appendChild(option);
    });

    if (previous && products.some(p =>
      isActive(p) && String(p.id) === String(previous)
    )) {
      select.value = previous;
    }

    updateProductInfo();
  }

  function updateProductInfo() {
    const p = selectedProduct();

    if ($("infoProduct")) $("infoProduct").textContent = p?.name || "-";
    if ($("infoUnit")) $("infoUnit").textContent = p?.unit || "-";
    if ($("infoStock")) $("infoStock").textContent = p ? num(p.stock) : "0";

    if ($("stockInfo")) {
      $("stockInfo").textContent = p
        ? `Available stock: ${num(p.stock)} ${p.unit || ""}`
        : "Available stock: -";
    }

    if (p && $("saleRate") && !$("saleRate").value) {
      $("saleRate").value = num(p.salePrice || p.sellingPrice);
    }

    calculateSale();
  }

  /* ---------------- Multi-Product Bill UI ---------------- */

  function ensureMultiProductUI() {
    if (!$("saleForm") || $("saleBillItemsPanel")) return;

    const anchor = $("saleProduct")?.closest(".sale-field")
      || $("saleProduct")?.parentElement;

    if (!anchor) return;

    const panel = document.createElement("section");
    panel.id = "saleBillItemsPanel";
    panel.style.cssText =
      "margin:14px 0;padding:14px;border:1px solid #d1d5db;" +
      "border-radius:12px;background:var(--card-bg,transparent)";

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <strong>🧾 एउटै बिलमा सामानहरू</strong>
        <span id="saleBillItemCount">0 प्रकारका सामान</span>
      </div>

      <div style="overflow-x:auto;margin-top:10px">
        <table style="width:100%;border-collapse:collapse;min-width:520px">
          <thead>
            <tr style="background:#166534;color:white">
              <th style="padding:9px">Product</th>
              <th style="padding:9px">Qty</th>
              <th style="padding:9px">Rate</th>
              <th style="padding:9px">Discount</th>
              <th style="padding:9px">Amount</th>
              <th style="padding:9px">Action</th>
            </tr>
          </thead>
          <tbody id="saleBillItemsBody"></tbody>
        </table>
      </div>

      <div style="display:flex;justify-content:flex-end;margin-top:12px">
        <div style="width:300px;max-width:100%">
          <div style="display:flex;justify-content:space-between;padding:4px 0">
            <span>Subtotal</span><strong id="saleCartSubtotal">Rs. 0.00</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:4px 0">
            <span>Total Discount</span><strong id="saleCartDiscount">Rs. 0.00</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:9px 0;border-top:2px solid #166534;color:#166534;font-size:17px">
            <span>Grand Total</span><strong id="saleCartTotal">Rs. 0.00</strong>
          </div>
        </div>
      </div>

      <button type="button" id="saleAddItemBtn" class="sale-btn primary" style="margin-top:10px">
        ＋ हालको Product बिलमा थप्नुहोस्
      </button>
      <button type="button" id="saleClearItemsBtn" class="sale-btn" style="margin-top:10px">
        सबै सामान हटाउनुहोस्
      </button>
      <p style="font-size:12px;margin-bottom:0">
        Product, Quantity, Rate र Discount राखेर “बिलमा थप्नुहोस्” थिच्नुहोस्।
        अर्को सामानका लागि Product छान्नुहोस्।
      </p>
    `;

    anchor.parentNode.insertBefore(panel, anchor.nextSibling);

    $("saleAddItemBtn").addEventListener("click", addCurrentItem);

    $("saleClearItemsBtn").addEventListener("click", () => {
      if (!billItems.length || confirm("बिलका सबै सामान हटाउने?")) {
        billItems = [];
        renderBillItems();
        calculateSale();
      }
    });

    $("saleBillItemsBody").addEventListener("click", e => {
      const button = e.target.closest("[data-remove-bill-item]");
      if (!button) return;

      billItems.splice(Number(button.dataset.removeBillItem), 1);
      renderBillItems();
      calculateSale();
    });
  }

  function currentEntry() {
    const p = selectedProduct();
    if (!p) throw new Error("कृपया Product छान्नुहोस्।");

    const qty = num($("saleQty")?.value);
    const rate = num($("saleRate")?.value);
    const discount = num($("saleDiscount")?.value);
    const alreadyAdded = billItems
      .filter(i => String(i.productId) === String(p.id))
      .reduce((sum, i) => sum + num(i.qty), 0);

    if (qty <= 0) throw new Error("Quantity शून्यभन्दा बढी हुनुपर्छ।");
    if (rate <= 0) throw new Error("Sale Rate शून्यभन्दा बढी हुनुपर्छ।");
    if (discount < 0 || discount > qty * rate) {
      throw new Error("Discount मिलाउनुहोस्।");
    }

    if (qty + alreadyAdded > num(p.stock)) {
      throw new Error(
        `पर्याप्त Stock छैन। ${p.name} को उपलब्ध Stock: ` +
        `${num(p.stock) - alreadyAdded}`
      );
    }

    return {
      productId: p.id,
      productName: p.name || "",
      barcode: String(p.barcode || "").trim(),
      unit: p.unit || "",
      qty,
      rate,
      discount,
      itemAmount: qty * rate,
      total: Math.max(0, qty * rate - discount)
    };
  }

  function addCurrentItem() {
    try {
      const item = currentEntry();

      const same = billItems.find(i =>
        String(i.productId) === String(item.productId) &&
        num(i.rate) === num(item.rate) &&
        num(i.discount) === 0 && num(item.discount) === 0
      );

      if (same) {
        same.qty += item.qty;
        same.itemAmount = same.qty * same.rate;
        same.total = same.itemAmount - same.discount;
      } else {
        billItems.push(item);
      }

      renderBillItems();

      if ($("saleQty")) $("saleQty").value = "1";
      if ($("saleDiscount")) $("saleDiscount").value = "0";
      if ($("paidAmount")) $("paidAmount").value = "0";

      calculateSale();
      toast(`${item.productName} बिलमा थपियो।`);
    } catch (error) {
      toast(error.message, "error");
    }
  }

  function renderBillItems() {
    const body = $("saleBillItemsBody");

    if (body) {
      body.innerHTML = billItems.length
        ? billItems.map((item, index) => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #ddd">
              ${esc(item.productName)}<br>
              <small>${esc(item.barcode || "Barcode: -")}</small>
            </td>
            <td style="padding:8px;text-align:right">${num(item.qty)} ${esc(item.unit)}</td>
            <td style="padding:8px;text-align:right">${money(item.rate)}</td>
            <td style="padding:8px;text-align:right">${money(item.discount)}</td>
            <td style="padding:8px;text-align:right">${money(item.total)}</td>
            <td style="padding:8px;text-align:center">
              <button type="button" class="sale-btn danger"
                data-remove-bill-item="${index}">हटाउनुहोस्</button>
            </td>
          </tr>
        `).join("")
        : '<tr><td colspan="6" style="padding:14px;text-align:center">सामान थपिएको छैन।</td></tr>';
    }

    if ($("saleBillItemCount")) {
      $("saleBillItemCount").textContent = `${billItems.length} प्रकारका सामान`;
    }

    const subtotal = billItems.reduce((s, i) => s + num(i.itemAmount), 0);
    const discount = billItems.reduce((s, i) => s + num(i.discount), 0);
    const total = billItems.reduce((s, i) => s + num(i.total), 0);

    if ($("saleCartSubtotal")) $("saleCartSubtotal").textContent = money(subtotal);
    if ($("saleCartDiscount")) $("saleCartDiscount").textContent = money(discount);
    if ($("saleCartTotal")) $("saleCartTotal").textContent = money(total);
  }

  /* ---------------- Barcode Scanner ---------------- */

  function createScannerUI() {
    if ($("saleBarcodePanel")) return;

    const field = $("saleProduct")?.closest(".sale-field");
    if (!field) return;

    const panel = document.createElement("section");
    panel.id = "saleBarcodePanel";
    panel.className = "sale-notice";
    panel.style.marginBottom = "14px";

    panel.innerHTML = `
      <strong>Barcode Scanner</strong>
      <p>Barcode लेख्नुहोस् वा क्यामेराबाट Scan गर्नुहोस्।</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <input id="saleBarcodeInput" type="search" inputmode="numeric"
          autocomplete="off" placeholder="Barcode नम्बर..."
          aria-label="Barcode नम्बर"
          style="flex:1;min-width:150px;padding:11px;border:1px solid #d1d5db;border-radius:8px">
        <button id="saleBarcodeFind" class="sale-btn primary" type="button">Find / Add</button>
        <button id="saleStartCamera" class="sale-btn" type="button">📷 Scan</button>
      </div>
      <div id="saleCameraArea" hidden style="margin-top:12px">
        <video id="saleCameraVideo" autoplay muted playsinline
          style="width:100%;max-width:480px;max-height:320px;background:#111"></video>
        <p id="saleCameraStatus">क्यामेरा सुरु हुँदैछ...</p>
        <button id="saleStopCamera" class="sale-btn danger" type="button">Stop Camera</button>
      </div>
      <p id="saleBarcodeStatus" aria-live="polite"></p>
    `;

    field.parentNode.insertBefore(panel, field);

    $("saleBarcodeFind").addEventListener("click", () =>
      lookupBarcode($("saleBarcodeInput").value)
    );

    $("saleBarcodeInput").addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        lookupBarcode($("saleBarcodeInput").value);
      }
    });

    $("saleStartCamera").addEventListener("click", startCamera);
    $("saleStopCamera").addEventListener("click", stopCamera);
  }

  function setBarcodeStatus(message, type = "info") {
    const el = $("saleBarcodeStatus");
    if (!el) return;

    el.textContent = message;
    el.style.color = type === "error" ? "#b91c1c"
      : type === "success" ? "#15803d" : "inherit";
  }

  function lookupBarcode(rawCode, fromCamera = false) {
    const code = String(rawCode || "").trim();

    if (!code) {
      setBarcodeStatus("पहिले Barcode नम्बर राख्नुहोस्।", "error");
      return;
    }

    const p = findProductByBarcode(code);

    if (!p) {
      setBarcodeStatus("Barcode भएको Active Product भेटिएन।", "error");
      toast("Barcode बाट Product भेटिएन।", "error");
      return;
    }

    const select = $("saleProduct");
    if (!select) return;

    select.value = String(p.id);

    if ($("saleQty")) $("saleQty").value = "1";
    if ($("saleRate")) $("saleRate").value = num(p.salePrice || p.sellingPrice);
    if ($("saleDiscount")) $("saleDiscount").value = "0";

    updateProductInfo();

    setBarcodeStatus(
      `Product: ${p.name} | Barcode: ${code} | Stock: ${num(p.stock)}`,
      "success"
    );

    if ($("saleBarcodeInput")) $("saleBarcodeInput").value = "";

    toast(fromCamera
      ? `${p.name} Scan भयो। बिलमा थप्नुहोस् थिच्नुहोस्।`
      : `${p.name} छानियो। बिलमा थप्नुहोस् थिच्नुहोस्।`
    );

    $("saleQty")?.focus();
  }

  async function startCamera() {
    if (scannerOpen) return;

    if (!navigator.mediaDevices?.getUserMedia || !("BarcodeDetector" in window)) {
      setBarcodeStatus("यो Browser मा Camera Barcode Scan उपलब्ध छैन। Manual Barcode प्रयोग गर्नुहोस्।", "error");
      return;
    }

    try {
      detector = new BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e",
          "code_128", "code_39", "codabar", "itf", "qr_code"]
      });
    } catch (e) {
      detector = new BarcodeDetector();
    }

    const area = $("saleCameraArea");
    const video = $("saleCameraVideo");
    if (!area || !video) return;

    area.hidden = false;
    scannerOpen = true;

    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } }
      });

      video.srcObject = cameraStream;
      await video.play();
      scanTimer = setInterval(scanVideoFrame, 300);
    } catch (error) {
      stopCamera();
      setBarcodeStatus("क्यामेरा खोल्न सकिएन। Permission र HTTPS जाँच्नुहोस्।", "error");
    }
  }

  async function scanVideoFrame() {
    if (!scannerOpen || !detector) return;

    const video = $("saleCameraVideo");
    if (!video || video.readyState < 2) return;

    try {
      const codes = await detector.detect(video);
      if (!codes?.length) return;

      const code = String(codes[0].rawValue || "").trim();
      const now = Date.now();

      if (!code || (code === lastScannedCode && now - lastScanTime < 1800)) return;

      lastScannedCode = code;
      lastScanTime = now;

      stopCamera();

      if ($("saleBarcodeInput")) $("saleBarcodeInput").value = code;
      lookupBarcode(code, true);
    } catch (error) {
      console.debug("Barcode frame skipped:", error);
    }
  }

  function stopCamera() {
    scannerOpen = false;

    if (scanTimer) {
      clearInterval(scanTimer);
      scanTimer = null;
    }

    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      cameraStream = null;
    }

    const video = $("saleCameraVideo");
    if (video) video.srcObject = null;

    const area = $("saleCameraArea");
    if (area) area.hidden = true;
  }

  /* ---------------- Sale Calculation ---------------- */

  function calculateSale() {
    const qty = num($("saleQty")?.value);
    const rate = num($("saleRate")?.value);
    const discountInput = num($("saleDiscount")?.value);
    const paid = num($("paidAmount")?.value);

    const amount = qty * rate;
    const discount = Math.min(Math.max(0, discountInput), amount);
    const total = Math.max(0, amount - discount);

    const cartSubtotal = billItems.reduce((s, i) => s + num(i.itemAmount), 0);
    const cartDiscount = billItems.reduce((s, i) => s + num(i.discount), 0);
    const cartTotal = billItems.reduce((s, i) => s + num(i.total), 0);

    const hasItems = billItems.length > 0;
    const shownTotal = hasItems ? cartTotal : total;
    const shownPaid = paid;
    const balance = Math.max(0, shownTotal - shownPaid);

    if ($("previewItemAmount")) {
      $("previewItemAmount").textContent = money(hasItems ? cartSubtotal : amount);
    }
    if ($("previewDiscount")) {
      $("previewDiscount").textContent = money(hasItems ? cartDiscount : discount);
    }
    if ($("previewTotal")) $("previewTotal").textContent = money(shownTotal);
    if ($("previewPaid")) $("previewPaid").textContent = money(shownPaid);
    if ($("previewBalance")) $("previewBalance").textContent = money(balance);

    if ($("infoQty")) {
      $("infoQty").textContent = String(hasItems
        ? billItems.reduce((s, i) => s + num(i.qty), 0) : qty);
    }

    if ($("infoPayment")) {
      $("infoPayment").textContent = $("paymentMethod")?.value || "CASH";
    }

    renderBillItems();
    return { qty, rate, discount, itemAmount: amount, total, paid, balance };
  }

  function applySaleDefaults() {
    const settings = readSettings();

    if ($("paymentMethod") && settings.defaultPayment) {
      const payment = String(settings.defaultPayment).toUpperCase();
      const exists = [...$("paymentMethod").options].some(
        o => o.value.toUpperCase() === payment
      );

      if (exists) $("paymentMethod").value = payment;
    }
  }

  [
    "saleProduct", "saleQty", "saleRate",
    "saleDiscount", "paidAmount", "paymentMethod"
  ].forEach(id => {
    const el = $(id);
    if (!el) return;

    el.addEventListener("input", () => {
      if (id === "saleProduct") {
        if ($("saleRate")) $("saleRate").value = "";
        updateProductInfo();
      } else {
        calculateSale();
      }
    });

    el.addEventListener("change", () => {
      if (id === "saleProduct") updateProductInfo();
      else calculateSale();
    });
  });

  /* ---------------- Sales History ---------------- */

  function renderSales() {
    const tbody = $("salesHistoryBody");

    const allSales = readArray(SALE_KEY)
      .filter(s => !s.voided && !s.isVoid)
      .sort((a, b) => String(b.createdAt || b.date || "")
        .localeCompare(String(a.createdAt || a.date || "")));

    const query = ($("saleSearch")?.value || "").toLowerCase().trim();
    const products = getProducts();
    const groups = new Map();

    allSales.forEach(s => {
      const key = String(s.billNumber || s.id);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    });

    const shown = [...groups.entries()].filter(([, items]) =>
      items.some(s => {
        const p = products.find(x => String(x.id) === String(s.productId));

        return [
          s.date, s.billNumber, s.customerName, s.productName,
          s.barcode, p?.barcode, s.paymentMethod
        ].some(v => String(v || "").toLowerCase().includes(query));
      })
    );

    if (tbody) {
      tbody.innerHTML = shown.length ? shown.map(([key, items]) => {
        const s = items[0];
        const total = items.reduce((a, x) => a + num(x.total), 0);
        const paid = Math.max(...items.map(x => num(x.paidAmount)));
        const balance = Math.max(0, total - paid);

        return `<tr>
          <td>${esc(s.date || "-")}</td>
          <td>${esc(s.billNumber || "-")}</td>
          <td>${esc(s.customerName || "Walk-in Customer")}</td>
          <td>${esc(items.map(x => x.productName || "-").join(", "))}<br>
            <small>${items.length} item type(s)</small></td>
          <td>${items.reduce((a, x) => a + num(x.qty), 0)}</td>
          <td>${money(total)}</td>
          <td>${money(paid)}</td>
          <td>${money(balance)}</td>
          <td>${esc(s.paymentMethod || "-")}</td>
          <td><button type="button" class="sale-btn"
            data-view-sale="${esc(s.id)}">View Bill</button></td>
        </tr>`;
      }).join("") : '<tr><td colspan="10" class="sale-empty">Sales विवरण छैन।</td></tr>';
    }

    if ($("totalSales")) $("totalSales").textContent = String(groups.size);

    if ($("salesValue")) {
      $("salesValue").textContent = money(
        [...groups.values()].reduce((t, items) =>
          t + items.reduce((a, s) => a + num(s.total), 0), 0)
      );
    }

    if ($("salesPaidValue")) {
      $("salesPaidValue").textContent = money(
        [...groups.values()].reduce((t, items) =>
          t + Math.max(...items.map(s => num(s.paidAmount))), 0)
      );
    }

    if ($("salesBalanceValue")) {
      $("salesBalanceValue").textContent = money(
        [...groups.values()].reduce((t, items) => {
          const total = items.reduce((a, s) => a + num(s.total), 0);
          const paid = Math.max(...items.map(s => num(s.paidAmount)));
          return t + Math.max(0, total - paid);
        }, 0)
      );
    }
  }

  $("saleSearch")?.addEventListener("input", renderSales);

  $("saleDate")?.addEventListener("change", () => {
    if ($("billNumber")) {
      $("billNumber").value = newBillNumber($("saleDate").value);
    }
  });

  /* ---------------- A4 Invoice / PDF / Signature ---------------- */

  $("salesHistoryBody")?.addEventListener("click", event => {
    const button = event.target.closest("[data-view-sale]");
    if (!button) return;

    const allSales = readArray(SALE_KEY);
    const selected = allSales.find(s => String(s.id) === button.dataset.viewSale);

    if (!selected) {
      toast("Sale record भेटिएन।", "error");
      return;
    }

    const items = allSales.filter(s =>
      !s.voided && !s.isVoid &&
      String(s.billNumber || s.id) === String(selected.billNumber || selected.id)
    );

    const billItemsForPrint = items.length ? items : [selected];
    const config = readSettings();
    const win = window.open("", "_blank");

    if (!win) {
      toast("Bill खोल्न Browser मा Popup अनुमति दिनुहोस्।", "error");
      return;
    }

    const storeName = config.storeName || "General Store";
    const storeAddress = config.storeAddress || "";
    const storePhone = config.storePhone || "";
    const storeEmail = config.storeEmail || "";
    const ownerName = config.ownerName || "";
    const taxNumber = config.taxNumber || "";
    const invoiceFooter = config.invoiceFooter || "हाम्रो पसलमा आउनुभएकोमा धन्यवाद!";

    const photo = config.operatorPhoto
      ? `<img class="store-photo" src="${esc(config.operatorPhoto)}" alt="Store photo">`
      : "";

    const subtotal = billItemsForPrint.reduce((s, i) => s + num(i.itemAmount), 0);
    const discount = billItemsForPrint.reduce((s, i) => s + num(i.discount), 0);
    const grandTotal = billItemsForPrint.reduce((s, i) => s + num(i.total), 0);
    const paid = Math.max(...billItemsForPrint.map(i => num(i.paidAmount)));
    const balance = Math.max(0, grandTotal - paid);

    const rows = billItemsForPrint.map((item, index) => {
      const product = getProducts().find(p => String(p.id) === String(item.productId));
      const barcode = item.barcode || product?.barcode || "-";

      return `<tr>
        <td class="center">${index + 1}</td>
        <td>${esc(item.productName || "-")}</td>
        <td>${esc(barcode)}</td>
        <td class="num">${num(item.qty)} ${esc(item.unit || "")}</td>
        <td class="num">${money(item.rate)}</td>
        <td class="num">${money(item.itemAmount)}</td>
      </tr>`;
    }).join("");

    win.document.open();
    win.document.write(`<!doctype html>
<html lang="ne">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${esc(selected.billNumber || "")}</title>
<style>
@page{size:A4 portrait;margin:12mm}
*{box-sizing:border-box}
body{margin:0;background:#eef2ef;color:#1f2937;font-family:Arial,"Noto Sans Devanagari",sans-serif;font-size:11px;line-height:1.45}
.invoice{width:100%;max-width:186mm;min-height:273mm;margin:0 auto;background:#fff;padding:8mm 9mm;display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:13px;padding-bottom:10px;border-bottom:2px solid #166534}
.store-photo{width:68px;height:68px;object-fit:contain;border:1px solid #e5e7eb;border-radius:8px;padding:3px;flex-shrink:0}
.brand-info{flex:1;min-width:0}
.brand h1{font-size:23px;line-height:1.25;color:#166534;margin:0 0 4px;overflow-wrap:anywhere}
.brand p{margin:1px 0;color:#4b5563;overflow-wrap:anywhere}
.brand .contact{display:flex;flex-wrap:wrap;gap:4px 18px}
.invoice-title{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:13px 0 11px}
.invoice-title h2{font-size:19px;letter-spacing:.7px;margin:0}
.invoice-title span{font-weight:700;color:#166534;border:1px solid #bbd7c2;padding:4px 10px;border-radius:4px}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px;padding:10px 12px;background:#f3f7f4;border:1px solid #dbe7dd;border-radius:6px;margin-bottom:12px}
.meta p{margin:0;line-height:1.55;overflow-wrap:anywhere}
table{width:100%;border-collapse:collapse;table-layout:fixed}
th{background:#166534;color:#fff;font-weight:700}
td,th{border:1px solid #d1d5db;padding:8px 7px;text-align:left;overflow-wrap:anywhere}
th:nth-child(1){width:6%}
th:nth-child(2){width:34%}
th:nth-child(3){width:17%}
th:nth-child(4){width:12%}
th:nth-child(5){width:15%}
th:nth-child(6){width:16%}
.center{text-align:center}
.num{text-align:right;white-space:nowrap}
tbody tr:nth-child(even){background:#f8faf9}
.totals-wrap{display:flex;justify-content:flex-end;width:100%;margin-top:12px}
.totals{width:80%;max-width:100mm;border-collapse:collapse}
.totals td{padding:6px 8px;border:0;border-bottom:1px solid #e5e7eb}
.totals td:last-child{text-align:right;font-weight:600;white-space:nowrap}
.totals .grand td{font-size:15px;font-weight:700;color:#166534;border-top:2px solid #166534;border-bottom:2px solid #166534;background:#f3f7f4}
.notes{margin-top:12px;padding:9px 11px;border-left:3px solid #166534;background:#f8faf8;overflow-wrap:anywhere}
.bottom-area{margin-top:auto;padding-top:18px}
.signature-row{display:flex;justify-content:space-between;gap:28px;margin:12px 0 20px;page-break-inside:avoid}
.signature{width:43%;text-align:center;padding-top:27px;border-bottom:1px solid #374151}
.signature span{position:relative;top:7px;background:#fff;padding:0 8px;color:#374151}
.footer{margin-top:14px;padding-top:10px;text-align:center;border-top:1px solid #d1d5db;color:#4b5563;line-height:1.6}
.footer .thanks{font-weight:700;color:#166534;font-size:14px;margin-bottom:3px}
.footer .contact{display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:4px 20px;margin:4px 0}
.actions{display:flex;justify-content:center;gap:10px;margin:18px auto}
button{padding:10px 18px;border:0;border-radius:7px;background:#166534;color:white;cursor:pointer;font-size:14px}
@media print{body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.invoice{max-width:none;min-height:273mm;padding:0}.actions{display:none}.bottom-area{margin-top:auto}}
@media screen{body{background:#eef2ef;padding:16px}.invoice{box-shadow:0 3px 18px #0002;min-height:273mm}}
@media(max-width:520px){.brand h1{font-size:19px}.store-photo{width:55px;height:55px}.meta{grid-template-columns:1fr}.totals{width:100%}td,th{padding:6px 4px;font-size:10px}.signature-row{gap:16px}}
</style>
</head>
<body>
<main class="invoice">
<header class="brand">
${photo}
<div class="brand-info">
<h1>${esc(storeName)}</h1>
${storeAddress ? `<p>${esc(storeAddress)}</p>` : ""}
<div class="contact">
${storePhone ? `<p>Phone: ${esc(storePhone)}</p>` : ""}
${storeEmail ? `<p>Email: ${esc(storeEmail)}</p>` : ""}
</div>
${ownerName ? `<p>Owner: ${esc(ownerName)}</p>` : ""}
${taxNumber ? `<p>PAN/VAT: ${esc(taxNumber)}</p>` : ""}
</div>
</header>

<section class="invoice-title">
<h2>SALES INVOICE</h2><span>ORIGINAL</span>
</section>

<section class="meta">
<p><strong>Invoice No.:</strong> ${esc(selected.billNumber || "-")}</p>
<p><strong>Date:</strong> ${esc(selected.date || "-")}</p>
<p><strong>Customer:</strong> ${esc(selected.customerName || "Walk-in Customer")}</p>
<p><strong>Payment:</strong> ${esc(selected.paymentMethod || "-")}</p>
</section>

<table>
<thead><tr>
<th class="center">SN</th><th>Product / Description</th><th>Barcode</th>
<th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>

<div class="totals-wrap">
<table class="totals">
<tr><td>Subtotal</td><td>${money(subtotal)}</td></tr>
<tr><td>Discount</td><td>${money(discount)}</td></tr>
<tr class="grand"><td>Grand Total</td><td>${money(grandTotal)}</td></tr>
<tr><td>Paid Amount</td><td>${money(paid)}</td></tr>
<tr><td>Balance Due</td><td>${money(balance)}</td></tr>
</table>
</div>

${billItemsForPrint.some(i => i.note) ? `<section class="notes"><strong>Notes:</strong> ${esc([...new Set(billItemsForPrint.map(i => i.note).filter(Boolean))].join(" | "))}</section>` : ""}

<div class="bottom-area">
<div class="signature-row">
<div class="signature"><span>Customer Signature</span></div>
<div class="signature"><span>Authorized Signature</span></div>
</div>

<footer class="footer">
<div class="thanks">Thank you, visit again 🙏</div>
<strong>${esc(invoiceFooter)}</strong>
<div class="contact">
${storePhone ? `<span>Phone: ${esc(storePhone)}</span>` : ""}
${storeEmail ? `<span>Email: ${esc(storeEmail)}</span>` : ""}
</div>
<div>This is a computer-generated invoice.</div>
</footer>
</div>

<div class="actions">
<button type="button" onclick="window.print()">Print / Save as PDF</button>
<button type="button" onclick="window.close()">Close</button>
</div>
</main>
</body>
</html>`);
    win.document.close();
  });

  /* ---------------- FIFO ---------------- */

  function allocateFIFO(lots, productId, quantity, productStock) {
    const productLots = lots
      .filter(l => String(l.productId) === String(productId) && num(l.remainingQty) > 0)
      .sort((a, b) =>
        String(a.date || a.purchaseDate || "").localeCompare(
          String(b.date || b.purchaseDate || "")
        )
      );

    const lotTotal = productLots.reduce((s, l) => s + num(l.remainingQty), 0);

    if (Math.abs(lotTotal - num(productStock)) > 0.000001) {
      throw new Error(
        `FIFO Stock नमिलेको छ। Product Stock: ${num(productStock)}, ` +
        `Lot Stock: ${lotTotal}। बिक्री सुरक्षित गरिएको छैन।`
      );
    }

    let remaining = quantity;
    let fifoCost = 0;
    const allocations = [];

    for (const lot of productLots) {
      if (remaining <= 0.000001) break;

      const used = Math.min(num(lot.remainingQty), remaining);
      if (used <= 0) continue;

      const unitCost = num(lot.effectiveCost ?? lot.unitCost ?? lot.costPrice);

      allocations.push({
        lotId: lot.id,
        qty: used,
        unitCost,
        cost: used * unitCost
      });

      fifoCost += used * unitCost;
      remaining -= used;
    }

    if (remaining > 0.000001) {
      throw new Error("FIFO Lot मा पर्याप्त स्टक छैन। बिक्री सुरक्षित गरिएको छैन।");
    }

    const updatedLots = lots.map(l => ({ ...l }));

    allocations.forEach(a => {
      const lot = updatedLots.find(x => String(x.id) === String(a.lotId));

      if (!lot || num(lot.remainingQty) < a.qty) {
        throw new Error("FIFO Lot परिवर्तन भएको छ। फेरि प्रयास गर्नुहोस्।");
      }

      lot.remainingQty = Math.max(0, num(lot.remainingQty) - a.qty);
    });

    return { allocations, fifoCost, updatedLots };
  }

  function saveSaleTransaction(updatedLots, updatedProducts, updatedSales, counterUpdate) {
    const keys = [LOT_KEY, PRODUCT_KEY, SALE_KEY];
    if (counterUpdate?.key) keys.push(counterUpdate.key);

    const oldValues = {};
    keys.forEach(k => { oldValues[k] = localStorage.getItem(k); });

    try {
      write(LOT_KEY, updatedLots);
      write(PRODUCT_KEY, updatedProducts);
      write(SALE_KEY, updatedSales);

      if (counterUpdate?.key) {
        localStorage.setItem(counterUpdate.key, String(counterUpdate.value));
      }
    } catch (error) {
      keys.forEach(k => {
        try {
          if (oldValues[k] === null) localStorage.removeItem(k);
          else localStorage.setItem(k, oldValues[k]);
        } catch (rollbackError) {
          console.error("Rollback error:", k, rollbackError);
        }
      });

      throw new Error("Storage मा Sale सुरक्षित गर्न सकिएन। पुरानो Data फर्काउने प्रयास गरियो।");
    }
  }

  /* ---------------- Save Sale ---------------- */

  if (form) {
    form.addEventListener("submit", event => {
      event.preventDefault();

      try {
        let itemsToSave = billItems.map(i => ({ ...i }));

        // सामान सूचीमा केही नथपिएको भए पुरानो एकल-सामान बिक्री पनि चल्छ।
        if (!itemsToSave.length) itemsToSave = [currentEntry()];

        const dateValue = $("saleDate")?.value;
        if (!dateValue) throw new Error("Sale Date राख्नुहोस्।");

        const allProducts = getProducts();
        const updatedProducts = allProducts.map(p => ({ ...p }));
        let workingLots = readArray(LOT_KEY).map(l => ({ ...l }));
        const updatedSales = readArray(SALE_KEY);

        const totals = itemsToSave.reduce((a, i) => {
          a.total += num(i.total);
          a.subtotal += num(i.itemAmount);
          a.discount += num(i.discount);
          return a;
        }, { total: 0, subtotal: 0, discount: 0 });

        const paid = num($("paidAmount")?.value);

        if (paid < 0 || paid > totals.total) {
          throw new Error("Paid Amount Grand Total भन्दा बढी वा शून्यभन्दा कम हुन मिल्दैन।");
        }

        // सबै सामानको संयुक्त Quantity पहिले जाँच्ने।
        const quantities = new Map();

        itemsToSave.forEach(i => {
          const id = String(i.productId);
          quantities.set(id, (quantities.get(id) || 0) + num(i.qty));
        });

        quantities.forEach((qty, id) => {
          const p = updatedProducts.find(x => String(x.id) === id);

          if (!p || !isActive(p)) {
            throw new Error("बिलमा भएको Product Active छैन वा भेटिएन।");
          }

          if (qty > num(p.stock)) {
            throw new Error(`पर्याप्त Stock छैन। ${p.name}: उपलब्ध ${num(p.stock)}।`);
          }
        });

        const billInfo = billNumberDetails(dateValue);
        const billNumber = billInfo.billNumber;
        if ($("billNumber")) $("billNumber").value = billNumber;

        const commonId = newId("BILL");
        const customerName = $("customerName")?.value.trim() || "";
        const paymentMethod = $("paymentMethod")?.value || "CASH";
        const note = $("saleNote")?.value.trim() || "";

        itemsToSave.forEach(item => {
          const product = updatedProducts.find(
            p => String(p.id) === String(item.productId)
          );

          const fifo = allocateFIFO(
            workingLots, product.id, num(item.qty), product.stock
          );

          workingLots = fifo.updatedLots;

          product.stock = Math.max(0, num(product.stock) - num(item.qty));
          product.salePrice = num(item.rate);

          updatedSales.push({
            id: newId("SALE"),
            billId: commonId,
            date: dateValue,
            billNumber,
            customerName,
            productId: product.id,
            productName: item.productName || product.name || "",
            barcode: item.barcode || product.barcode || "",
            unit: item.unit || product.unit || "",
            qty: num(item.qty),
            rate: num(item.rate),
            discount: num(item.discount),
            itemAmount: num(item.itemAmount),
            total: num(item.total),
            paidAmount: paid,
            balance: Math.max(0, totals.total - paid),
            paymentMethod,
            note,
            fifoAllocations: fifo.allocations,
            fifoCost: fifo.fifoCost,
            profit: num(item.total) - fifo.fifoCost,
            createdAt: new Date().toISOString()
          });
        });

        saveSaleTransaction(
          workingLots,
          updatedProducts,
          updatedSales,
          { key: billInfo.counterKey, value: billInfo.counter }
        );

        toast(`Sale सफल भयो। ${itemsToSave.length} प्रकारका सामान | Bill: ${billNumber}`);

        billItems = [];
        form.reset();

        if ($("saleDate")) $("saleDate").value = today();
        if ($("billNumber")) $("billNumber").value = newBillNumber($("saleDate")?.value);
        if ($("saleQty")) $("saleQty").value = "1";
        if ($("saleRate")) $("saleRate").value = "";
        if ($("saleDiscount")) $("saleDiscount").value = "0";
        if ($("paidAmount")) $("paidAmount").value = "0";

        loadProducts();
        applySaleDefaults();
        renderBillItems();
        calculateSale();
        renderSales();
        closeSaleModal();

      } catch (error) {
        console.error("Sale save error:", error);
        toast(error.message || "Sale सुरक्षित गर्न सकिएन।", "error");
      }
    });
  }

  /* ---------------- Form Reset ---------------- */

  form?.addEventListener("reset", () => {
    stopCamera();

    setTimeout(() => {
      if ($("saleDate")) $("saleDate").value = today();
      if ($("billNumber")) $("billNumber").value = newBillNumber();

      loadProducts();
      applySaleDefaults();
      renderBillItems();
      calculateSale();

      if ($("saleBarcodeStatus")) $("saleBarcodeStatus").textContent = "";
    }, 0);
  });

  /* ---------------- Initialize ---------------- */

  function initialize() {
    createScannerUI();
    ensureMultiProductUI();

    if ($("saleDate")) $("saleDate").value = today();

    if ($("billNumber")) {
      $("billNumber").readOnly = true;
      $("billNumber").placeholder = "Settings Prefix अनुसार स्वतः बन्नेछ";
      $("billNumber").value = newBillNumber($("saleDate")?.value);
    }

    if ($("saleQty") && !$("saleQty").value) $("saleQty").value = "1";
    if ($("saleDiscount") && $("saleDiscount").value === "") $("saleDiscount").value = "0";
    if ($("paidAmount") && $("paidAmount").value === "") $("paidAmount").value = "0";

    loadProducts();
    applySaleDefaults();
    renderBillItems();
    renderSales();
    calculateSale();
    closeSaleModal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
