
/* =========================================================
   GS GENERAL STORE MANAGEMENT SYSTEM
   SALE MODULE — BARCODE SCAN + FIFO + SETTINGS
   Existing storage keys and single-product sale format kept.
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

  function readSettings() {
    const value = read(SETTINGS_KEY, {});
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function money(value) {
    const settings = readSettings();
    const currency = String(settings.currency || "NPR").toUpperCase();

    const symbols = {
      NPR: "Rs.",
      RS: "Rs.",
      INR: "₹",
      USD: "$",
      GBP: "£",
      EUR: "€"
    };

    const symbol = symbols[currency] || currency;

    return symbol + " " + num(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
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

  function newBillNumber() {
    const settings = readSettings();
    const prefix = String(settings.invoicePrefix || "SALE")
      .trim()
      .replace(/\s+/g, "-");

    return prefix + "-" + Date.now();
  }

  function newId(prefix) {
    return prefix + "-" + Date.now() + "-" +
      Math.floor(Math.random() * 1000000);
  }

  /* ---------------- In-page notification ---------------- */

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
        width: "max-content",
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
      ? "#b91c1c"
      : type === "info"
        ? "#1d4ed8"
        : "#166534";

    box.textContent = message;
    box.style.display = "block";

    clearTimeout(box._hideTimer);
    box._hideTimer = setTimeout(() => {
      box.style.display = "none";
    }, 4200);
  }

  /* ---------------- Modal helpers ---------------- */

  const modal = $("saleModal");
  const form = $("saleForm");

  function openSaleModal() {
    if (!modal) {
      toast("Sale Modal भेटिएन। sale.html को संरचना जाँच्नुहोस्।", "error");
      return;
    }

    modal.hidden = false;
    modal.style.display = "block";
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");

    if ($("saleDate") && !$("saleDate").value) {
      $("saleDate").value = today();
    }

    if ($("billNumber") && !$("billNumber").value) {
      $("billNumber").value = newBillNumber();
    }

    loadProducts();
    applySaleDefaults();
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

  modal?.addEventListener("click", event => {
    if (event.target === modal) closeSaleModal();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeSaleModal();
  });

  /* ---------------- Product helpers ---------------- */

  function getProducts() {
    return readArray(PRODUCT_KEY);
  }

  function isActive(product) {
    return product &&
      product.active !== false &&
      product.status !== "INACTIVE";
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
      isActive(p) &&
      String(p.barcode || "").trim() === barcode
    ) || null;
  }

  function loadProducts() {
    const select = $("saleProduct");
    if (!select) return;

    const previous = select.value;
    const products = getProducts();

    select.innerHTML = '<option value="">Product छान्नुहोस्</option>';

    products.filter(isActive).forEach(product => {
      const option = document.createElement("option");
      option.value = product.id;

      option.textContent =
        `${product.name || "Product"} — Stock: ` +
        `${num(product.stock)} ${product.unit || ""}` +
        (product.barcode ? ` — ${product.barcode}` : "");

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
    const product = selectedProduct();

    if ($("infoProduct")) {
      $("infoProduct").textContent = product?.name || "-";
    }

    if ($("infoUnit")) {
      $("infoUnit").textContent = product?.unit || "-";
    }

    if ($("infoStock")) {
      $("infoStock").textContent = product ? num(product.stock) : "0";
    }

    if ($("stockInfo")) {
      $("stockInfo").textContent = product
        ? `Available stock: ${num(product.stock)} ${product.unit || ""}`
        : "Available stock: -";
    }

    if (product && $("saleRate") && !$("saleRate").value) {
      $("saleRate").value = num(product.salePrice || product.sellingPrice);
    }

    calculateSale();
  }

  /* ---------------- Barcode scanner UI ---------------- */

  function createScannerUI() {
    if ($("saleBarcodePanel")) return;

    const productField = $("saleProduct")?.closest(".sale-field");

    if (!productField) {
      console.error("saleProduct field भेटिएन।");
      return;
    }

    const panel = document.createElement("section");
    panel.id = "saleBarcodePanel";
    panel.className = "sale-notice";
    panel.style.marginBottom = "14px";

    panel.innerHTML = `
      <strong>Barcode Scanner</strong>
      <p>Barcode नम्बर लेख्नुहोस् वा मोबाइल क्यामेराबाट Scan गर्नुहोस्।</p>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <input
          id="saleBarcodeInput"
          type="search"
          inputmode="numeric"
          autocomplete="off"
          placeholder="Barcode नम्बर..."
          aria-label="Barcode नम्बर"
          style="flex:1;min-width:150px;padding:11px;border:1px solid var(--border-color,#d1d5db);border-radius:8px;background:var(--input-bg,transparent);color:inherit"
        >
        <button id="saleBarcodeFind" class="sale-btn primary" type="button">
          Find / Add
        </button>
        <button id="saleStartCamera" class="sale-btn" type="button">
          📷 Scan
        </button>
      </div>

      <div id="saleCameraArea" hidden style="margin-top:12px">
        <video
          id="saleCameraVideo"
          autoplay
          muted
          playsinline
          style="width:100%;max-width:480px;max-height:320px;object-fit:contain;background:#111;border-radius:10px"
        ></video>
        <p id="saleCameraStatus" aria-live="polite">
          क्यामेरा सुरु हुँदैछ...
        </p>
        <button id="saleStopCamera" class="sale-btn danger" type="button">
          Stop Camera
        </button>
      </div>

      <p id="saleBarcodeStatus" aria-live="polite" style="margin-bottom:0"></p>
    `;

    productField.parentNode.insertBefore(panel, productField);

    $("saleBarcodeFind").addEventListener("click", () => {
      lookupBarcode($("saleBarcodeInput").value);
    });

    $("saleBarcodeInput").addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
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
    el.style.color = type === "error"
      ? "#b91c1c"
      : type === "success"
        ? "#15803d"
        : "inherit";
  }

  function lookupBarcode(rawCode, fromCamera = false) {
    const code = String(rawCode || "").trim();

    if (!code) {
      setBarcodeStatus("पहिले Barcode नम्बर राख्नुहोस्।", "error");
      return;
    }

    const product = findProductByBarcode(code);

    if (!product) {
      setBarcodeStatus(
        "यो Barcode भएको Active Product भेटिएन। Inventory मा Barcode जाँच्नुहोस्।",
        "error"
      );
      toast("Barcode बाट Product भेटिएन।", "error");
      return;
    }

    const select = $("saleProduct");
    if (!select) return;

    select.value = String(product.id);

    if (select.value !== String(product.id)) {
      setBarcodeStatus("Product Select गर्न सकिएन।", "error");
      return;
    }

    // उही Product फेरि Scan गर्दा Quantity बढाउने।
    const qtyInput = $("saleQty");
    const oldProductId = lookupBarcode._lastProductId;
    const currentQty = num(qtyInput?.value);

    if (qtyInput) {
      if (oldProductId === String(product.id) && currentQty > 0) {
        qtyInput.value = String(currentQty + 1);
      } else {
        qtyInput.value = "1";
      }
    }

    lookupBarcode._lastProductId = String(product.id);

    if ($("saleRate")) {
      $("saleRate").value = num(product.salePrice || product.sellingPrice);
    }

    if ($("saleDiscount")) $("saleDiscount").value = "0";
    if ($("paidAmount")) $("paidAmount").value = "0";

    updateProductInfo();

    setBarcodeStatus(
      `Product: ${product.name} | Barcode: ${code} | ` +
      `Stock: ${num(product.stock)} ${product.unit || ""}`,
      "success"
    );

    if ($("saleBarcodeInput")) $("saleBarcodeInput").value = "";

    if (fromCamera) {
      toast(`${product.name} Scan भयो। Quantity: ${num(qtyInput?.value)}`);
    } else {
      toast(`${product.name} Sale Form मा थपियो।`);
    }

    qtyInput?.focus();
  }

  /* ---------------- Mobile camera scan ---------------- */

  async function startCamera() {
    if (scannerOpen) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setBarcodeStatus(
        "यो Browser मा Camera उपलब्ध छैन। Barcode हातैले राख्नुहोस्।",
        "error"
      );
      return;
    }

    if (!("BarcodeDetector" in window)) {
      setBarcodeStatus(
        "यो Browser ले Native Barcode Scan समर्थन गर्दैन। " +
        "Barcode हातैले राखेर Find / Add थिच्नुहोस्।",
        "error"
      );
      toast("Camera Barcode Scan उपलब्ध छैन; Manual Barcode प्रयोग गर्नुहोस्।", "info");
      return;
    }

    try {
      detector = new BarcodeDetector({
        formats: [
          "ean_13",
          "ean_8",
          "upc_a",
          "upc_e",
          "code_128",
          "code_39",
          "codabar",
          "itf",
          "qr_code"
        ]
      });
    } catch (error) {
      try {
        detector = new BarcodeDetector();
      } catch (fallbackError) {
        setBarcodeStatus("Barcode Detector सुरु हुन सकेन।", "error");
        return;
      }
    }

    const area = $("saleCameraArea");
    const video = $("saleCameraVideo");

    if (!area || !video) return;

    area.hidden = false;
    scannerOpen = true;

    if ($("saleCameraStatus")) {
      $("saleCameraStatus").textContent =
        "क्यामेरा अनुमति दिनुहोस् र Barcode क्यामेरामा देखाउनुहोस्।";
    }

    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" }
        }
      });

      video.srcObject = cameraStream;
      await video.play();

      scanTimer = setInterval(scanVideoFrame, 300);
    } catch (error) {
      console.error("Camera error:", error);
      stopCamera();

      setBarcodeStatus(
        "क्यामेरा खोल्न सकिएन। Browser Permission र HTTPS जाँच्नुहोस्।",
        "error"
      );
    }
  }

  async function scanVideoFrame() {
    if (!scannerOpen || !detector) return;

    const video = $("saleCameraVideo");

    if (!video || video.readyState < 2) return;

    try {
      const codes = await detector.detect(video);
      if (!codes || !codes.length) return;

      const code = String(codes[0].rawValue || "").trim();
      if (!code) return;

      const now = Date.now();

      if (code === lastScannedCode && now - lastScanTime < 1800) {
        return;
      }

      lastScannedCode = code;
      lastScanTime = now;

      stopCamera();
      if ($("saleBarcodeInput")) $("saleBarcodeInput").value = code;

      lookupBarcode(code, true);
    } catch (error) {
      // क्यामेराको एउटा Frame पढ्न नसक्दा Scan प्रक्रिया जारी रहन्छ।
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
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }

    const video = $("saleCameraVideo");
    if (video) video.srcObject = null;

    const area = $("saleCameraArea");
    if (area) area.hidden = true;
  }

  /* ---------------- Sale calculation ---------------- */

  function calculateSale() {
    const qty = num($("saleQty")?.value);
    const rate = num($("saleRate")?.value);
    const discountInput = num($("saleDiscount")?.value);
    const paid = num($("paidAmount")?.value);

    const itemAmount = qty * rate;
    const discount = Math.min(Math.max(0, discountInput), itemAmount);
    const total = Math.max(0, itemAmount - discount);
    const balance = Math.max(0, total - paid);

    if ($("previewItemAmount")) {
      $("previewItemAmount").textContent = money(itemAmount);
    }
    if ($("previewDiscount")) {
      $("previewDiscount").textContent = money(discount);
    }
    if ($("previewTotal")) {
      $("previewTotal").textContent = money(total);
    }
    if ($("previewPaid")) {
      $("previewPaid").textContent = money(paid);
    }
    if ($("previewBalance")) {
      $("previewBalance").textContent = money(balance);
    }
    if ($("infoQty")) {
      $("infoQty").textContent = String(qty);
    }
    if ($("infoPayment")) {
      $("infoPayment").textContent =
        $("paymentMethod")?.value || "CASH";
    }

    return { qty, rate, discount, itemAmount, total, paid, balance };
  }

  function applySaleDefaults() {
    const settings = readSettings();

    if ($("paymentMethod") && settings.defaultPayment) {
      const payment = String(settings.defaultPayment).toUpperCase();
      const optionExists = [...$("paymentMethod").options].some(
        option => option.value.toUpperCase() === payment
      );

      if (optionExists) $("paymentMethod").value = payment;
    }
  }

  [
    "saleProduct",
    "saleQty",
    "saleRate",
    "saleDiscount",
    "paidAmount",
    "paymentMethod"
  ].forEach(id => {
    const el = $(id);
    if (!el) return;

    el.addEventListener("input", () => {
      if (id === "saleProduct") {
        if ($("saleRate")) $("saleRate").value = "";
        lookupBarcode._lastProductId = null;
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

  /* ---------------- Sales history ---------------- */

  function renderSales() {
    const tbody = $("salesHistoryBody");
    const allSales = readArray(SALE_KEY)
      .filter(s => !s.voided && !s.isVoid)
      .sort((a, b) =>
        String(b.createdAt || b.date || "").localeCompare(
          String(a.createdAt || a.date || "")
        )
      );

    const query = ($("saleSearch")?.value || "").toLowerCase().trim();

    const shown = allSales.filter(s => {
      const product = getProducts().find(
        p => String(p.id) === String(s.productId)
      );

      return [
        s.date,
        s.billNumber,
        s.customerName,
        s.productName,
        s.barcode,
        product?.barcode,
        s.paymentMethod
      ].some(value =>
        String(value || "").toLowerCase().includes(query)
      );
    });

    if (tbody) {
      tbody.innerHTML = shown.length
        ? shown.map(s => {
            const product = getProducts().find(
              p => String(p.id) === String(s.productId)
            );

            const barcode = s.barcode || product?.barcode || "-";

            return `
              <tr>
                <td>${esc(s.date || "-")}</td>
                <td>${esc(s.billNumber || "-")}</td>
                <td>${esc(s.customerName || "Walk-in Customer")}</td>
                <td>
                  ${esc(s.productName || "-")}
                  <br>
                  <small>Barcode: ${esc(barcode)}</small>
                </td>
                <td>${num(s.qty)}</td>
                <td>${money(s.total)}</td>
                <td>${money(s.paidAmount)}</td>
                <td>${money(s.balance)}</td>
                <td>${esc(s.paymentMethod || "-")}</td>
                <td>
                  <button type="button"
                    class="sale-btn"
                    data-view-sale="${esc(s.id)}">
                    View Bill
                  </button>
                </td>
              </tr>
            `;
          }).join("")
        : '<tr><td colspan="10" class="sale-empty">Sales विवरण छैन।</td></tr>';
    }

    if ($("totalSales")) {
      $("totalSales").textContent = String(allSales.length);
    }

    if ($("salesValue")) {
      $("salesValue").textContent = money(
        allSales.reduce((total, sale) => total + num(sale.total), 0)
      );
    }

    if ($("salesPaidValue")) {
      $("salesPaidValue").textContent = money(
        allSales.reduce((total, sale) => total + num(sale.paidAmount), 0)
      );
    }

    if ($("salesBalanceValue")) {
      $("salesBalanceValue").textContent = money(
        allSales.reduce((total, sale) => total + num(sale.balance), 0)
      );
    }
  }

  $("saleSearch")?.addEventListener("input", renderSales);

  $("salesHistoryBody")?.addEventListener("click", event => {
    const button = event.target.closest("[data-view-sale]");
    if (!button) return;

    const sale = readArray(SALE_KEY).find(
      s => String(s.id) === button.dataset.viewSale
    );

    if (!sale) {
      toast("Sale record भेटिएन।", "error");
      return;
    }

    const product = getProducts().find(
      p => String(p.id) === String(sale.productId)
    );

    const barcode = sale.barcode || product?.barcode || "-";
    const win = window.open("", "_blank");

    if (!win) {
      toast("Bill खोल्न Browser मा Popup अनुमति दिनुहोस्।", "error");
      return;
    }

    win.document.write(`
      <!doctype html>
      <html lang="ne">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Sale Bill</title>
        <style>
          body{font-family:Arial,sans-serif;padding:24px;color:#111}
          table{width:100%;border-collapse:collapse}
          td,th{border:1px solid #ccc;padding:8px;text-align:left}
          .right{text-align:right}
          @media print{button{display:none}}
        </style>
      </head>
      <body>
        <h2>GENERAL STORE</h2>
        <h3>Sales Receipt</h3>
        <p>Bill: ${esc(sale.billNumber)}</p>
        <p>Date: ${esc(sale.date)}</p>
        <p>Customer: ${esc(sale.customerName || "Walk-in Customer")}</p>

        <table>
          <tr>
            <th>Product</th><th>Barcode</th><th>Qty</th>
            <th>Rate</th><th>Amount</th>
          </tr>
          <tr>
            <td>${esc(sale.productName)}</td>
            <td>${esc(barcode)}</td>
            <td>${num(sale.qty)} ${esc(sale.unit || "")}</td>
            <td>${money(sale.rate)}</td>
            <td>${money(sale.itemAmount)}</td>
          </tr>
        </table>

        <p class="right">Discount: ${money(sale.discount)}</p>
        <h3 class="right">Total: ${money(sale.total)}</h3>
        <p class="right">Paid: ${money(sale.paidAmount)}</p>
        <p class="right">Balance: ${money(sale.balance)}</p>
        <p>Payment: ${esc(sale.paymentMethod || "-")}</p>
        <p>Notes: ${esc(sale.note || "-")}</p>
        <button onclick="window.print()">Print</button>
      </body>
      </html>
    `);

    win.document.close();
  });

  /* ---------------- FIFO sale saving ---------------- */

  function allocateFIFO(lots, productId, quantity, productStock) {
    const productLots = lots
      .filter(lot =>
        String(lot.productId) === String(productId) &&
        num(lot.remainingQty) > 0
      )
      .sort((a, b) =>
        String(a.date || a.purchaseDate || "").localeCompare(
          String(b.date || b.purchaseDate || "")
        )
      );

    const lotTotal = productLots.reduce(
      (sum, lot) => sum + num(lot.remainingQty), 0
    );

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
      throw new Error(
        "FIFO Lot मा पर्याप्त स्टक छैन। बिक्री सुरक्षित गरिएको छैन।"
      );
    }

    // यहाँ original lots लाई मात्र calculation गरेर प्रतिलिपिमा update गरिन्छ।
    const updatedLots = lots.map(lot => ({ ...lot }));

    for (const allocation of allocations) {
      const lot = updatedLots.find(
        item => String(item.id) === String(allocation.lotId)
      );

      if (!lot || num(lot.remainingQty) < allocation.qty) {
        throw new Error("FIFO Lot परिवर्तन भएको छ। फेरि प्रयास गर्नुहोस्।");
      }

      lot.remainingQty = Math.max(
        0,
        num(lot.remainingQty) - allocation.qty
      );
    }

    return { allocations, fifoCost, updatedLots };
  }

  function saveSaleTransaction(updatedLots, updatedProducts, updatedSales) {
    const keys = [LOT_KEY, PRODUCT_KEY, SALE_KEY];
    const oldValues = {};

    keys.forEach(key => {
      oldValues[key] = localStorage.getItem(key);
    });

    try {
      // Sales record अन्त्यमा लेखिन्छ।
      write(LOT_KEY, updatedLots);
      write(PRODUCT_KEY, updatedProducts);
      write(SALE_KEY, updatedSales);
    } catch (error) {
      // कुनै लेखाइ असफल भए पुराना values फर्काउने प्रयास।
      keys.forEach(key => {
        try {
          if (oldValues[key] === null) {
            localStorage.removeItem(key);
          } else {
            localStorage.setItem(key, oldValues[key]);
          }
        } catch (rollbackError) {
          console.error("Rollback error:", key, rollbackError);
        }
      });

      throw new Error(
        "Storage मा Sale सुरक्षित गर्न सकिएन। पुरानो Data फर्काउने प्रयास गरियो।"
      );
    }
  }

  if (form) {
    form.addEventListener("submit", event => {
      event.preventDefault();

      try {
        const product = selectedProduct();

        if (!product) {
          toast("कृपया Product छान्नुहोस्।", "error");
          return;
        }

        const calc = calculateSale();

        if (!$("saleDate")?.value) {
          toast("Sale Date राख्नुहोस्।", "error");
          return;
        }

        if (calc.qty <= 0) {
          toast("Quantity शून्यभन्दा बढी हुनुपर्छ।", "error");
          return;
        }

        if (calc.rate <= 0) {
          toast("Sale Rate शून्यभन्दा बढी हुनुपर्छ।", "error");
          return;
        }

        if (calc.discount < 0 || calc.discount > calc.itemAmount) {
          toast("Discount मिलाउनुहोस्।", "error");
          return;
        }

        if (calc.paid < 0 || calc.paid > calc.total) {
          toast("Paid Amount मिलाउनुहोस्।", "error");
          return;
        }

        // Data लाई फेरि पढेर पछिल्लो Stock जाँच्ने।
        const allProducts = getProducts();
        const productIndex = allProducts.findIndex(
          p => String(p.id) === String(product.id)
        );

        if (productIndex < 0) {
          toast("Product record भेटिएन।", "error");
          return;
        }

        const currentProduct = allProducts[productIndex];

        if (!isActive(currentProduct)) {
          toast("यो Product Active छैन।", "error");
          return;
        }

        if (calc.qty > num(currentProduct.stock)) {
          toast(
            `पर्याप्त Stock छैन। उपलब्ध: ${num(currentProduct.stock)}`,
            "error"
          );
          return;
        }

        const allLots = readArray(LOT_KEY);
        const fifo = allocateFIFO(
          allLots,
          currentProduct.id,
          calc.qty,
          currentProduct.stock
        );

        const billNumber =
          $("billNumber")?.value.trim() || newBillNumber();

        const barcode = String(currentProduct.barcode || "").trim();

        const sale = {
          id: newId("SALE"),
          date: $("saleDate").value,
          billNumber,
          customerName: $("customerName")?.value.trim() || "",
          productId: currentProduct.id,
          productName: currentProduct.name || "",
          barcode,
          unit: currentProduct.unit || "",
          qty: calc.qty,
          rate: calc.rate,
          discount: calc.discount,
          itemAmount: calc.itemAmount,
          total: calc.total,
          paidAmount: calc.paid,
          balance: calc.balance,
          paymentMethod: $("paymentMethod")?.value || "CASH",
          note: $("saleNote")?.value.trim() || "",
          fifoAllocations: fifo.allocations,
          fifoCost: fifo.fifoCost,
          profit: calc.total - fifo.fifoCost,
          createdAt: new Date().toISOString()
        };

        const updatedProducts = allProducts.map(p => ({ ...p }));

        updatedProducts[productIndex].stock = Math.max(
          0,
          num(updatedProducts[productIndex].stock) - calc.qty
        );

        updatedProducts[productIndex].salePrice = calc.rate;

        const updatedSales = readArray(SALE_KEY);
        updatedSales.push(sale);

        // सबै validation र FIFO calculation सफल भएपछि मात्र Save।
        saveSaleTransaction(
          fifo.updatedLots,
          updatedProducts,
          updatedSales
        );

        toast("Sale सफलतापूर्वक सुरक्षित भयो।");

        form.reset();

        if ($("saleDate")) $("saleDate").value = today();
        if ($("billNumber")) $("billNumber").value = newBillNumber();
        if ($("saleQty")) $("saleQty").value = "";
        if ($("saleRate")) $("saleRate").value = "";
        if ($("saleDiscount")) $("saleDiscount").value = "0";
        if ($("paidAmount")) $("paidAmount").value = "0";

        lookupBarcode._lastProductId = null;

        loadProducts();
        applySaleDefaults();
        calculateSale();
        renderSales();
        closeSaleModal();
      } catch (error) {
        console.error("Sale save error:", error);
        toast(
          error.message || "Sale सुरक्षित गर्न सकिएन।",
          "error"
        );
      }
    });
  }

  /* ---------------- Form reset ---------------- */

  form?.addEventListener("reset", () => {
    stopCamera();

    setTimeout(() => {
      if ($("saleDate")) $("saleDate").value = today();
      if ($("billNumber")) $("billNumber").value = newBillNumber();

      lookupBarcode._lastProductId = null;

      loadProducts();
      applySaleDefaults();
      calculateSale();

      if ($("saleBarcodeStatus")) {
        $("saleBarcodeStatus").textContent = "";
      }
    }, 0);
  });

  /* ---------------- Initialize ---------------- */

  function initialize() {
    createScannerUI();

    if ($("saleDate")) $("saleDate").value = today();
    if ($("billNumber")) $("billNumber").value = newBillNumber();

    if ($("saleDiscount") && $("saleDiscount").value === "") {
      $("saleDiscount").value = "0";
    }

    if ($("paidAmount") && $("paidAmount").value === "") {
      $("paidAmount").value = "0";
    }

    loadProducts();
    applySaleDefaults();
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
