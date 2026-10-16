/* =========================================================
GS GENERAL STORE — REPORTS.JS
FULL REPLACEMENT (Fixed Tab Switching & Panel Rendering)
========================================================= */
(() => {
"use strict";

const KEY = {
  sales: "gs_sales",
  purchases: "gs_purchases",
  products: "gs_products",
  customers: "gs_customers",
  suppliers: "gs_suppliers",
  finance: "gs_finance",
  settings: "gs_settings"
};

const $ = (s, root = document) => root.querySelector(s); const $$ = (s, root = document) => [...root.querySelectorAll(s)];

let fromDate = "";
let toDate = "";

/* ---------- STORAGE ---------- */

function read(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    return value == null ? fallback : value;
  } catch (error) {
    console.error("[GS Reports] Storage error:", key, error);
    showError("Data पढ्न समस्या भयो: " + key);
    return fallback;
  }
}

function list(key) {
  const value = read(key, []);
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    for (const k of ["data", "items", "records", "list"]) {
      if (Array.isArray(value[k])) return value[k];
    }
  }
  return [];
}

function settings() {
  const value = read(KEY.settings, {});
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function val(object, keys, fallback = "") {
  for (const key of keys) {
    const value = object?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return fallback;
}

function num(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value !== "string") return 0;
  const parsed = Number(value.replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function money(value) {
  const currency = String(val(settings(), ["currency", "currencyCode"], "NPR")).toUpperCase();
  const symbols = { NPR: "Rs.", RS: "Rs.", INR: "₹", USD: "$", GBP: "£", EUR: "€" };
  return (symbols[currency] || currency) + " " + num(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateOf(record) {
  const raw = val(record, ["date", "saleDate", "purchaseDate", "createdAt"], "");
  if (!raw) return "";
  const text = String(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function inRange(record) {
  const date = dateOf(record);
  if (!date) return !fromDate && !toDate;
  return (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
}

function filtered(key) {
  return list(key).filter(inRange);
}

function itemsOf(record) {
  if (Array.isArray(record.items) && record.items.length) {
    return record.items;
  }
  if (record.productId || record.productName) {
    return [{
      productId: record.productId || "",
      productName: record.productName || "Product",
      barcode: record.barcode || "",
      unit: record.unit || "Unit",
      qty: num(record.qty),
      rate: num(record.rate),
      itemAmount: num(record.itemAmount) || num(record.total)
    }];
  }
  return [];
}

function amountOf(record) {
  return num(val(record, ["total", "grandTotal", "netTotal", "amount", "value"], 0));
}

function paidOf(record) {
  return num(val(record, ["paidAmount", "paid", "amountPaid"], 0));
}

function dueOf(record) {
  return num(val(record, ["balance", "due", "dueAmount", "payable"], Math.max(0, amountOf(record) - paidOf(record))));
}

/* ---------- PAGE APPEARANCE ---------- */

function applyReportAppearance() {
  if (window.GSAppearance && typeof window.GSAppearance.apply === "function") {
    window.GSAppearance.apply();
  }

  let style = document.getElementById("gsReportAppearance");
  if (!style) {
    style = document.createElement("style");
    style.id = "gsReportAppearance";
    document.head.appendChild(style);
  }

  style.textContent = `
    html, body {
      background: var(--body-bg, #f3f6fa) !important;
      color: var(--text-color, #111827) !important;
      font-family: var(--font-family, Arial, sans-serif) !important;
    }
    .report-card, .report-stat, .report-tabs, .report-table-wrap, .report-table, .report-field input, .profit-item {
      background: var(--card-bg, #ffffff) !important;
      color: var(--text-color, #111827) !important;
      border-color: var(--border-color, #e5e7eb) !important;
    }
    .report-table th {
      background: var(--accent-color, #166534) !important;
      color: #ffffff !important;
    }
    .report-table tbody tr:nth-child(even) td {
      background: var(--hover-bg, #f1f5f9) !important;
    }
    .report-tab {
      color: var(--muted-color, #6b7280) !important;
    }
    .report-tab.active, .report-btn.primary {
      background: var(--accent-color, #166534) !important;
      border-color: var(--accent-color, #166534) !important;
      color: #ffffff !important;
    }
  `;
}

window.addEventListener("storage", event => {
  if (event.key === KEY.settings || event.key === null) {
    applyReportAppearance();
  }
});

document.addEventListener("gs:appearance-change", applyReportAppearance);

/* ---------- UI HELPERS ---------- */

function setText(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}

function setBody(id, rows, colspan, emptyText) {
  const body = document.getElementById(id);
  if (!body) return;
  body.innerHTML = rows.length ? rows.join("") : `<tr><td class="report-empty" colspan="${colspan}">${esc(emptyText)}</td></tr>`;
}

function showError(message) {
  const box = $("#reportError");
  if (!box) return;
  box.textContent = message;
  box.classList.add("show");
}

function clearError() {
  const box = $("#reportError");
  if (!box) return;
  box.textContent = "";
  box.classList.remove("show");
}

function setCount(id, count, label) {
  setText(id, `${count} ${label}`);
}

/* ---------- REPORT RENDERING FUNCTIONS ---------- */

function renderSales() {
  const sales = filtered(KEY.sales).slice().sort((a, b) => dateOf(b).localeCompare(dateOf(a)));
  const rows = [];
  sales.forEach(sale => {
    const items = itemsOf(sale);
    const displayItems = items.length ? items : [{ productName: "—", barcode: "—", qty: 0 }];
    displayItems.forEach((item, index) => {
      rows.push(`
        <tr>
          <td>${esc(dateOf(sale) || "—")}</td>
          <td>${esc(val(sale, ["billNumber", "invoiceNumber", "invoiceNo", "id"], "—"))}</td>
          <td>${esc(val(sale, ["customerName", "customer"], "Cash Customer"))}</td>
          <td>${esc(val(item, ["productName", "name"], "Product"))}</td>
          <td>${esc(val(item, ["barcode"], "—"))}</td>
          <td class="num">${num(val(item, ["qty", "quantity"], 0))}</td>
          <td class="num">${money(index === 0 ? amountOf(sale) : 0)}</td>
          <td class="num">${money(index === 0 ? paidOf(sale) : 0)}</td>
          <td class="num">${money(index === 0 ? dueOf(sale) : 0)}</td>
        </tr>
      `);
    });
  });
  setBody("salesReportBody", rows, 9, "यो अवधिमा बिक्री विवरण भेटिएन।");
  setCount("salesReportCount", sales.length, "bills");
  return sales;
}

function renderPurchases() {
  const purchases = filtered(KEY.purchases).slice().sort((a, b) => dateOf(b).localeCompare(dateOf(a)));
  const rows = [];
  purchases.forEach(purchase => {
    const items = itemsOf(purchase);
    const displayItems = items.length ? items : [{ productName: "—", qty: 0, rate: 0 }];
    displayItems.forEach((item, index) => {
      rows.push(`
        <tr>
          <td>${esc(dateOf(purchase) || "—")}</td>
          <td>${esc(val(purchase, ["billNumber", "invoiceNumber", "id"], "—"))}</td>
          <td>${esc(val(purchase, ["supplierName", "supplier"], "—"))}</td>
          <td>${esc(val(item, ["productName", "name"], "Product"))}</td>
          <td class="num">${num(val(item, ["qty", "quantity", "totalReceivedQty"], 0))}</td>
          <td class="num">${money(val(item, ["rate", "purchasePrice", "effectiveCost"], 0))}</td>
          <td class="num">${money(index === 0 ? amountOf(purchase) : 0)}</td>
          <td class="num">${money(index === 0 ? paidOf(purchase) : 0)}</td>
        </tr>
      `);
    });
  });
  setBody("purchaseReportBody", rows, 8, "यो अवधिमा खरिद विवरण भेटिएन।");
  setCount("purchaseReportCount", purchases.length, "bills");
  return purchases;
}

function renderStock() {
  const products = list(KEY.products).slice().sort((a, b) => 
    String(val(a, ["name", "productName"], "")).localeCompare(String(val(b, ["name", "productName"], "")))
  );
  const rows = products.map(product => {
    const stock = num(val(product, ["stock", "quantity", "qty", "currentStock"], 0));
    const cost = num(val(product, ["purchasePrice", "costPrice", "buyPrice", "rate"], 0));
    const price = num(val(product, ["sellingPrice", "salePrice", "price", "mrp"], 0));
    const lowLimit = num(val(product, ["lowStock", "reorderLevel", "minimumStock"], 5));
    let status;
    if (stock <= 0) {
      status = '<span class="report-status out">Out of stock</span>';
    } else if (stock <= lowLimit) {
      status = '<span class="report-status low">Low stock</span>';
    } else {
      status = '<span class="report-status ok">In stock</span>';
    }
    return `
      <tr>
        <td>${esc(val(product, ["name", "productName"], "—"))}</td>
        <td>${esc(val(product, ["barcode", "sku"], "—"))}</td>
        <td>${esc(val(product, ["category", "categoryName"], "—"))}</td>
        <td>${esc(val(product, ["unit"], "Unit"))}</td>
        <td class="num">${stock.toLocaleString("en-IN")}</td>
        <td class="num">${money(cost)}</td>
        <td class="num">${money(price)}</td>
        <td class="num">${money(stock * cost)}</td>
        <td>${status}</td>
      </tr>
    `;
  });
  setBody("stockReportBody", rows, 9, "Product विवरण भेटिएन।");
  setCount("stockReportCount", products.length, "products");
}

function renderCustomers() {
  const customers = list(KEY.customers);
  const sales = filtered(KEY.sales);
  const rows = customers.map(customer => {
    const id = String(val(customer, ["id", "customerId"], ""));
    const name = String(val(customer, ["name", "customerName", "fullName"], "Unknown"));
    const matching = sales.filter(sale => 
      (id && String(val(sale, ["customerId"], "")) === id) || 
      String(val(sale, ["customerName", "customer"], "")).toLowerCase() === name.toLowerCase()
    );
    const credit = matching.reduce((sum, sale) => sum + amountOf(sale), 0);
    const payments = matching.reduce((sum, sale) => sum + paidOf(sale), 0);
    const opening = num(val(customer, ["openingBalance", "openingDue"], 0));
    const balance = num(val(customer, ["currentBalance", "balanceDue", "due"], opening + credit - payments));
    return `
      <tr>
        <td>${esc(name)}</td>
        <td>${esc(val(customer, ["phone", "mobile", "contact"], "—"))}</td>
        <td class="num">${money(opening)}</td>
        <td class="num">${money(credit)}</td>
        <td class="num">${money(payments)}</td>
        <td class="num">${money(balance)}</td>
      </tr>
    `;
  });
  setBody("customerReportBody", rows, 6, "Customer विवरण भेटिएन।");
  setCount("customerReportCount", customers.length, "customers");
}

function renderSuppliers() {
  const suppliers = list(KEY.suppliers);
  const purchases = filtered(KEY.purchases);
  const rows = suppliers.map(supplier => {
    const id = String(val(supplier, ["id", "supplierId"], ""));
    const name = String(val(supplier, ["name", "supplierName", "companyName"], "Unknown"));
    const matching = purchases.filter(purchase => 
      (id && String(val(purchase, ["supplierId"], "")) === id) || 
      String(val(purchase, ["supplierName", "supplier"], "")).toLowerCase() === name.toLowerCase()
    );
    const total = matching.reduce((sum, purchase) => sum + amountOf(purchase), 0);
    const payments = matching.reduce((sum, purchase) => sum + paidOf(purchase), 0);
    const opening = num(val(supplier, ["openingBalance", "openingPayable"], 0));
    const balance = num(val(supplier, ["currentBalance", "balance", "payable"], opening + total - payments));
    return `
      <tr>
        <td>${esc(name)}</td>
        <td>${esc(val(supplier, ["phone", "mobile", "contact"], "—"))}</td>
        <td class="num">${money(opening)}</td>
        <td class="num">${money(total)}</td>
        <td class="num">${money(payments)}</td>
        <td class="num">${money(balance)}</td>
      </tr>
    `;
  });
  setBody("supplierReportBody", rows, 6, "Supplier विवरण भेटिएन।");
  setCount("supplierReportCount", suppliers.length, "suppliers");
}

function renderProfit(sales, purchases) {
  const finance = filtered(KEY.finance);
  const revenue = sales.reduce((sum, sale) => sum + amountOf(sale), 0);
  const hasCost = sales.some(sale => num(val(sale, ["fifoCost", "costOfGoodsSold", "totalCost"], 0)) > 0);
  const cost = sales.reduce((sum, sale) => {
    const savedCost = num(val(sale, ["fifoCost", "costOfGoodsSold", "totalCost"], 0));
    if (savedCost > 0) return sum + savedCost;
    return sum + itemsOf(sale).reduce((itemSum, item) => itemSum + num(val(item, ["fifoCost", "cost", "effectiveCost"], 0)) * num(val(item, ["qty", "quantity"], 0)), 0);
  }, 0);
  const savedProfit = sales.reduce((sum, sale) => sum + num(val(sale, ["profit", "grossProfit"], 0)), 0);
  const gross = hasCost ? revenue - cost : savedProfit;
  const expenses = finance.reduce((sum, item) => {
    const type = String(val(item, ["type", "category", "transactionType"], "")).toLowerCase();
    const isExpense = type.includes("expense") || type === "out" || type.includes("withdraw");
    return sum + (isExpense ? num(val(item, ["amount", "total", "value"], 0)) : 0);
  }, 0);

  setText("reportSales", money(revenue));
  setText("reportPurchases", money(purchases.reduce((sum, p) => sum + amountOf(p), 0)));
  setText("reportExpenses", money(expenses));
  setText("reportGrossProfit", money(gross));
  setText("profitSales", money(revenue));
  setText("profitCost", money(cost));
  setText("profitGross", money(gross));
  setText("profitExpense", money(expenses));
  setText("profitNet", money(gross - expenses));

  const warning = $("#profitWarning");
  if (warning) {
    warning.textContent = sales.length && !hasCost && savedProfit === 0 ? "चेतावनी: बिक्रीको लागत वा Profit विवरण उपलब्ध छैन। Gross Profit सही नहुन सक्छ।" : "";
  }
}

function renderAll() {
  clearError();
  try {
    const sales = renderSales();
    const purchases = renderPurchases();
    renderStock();
    renderCustomers();
    renderSuppliers();
    renderProfit(sales, purchases);
    const note = $("#reportPeriodNote");
    if (note) {
      note.textContent = fromDate || toDate ? "छानिएको अवधि: " + (fromDate || "सुरु मिति छैन") + " देखि " + (toDate || "अन्तिम मिति छैन") : "सबै मितिको Data देखाइएको छ।";
    }
  } catch (error) {
    console.error("[GS Reports] Render failed:", error);
    showError("Report देखाउन समस्या भयो। Refresh गरेर फेरि प्रयास गर्नुहोस्।");
  }
}

/* ---------- TABS SWITCHING LOGIC (FIXED) ---------- */

function setActiveTab(targetName) {
  $$("[data-report-tab]").forEach(tab => { const active = tab.getAttribute("data-report-tab") === targetName; tab.classList.toggle("active", active); tab.setAttribute("aria-selected", String(active)); });    $$
(".report-panel[data-report]").forEach(panel => {
    const match = panel.getAttribute("data-report") === targetName;
    if (match) {
      panel.removeAttribute("hidden");
      panel.style.display = "";
    } else {
      panel.setAttribute("hidden", "true");
      panel.style.display = "none";
    }
  });
}

function bindTabs() {
  const nav = $(".report-tabs");
  if (!nav || nav.dataset.tabsBound === "true") return;
  nav.dataset.tabsBound = "true";

  nav.addEventListener("click", event => {
    const tabBtn = event.target.closest("[data-report-tab]");
    if (!tabBtn || !nav.contains(tabBtn)) return;
    event.preventDefault();
    const targetReport = tabBtn.getAttribute("data-report-tab");
    setActiveTab(targetReport);
  });
}

/* ---------- DATE FILTER ---------- */

function bindFilters() {
  const from = $("#reportFromDate");
  const to = $("#reportToDate");

  $("#applyReportFilterBtn")?.addEventListener("click", () => {
    fromDate = from?.value || "";
    toDate = to?.value || "";
    if (fromDate && toDate && fromDate > toDate) {
      showError("From Date, To Date भन्दा पछाडि हुन मिल्दैन।");
      return;
    }
    renderAll();
  });

  $("#clearReportFilterBtn")?.addEventListener("click", () => {
    if (from) from.value = "";
    if (to) to.value = "";
    fromDate = "";
    toDate = "";
    renderAll();
  });

  $("#refreshReportsBtn")?.addEventListener("click", renderAll);
}

/* ---------- PRINT / SAVE REPORT PDF ---------- */

function printCurrentReport(panel) {
  const win = window.open("", "_blank");
  if (!win) {
    showError("PDF खोल्न Browser popup अनुमति दिनुहोस्।");
    return;
  }

  const s = settings() || {};
  const read = (...keys) => {
    for (const key of keys) {
      const value = s[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return String(value).trim();
      }
    }
    return "";
  };

  const profile = {
    name: read("storeName", "businessName", "name", "shopName") || "General Store",
    owner: read("ownerName", "proprietorName", "owner", "operatorName"),
    address: read("storeAddress", "address", "businessAddress", "shopAddress"),
    phone: read("storePhone", "phone", "mobile", "contactNumber"),
    email: read("storeEmail", "email", "businessEmail"),
    taxType: read("taxType") || "VAT",
    taxNumber: read("taxNumber", "panNumber", "vatNumber", "pan", "vat", "taxId"),
    photo: read("operatorPhoto", "ownerPhoto", "ownerPhotoUrl", "userPhoto", "photoUrl"),
    footer: read("invoiceFooter", "receiptFooter", "footerText") || "हाम्रो पसलमा आउनुभएकोमा धन्यवाद!"
  };

  const safe = value => esc(String(value ?? ""));
  const heading = $("h2", panel);
  const reportName = heading?.textContent?.trim() || "Business Report";
  const dateLabel = fromDate || toDate ? `${fromDate || "—"} देखि ${toDate || "—"}` : "सबै मिति";

  const content = panel.cloneNode(true);
  content.querySelectorAll(".no-print, .report-print-btn, button").forEach(el => el.remove());
  content.hidden = false;
  content.removeAttribute("hidden");
  content.style.display = "";
  content.querySelectorAll("[hidden]").forEach(el => {
    el.hidden = false;
    el.removeAttribute("hidden");
    el.style.display = "";
  });

  const photo = profile.photo
    ? `<img class="profile-photo" src="${safe(profile.photo)}" alt="Store owner" onerror="this.style.display='none'">`
    : `<div class="photo-placeholder">👤</div>`;

  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html lang="ne">
<head>
<meta charset="UTF-8">
<title>${safe(profile.name)} - ${safe(reportName)}</title>
<style>
@page { size: A4 portrait; margin: 10mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; width: 100%; font-family: Arial, sans-serif; font-size: 10px; color: #18212f; background: white; }
.paper { width: 100%; margin: 0; padding: 27mm 0 15mm; }
.store-head { position: fixed; top: 0; left: 0; right: 0; height: 24mm; background: white; border-bottom: 1.5px solid #17683a; }
.profile-header { height: 23mm; display: grid; grid-template-columns: 19mm minmax(0, 1fr) minmax(0, 1fr); gap: 3mm; align-items: center; }
.profile-photo-box { width: 18mm; height: 18mm; display: flex; justify-content: center; align-items: center; overflow: hidden; }
.profile-photo, .photo-placeholder { width: 18mm; height: 18mm; border-radius: 50%; object-fit: cover; }
.photo-placeholder { display: flex; justify-content: center; align-items: center; background: #f0f0f0; font-size: 22px; }
.profile-store, .profile-owner { min-width: 0; font-size: 9px; line-height: 1.5; overflow-wrap: anywhere; }
.store-name { font-size: 13px; font-weight: bold; color: #17683a; }
.owner-name { font-size: 11px; font-weight: bold; }
.report-title { display: flex; justify-content: space-between; align-items: flex-end; gap: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin-bottom: 8px; }
.report-title h2 { margin: 0; font-size: 14px; overflow-wrap: anywhere; }
.report-content, .report-card { width: 100% !important; margin: 0 !important; padding: 0 !important; background: white !important; border: 0 !important; box-shadow: none !important; }
.report-table-wrap { width: 100% !important; border: 1px solid #cbd5e1 !important; }
table, .report-table { width: 100% !important; border-collapse: collapse !important; font-size: 8px !important; }
th, .report-table th { padding: 5px 3px !important; background: #17683a !important; color: white !important; border: 1px solid #cbd5e1 !important; }
td, .report-table td { padding: 4px 3px !important; border: 1px solid #d1d5db !important; }
.thanks { text-align: center; font-weight: bold; color: #17683a; font-size: 9px; margin-top: 8px; }
.store-foot { position: fixed; bottom: 0; left: 0; right: 0; height: 12mm; display: flex; justify-content: center; align-items: flex-start; gap: 8mm; background: white; border-top: 1px solid #9ca3af; font-size: 9px; }
.actions { text-align: center; margin: 15px auto; }
.actions button { padding: 9px 16px; margin: 4px; color: white; background: #17683a; border: 0; border-radius: 4px; }
@media print { .actions, .no-print { display: none !important; } }
</style>
</head>
<body>
<div class="paper">
  <div class="store-head">
    <div class="profile-header">
      <div class="profile-photo-box">${photo}</div>
      <div class="profile-store">
        <div class="store-name">${safe(profile.name)}</div>
        <div>${safe(profile.taxType)}: ${safe(profile.taxNumber || "-")}</div>
      </div>
      <div class="profile-owner">
        <div class="owner-name">${safe(profile.owner || "-")}</div>
        <div>${safe(profile.address || "-")}</div>
      </div>
    </div>
  </div>

  <div class="report-title">
    <h2>${safe(reportName)}</h2>
    <div style="text-align:right; font-size:8px;">
      <div>अवधि: ${safe(dateLabel)}</div>
    </div>
  </div>

  <div class="report-content">${content.outerHTML}</div>
  <div class="thanks">${safe(profile.footer)}</div>

  <div class="store-foot">
    <div>फोन: ${safe(profile.phone || "-")}</div>
    <div>इमेल: ${safe(profile.email || "-")}</div>
  </div>
</div>

<div class="actions">
  <button onclick="window.print()">Print / Save PDF</button>
  <button onclick="window.close()">Close</button>
</div>

<script>
window.addEventListener("load", () => {
  setTimeout(() => { window.focus(); window.print(); }, 300);
});
<\/script>
</body>
</html>`);
  win.document.close();
}

function addPrintButtons() {
  $$(".report-panel[data-report]").forEach(panel => {
    if ($(".report-print-btn", panel)) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "report-btn report-print-btn no-print";
    button.textContent = "🖨️ Print / Save PDF";
    button.addEventListener("click", () => printCurrentReport(panel));
    const header = $(".report-panel-header", panel);
    if (header) header.appendChild(button);
  });
}

/* ---------- INITIALIZE ---------- */

function init() {
  applyReportAppearance();
  bindTabs();
  bindFilters();
  addPrintButtons();
  setActiveTab("sales"); // Default Tab
  renderAll();
  console.info("[GS Reports] Successfully Initialized");
}

window.loadReports = renderAll;
window.refreshReports = renderAll;
window.GSReports = { refresh: renderAll, render: renderAll, money };

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
})();
