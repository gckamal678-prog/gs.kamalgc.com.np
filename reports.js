
/* =========================================================
   GS GENERAL STORE — REPORT MANAGEMENT SYSTEM
   Full replacement: report.js
   Features:
   - Sales, Purchase, Stock, Customer, Supplier, Profit reports
   - Date filtering and Refresh
   - One Print / Save PDF button per report
   - A4 print layout
   - Store details, logo/avatar and professional footer
   - LocalStorage based
========================================================= */

(() => {
  "use strict";

  const STORAGE = {
    sales: "gs_sales",
    purchases: "gs_purchases",
    products: "gs_products",
    customers: "gs_customers",
    suppliers: "gs_suppliers",
    finance: "gs_finance",
    settings: "gs_settings"
  };

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  let startDate = "";
  let endDate = "";
  let refreshInProgress = false;

  /* -------------------- STORAGE HELPERS -------------------- */

  function read(key, fallback = []) {
    try {
      const value = localStorage.getItem(key);
      if (value === null) return fallback;

      const parsed = JSON.parse(value);
      return parsed ?? fallback;
    } catch (error) {
      console.warn("GS Reports: Could not read", key, error);
      return fallback;
    }
  }

  function readArray(key) {
    const value = read(key, []);
    if (Array.isArray(value)) return value;

    if (value && typeof value === "object") {
      if (Array.isArray(value.data)) return value.data;
      if (Array.isArray(value.items)) return value.items;
      if (Array.isArray(value.records)) return value.records;
    }

    return [];
  }

  function settings() {
    const value = read(STORAGE.settings, {});
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  }

  function firstValue(object, keys, fallback = "") {
    for (const key of keys) {
      const value = object?.[key];

      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return value;
      }
    }

    return fallback;
  }

  function number(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === "string") {
      const cleaned = value.replace(/,/g, "").replace(/[^\d.-]/g, "");
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  function money(value) {
    const s = settings();
    const currency = String(
      firstValue(s, ["currency", "currencyCode"], "NPR")
    ).toUpperCase();

    const symbolMap = {
      NPR: "Rs. ",
      RS: "Rs. ",
      INR: "₹",
      USD: "$",
      GBP: "£",
      EUR: "€"
    };

    const symbol = symbolMap[currency] || (currency + " ");

    return symbol + number(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
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

  function formatDate(value) {
    if (!value) return "—";

    const date = parseDate(value);
    if (!date) return escapeHTML(value);

    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function parseDate(value) {
    if (!value) return null;

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === "number") {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const text = String(value).trim();

    // ISO date: YYYY-MM-DD
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      const d = new Date(
        Number(iso[1]),
        Number(iso[2]) - 1,
        Number(iso[3])
      );
      return Number.isNaN(d.getTime()) ? null : d;
    }

    // DD/MM/YYYY or DD-MM-YYYY
    const local = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (local) {
      const d = new Date(
        Number(local[3]),
        Number(local[2]) - 1,
        Number(local[1])
      );
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(text);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function recordDate(record) {
    return firstValue(record, [
      "date",
      "saleDate",
      "purchaseDate",
      "createdAt",
      "created_at",
      "invoiceDate",
      "billDate",
      "transactionDate",
      "updatedAt"
    ], "");
  }

  function inDateRange(record) {
    const value = recordDate(record);
    const date = parseDate(value);

    // If no date can be identified, don't accidentally hide the record.
    if (!date) return !startDate && !endDate;

    const day = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");

    if (startDate && day < startDate) return false;
    if (endDate && day > endDate) return false;

    return true;
  }

  function filtered(key) {
    return readArray(key).filter(inDateRange);
  }

  /* -------------------- STORE PROFILE -------------------- */

  function storeProfile() {
    const s = settings();

    const name = firstValue(s, [
      "storeName", "shopName", "businessName", "companyName", "name"
    ], "GS General Store");

    const address = firstValue(s, [
      "storeAddress", "shopAddress", "businessAddress", "address"
    ], "");

    const phone = firstValue(s, [
      "storePhone", "shopPhone", "businessPhone", "phone", "mobile",
      "phoneNumber", "contactNumber"
    ], "");

    const email = firstValue(s, [
      "storeEmail", "shopEmail", "businessEmail", "email"
    ], "");

    const owner = firstValue(s, [
      "ownerName", "storeOwner", "shopOwner", "proprietor", "preparedBy"
    ], "");

    // Support common logo/avatar/photo field names.
    const photo = firstValue(s, [
      "storeAvatar", "storeAvatarUrl", "shopAvatar", "shopAvatarUrl",
      "storePhoto", "shopPhoto", "businessPhoto",
      "avatar", "avatarUrl", "photo", "photoUrl",
      "logo", "logoUrl", "shopLogo", "storeLogo",
      "profileImage", "profilePhoto", "image", "imageUrl"
    ], "");

    return {
      name: String(name),
      address: String(address),
      phone: String(phone),
      email: String(email),
      owner: String(owner),
      photo: typeof photo === "string" ? photo : ""
    };
  }

  /* -------------------- DATA NORMALIZATION -------------------- */

  function amountOf(record) {
    return number(firstValue(record, [
      "grandTotal", "totalAmount", "total", "netTotal",
      "billTotal", "amount", "finalAmount", "payable"
    ], 0));
  }

  function paidOf(record) {
    return number(firstValue(record, [
      "paidAmount", "paid", "amountPaid", "received",
      "receivedAmount", "payment", "advance"
    ], 0));
  }

  function balanceOf(record) {
    const explicit = firstValue(record, [
      "balance", "due", "dueAmount", "remaining",
      "remainingAmount", "balanceAmount"
    ], null);

    if (explicit !== null) return Math.max(0, number(explicit));

    return Math.max(0, amountOf(record) - paidOf(record));
  }

  function recordName(record, type = "customer") {
    const keys = type === "supplier"
      ? ["supplierName", "supplier", "name", "partyName", "companyName"]
      : ["customerName", "customer", "name", "partyName", "buyerName"];

    const value = firstValue(record, keys, "");
    if (typeof value === "object" && value !== null) {
      return firstValue(value, ["name", "customerName", "supplierName"], "Walk-in");
    }

    return String(value || (type === "customer" ? "Walk-in Customer" : "Unknown Supplier"));
  }

  function itemsOf(record) {
    const items = firstValue(record, [
      "items", "products", "cart", "saleItems", "purchaseItems", "details"
    ], []);

    return Array.isArray(items) ? items : [];
  }

  function itemName(item) {
    return String(firstValue(item, [
      "productName", "name", "title", "itemName", "product"
    ], "Item"));
  }

  function itemQuantity(item) {
    return number(firstValue(item, [
      "quantity", "qty", "soldQty", "purchaseQty", "count"
    ], 0));
  }

  function itemRate(item) {
    return number(firstValue(item, [
      "rate", "price", "sellingPrice", "purchasePrice", "unitPrice"
    ], 0));
  }

  function itemAmount(item) {
    const explicit = firstValue(item, [
      "amount", "total", "lineTotal", "subtotal", "netAmount"
    ], null);

    return explicit === null
      ? itemQuantity(item) * itemRate(item)
      : number(explicit);
  }

  /* -------------------- REPORT HTML -------------------- */

  function statCard(label, value) {
    return `
      <div class="gs-report-stat">
        <div class="gs-report-stat-label">${escapeHTML(label)}</div>
        <div class="gs-report-stat-value">${escapeHTML(value)}</div>
      </div>
    `;
  }

  function table(headers, rows) {
    if (!rows.length) {
      return `
        <div class="gs-report-empty">
          No records found for the selected date range.
        </div>
      `;
    }

    return `
      <div class="gs-report-table-wrap">
        <table class="gs-report-table">
          <thead>
            <tr>${headers.map(h => `<th>${escapeHTML(h)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${row.map(cell => `<td>${cell === null || cell === undefined ? "" : cell}</td>`).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function statsHTML(cards) {
    return `<div class="gs-report-stats">${cards.join("")}</div>`;
  }

  function saleReport() {
    const records = filtered(STORAGE.sales);
    const total = records.reduce((sum, r) => sum + amountOf(r), 0);
    const paid = records.reduce((sum, r) => sum + paidOf(r), 0);
    const due = records.reduce((sum, r) => sum + balanceOf(r), 0);

    const rows = records.map(r => {
      const bill = firstValue(r, [
        "invoiceNumber", "billNumber", "invoiceNo", "billNo", "id"
      ], "—");

      const itemNames = itemsOf(r).map(itemName).join(", ") || "—";

      return [
        escapeHTML(bill),
        escapeHTML(formatDate(recordDate(r))),
        escapeHTML(recordName(r, "customer")),
        escapeHTML(itemNames),
        escapeHTML(money(amountOf(r))),
        escapeHTML(money(paidOf(r))),
        escapeHTML(money(balanceOf(r)))
      ];
    });

    return {
      title: "Sales Report",
      summary: statsHTML([
        statCard("Total Bills", String(records.length)),
        statCard("Total Sales", money(total)),
        statCard("Paid Amount", money(paid)),
        statCard("Balance Due", money(due))
      ]),
      table: table(
        ["Bill No.", "Date", "Customer", "Items", "Total", "Paid", "Balance"],
        rows
      )
    };
  }

  function purchaseReport() {
    const records = filtered(STORAGE.purchases);
    const total = records.reduce((sum, r) => sum + amountOf(r), 0);
    const paid = records.reduce((sum, r) => sum + paidOf(r), 0);
    const due = records.reduce((sum, r) => sum + balanceOf(r), 0);

    const rows = records.map(r => {
      const bill = firstValue(r, [
        "purchaseNumber", "purchaseNo", "billNumber", "invoiceNumber",
        "invoiceNo", "billNo", "id"
      ], "—");

      const itemNames = itemsOf(r).map(itemName).join(", ") || "—";

      return [
        escapeHTML(bill),
        escapeHTML(formatDate(recordDate(r))),
        escapeHTML(recordName(r, "supplier")),
        escapeHTML(itemNames),
        escapeHTML(money(amountOf(r))),
        escapeHTML(money(paidOf(r))),
        escapeHTML(money(balanceOf(r)))
      ];
    });

    return {
      title: "Purchase Report",
      summary: statsHTML([
        statCard("Total Bills", String(records.length)),
        statCard("Total Purchases", money(total)),
        statCard("Paid Amount", money(paid)),
        statCard("Balance Due", money(due))
      ]),
      table: table(
        ["Bill No.", "Date", "Supplier", "Items", "Total", "Paid", "Balance"],
        rows
      )
    };
  }

  function stockReport() {
    const products = readArray(STORAGE.products);

    const rows = products.map(p => {
      const name = firstValue(p, ["name", "productName", "title"], "Unnamed Product");
      const barcode = firstValue(p, ["barcode", "barCode", "sku", "code"], "—");
      const quantity = number(firstValue(p, [
        "stock", "quantity", "qty", "stockQty", "currentStock", "available"
      ], 0));
      const cost = number(firstValue(p, [
        "purchasePrice", "costPrice", "cost", "buyPrice"
      ], 0));
      const rate = number(firstValue(p, [
        "sellingPrice", "salePrice", "price", "rate"
      ], 0));

      return [
        escapeHTML(name),
        escapeHTML(barcode),
        escapeHTML(quantity.toLocaleString("en-IN")),
        escapeHTML(money(cost)),
        escapeHTML(money(rate)),
        escapeHTML(money(quantity * cost))
      ];
    });

    const quantityTotal = products.reduce((sum, p) =>
      sum + number(firstValue(p, [
        "stock", "quantity", "qty", "stockQty", "currentStock", "available"
      ], 0)), 0);

    const stockValue = products.reduce((sum, p) => {
      const qty = number(firstValue(p, [
        "stock", "quantity", "qty", "stockQty", "currentStock", "available"
      ], 0));
      const cost = number(firstValue(p, [
        "purchasePrice", "costPrice", "cost", "buyPrice"
      ], 0));
      return sum + qty * cost;
    }, 0);

    return {
      title: "Stock Report",
      summary: statsHTML([
        statCard("Total Products", String(products.length)),
        statCard("Total Stock Quantity", quantityTotal.toLocaleString("en-IN")),
        statCard("Stock Cost Value", money(stockValue))
      ]),
      table: table(
        ["Product", "Barcode", "Quantity", "Cost Rate", "Selling Rate", "Stock Value"],
        rows
      )
    };
  }

  function customerReport() {
    const customers = readArray(STORAGE.customers);
    const sales = readArray(STORAGE.sales);

    const rows = customers.map(c => {
      const id = firstValue(c, ["id", "customerId", "phone", "mobile"], "");
      const name = firstValue(c, ["name", "customerName", "fullName"], "Unnamed Customer");
      const phone = firstValue(c, ["phone", "mobile", "phoneNumber", "contact"], "—");

      const customerSales = sales.filter(s => {
        const saleName = recordName(s, "customer");
        const saleId = firstValue(s, ["customerId"], "");
        return (id && saleId && String(id) === String(saleId)) ||
          saleName.toLowerCase() === String(name).toLowerCase();
      });

      const total = customerSales.reduce((sum, s) => sum + amountOf(s), 0);
      const due = customerSales.reduce((sum, s) => sum + balanceOf(s), 0);

      return [
        escapeHTML(name),
        escapeHTML(phone),
        String(customerSales.length),
        escapeHTML(money(total)),
        escapeHTML(money(due))
      ];
    });

    return {
      title: "Customer Report",
      summary: statsHTML([
        statCard("Total Customers", String(customers.length)),
        statCard("Sales Records", String(sales.filter(inDateRange).length))
      ]),
      table: table(
        ["Customer Name", "Phone", "Bills", "Total Sales", "Balance Due"],
        rows
      )
    };
  }

  function supplierReport() {
    const suppliers = readArray(STORAGE.suppliers);
    const purchases = readArray(STORAGE.purchases);

    const rows = suppliers.map(s => {
      const id = firstValue(s, ["id", "supplierId", "phone", "mobile"], "");
      const name = firstValue(s, ["name", "supplierName", "fullName", "companyName"], "Unnamed Supplier");
      const phone = firstValue(s, ["phone", "mobile", "phoneNumber", "contact"], "—");

      const supplierPurchases = purchases.filter(p => {
        const purchaseName = recordName(p, "supplier");
        const purchaseId = firstValue(p, ["supplierId"], "");
        return (id && purchaseId && String(id) === String(purchaseId)) ||
          purchaseName.toLowerCase() === String(name).toLowerCase();
      });

      const total = supplierPurchases.reduce((sum, p) => sum + amountOf(p), 0);
      const due = supplierPurchases.reduce((sum, p) => sum + balanceOf(p), 0);

      return [
        escapeHTML(name),
        escapeHTML(phone),
        String(supplierPurchases.length),
        escapeHTML(money(total)),
        escapeHTML(money(due))
      ];
    });

    return {
      title: "Supplier Report",
      summary: statsHTML([
        statCard("Total Suppliers", String(suppliers.length)),
        statCard("Purchase Records", String(purchases.filter(inDateRange).length))
      ]),
      table: table(
        ["Supplier Name", "Phone", "Bills", "Total Purchases", "Balance Due"],
        rows
      )
    };
  }

  function profitReport() {
    const sales = filtered(STORAGE.sales);
    const purchases = filtered(STORAGE.purchases);

    const salesTotal = sales.reduce((sum, s) => sum + amountOf(s), 0);
    const purchaseTotal = purchases.reduce((sum, p) => sum + amountOf(p), 0);

    const finance = filtered(STORAGE.finance);
    const income = finance.reduce((sum, f) => {
      const type = String(firstValue(f, ["type", "category", "transactionType"], "")).toLowerCase();
      const amount = number(firstValue(f, ["amount", "total", "value"], 0));
      return sum + (type.includes("income") || type.includes("in") ? amount : 0);
    }, 0);

    const expense = finance.reduce((sum, f) => {
      const type = String(firstValue(f, ["type", "category", "transactionType"], "")).toLowerCase();
      const amount = number(firstValue(f, ["amount", "total", "value"], 0));
      return sum + (type.includes("expense") || type.includes("out") ? amount : 0);
    }, 0);

    // This is a simple sales-minus-purchases estimate, not audited net profit.
    const estimatedDifference = salesTotal - purchaseTotal;

    const rows = [
      ["Total Sales", escapeHTML(money(salesTotal))],
      ["Total Purchases", escapeHTML(money(purchaseTotal))],
      ["Other Income (matched records)", escapeHTML(money(income))],
      ["Expenses (matched records)", escapeHTML(money(expense))],
      ["Estimated Sales - Purchases", escapeHTML(money(estimatedDifference))]
    ];

    return {
      title: "Profit & Finance Report",
      summary: statsHTML([
        statCard("Total Sales", money(salesTotal)),
        statCard("Total Purchases", money(purchaseTotal)),
        statCard("Other Income", money(income)),
        statCard("Expenses", money(expense)),
        statCard("Estimated Difference", money(estimatedDifference))
      ]),
      table: table(["Description", "Amount"], rows)
    };
  }

  const REPORTS = {
    sales: saleReport,
    sale: saleReport,
    purchases: purchaseReport,
    purchase: purchaseReport,
    stock: stockReport,
    inventory: stockReport,
    customers: customerReport,
    customer: customerReport,
    suppliers: supplierReport,
    supplier: supplierReport,
    profit: profitReport,
    finance: profitReport
  };

  /* -------------------- SHARED STYLES -------------------- */

  function addReportStyles() {
    if ($("#gsReportStyles")) return;

    const style = document.createElement("style");
    style.id = "gsReportStyles";

    style.textContent = `
      .gs-report-controls {
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        gap:10px;
        margin:12px 0 18px;
      }

      .gs-report-controls label {
        display:flex;
        flex-direction:column;
        gap:5px;
        font-size:13px;
      }

      .gs-report-controls input {
        min-height:38px;
        padding:7px 10px;
        border:1px solid #d1d5db;
        border-radius:8px;
        font:inherit;
        background:#fff;
        color:#111827;
      }

      .gs-report-action {
        min-height:38px;
        padding:8px 14px;
        border:0;
        border-radius:8px;
        cursor:pointer;
        font:inherit;
        font-weight:600;
        background:#166534;
        color:#fff;
      }

      .gs-report-action:hover { filter:brightness(.94); }

      .gs-report-action.secondary {
        background:#374151;
      }

      .gs-report-stats {
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(145px,1fr));
        gap:12px;
        margin:14px 0;
      }

      .gs-report-stat {
        padding:14px;
        border:1px solid #e5e7eb;
        border-radius:10px;
        background:#fff;
        min-width:0;
      }

      .gs-report-stat-label {
        color:#6b7280;
        font-size:12px;
        margin-bottom:8px;
      }

      .gs-report-stat-value {
        color:#111827;
        font-size:18px;
        font-weight:700;
        overflow-wrap:anywhere;
      }

      .gs-report-table-wrap {
        width:100%;
        overflow-x:auto;
        margin:12px 0;
      }

      .gs-report-table {
        width:100%;
        border-collapse:collapse;
        background:#fff;
        font-size:13px;
      }

      .gs-report-table th,
      .gs-report-table td {
        padding:10px 9px;
        border:1px solid #e5e7eb;
        text-align:left;
        vertical-align:top;
      }

      .gs-report-table th {
        background:#f3f4f6;
        color:#111827;
        font-weight:700;
      }

      .gs-report-empty {
        padding:22px;
        text-align:center;
        color:#6b7280;
        border:1px dashed #d1d5db;
        border-radius:8px;
        margin:12px 0;
      }

      .gs-report-panel-heading {
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
        flex-wrap:wrap;
      }

      @media(max-width:600px) {
        .gs-report-stat-value { font-size:16px; }
        .gs-report-table { font-size:12px; }
        .gs-report-table th,
        .gs-report-table td { padding:7px 6px; }
      }
    `;

    document.head.appendChild(style);
  }

  /* -------------------- REPORT PANEL HELPERS -------------------- */

  function reportType(panel) {
    return String(
      panel.dataset.report ||
      panel.dataset.type ||
      panel.id ||
      ""
    ).toLowerCase().replace(/[^a-z]/g, "");
  }

  function findReportFunction(panel) {
    const type = reportType(panel);

    for (const key of Object.keys(REPORTS)) {
      if (type === key || type.includes(key)) return REPORTS[key];
    }

    return null;
  }

  function panelTitle(panel, fallback) {
    const heading = $("h1, h2, h3, .report-title, .panel-title", panel);
    return heading ? heading.textContent.trim() : fallback;
  }

  function renderPanel(panel) {
    const makeReport = findReportFunction(panel);
    if (!makeReport) return;

    const report = makeReport();
    const oldContent = $(".gs-report-generated-content", panel);

    const content = document.createElement("div");
    content.className = "gs-report-generated-content";
    content.innerHTML = `
      ${report.summary}
      ${report.table}
    `;

    if (oldContent) {
      oldContent.replaceWith(content);
    } else {
      panel.appendChild(content);
    }

    panel.dataset.gsReportReady = "true";
  }

  function renderAllReports() {
    $$(".report-panel[data-report], [data-report].report-panel, [data-report].report-card")
      .forEach(renderPanel);
  }

  /* -------------------- DATE FILTERS / REFRESH -------------------- */

  function dateInputValue(selectors) {
    for (const selector of selectors) {
      const element = $(selector);
      if (element && element.value) return element.value;
    }
    return "";
  }

  function loadDateFilters() {
    startDate = dateInputValue([
      "#startDate", "#fromDate", "#reportStartDate",
      "#dateFrom", "[name='startDate']", "[name='fromDate']"
    ]);

    endDate = dateInputValue([
      "#endDate", "#toDate", "#reportEndDate",
      "#dateTo", "[name='endDate']", "[name='toDate']"
    ]);
  }

  function refreshReports() {
    if (refreshInProgress) return;
    refreshInProgress = true;

    try {
      loadDateFilters();
      renderAllReports();
      showToast("Reports refreshed successfully.");
    } catch (error) {
      console.error("GS Reports refresh error:", error);
      showToast("Reports refresh गर्न समस्या भयो। Console जाँच गर्नुहोस्।", true);
    } finally {
      refreshInProgress = false;
    }
  }

  /* -------------------- TOAST -------------------- */

  function showToast(message, isError = false) {
    let toast = $("#gsReportToast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "gsReportToast";

      Object.assign(toast.style, {
        position: "fixed",
        left: "50%",
        bottom: "22px",
        transform: "translateX(-50%)",
        zIndex: "99999",
        maxWidth: "90%",
        padding: "12px 18px",
        borderRadius: "9px",
        color: "#fff",
        fontSize: "14px",
        boxShadow: "0 4px 16px rgba(0,0,0,.2)",
        display: "none"
      });

      document.body.appendChild(toast);
    }

    toast.style.background = isError ? "#b91c1c" : "#166534";
    toast.textContent = message;
    toast.style.display = "block";

    if (toast._hideTimer) clearTimeout(toast._hideTimer);

    toast._hideTimer = setTimeout(() => {
      toast.style.display = "none";
    }, 2800);
  }

  /* -------------------- PDF / PRINT -------------------- */


function printReport(panel) {
  const profile = storeProfile();
  const makeReport = findReportFunction(panel);

  if (!makeReport) {
    showToast("यो रिपोर्टको प्रकार पहिचान भएन।", true);
    return;
  }

  const report = makeReport();
  const title = panelTitle(panel, report.title);

  const dateRange = startDate || endDate
    ? `${startDate ? formatDate(startDate) : "Beginning"} — ${
        endDate ? formatDate(endDate) : "Today"
      }`
    : "All available records";

  const now = new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  /*
   * Store name, owner, address, contact and logo
   * are read dynamically from Store Profile.
   * No particular store identity is hard-coded here.
   */
  const logoHTML = profile.photo
    ? `<img
         class="store-logo"
         src="${escapeHTML(profile.photo)}"
         alt="Store Logo"
         onerror="this.style.display='none';"
       >`
    : `<div class="store-logo-placeholder">Logo</div>`;

  const contactLines = [
    profile.owner
      ? `<div><strong>Owner:</strong> ${escapeHTML(profile.owner)}</div>`
      : "",
    profile.address
      ? `<div>${escapeHTML(profile.address)}</div>`
      : "",
    profile.phone
      ? `<div><strong>Phone:</strong> ${escapeHTML(profile.phone)}</div>`
      : "",
    profile.email
      ? `<div><strong>Email:</strong> ${escapeHTML(profile.email)}</div>`
      : ""
  ].filter(Boolean).join("");

  const documentHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHTML(title)} - ${escapeHTML(profile.name)}</title>

<style>
  @page {
    size: A4 portrait;
    margin: 11mm 10mm 12mm;
  }

  * {
    box-sizing: border-box;
  }

  html {
    background: #fff;
  }

  body {
    margin: 0;
    padding: 0;
    color: #1f2937;
    background: #fff;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10px;
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Print controls are visible in the preview only. */
  .print-toolbar {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    margin: 0 0 18px;
    padding: 12px;
    background: #f3f4f6;
    border-radius: 8px;
  }

  .print-toolbar button {
    padding: 10px 18px;
    border: 0;
    border-radius: 6px;
    background: #166534;
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }

  .print-toolbar .close-button {
    background: #374151;
  }

  /* Store header */
  .store-header {
    display: flex;
    align-items: center;
    gap: 13px;
    padding: 0 0 12px;
    margin: 0 0 15px;
    border-bottom: 2px solid #198044;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .store-logo,
  .store-logo-placeholder {
    display: block;
    width: 65px;
    height: 65px;
    flex: 0 0 65px;
    object-fit: contain;
    border: 1px solid #e5e7eb;
    border-radius: 5px;
  }

  .store-logo-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #166534;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
  }

  .store-details {
    flex: 1 1 auto;
    min-width: 0;
  }

  .store-name {
    margin: 0 0 5px;
    color: #14532d;
    font-size: 22px;
    font-weight: 800;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .store-contact {
    color: #374151;
    font-size: 9px;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }

  .store-contact strong {
    color: #111827;
  }

  /* Report heading */
  .report-heading {
    margin: 15px 0 13px;
    text-align: center;
    break-after: avoid;
    page-break-after: avoid;
  }

  .report-heading h2 {
    margin: 0 0 5px;
    color: #111827;
    font-size: 17px;
    line-height: 1.3;
    font-weight: 800;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }

  .report-heading p {
    margin: 3px 0;
    color: #4b5563;
    font-size: 9px;
  }

  /* Summary cards */
  .gs-report-stats {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: 7px;
    margin: 12px 0 15px;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .gs-report-stat {
    flex: 1 1 105px;
    min-width: 0;
    padding: 8px;
    border: 1px solid #d1d5db;
    border-top: 2px solid #198044;
    border-radius: 4px;
    background: #fff;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .gs-report-stat-label {
    margin-bottom: 5px;
    color: #6b7280;
    font-size: 9px;
    line-height: 1.35;
  }

  .gs-report-stat-value {
    color: #111827;
    font-size: 11px;
    font-weight: 700;
    line-height: 1.35;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  /* Table layout */
  .gs-report-table-wrap {
    width: 100%;
    max-width: 100%;
    margin: 10px 0 14px;
    overflow: visible;
  }

  .gs-report-table,
  table {
    width: 100%;
    max-width: 100%;
    margin: 0;
    border-collapse: collapse;
    table-layout: auto;
    font-size: 9px;
  }

  .gs-report-table thead,
  table thead {
    display: table-header-group;
  }

  .gs-report-table tfoot,
  table tfoot {
    display: table-footer-group;
  }

  .gs-report-table tr,
  table tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .gs-report-table th,
  .gs-report-table td,
  th,
  td {
    padding: 6px 5px;
    border: 1px solid #d1d5db;
    text-align: left;
    vertical-align: top;
    line-height: 1.4;
    overflow-wrap: anywhere;
    word-break: normal;
  }

  .gs-report-table th,
  table th {
    background: #e8f3eb;
    color: #14532d;
    font-weight: 700;
    border-color: #b9d6c1;
  }

  .gs-report-table td,
  table td {
    color: #1f2937;
  }

  .gs-report-table tbody tr:nth-child(even) td {
    background: #fafcfb;
  }

  /* Empty-report message */
  .gs-report-empty {
    margin: 12px 0;
    padding: 18px 10px;
    border: 1px dashed #9ca3af;
    color: #6b7280;
    text-align: center;
    border-radius: 4px;
  }

  /* Signatures */
  .signature-area {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 18px;
    margin: 38px 0 0;
    padding-top: 8px;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .signature {
    flex: 1 1 0;
    min-width: 0;
    min-height: 27px;
    padding-top: 6px;
    border-top: 1px solid #374151;
    color: #374151;
    text-align: center;
    font-size: 9px;
  }

  /* Footer follows content naturally to reduce blank pages. */
  .report-footer {
    margin-top: 23px;
    padding-top: 10px;
    border-top: 1px solid #d1d5db;
    text-align: center;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .thank-you {
    margin: 0;
    color: #166534;
    font-size: 12px;
    font-weight: 700;
  }

  .print-note {
    margin-top: 6px;
    color: #6b7280;
    font-size: 8px;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }

  @media screen {
    body {
      width: calc(100% - 32px);
      max-width: 190mm;
      margin: 20px auto;
    }
  }

  @media print {
    html,
    body {
      width: auto !important;
      max-width: none !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
    }

    .print-toolbar {
      display: none !important;
    }

    .store-header,
    .report-heading,
    .gs-report-stat,
    .signature-area,
    .report-footer {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .gs-report-table-wrap {
      overflow: visible !important;
    }

    a {
      color: inherit;
      text-decoration: none;
    }
  }
</style>
</head>

<body>
  <div class="print-toolbar">
    <button type="button" onclick="window.print()">
      Print / Save PDF
    </button>
    <button
      type="button"
      class="close-button"
      onclick="window.close()"
    >
      Close
    </button>
  </div>

  <header class="store-header">
    ${logoHTML}

    <div class="store-details">
      <h1 class="store-name">${escapeHTML(profile.name)}</h1>
      <div class="store-contact">
        ${contactLines}
      </div>
    </div>
  </header>

  <section class="report-heading">
    <h2>${escapeHTML(title)}</h2>
    <p><strong>Date Range:</strong> ${escapeHTML(dateRange)}</p>
    <p><strong>Generated:</strong> ${escapeHTML(now)}</p>
  </section>

  ${report.summary}
  ${report.table}

  <section class="signature-area">
    <div class="signature">Prepared By</div>
    <div class="signature">Checked By</div>
    <div class="signature">Authorized Signature</div>
  </section>

  <footer class="report-footer">
    <p class="thank-you">Thank you for your business. Visit again!</p>

    <div class="print-note">
      This is a computer-generated report.
      ${profile.phone
        ? `<div>Phone: ${escapeHTML(profile.phone)}</div>`
        : ""}
      ${profile.email
        ? `<div>Email: ${escapeHTML(profile.email)}</div>`
        : ""}
    </div>
  </footer>
</body>
</html>`;

  const popup = window.open("", "_blank");

  if (!popup) {
    showToast("PDF खोल्न popup अनुमति दिनुहोस्।", true);
    return;
  }

  try {
    popup.document.open();
    popup.document.write(documentHTML);
    popup.document.close();
    popup.focus();
  } catch (error) {
    console.error("GS Reports PDF error:", error);
    showToast("PDF खोल्न समस्या भयो। फेरि प्रयास गर्नुहोस्।", true);
  }
}

    
  /* -------------------- ONE PRINT BUTTON PER PANEL -------------------- */

  function ensurePrintButtons() {
    const panels = $$(".report-panel[data-report], [data-report].report-panel, [data-report].report-card");

    panels.forEach(panel => {
      if (!findReportFunction(panel)) return;

      // Remove duplicate buttons created by this script.
      const existing = $$(".gs-report-print-button", panel);
      existing.slice(1).forEach(button => button.remove());

      let button = $(".gs-report-print-button", panel);

      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.className = "gs-report-action gs-report-print-button";
        button.textContent = "Print / Save PDF";
        button.addEventListener("click", () => printReport(panel));

        const heading = $(".gs-report-panel-heading", panel) ||
          $("h1, h2, h3, .report-title, .panel-title", panel);

        if (heading && heading.parentElement) {
          heading.parentElement.appendChild(button);
        } else {
          panel.insertBefore(button, panel.firstChild);
        }
      }
    });
  }

  /* -------------------- REFRESH BUTTON WIRING -------------------- */

  function setupRefreshButton() {
    const selectors = [
      "#refreshReports",
      "#refreshReport",
      "#refreshBtn",
      "#refreshButton",
      "#reportRefresh",
      "[data-action='refresh-reports']",
      "[data-refresh-reports]"
    ];

    let buttons = [];

    selectors.forEach(selector => {
      buttons = buttons.concat($$(selector));
    });

    // Also find buttons whose visible text says Refresh.
    $$("button").forEach(button => {
      if (/^refresh(?:\s+reports?)?$/i.test(button.textContent.trim())) {
        buttons.push(button);
      }
    });

    [...new Set(buttons)].forEach(button => {
      if (button.dataset.gsRefreshBound === "true") return;

      button.dataset.gsRefreshBound = "true";

      button.addEventListener("click", event => {
        event.preventDefault();
        refreshReports();
      });
    });
  }

  /* -------------------- DATE FILTER WIRING -------------------- */

  function setupDateFilters() {
    const selectors = [
      "#startDate", "#fromDate", "#reportStartDate", "#dateFrom",
      "#endDate", "#toDate", "#reportEndDate", "#dateTo",
      "[name='startDate']", "[name='fromDate']",
      "[name='endDate']", "[name='toDate']"
    ];

    const inputs = [...new Set(selectors.flatMap(selector => $$(selector)))];

    inputs.forEach(input => {
      if (input.dataset.gsDateBound === "true") return;

      input.dataset.gsDateBound = "true";

      input.addEventListener("change", () => {
        loadDateFilters();
        renderAllReports();
      });
    });
  }

  /* -------------------- TABS -------------------- */

  function setupTabs() {
    $$("[data-report-tab]").forEach(tab => {
      if (tab.dataset.gsTabBound === "true") return;
      tab.dataset.gsTabBound = "true";

      tab.addEventListener("click", () => {
        const target = tab.dataset.reportTab;

        $$("[data-report-tab]").forEach(other => {
          other.classList.toggle("active", other === tab);
          other.setAttribute("aria-selected", other === tab ? "true" : "false");
        });

        $$("[data-report-section]").forEach(section => {
          section.hidden = section.dataset.reportSection !== target;
        });
      });
    });
  }

  /* -------------------- INITIALIZATION -------------------- */

  function initReports() {
    addReportStyles();
    loadDateFilters();
    ensurePrintButtons();
    renderAllReports();
    setupRefreshButton();
    setupDateFilters();
    setupTabs();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initReports, { once: true });
  } else {
    initReports();
  }

  // Expose safe methods for optional use by report.html.
  window.GSReports = {
    refresh: refreshReports,
    render: renderAllReports,
    print: printReport,
    money,
    formatDate
  };
})();
