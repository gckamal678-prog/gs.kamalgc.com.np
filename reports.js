
/* =========================================================
   GS GENERAL STORE — REPORTS.JS
   FULL REPLACEMENT
   Compatible with current reports.html
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

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  let fromDate = "";
  let toDate = "";

  /* ---------------- STORAGE ---------------- */

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
      for (const prop of ["data", "items", "records", "list"]) {
        if (Array.isArray(value[prop])) return value[prop];
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
      NPR: "Rs. ",
      RS: "Rs. ",
      INR: "₹",
      USD: "$",
      GBP: "£",
      EUR: "€"
    };

    return (symbols[currency] || currency + " ") +
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

  /* ---------------- UI HELPERS ---------------- */

  function setText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  }

  function setBody(id, rows, colspan, emptyText) {
    const body = document.getElementById(id);
    if (!body) return;

    body.innerHTML = rows.length
      ? rows.join("")
      : `<tr><td class="report-empty" colspan="${colspan}">${esc(emptyText)}</td></tr>`;
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

  /* ---------------- SALES REPORT ---------------- */

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
            <td>${esc(val(sale, ["billNumber", "invoiceNumber", "invoiceNo", "id"], "—"))}</td>
            <td>${esc(val(sale, ["customerName", "customer"], "Cash Customer"))}</td>
            <td>${esc(val(item, ["productName", "name"], "Product"))}</td>
            <td>${esc(val(item, ["barcode"], "—"))}</td>
            <td>${num(val(item, ["qty", "quantity"], 0))}</td>
            <td>${money(index === 0 ? amountOf(sale) : 0)}</td>
            <td>${money(index === 0 ? paidOf(sale) : 0)}</td>
            <td>${money(index === 0 ? dueOf(sale) : 0)}</td>
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

  /* ---------------- PURCHASE REPORT ---------------- */

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
            <td>${esc(val(purchase, ["billNumber", "invoiceNumber", "id"], "—"))}</td>
            <td>${esc(val(purchase, ["supplierName", "supplier"], "—"))}</td>
            <td>${esc(val(item, ["productName", "name"], "Product"))}</td>
            <td>${num(val(item, ["qty", "quantity", "totalReceivedQty"], 0))}</td>
            <td>${money(val(item, ["rate", "purchasePrice", "effectiveCost"], 0))}</td>
            <td>${money(index === 0 ? amountOf(purchase) : 0)}</td>
            <td>${money(index === 0 ? paidOf(purchase) : 0)}</td>
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

  /* ---------------- STOCK REPORT ---------------- */

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
          <td>${stock.toLocaleString("en-IN")}</td>
          <td>${money(cost)}</td>
          <td>${money(price)}</td>
          <td>${money(stock * cost)}</td>
          <td>${status}</td>
        </tr>
      `;
    });

    setBody("stockReportBody", rows, 9, "Product विवरण भेटिएन।");
    setCount("stockReportCount", products.length, "products");

    return products;
  }

  /* ---------------- CUSTOMER REPORT ---------------- */

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
          <td>${money(opening)}</td>
          <td>${money(credit)}</td>
          <td>${money(payments)}</td>
          <td>${money(balance)}</td>
        </tr>
      `;
    });

    setBody(
      "customerReportBody",
      rows,
      6,
      "Customer विवरण भेटिएन।"
    );

    setCount("customerReportCount", customers.length, "customers");
  }

  /* ---------------- SUPPLIER REPORT ---------------- */

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
          <td>${money(opening)}</td>
          <td>${money(total)}</td>
          <td>${money(payments)}</td>
          <td>${money(balance)}</td>
        </tr>
      `;
    });

    setBody(
      "supplierReportBody",
      rows,
      6,
      "Supplier विवरण भेटिएन।"
    );

    setCount("supplierReportCount", suppliers.length, "suppliers");
  }

  /* ---------------- PROFIT & LOSS ---------------- */

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

    const totalSales = sales.reduce(
      (sum, sale) => sum + amountOf(sale), 0
    );

    const totalPurchases = purchases.reduce(
      (sum, purchase) => sum + amountOf(purchase), 0
    );

    setText("reportSales", money(totalSales));
    setText("reportPurchases", money(totalPurchases));
    setText("reportExpenses", money(expenses));
    setText("reportGrossProfit", money(gross));

    setText("profitSales", money(revenue));
    setText("profitCost", money(cost));
    setText("profitGross", money(gross));
    setText("profitExpense", money(expenses));
    setText("profitNet", money(gross - expenses));

    const warning = $("#profitWarning");

    if (warning) {
      warning.textContent = sales.length && !hasCost && savedProfit === 0
        ? "चेतावनी: बिक्रीको लागत वा Profit विवरण उपलब्ध छैन। Gross Profit सही नहुन सक्छ।"
        : "";
    }
  }

  /* ---------------- MAIN RENDER ---------------- */

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

  /* ---------------- TAB FIX ---------------- */

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

  /* ---------------- DATE FILTERS ---------------- */

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

  /* ---------------- PRINT / SAVE PDF ---------------- */

  function addPrintButtons() {
    $$(".report-panel[data-report]").forEach(panel => {
      if ($(".report-print-btn", panel)) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "report-btn report-print-btn no-print";
      button.textContent = "Print / Save PDF";

      button.addEventListener("click", () => {
        const oldTitle = document.title;
        const heading = $("h2", panel);

        document.title =
          "GS General Store - " + (heading?.textContent || "Report");

        const style = document.createElement("style");
        style.id = "gsReportPrintStyle";
        style.textContent = `
          @media print {
            body * { visibility: hidden !important; }
            .report-panel:not([hidden]),
            .report-panel:not([hidden]) * {
              visibility: visible !important;
            }
            .report-panel:not([hidden]) {
              display: block !important;
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              box-shadow: none;
            }
            .no-print { display: none !important; }
            .report-table {
              min-width: 0 !important;
              font-size: 9px !important;
            }
          }
        `;

        document.head.appendChild(style);
        window.print();

        setTimeout(() => {
          $("#gsReportPrintStyle")?.remove();
          document.title = oldTitle;
        }, 700);
      });

      const header = $(".report-panel-header", panel);

      if (header) header.appendChild(button);
    });
  }

  /* ---------------- INITIALIZE ---------------- */

  function init() {
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
    money
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
