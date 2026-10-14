
/* =========================================================
   GS GENERAL STORE — REPORTS.JS
   FULL REPLACEMENT
   Clean Appearance + Store Profile PDF Header/Footer
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

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

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
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  }

  function val(object, keys, fallback = "") {
    for (const key of keys) {
      const value = object?.[key];

      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
      ) {
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

    const parsed = Number(
      value.replace(/,/g, "").replace(/[^\d.-]/g, "")
    );

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
    const currency = String(
      val(settings(), ["currency", "currencyCode"], "NPR")
    ).toUpperCase();

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

  function dateOf(record) {
    const raw = val(
      record,
      ["date", "saleDate", "purchaseDate", "createdAt"],
      ""
    );

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

    return (!fromDate || date >= fromDate) &&
           (!toDate || date <= toDate);
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
    return num(val(
      record,
      ["total", "grandTotal", "netTotal", "amount", "value"],
      0
    ));
  }

  function paidOf(record) {
    return num(val(
      record,
      ["paidAmount", "paid", "amountPaid"],
      0
    ));
  }

  function dueOf(record) {
    return num(val(
      record,
      ["balance", "due", "dueAmount", "payable"],
      Math.max(0, amountOf(record) - paidOf(record))
    ));
  }

  /* ---------- PAGE APPEARANCE ---------- */

  function applyReportAppearance() {
    if ($("#gsReportAppearance")) return;

    const style = document.createElement("style");
    style.id = "gsReportAppearance";

    style.textContent = `
      html, body {
        background: #f3f6fa !important;
        color: #172033 !important;
      }

      .report-wrap {
        color: #172033 !important;
      }

      .report-card,
      .report-stat,
      .report-tabs,
      .report-table,
      .report-field input,
      .profit-item {
        background: #ffffff !important;
        color: #172033 !important;
      }

      .report-card,
      .report-stat,
      .report-tabs,
      .report-table-wrap,
      .report-table td,
      .report-table th {
        border-color: #d8e0e8 !important;
      }

      .report-table th {
        background: #17683a !important;
        color: #ffffff !important;
      }

      .report-table td {
        color: #172033 !important;
      }

      .report-table tbody tr:nth-child(even) td {
        background: #f0f7f2 !important;
      }

      .report-tab {
        color: #475569 !important;
      }

      .report-tab.active {
        background: #17683a !important;
        color: #ffffff !important;
      }

      .stat-label,
      .stat-note,
      .report-period,
      .report-help,
      .report-count,
      .report-field label,
      .profit-item span {
        color: #64748b !important;
      }

      .stat-value,
      .profit-item strong,
      .report-panel-header h2 {
        color: #172033 !important;
      }

      .report-btn:not(.primary) {
        background: #ffffff !important;
        color: #172033 !important;
      }

      .report-btn.primary {
        background: #17683a !important;
        color: #ffffff !important;
      }

      .report-table td.num {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
    `;

    document.head.appendChild(style);
  }

  /* ---------- UI HELPERS ---------- */

  function setText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  }

  function setBody(id, rows, colspan, emptyText) {
    const body = document.getElementById(id);
    if (!body) return;

    body.innerHTML = rows.length
      ? rows.join("")
      : `<tr><td class="report-empty" colspan="${colspan}">
           ${esc(emptyText)}
         </td></tr>`;
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

  /* ---------- SALES REPORT ---------- */

  function renderSales() {
    const sales = filtered(KEY.sales).slice().sort(
      (a, b) => dateOf(b).localeCompare(dateOf(a))
    );

    const rows = [];

    sales.forEach(sale => {
      const items = itemsOf(sale);
      const displayItems = items.length
        ? items
        : [{ productName: "—", barcode: "—", qty: 0 }];

      displayItems.forEach((item, index) => {
        rows.push(`
          <tr>
            <td>${esc(dateOf(sale) || "—")}</td>
            <td>${esc(val(sale,
              ["billNumber", "invoiceNumber", "invoiceNo", "id"], "—"))}</td>
            <td>${esc(val(sale,
              ["customerName", "customer"], "Cash Customer"))}</td>
            <td>${esc(val(item,
              ["productName", "name"], "Product"))}</td>
            <td>${esc(val(item, ["barcode"], "—"))}</td>
            <td class="num">${num(val(item, ["qty", "quantity"], 0))}</td>
            <td class="num">${money(index === 0 ? amountOf(sale) : 0)}</td>
            <td class="num">${money(index === 0 ? paidOf(sale) : 0)}</td>
            <td class="num">${money(index === 0 ? dueOf(sale) : 0)}</td>
          </tr>
        `);
      });
    });

    setBody(
      "salesReportBody",
      rows,
      9,
      "यो अवधिमा बिक्री विवरण भेटिएन।"
    );

    setCount("salesReportCount", sales.length, "bills");

    return sales;
  }

  /* ---------- PURCHASE REPORT ---------- */

  function renderPurchases() {
    const purchases = filtered(KEY.purchases).slice().sort(
      (a, b) => dateOf(b).localeCompare(dateOf(a))
    );

    const rows = [];

    purchases.forEach(purchase => {
      const items = itemsOf(purchase);
      const displayItems = items.length
        ? items
        : [{ productName: "—", qty: 0, rate: 0 }];

      displayItems.forEach((item, index) => {
        rows.push(`
          <tr>
            <td>${esc(dateOf(purchase) || "—")}</td>
            <td>${esc(val(purchase,
              ["billNumber", "invoiceNumber", "id"], "—"))}</td>
            <td>${esc(val(purchase,
              ["supplierName", "supplier"], "—"))}</td>
            <td>${esc(val(item,
              ["productName", "name"], "Product"))}</td>
            <td class="num">${num(val(item,
              ["qty", "quantity", "totalReceivedQty"], 0))}</td>
            <td class="num">${money(val(item,
              ["rate", "purchasePrice", "effectiveCost"], 0))}</td>
            <td class="num">${money(index === 0 ? amountOf(purchase) : 0)}</td>
            <td class="num">${money(index === 0 ? paidOf(purchase) : 0)}</td>
          </tr>
        `);
      });
    });

    setBody(
      "purchaseReportBody",
      rows,
      8,
      "यो अवधिमा खरिद विवरण भेटिएन।"
    );

    setCount("purchaseReportCount", purchases.length, "bills");

    return purchases;
  }

  /* ---------- STOCK REPORT ---------- */

  function renderStock() {
    const products = list(KEY.products).slice().sort(
      (a, b) => String(val(a, ["name", "productName"], ""))
        .localeCompare(String(val(b, ["name", "productName"], "")))
    );

    const rows = products.map(product => {
      const stock = num(val(
        product, ["stock", "quantity", "qty", "currentStock"], 0
      ));

      const cost = num(val(
        product, ["purchasePrice", "costPrice", "buyPrice", "rate"], 0
      ));

      const price = num(val(
        product, ["sellingPrice", "salePrice", "price", "mrp"], 0
      ));

      const lowLimit = num(val(
        product, ["lowStock", "reorderLevel", "minimumStock"], 5
      ));

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

  /* ---------- CUSTOMER REPORT ---------- */

  function renderCustomers() {
    const customers = list(KEY.customers);
    const sales = filtered(KEY.sales);

    const rows = customers.map(customer => {
      const id = String(val(customer, ["id", "customerId"], ""));
      const name = String(val(
        customer, ["name", "customerName", "fullName"], "Unknown"
      ));

      const matching = sales.filter(sale =>
        (id && String(val(sale, ["customerId"], "")) === id) ||
        String(val(sale, ["customerName", "customer"], ""))
          .toLowerCase() === name.toLowerCase()
      );

      const credit = matching.reduce(
        (sum, sale) => sum + amountOf(sale), 0
      );

      const payments = matching.reduce(
        (sum, sale) => sum + paidOf(sale), 0
      );

      const opening = num(val(
        customer, ["openingBalance", "openingDue"], 0
      ));

      const balance = num(val(
        customer, ["currentBalance", "balanceDue", "due"],
        opening + credit - payments
      ));

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

  /* ---------- SUPPLIER REPORT ---------- */

  function renderSuppliers() {
    const suppliers = list(KEY.suppliers);
    const purchases = filtered(KEY.purchases);

    const rows = suppliers.map(supplier => {
      const id = String(val(supplier, ["id", "supplierId"], ""));
      const name = String(val(
        supplier, ["name", "supplierName", "companyName"], "Unknown"
      ));

      const matching = purchases.filter(purchase =>
        (id && String(val(purchase, ["supplierId"], "")) === id) ||
        String(val(purchase, ["supplierName", "supplier"], ""))
          .toLowerCase() === name.toLowerCase()
      );

      const total = matching.reduce(
        (sum, purchase) => sum + amountOf(purchase), 0
      );

      const payments = matching.reduce(
        (sum, purchase) => sum + paidOf(purchase), 0
      );

      const opening = num(val(
        supplier, ["openingBalance", "openingPayable"], 0
      ));

      const balance = num(val(
        supplier, ["currentBalance", "balance", "payable"],
        opening + total - payments
      ));

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

  /* ---------- PROFIT & LOSS ---------- */

  function renderProfit(sales, purchases) {
    const finance = filtered(KEY.finance);

    const revenue = sales.reduce(
      (sum, sale) => sum + amountOf(sale), 0
    );

    const hasCost = sales.some(sale =>
      num(val(sale, ["fifoCost", "costOfGoodsSold", "totalCost"], 0)) > 0
    );

    const cost = sales.reduce((sum, sale) => {
      const savedCost = num(val(
        sale, ["fifoCost", "costOfGoodsSold", "totalCost"], 0
      ));

      if (savedCost > 0) return sum + savedCost;

      return sum + itemsOf(sale).reduce((itemSum, item) =>
        itemSum +
        num(val(item, ["fifoCost", "cost", "effectiveCost"], 0)) *
        num(val(item, ["qty", "quantity"], 0)),
      0);
    }, 0);

    const savedProfit = sales.reduce(
      (sum, sale) => sum + num(val(sale, ["profit", "grossProfit"], 0)),
      0
    );

    const gross = hasCost ? revenue - cost : savedProfit;

    const expenses = finance.reduce((sum, item) => {
      const type = String(val(
        item, ["type", "category", "transactionType"], ""
      )).toLowerCase();

      const isExpense =
        type.includes("expense") ||
        type === "out" ||
        type.includes("withdraw");

      return sum + (
        isExpense
          ? num(val(item, ["amount", "total", "value"], 0))
          : 0
      );
    }, 0);

    setText("reportSales", money(revenue));

    setText(
      "reportPurchases",
      money(purchases.reduce((sum, p) => sum + amountOf(p), 0))
    );

    setText("reportExpenses", money(expenses));
    setText("reportGrossProfit", money(gross));

    setText("profitSales", money(revenue));
    setText("profitCost", money(cost));
    setText("profitGross", money(gross));
    setText("profitExpense", money(expenses));
    setText("profitNet", money(gross - expenses));

    const warning = $("#profitWarning");

    if (warning) {
      warning.textContent =
        sales.length && !hasCost && savedProfit === 0
          ? "चेतावनी: बिक्रीको लागत वा Profit विवरण उपलब्ध छैन। Gross Profit सही नहुन सक्छ।"
          : "";
    }
  }

  /* ---------- RENDER ALL ---------- */

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
        note.textContent = fromDate || toDate
          ? "छानिएको अवधि: " + (fromDate || "सुरु मिति छैन") +
            " देखि " + (toDate || "अन्तिम मिति छैन")
          : "सबै मितिको Data देखाइएको छ।";
      }
    } catch (error) {
      console.error("[GS Reports] Render failed:", error);
      showError("Report देखाउन समस्या भयो। Refresh गरेर फेरि प्रयास गर्नुहोस्।");
    }
  }

  /* ---------- REPORT TABS ---------- */

  function setActiveTab(target) {
    $$("[data-report-tab]").forEach(tab => {
      const active = tab.dataset.reportTab === target;

      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    $$(".report-panel[data-report]").forEach(panel => {
      panel.hidden = panel.dataset.report !== target;
    });
  }

  function bindTabs() {
    $$("[data-report-tab]").forEach(tab => {
      tab.addEventListener("click", () => {
        setActiveTab(tab.dataset.reportTab);
      });
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


/* ---------- STORE PROFILE FOR PDF ---------- */

function storeProfile() {
  const s = settings() || {};

  const first = keys =>
    String(val(s, keys, "") ?? "").trim();

  return {
    name: first(["storeName", "businessName", "name", "shopName"])
      || "General Store",

    owner: first(["ownerName", "proprietorName", "owner"]),

    address: first([
      "storeAddress", "address", "businessAddress", "shopAddress"
    ]),

    phone: first([
      "storePhone", "phone", "mobile", "contactNumber"
    ]),

    email: first([
      "storeEmail", "email", "businessEmail"
    ]),

    taxType: first(["taxType"]) || "VAT",

    taxNumber: first([
      "taxNumber", "panNumber", "vatNumber", "pan", "vat", "taxId"
    ]),

    operatorPhoto: first([
      "operatorPhoto", "ownerPhoto", "ownerPhotoUrl",
      "userPhoto", "photoUrl"
    ]),

    footer: first([
      "invoiceFooter", "receiptFooter", "footerText"
    ]) || "हाम्रो पसलमा आउनुभएकोमा धन्यवाद!"
  };
}

function profileLines(p) {
  return `
    <div class="profile-header">
      <div class="profile-photo-box">
        ${
          p.operatorPhoto
            ? `<img class="profile-photo"
                 src="${esc(p.operatorPhoto)}"
                 alt="Owner photo"
                 onerror="this.style.display='none'">`
            : `<div class="photo-placeholder">👤</div>`
        }
      </div>

      <div class="profile-store">
        <div class="store-name">${esc(p.name)}</div>
        <div>${esc(p.taxType)}: ${esc(p.taxNumber || "-")}</div>
      </div>

      <div class="profile-owner">
        <div class="owner-name">${esc(p.owner || "-")}</div>
        <div>${esc(p.address || "-")}</div>
      </div>
    </div>
  `;
}


/* ---------- PRINT / SAVE REPORT PDF ---------- */

function printCurrentReport(panel) {
  const profile = storeProfile();

  const heading = $("h2", panel);
  const reportName = heading?.textContent?.trim() || "Business Report";

  const dateLabel = fromDate || toDate
    ? `${fromDate || "—"} देखि ${toDate || "—"}`
    : "सबै मिति";

  const content = panel.cloneNode(true);

  content.querySelectorAll(
    ".no-print, .report-print-btn"
  ).forEach(element => element.remove());

  content.hidden = false;

  const table = content.querySelector(".report-table");
  if (table) table.style.minWidth = "0";

  const win = window.open("", "_blank");

  if (!win) {
    showError("PDF खोल्न Browser popup अनुमति दिनुहोस्।");
    return;
  }

  const safe = value => esc(String(value ?? ""));

  win.document.open();

  win.document.write(`<!doctype html>
<html lang="ne">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">

<title>${safe(profile.name)} - ${safe(reportName)}</title>

<style>
  @page {
    size: A4 portrait;
    margin: 30mm 10mm 19mm;
  }

  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    background: #fff;
    color: #18212f;
    font-family: Arial, "Noto Sans Devanagari", sans-serif;
    font-size: 10px;
  }

  .paper {
    width: 100%;
    margin: 0 auto;
  }

  /* Header repeats on each printed page. */
  .store-head {
    position: fixed;
    top: -26mm;
    left: 0;
    right: 0;
    height: 24mm;
    padding-bottom: 2mm;
    background: #fff;
    border-bottom: 1.5px solid #17683a;
  }

  .profile-header {
    width: 100%;
    height: 22mm;
    display: grid;
    grid-template-columns: 19mm minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
    column-gap: 4mm;
  }

  .profile-photo-box {
    width: 18mm;
    height: 18mm;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .profile-photo,
  .photo-placeholder {
    width: 18mm;
    height: 18mm;
    border-radius: 50%;
    object-fit: cover;
  }

  .photo-placeholder {
    display: flex;
    justify-content: center;
    align-items: center;
    background: #f0f0f0;
    font-size: 22px;
  }

  .profile-store,
  .profile-owner {
    min-width: 0;
    overflow-wrap: anywhere;
    line-height: 1.5;
    font-size: 9px;
  }

  .store-name {
    color: #17683a;
    font-size: 13px;
    font-weight: bold;
    line-height: 1.3;
    margin-bottom: 2px;
  }

  .owner-name {
    font-size: 11px;
    font-weight: bold;
    margin-bottom: 2px;
  }

  .report-title {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 8px;
    padding-bottom: 7px;
    margin-bottom: 10px;
    border-bottom: 1px solid #cbd5e1;
  }

  .report-title h2 {
    margin: 0;
    font-size: 15px;
    overflow-wrap: anywhere;
  }

  .period {
    text-align: right;
    line-height: 1.5;
    font-size: 9px;
  }

  .report-content,
  .report-card {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    background: #fff !important;
    color: #18212f !important;
  }

  .report-panel-header {
    margin: 0 0 6px !important;
  }

  .report-panel-header h2 {
    display: none !important;
  }

  .report-table-wrap {
    max-width: 100% !important;
    overflow: visible !important;
    border: 1px solid #cbd5e1 !important;
    border-radius: 0 !important;
  }

  .report-table {
    width: 100% !important;
    min-width: 0 !important;
    border-collapse: collapse !important;
    table-layout: auto;
    white-space: normal !important;
    font-size: 9px !important;
    background: #fff !important;
  }

  .report-table thead {
    display: table-header-group;
  }

  .report-table tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .report-table th {
    padding: 6px 4px !important;
    background: #17683a !important;
    color: #fff !important;
    border: 1px solid #cbd5e1 !important;
    overflow-wrap: anywhere;
  }

  .report-table td {
    padding: 5px 4px !important;
    background: #fff !important;
    color: #18212f !important;
    border: 1px solid #d1d5db !important;
    white-space: normal !important;
    overflow-wrap: anywhere;
  }

  .report-table tbody tr:nth-child(even) td {
    background: #f1f7f3 !important;
  }

  .report-empty {
    text-align: center !important;
  }

  .profit-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .profit-item {
    break-inside: avoid;
    page-break-inside: avoid;
    border: 1px solid #d1d5db !important;
    padding: 8px !important;
    background: #fff !important;
  }

  .profit-item span {
    color: #4b5563 !important;
  }

  .profit-item strong {
    overflow-wrap: anywhere;
  }

  .report-warning {
    padding: 7px !important;
    border: 1px solid #e7c879 !important;
  }

  .report-help {
    color: #4b5563 !important;
  }

  /* Footer repeats at the bottom of every page. */
  .store-foot {
    position: fixed;
    bottom: -15mm;
    left: 0;
    right: 0;
    height: 12mm;
    padding-top: 3mm;
    border-top: 1px solid #9ca3af;
    background: #fff;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    gap: 8mm;
    font-size: 9px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .store-foot span {
    min-width: 0;
  }

  .thanks {
    text-align: center;
    color: #17683a;
    font-weight: bold;
    margin-top: 10px;
    font-size: 9px;
  }

  .actions {
    margin: 18px auto;
    text-align: center;
  }

  .actions button {
    border: 0;
    border-radius: 4px;
    padding: 10px 18px;
    margin: 4px;
    color: white;
    background: #17683a;
    cursor: pointer;
  }

  @media screen {
    body {
      padding: 12px;
      background: #eee;
    }

    .paper {
      max-width: 190mm;
      min-height: 240mm;
      padding: 12px;
      background: white;
    }

    .store-head,
    .store-foot {
      position: static;
      height: auto;
    }

    .store-head {
      margin-bottom: 12px;
    }

    .store-foot {
      margin-top: 18px;
      padding-bottom: 8px;
    }
  }

  @media print {
    .actions,
    .no-print {
      display: none !important;
    }

    html, body {
      width: 100%;
      margin: 0;
      padding: 0;
      background: #fff;
    }

    .paper {
      width: 100%;
      max-width: none;
      min-height: 0;
      padding: 0;
    }

    .store-head,
    .store-foot {
      position: fixed;
      background: #fff;
    }

    .report-table {
      page-break-inside: auto;
    }

    .report-table thead {
      display: table-header-group;
    }

    .report-table tr,
    .profit-item {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  }
</style>
</head>

<body>
<main class="paper">

  <header class="store-head">
    ${profileLines(profile)}
  </header>

  <section class="report-title">
    <h2>${safe(reportName)}</h2>

    <div class="period">
      <b>अवधि:</b> ${safe(dateLabel)}<br>
      <b>प्रिन्ट मिति:</b>
      ${safe(new Date().toLocaleDateString("en-GB"))}
    </div>
  </section>

  <section class="report-content">
    ${content.outerHTML}
  </section>

  <div class="thanks">${safe(profile.footer)}</div>

  <footer class="store-foot">
    <span>फोन: ${safe(profile.phone || "-")}</span>
    <span>इमेल: ${safe(profile.email || "-")}</span>
  </footer>

</main>

<div class="actions">
  <button onclick="window.print()">Print / Save PDF</button>
  <button onclick="window.close()">Close</button>
</div>

<script>
  window.addEventListener("load", () => {
    setTimeout(() => {
      window.focus();
      window.print();
    }, 400);
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

      button.addEventListener("click", () => {
        printCurrentReport(panel);
      });

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

    setActiveTab("sales");
    renderAll();

    console.info(
      "[GS Reports] Ready:",
      list(KEY.sales).length, "sales;",
      list(KEY.purchases).length, "purchases;",
      list(KEY.products).length, "products"
    );
  }

  window.loadReports = renderAll;
  window.refreshReports = renderAll;

  window.GSReports = {
    refresh: renderAll,
    render: renderAll,
    money,
    storeProfile
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
