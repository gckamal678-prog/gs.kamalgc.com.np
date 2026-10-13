/* =========================================================
   GS GENERAL STORE MANAGEMENT SYSTEM
   SALE MODULE — A4 INVOICE + DAILY INVOICE PREFIX
   Barcode + FIFO + Existing Sales Data preserved
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

  /* ---------------- Invoice Prefix ---------------- */

  function billNumberDetails(dateValue = $("saleDate")?.value || today()) {
    const settings = readSettings();
    const prefix = String(settings.invoicePrefix || "INV")
      .trim()
      .replace(/\s+/g, "-") || "INV";

    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(dateValue || ""))
      ? new Date(String(dateValue) + "T00:00:00")
      : new Date();

    const datePart = [
      String(date.getDate()).padStart(2, "0"),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getFullYear())
    ].join("");

    const counterKey = "gs_invoice_counter_" + datePart;
    const counter = (Number(localStorage.getItem(counterKey)) || 0) + 1;

    return {
      billNumber: prefix + "-" + datePart + String(counter).padStart(2, "0"),
      counterKey,
      counter
    };
  }

  function newBillNumber(dateValue = $("saleDate")?.value || today()) {
    return billNumberDetails(dateValue).billNumber;
  }

  function newId(prefix) {
    return prefix + "-" + Date.now() + "-" +
      Math.floor(Math.random() * 1000000);
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

  /* ---------------- Sale Modal ---------------- */

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

    if ($("billNumber")) {
      $("billNumber").readOnly = true;
      $("billNumber").value = newBillNumber($("saleDate")?.value);
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

  /* ---------------- Products ---------------- */

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

  /* ---------------- Barcode Scanner UI ---------------- */

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

  /* ---------------- Mobile Camera Scan ---------------- */

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
        video: { facingMode: { ideal: "environment" } }
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

  /* ---------------- Sale Calculation ---------------- */

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

  /* ---------------- Sales History ---------------- */

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

  $("saleDate")?.addEventListener("change", () => {
    if ($("billNumber")) {
      $("billNumber").value = newBillNumber($("saleDate").value);
    }
  });

  /* ---------------- View / Print A4 Invoice ---------------- */

  
            display: flex;
            align-items: center;
            gap: 16px;
            padding-bottom: 16px;
            border-bottom: 3px solid #166534;
          }
          .store-photo {
            width: 76px;
            height: 76px;
            object-fit: contain;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 4px;
          }
          .brand-info { flex: 1; min-width: 0; }
          .brand h1 {
            margin: 0 0 6px;
            color: #166534;
            font-size: 25px;
            overflow-wrap: anywhere;
          }
          .brand p { margin: 3px 0; color: #4b5563; overflow-wrap: anywhere; }
          .invoice-title {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            margin: 18px 0;
          }
          .invoice-title h2 { margin: 0; font-size: 21px; letter-spacing: 1px; }
          .invoice-title span { color: #166534; font-weight: 700; }
          .meta {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 18px;
            padding: 13px;
            background: #f3f7f4;
            border: 1px solid #dbe7dd;
            border-radius: 8px;
            margin-bottom: 18px;
          }
          .meta p { margin: 0; line-height: 1.6; overflow-wrap: anywhere; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { background: #166534; color: white; font-weight: 700; }
          td, th { border: 1px solid #d1d5db; padding: 10px 8px; text-align: left; }
          .num { text-align: right; white-space: nowrap; }
          .totals { width: 78%; max-width: 105mm; margin: 16px 0 0 auto; }
          .totals div {
            display: flex;
            justify-content: space-between;
            gap: 18px;
            padding: 7px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .totals .grand {
            font-size: 16px;
            font-weight: 700;
            color: #166534;
            border-bottom: 2px solid #166534;
          }
          .notes {
            margin-top: 18px;
            padding: 10px 12px;
            border-left: 3px solid #166534;
            background: #f8faf8;
            overflow-wrap: anywhere;
          }
          .footer {
            margin-top: 28px;
            padding-top: 12px;
            text-align: center;
            border-top: 1px solid #d1d5db;
            color: #4b5563;
            line-height: 1.7;
          }
          .actions { display: flex; justify-content: center; gap: 10px; margin: 20px auto; }
          button {
            padding: 10px 18px;
            border: 0;
            border-radius: 7px;
            background: #166534;
            color: white;
            cursor: pointer;
            font-size: 14px;
          }
          @media print {
            .actions { display: none; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          @media screen {
            body { background: #e5e7eb; padding: 18px; }
            .invoice {
              background: white;
              min-height: 260mm;
              padding: 16mm;
              box-shadow: 0 3px 18px #0002;
            }
          }
        </style>
      </head>
      <body>


  /* ---------------- View / Print A4 Invoice ---------------- */

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

    const config = readSettings();
    const barcode = sale.barcode || product?.barcode || "-";
    const win = window.open("", "_blank");

    if (!win) {
      toast("Bill खोल्न Browser मा Popup अनुमति दिनुहोस्।", "error");
      return;
    }

    const storeName = config.storeName || "कृष्ण किराना पसल";
    const storeAddress = config.storeAddress || "";
    const storePhone = config.storePhone || "";
    const storeEmail = config.storeEmail || "";
    const ownerName = config.ownerName || "";
    const taxNumber = config.taxNumber || "";
    const invoiceFooter =
      config.invoiceFooter || "हाम्रो पसलमा आउनुभएकोमा धन्यवाद!";

    const photo = config.operatorPhoto
      ? `<img class="store-photo" src="${esc(config.operatorPhoto)}" alt="Store photo">`
      : "";

    win.document.write(`
      <!doctype html>
      <html lang="ne">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Invoice ${esc(sale.billNumber || "")}</title>

        <style>
          @page {
            size: A4 portrait;
            margin: 12mm;
          }

          * {
            box-sizing: border-box;
          }

          html, body {
            margin: 0;
            padding: 0;
            color: #27313a;
            font-family: Arial, "Noto Sans Devanagari", sans-serif;
            font-size: 12px;
          }

          .invoice {
            width: 100%;
            min-height: 273mm;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
          }

          /* Header */

          .brand {
            display: flex;
            align-items: center;
            gap: 14px;
            padding-bottom: 13px;
            border-bottom: 3px solid #17683a;
          }

          .store-photo {
            width: 19mm;
            height: 19mm;
            flex-shrink: 0;
            object-fit: contain;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 3px;
          }

          .brand-info {
            flex: 1;
            min-width: 0;
          }

          .brand h1 {
            margin: 0;
            color: #17683a;
            font-size: 21px;
            overflow-wrap: anywhere;
          }

          .owner-info {
            flex: 0 0 34%;
            text-align: right;
            align-self: center;
            overflow-wrap: anywhere;
          }

          .owner-info .owner {
            margin: 0 0 5px;
            color: #27313a;
            font-weight: 700;
          }

          .owner-info .address {
            margin: 0;
            color: #626b73;
          }

          .tax-number {
            margin-top: 5px;
            font-size: 10px;
          }

          /* Invoice heading */

          .invoice-title {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            margin: 14px 0;
          }

          .invoice-title h2 {
            margin: 0;
            font-size: 21px;
            letter-spacing: .3px;
          }

          .invoice-title span {
            color: #17683a;
            font-weight: 700;
            border: 1px solid #d9e4dd;
            border-radius: 5px;
            padding: 7px 10px;
          }

          /* Invoice details */

          .meta {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 16px;
            padding: 12px;
            background: #f0f6f2;
            border: 1px solid #d9e4dd;
            border-radius: 6px;
            margin-bottom: 14px;
          }

          .meta p {
            margin: 0;
            line-height: 1.6;
            overflow-wrap: anywhere;
          }

          /* Product table */

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            margin: 8px 0 0;
          }

          th {
            background: #17683a;
            color: white;
            font-weight: 700;
          }

          td, th {
            border: 1px solid #c9d0d3;
            padding: 9px 7px;
            text-align: left;
            overflow-wrap: anywhere;
          }

          th.num, td.num {
            text-align: right;
          }

          .num {
            white-space: nowrap;
          }

          /* Notes */

          .notes {
            margin-top: 8px;
            padding: 8px 10px;
            border-left: 3px solid #17683a;
            background: #f8faf8;
            overflow-wrap: anywhere;
          }

          /* Totals: directly below table, aligned right */

          .totals {
            width: 50%;
            max-width: 105mm;
            min-width: 76mm;
            margin: 12px 0 0 auto;
            padding-top: 0;
            align-self: flex-end;
            flex-shrink: 0;
          }

          .totals div {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            min-height: 29px;
            padding: 5px 8px;
            border-bottom: 1px solid #e0e4e2;
          }

          .totals div strong {
            white-space: nowrap;
            text-align: right;
          }

          .totals .grand {
            min-height: 36px;
            padding: 7px 8px;
            font-size: 16px;
            font-weight: 700;
            color: #17683a;
            background: #f0f6f2;
            border-top: 2px solid #17683a;
            border-bottom: 2px solid #17683a;
          }

          /* Signatures: retain space below totals */

          .signatures {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            gap: 25px;
            margin-top: auto;
            padding-top: 25px;
            padding-bottom: 12px;
            break-inside: avoid;
          }

          .signature {
            width: 42%;
            text-align: center;
          }

          .signature-line {
            height: 22px;
            border-bottom: 1px solid #626b73;
            margin-bottom: 6px;
          }

          .signature-label {
            font-size: 11px;
            color: #626b73;
          }

          /* Footer */

          .footer {
            flex-shrink: 0;
            margin-top: 0;
            padding-top: 10px;
            text-align: center;
            border-top: 1px solid #c9d0d3;
            color: #626b73;
            line-height: 1.7;
            overflow-wrap: anywhere;
          }

          .footer .thank-you {
            display: block;
            color: #17683a;
            font-size: 14px;
            font-weight: 700;
            margin-bottom: 3px;
          }

          .footer .contact {
            margin-top: 5px;
          }

          .actions {
            display: flex;
            justify-content: center;
            gap: 10px;
            margin: 15px auto;
          }

          .actions button {
            padding: 10px 18px;
            border: 0;
            border-radius: 7px;
            background: #17683a;
            color: white;
            cursor: pointer;
            font-size: 14px;
          }

          .actions button:last-child {
            background: #4b5563;
          }

          @media print {
            .actions {
              display: none !important;
            }

            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .invoice {
              min-height: 273mm;
            }

            .totals,
            .signatures,
            .footer {
              break-inside: avoid;
            }
          }

          @media screen {
            body {
              background: #e5e7eb;
              padding: 18px;
            }

            .invoice {
              max-width: 210mm;
              min-height: 273mm;
              padding: 12mm;
              background: white;
              box-shadow: 0 3px 18px #0002;
            }
          }

          @media screen and (max-width: 560px) {
            body {
              padding: 5px;
            }

            .invoice {
              padding: 12px;
              min-height: 0;
            }

            .brand {
              gap: 8px;
            }

            .store-photo {
              width: 48px;
              height: 48px;
            }

            .brand h1 {
              font-size: 16px;
            }

            .owner-info {
              flex-basis: 34%;
              font-size: 10px;
            }

            .meta {
              grid-template-columns: 1fr 1fr;
              gap: 8px;
              padding: 9px;
              font-size: 10px;
            }

            td, th {
              padding: 6px 4px;
              font-size: 10px;
            }

            .totals {
              width: 62%;
              min-width: 0;
              margin-top: 12px;
              font-size: 10px;
            }

            .totals div {
              gap: 6px;
              padding: 5px;
            }

            .totals .grand {
              font-size: 13px;
            }

            .signatures {
              margin-top: 35px;
              gap: 12px;
            }
          }
        </style>
      </head>

      <body>
        <main class="invoice">

          <header class="brand">
            ${photo}

            <div class="brand-info">
              <h1>${esc(storeName)}</h1>
            </div>

            <div class="owner-info">
              ${ownerName
                ? `<p class="owner">Owner: ${esc(ownerName)}</p>`
                : ""}
              ${storeAddress
                ? `<p class="address">${esc(storeAddress)}</p>`
                : ""}
              ${taxNumber
                ? `<p class="tax-number">PAN/VAT: ${esc(taxNumber)}</p>`
                : ""}
            </div>
          </header>

          <section class="invoice-title">
            <h2>SALES INVOICE</h2>
            <span>ORIGINAL</span>
          </section>

          <section class="meta">
            <p><strong>Invoice No.:</strong> ${esc(sale.billNumber || "-")}</p>
            <p><strong>Date:</strong> ${esc(sale.date || "-")}</p>
            <p><strong>Customer:</strong> ${esc(sale.customerName || "Walk-in Customer")}</p>
            <p><strong>Payment:</strong> ${esc(sale.paymentMethod || "-")}</p>
          </section>

          <table>
            <thead>
              <tr>
                <th style="width:6%">SN</th>
                <th style="width:34%">Product / Description</th>
                <th style="width:17%">Barcode</th>
                <th class="num" style="width:11%">Qty</th>
                <th class="num" style="width:15%">Rate</th>
                <th class="num" style="width:17%">Amount</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>1</td>
                <td>${esc(sale.productName || "-")}</td>
                <td>${esc(barcode)}</td>
                <td class="num">${num(sale.qty)} ${esc(sale.unit || "")}</td>
                <td class="num">${money(sale.rate)}</td>
                <td class="num">${money(sale.itemAmount)}</td>
              </tr>
            </tbody>
          </table>

          ${sale.note
            ? `<section class="notes"><strong>Notes:</strong> ${esc(sale.note)}</section>`
            : ""}

          <section class="totals">
            <div>
              <span>Subtotal</span>
              <strong>${money(sale.itemAmount)}</strong>
            </div>

            <div>
              <span>Discount</span>
              <strong>${money(sale.discount)}</strong>
            </div>

            <div class="grand">
              <span>Grand Total</span>
              <strong>${money(sale.total)}</strong>
            </div>

            <div>
              <span>Paid Amount</span>
              <strong>${money(sale.paidAmount)}</strong>
            </div>

            <div>
              <span>Balance Due</span>
              <strong>${money(sale.balance)}</strong>
            </div>
          </section>

          <section class="signatures">
            <div class="signature">
              <div class="signature-line"></div>
              <div class="signature-label">Customer Signature</div>
            </div>

            <div class="signature">
              <div class="signature-line"></div>
              <div class="signature-label">Authorized Signature</div>
            </div>
          </section>

          <footer class="footer">
            <strong class="thank-you">Thank you, visit again 🙏</strong>
            <strong>${esc(invoiceFooter)}</strong>

            <div class="contact">
              ${storePhone ? `Phone: ${esc(storePhone)}` : ""}
              ${storePhone && storeEmail ? "&nbsp;&nbsp;&nbsp;" : ""}
              ${storeEmail ? `Email: ${esc(storeEmail)}` : ""}
            </div>

            <div>This is a computer-generated invoice.</div>
          </footer>

          <div class="actions">
            <button type="button" onclick="window.print()">
              Print / Save as PDF
            </button>
            <button type="button" onclick="window.close()">
              Close
            </button>
          </div>

        </main>
      </body>
      </html>
    `);

    win.document.close();
  });


  /* ---------------- FIFO ---------------- */

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

  function saveSaleTransaction(updatedLots, updatedProducts, updatedSales, counterUpdate) {
    const keys = [LOT_KEY, PRODUCT_KEY, SALE_KEY];
    if (counterUpdate?.key) keys.push(counterUpdate.key);

    const oldValues = {};
    keys.forEach(key => {
      oldValues[key] = localStorage.getItem(key);
    });

    try {
      write(LOT_KEY, updatedLots);
      write(PRODUCT_KEY, updatedProducts);
      write(SALE_KEY, updatedSales);

      if (counterUpdate?.key) {
        localStorage.setItem(counterUpdate.key, String(counterUpdate.value));
      }
    } catch (error) {
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

  /* ---------------- Save Sale ---------------- */

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

        // सफल बिक्रीमा मात्र दैनिक क्रम संख्या सुरक्षित हुन्छ।
        const billInfo = billNumberDetails($("saleDate").value);
        const billNumber = billInfo.billNumber;

        if ($("billNumber")) $("billNumber").value = billNumber;

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

        saveSaleTransaction(
          fifo.updatedLots,
          updatedProducts,
          updatedSales,
          { key: billInfo.counterKey, value: billInfo.counter }
        );

        toast("Sale सफलतापूर्वक सुरक्षित भयो।");

        form.reset();

        if ($("saleDate")) $("saleDate").value = today();
        if ($("billNumber")) $("billNumber").value = newBillNumber($("saleDate")?.value);
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

  /* ---------------- Form Reset ---------------- */

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

    if ($("billNumber")) {
      $("billNumber").readOnly = true;
      $("billNumber").placeholder = "Settings Prefix अनुसार स्वतः बन्नेछ";
      $("billNumber").value = newBillNumber($("saleDate")?.value);
    }

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
