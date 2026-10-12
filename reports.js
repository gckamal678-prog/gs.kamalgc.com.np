"use strict";

document.addEventListener("DOMContentLoaded", function () {
  const KEYS = {
    sales: "gs_sales",
    purchases: "gs_purchases",
    products: "gs_products",
    customers: "gs_customers",
    suppliers: "gs_suppliers",
    finance: "gs_finance",
    settings: "gs_settings"
  };

  const $ = id => document.getElementById(id);

  const fromDate = $("reportFromDate");
  const toDate = $("reportToDate");
  const errorBox = $("reportError");

  // =========================================================
  // STORAGE AND BASIC HELPERS
  // =========================================================

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;

      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (error) {
      console.error("Could not read " + key, error);
      return fallback;
    }
  }

  function readArray(key) {
    const value = read(key, []);
    return Array.isArray(value) ? value : [];
  }

  function readSettings() {
    const value = read(KEYS.settings, {});
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  }

  function loadData() {
    return {
      sales: readArray(KEYS.sales),
      purchases: readArray(KEYS.purchases),
      products: readArray(KEYS.products),
      customers: readArray(KEYS.customers),
      suppliers: readArray(KEYS.suppliers),
      finance: readArray(KEYS.finance)
    };
  }

  function num(value) {
    if (typeof value === "string") {
      value = value.replace(/,/g, "").trim();
    }

    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
  }

  function firstNumber(object, keys, fallback) {
    for (const key of keys) {
      if (
        object &&
        object[key] !== undefined &&
        object[key] !== null &&
        object[key] !== ""
      ) {
        return num(object[key]);
      }
    }

    return fallback === undefined ? 0 : fallback;
  }

  function firstValue(object, keys, fallback) {
    for (const key of keys) {
      if (
        object &&
        object[key] !== undefined &&
        object[key] !== null &&
        object[key] !== ""
      ) {
        return object[key];
      }
    }

    return fallback === undefined ? "" : fallback;
  }

  function currencySymbol() {
    const settings = readSettings();
    const value = settings.currencySymbol || settings.currency || "Rs.";

    return typeof value === "string" || typeof value === "number"
      ? String(value)
      : "Rs.";
  }

  function money(value) {
    return currencySymbol() + " " + num(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);
  }

  function localDateString(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function dateOf(record) {
    const raw = firstValue(record, [
      "date",
      "saleDate",
      "purchaseDate",
      "transactionDate",
      "createdAt"
    ], "");

    if (!raw) return "";

    const text = String(raw);
    const match = text.match(/^(\d{4}-\d{2}-\d{2})/);

    if (match) return match[1];

    const parsed = new Date(text);

    if (Number.isNaN(parsed.getTime())) return "";

    return localDateString(parsed);
  }

  function formatDate(value) {
    if (!value) return "-";

    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!match) return String(value);

    return match[3] + "-" + match[2] + "-" + match[1];
  }

  function dateAllowed(record) {
    const date = dateOf(record);

    if (!date) return false;
    if (fromDate.value && date < fromDate.value) return false;
    if (toDate.value && date > toDate.value) return false;

    return true;
  }

  function setError(message) {
    if (!errorBox) return;

    errorBox.textContent = message;
    errorBox.classList.add("show");
  }

  function clearError() {
    if (!errorBox) return;

    errorBox.textContent = "";
    errorBox.classList.remove("show");
  }

  function setText(id, value) {
    const element = $(id);

    if (element) {
      element.textContent = value;
    }
  }

  function setMoney(id, value) {
    setText(id, money(value));
  }

  function setCount(id, count, label) {
    setText(id, count + " " + label);
  }

  function showEmpty(body, columns, message) {
    if (!body) return;

    body.innerHTML = `
      <tr>
        <td colspan="${columns}" class="report-empty">
          ${escapeHTML(message)}
        </td>
      </tr>
    `;
  }

  // =========================================================
  // TRANSACTION HELPERS
  // =========================================================

  function transactionTotal(record) {
    return firstNumber(record, [
      "grandTotal",
      "netTotal",
      "total",
      "amount",
      "subtotal"
    ], 0);
  }

  function transactionItems(record) {
    const items = firstValue(record, [
      "items",
      "cart",
      "products",
      "lines",
      "details"
    ], null);

    return Array.isArray(items) ? items : [];
  }

  function buildProductLookups(products) {
    const byId = new Map();
    const byName = new Map();
    const byBarcode = new Map();

    products.forEach(product => {
      const id = firstValue(product, [
        "id",
        "productId",
        "product_id"
      ], "");

      const name = String(firstValue(product, [
        "name",
        "productName"
      ], "")).trim().toLowerCase();

      const barcode = String(firstValue(product, [
        "barcode",
        "barCode",
        "productBarcode",
        "productCode"
      ], "")).trim();

      if (id !== "") byId.set(String(id), product);
      if (name) byName.set(name, product);
      if (barcode) byBarcode.set(barcode, product);
    });

    return { byId, byName, byBarcode };
  }

  function findProduct(item, lookups) {
    const id = firstValue(item, [
      "productId",
      "product_id",
      "id"
    ], "");

    const name = String(firstValue(item, [
      "productName",
      "name",
      "itemName",
      "title"
    ], "")).trim().toLowerCase();

    const barcode = String(firstValue(item, [
      "barcode",
      "barCode",
      "productBarcode",
      "productCode"
    ], "")).trim();

    return (
      (id !== "" && lookups.byId.get(String(id))) ||
      (name && lookups.byName.get(name)) ||
      (barcode && lookups.byBarcode.get(barcode)) ||
      null
    );
  }

  function itemBarcode(item, lookups) {
    const direct = firstValue(item, [
      "barcode",
      "barCode",
      "productBarcode",
      "productCode"
    ], "");

    if (direct !== "") return String(direct);

    const product = findProduct(item, lookups);

    return product
      ? String(firstValue(product, [
          "barcode",
          "barCode",
          "productBarcode",
          "productCode"
        ], ""))
      : "";
  }

  function expandTransactions(records, kind, products) {
    const result = [];
    const lookups = buildProductLookups(products);

    records.forEach(record => {
      if (!dateAllowed(record)) return;

      const date = dateOf(record);

      const billNumber = firstValue(record, [
        "billNumber",
        "invoiceNumber",
        "invoiceNo",
        "billNo",
        "reference",
        "id"
      ], "-");

      const customerName = firstValue(record, [
        "customerName",
        "customer",
        "partyName"
      ], "Walk-in");

      const supplierName = firstValue(record, [
        "supplierName",
        "supplier",
        "partyName"
      ], "-");

      const items = transactionItems(record);
      const lines = items.length ? items : [record];

      lines.forEach((item, index) => {
        const qty = firstNumber(item, [
          "qty",
          "quantity",
          "soldQty",
          "purchaseQty"
        ], 0);

        const rate = firstNumber(item, [
          "rate",
          "price",
          "salePrice",
          "purchasePrice",
          "unitPrice"
        ], 0);

        const lineTotal = firstNumber(item, [
          "lineTotal",
          "total",
          "amount",
          "subtotal"
        ], qty * rate);

        const product = findProduct(item, lookups);

        const productName = firstValue(item, [
          "productName",
          "name",
          "itemName",
          "title",
          "product"
        ], product
          ? firstValue(product, ["name", "productName"], "-")
          : "-"
        );

        const paid = firstNumber(record, [
          "paidAmount",
          "paid",
          "amountPaid",
          "payment"
        ], 0);

        const total = transactionTotal(record);

        const balance = firstNumber(record, [
          "balance",
          "due",
          "remainingBalance"
        ], Math.max(total - paid, 0));

        result.push({
          date,
          billNumber,
          customerName,
          supplierName,
          productName,
          barcode: itemBarcode(item, lookups),
          qty,
          rate,
          total: lineTotal,
          paidAmount: index === 0 ? paid : 0,
          balance: index === 0 ? balance : 0,
          source: record,
          item
        });
      });
    });

    return result.sort((a, b) => b.date.localeCompare(a.date));
  }

  // =========================================================
  // SALES REPORT
  // =========================================================

  function renderSalesReport(data) {
    const body = $("salesReportBody");
    const rows = expandTransactions(data.sales, "sale", data.products);

    setCount("salesReportCount", rows.length, "items");

    if (!body) return 0;

    if (!rows.length) {
      showEmpty(body, 9, "No sales found for the selected period.");
    } else {
      body.innerHTML = rows.map(sale => `
        <tr>
          <td>${escapeHTML(sale.date || "-")}</td>
          <td>${escapeHTML(sale.billNumber || "-")}</td>
          <td>${escapeHTML(sale.customerName || "Walk-in")}</td>
          <td>${escapeHTML(sale.productName || "-")}</td>
          <td>${escapeHTML(sale.barcode || "-")}</td>
          <td>${num(sale.qty).toLocaleString("en-IN")}</td>
          <td>${money(sale.total)}</td>
          <td>${money(sale.paidAmount)}</td>
          <td>${money(sale.balance)}</td>
        </tr>
      `).join("");
    }

    // प्रत्येक बिलको Grand Total एकपटक मात्र जोडिन्छ।
    return data.sales.filter(dateAllowed).reduce((sum, sale) => {
      return sum + transactionTotal(sale);
    }, 0);
  }

  // =========================================================
  // PURCHASE REPORT
  // =========================================================

  function renderPurchaseReport(data) {
    const body = $("purchaseReportBody");
    const rows = expandTransactions(
      data.purchases,
      "purchase",
      data.products
    );

    setCount("purchaseReportCount", rows.length, "items");

    if (!body) return 0;

    if (!rows.length) {
      showEmpty(body, 8, "No purchases found for the selected period.");
    } else {
      body.innerHTML = rows.map(purchase => `
        <tr>
          <td>${escapeHTML(purchase.date || "-")}</td>
          <td>${escapeHTML(purchase.billNumber || "-")}</td>
          <td>${escapeHTML(purchase.supplierName || "-")}</td>
          <td>${escapeHTML(purchase.productName || "-")}</td>
          <td>${num(purchase.qty).toLocaleString("en-IN")}</td>
          <td>${money(purchase.rate)}</td>
          <td>${money(purchase.total)}</td>
          <td>${money(purchase.paidAmount)}</td>
        </tr>
      `).join("");
    }

    return data.purchases.filter(dateAllowed).reduce((sum, purchase) => {
      return sum + transactionTotal(purchase);
    }, 0);
  }

  // =========================================================
  // STOCK REPORT
  // =========================================================

  function renderStockReport(products) {
    const body = $("stockReportBody");

    const sorted = products.slice().sort((a, b) =>
      String(firstValue(a, ["name", "productName"], ""))
        .localeCompare(
          String(firstValue(b, ["name", "productName"], ""))
        )
    );

    setCount("stockReportCount", sorted.length, "products");

    if (!body) return;

    if (!sorted.length) {
      showEmpty(body, 9, "No products found.");
      return;
    }

    body.innerHTML = sorted.map(product => {
      const stock = firstNumber(product, [
        "stock",
        "quantity",
        "currentStock"
      ], 0);

      const purchasePrice = firstNumber(product, [
        "purchasePrice",
        "costPrice",
        "cost",
        "purchaseRate"
      ], 0);

      const salePrice = firstNumber(product, [
        "salePrice",
        "sellingPrice",
        "price",
        "rate"
      ], 0);

      const minimum = firstNumber(product, [
        "minStock",
        "minimumStock",
        "reorderLevel"
      ], 0);

      const barcode = firstValue(product, [
        "barcode",
        "barCode",
        "productBarcode",
        "productCode"
      ], "-");

      let status = '<span class="report-status ok">In Stock</span>';

      if (stock <= 0) {
        status = '<span class="report-status out">Out of Stock</span>';
      } else if (minimum > 0 && stock <= minimum) {
        status = '<span class="report-status low">Low Stock</span>';
      }

      return `
        <tr>
          <td>${escapeHTML(firstValue(product, [
            "name",
            "productName"
          ], "-"))}</td>
          <td>${escapeHTML(barcode)}</td>
          <td>${escapeHTML(firstValue(product, [
            "category",
            "categoryName"
          ], "-"))}</td>
          <td>${escapeHTML(firstValue(product, [
            "unit",
            "unitName"
          ], "-"))}</td>
          <td>${stock.toLocaleString("en-IN")}</td>
          <td>${money(purchasePrice)}</td>
          <td>${money(salePrice)}</td>
          <td>${money(stock * purchasePrice)}</td>
          <td>${status}</td>
        </tr>
      `;
    }).join("");
  }

  // =========================================================
  // CUSTOMER REPORT
  // =========================================================

  function currentCustomerDue(customer) {
    const explicit = firstValue(customer, ["currentBalance"], null);

    if (explicit !== null) return num(explicit);

    return num(customer.openingBalance) +
      firstNumber(customer, [
        "creditSaleTotal",
        "creditSales",
        "totalCreditSales"
      ], 0) -
      firstNumber(customer, [
        "paymentTotal",
        "totalPayments",
        "receivedTotal"
      ], 0) -
      firstNumber(customer, [
        "returnTotal",
        "salesReturnTotal"
      ], 0);
  }

  function renderCustomerReport(customers) {
    const body = $("customerReportBody");

    const sorted = customers.slice().sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""))
    );

    setCount("customerReportCount", sorted.length, "customers");

    if (!body) return;

    if (!sorted.length) {
      showEmpty(body, 6, "No customers found.");
      return;
    }

    body.innerHTML = sorted.map(customer => {
      const opening = num(customer.openingBalance);

      const credit = firstNumber(customer, [
        "creditSaleTotal",
        "creditSales",
        "totalCreditSales"
      ], 0);

      const payments = firstNumber(customer, [
        "paymentTotal",
        "totalPayments",
        "receivedTotal"
      ], 0);

      const due = currentCustomerDue(customer);

      return `
        <tr>
          <td>${escapeHTML(customer.name || "-")}</td>
          <td>${escapeHTML(customer.phone || "-")}</td>
          <td>${money(Math.abs(opening))}</td>
          <td>${money(credit)}</td>
          <td>${money(payments)}</td>
          <td class="${due > 0 ? "report-orange" : "report-green"}">
            <strong>${money(Math.max(due, 0))}</strong>
            ${due < 0
              ? " (Advance " + escapeHTML(money(Math.abs(due))) + ")"
              : ""
            }
          </td>
        </tr>
      `;
    }).join("");
  }

  // =========================================================
  // SUPPLIER REPORT
  // =========================================================

  function currentSupplierBalance(supplier) {
    const explicit = firstValue(supplier, ["currentBalance"], null);

    if (explicit !== null) return num(explicit);

    const opening = num(supplier.openingBalance);

    const signedOpening =
      String(supplier.balanceType || "").toUpperCase() === "ADVANCE"
        ? -Math.abs(opening)
        : Math.abs(opening);

    return signedOpening +
      firstNumber(supplier, [
        "purchaseTotal",
        "totalPurchases"
      ], 0) -
      firstNumber(supplier, [
        "paymentTotal",
        "totalPayments"
      ], 0) -
      firstNumber(supplier, [
        "returnTotal",
        "purchaseReturnTotal"
      ], 0);
  }

  function renderSupplierReport(suppliers) {
    const body = $("supplierReportBody");

    const sorted = suppliers.slice().sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""))
    );

    setCount("supplierReportCount", sorted.length, "suppliers");

    if (!body) return;

    if (!sorted.length) {
      showEmpty(body, 6, "No suppliers found.");
      return;
    }

    body.innerHTML = sorted.map(supplier => {
      const opening = num(supplier.openingBalance);

      const purchases = firstNumber(supplier, [
        "purchaseTotal",
        "totalPurchases"
      ], 0);

      const payments = firstNumber(supplier, [
        "paymentTotal",
        "totalPayments"
      ], 0);

      const balance = currentSupplierBalance(supplier);

      return `
        <tr>
          <td>${escapeHTML(supplier.name || "-")}</td>
          <td>${escapeHTML(supplier.phone || "-")}</td>
          <td>${money(Math.abs(opening))}</td>
          <td>${money(purchases)}</td>
          <td>${money(payments)}</td>
          <td class="${balance > 0 ? "report-orange" : "report-green"}">
            <strong>${money(Math.max(balance, 0))}</strong>
            ${balance < 0
              ? " (Advance " + escapeHTML(money(Math.abs(balance))) + ")"
              : ""
            }
          </td>
        </tr>
      `;
    }).join("");
  }

  // =========================================================
  // PROFIT REPORT
  // =========================================================

  function isExpense(transaction) {
    const type = String(firstValue(transaction, [
      "type",
      "transactionType",
      "categoryType"
    ], "")).trim().toUpperCase();

    return ["EXPENSE", "EXPENSES", "OUTFLOW"].includes(type);
  }

  function calculateProfit(data, salesTotal, purchaseTotal) {
    const filteredSales = data.sales.filter(dateAllowed);
    const filteredFinance = data.finance.filter(dateAllowed);

    const expenses = filteredFinance.reduce((sum, transaction) => {
      return sum + (
        isExpense(transaction)
          ? firstNumber(transaction, [
              "amount",
              "total",
              "value"
            ], 0)
          : 0
      );
    }, 0);

    const lookups = buildProductLookups(data.products);

    let cost = 0;
    let costKnown = true;
    let costRows = 0;

    filteredSales.forEach(sale => {
      const items = transactionItems(sale);
      const lines = items.length ? items : [sale];

      lines.forEach(item => {
        const qty = firstNumber(item, [
          "qty",
          "quantity",
          "soldQty"
        ], 0);

        let unitCost = firstValue(item, [
          "unitCost",
          "costPrice",
          "purchasePrice",
          "costRate",
          "averageCost",
          "fifoCost"
        ], null);

        if (unitCost === null) {
          const product = findProduct(item, lookups);

          if (product) {
            unitCost = firstValue(product, [
              "purchasePrice",
              "costPrice",
              "purchaseRate"
            ], null);
          }
        }

        if (unitCost === null) {
          costKnown = false;
          return;
        }

        cost += qty * num(unitCost);
        costRows++;
      });
    });

    const costAvailable =
      filteredSales.length > 0 &&
      costKnown &&
      costRows > 0;

    return {
      salesTotal,
      expenseTotal: expenses,
      purchaseTotal,
      cost,
      grossProfit: costAvailable ? salesTotal - cost : null,
      netProfit: costAvailable
        ? salesTotal - cost - expenses
        : null,
      costAvailable
    };
  }

  function renderProfit(profit) {
    setMoney("profitSales", profit.salesTotal);
    setMoney("profitExpense", profit.expenseTotal);

    const warning = $("profitWarning");

    if (!profit.costAvailable) {
      setText("profitCost", "N/A");
      setText("profitGross", "N/A");
      setText("profitNet", "N/A");
      setText("reportGrossProfit", "N/A");

      if (warning) {
        warning.textContent =
          "नाफा निकाल्न बिक्रीका item मा unitCost/costPrice/purchasePrice " +
          "वा product मा purchasePrice चाहिन्छ। लागत उपलब्ध नभएकाले Gross Profit " +
          "र Net Profit देखाइएको छैन। हालको product लागत प्रयोग भए नतिजा अनुमानित " +
          "हुन सक्छ; यो ऐतिहासिक FIFO cost नहुन सक्छ।";
      }

      return;
    }

    if (warning) warning.textContent = "";

    setMoney("profitCost", profit.cost);
    setMoney("profitGross", profit.grossProfit);
    setMoney("profitNet", profit.netProfit);
    setMoney("reportGrossProfit", profit.grossProfit);

    [
      ["profitGross", profit.grossProfit],
      ["profitNet", profit.netProfit],
      ["reportGrossProfit", profit.grossProfit]
    ].forEach(([id, value]) => {
      const element = $(id);

      if (!element) return;

      element.classList.toggle("report-green", value >= 0);
      element.classList.toggle("report-red", value < 0);
    });
  }

  // =========================================================
  // MAIN REPORT RENDERER
  // =========================================================

  function renderReports() {
    clearError();

    if (
      fromDate &&
      toDate &&
      fromDate.value &&
      toDate.value &&
      fromDate.value > toDate.value
    ) {
      setError("From Date, To Date भन्दा पछाडिको मिति हुन मिल्दैन।");
      return;
    }

    const data = loadData();

    setText(
      "reportPeriodNote",
      "Transactions: " +
        ((fromDate && fromDate.value) || "Any date") +
        " to " +
        ((toDate && toDate.value) || "Any date") +
        ". Stock and current balances show the present position."
    );

    const salesTotal = renderSalesReport(data);
    const purchaseTotal = renderPurchaseReport(data);

    renderStockReport(data.products);
    renderCustomerReport(data.customers);
    renderSupplierReport(data.suppliers);

    const profit = calculateProfit(
      data,
      salesTotal,
      purchaseTotal
    );

    setMoney("reportSales", salesTotal);
    setMoney("reportPurchases", purchaseTotal);
    setMoney("reportExpenses", profit.expenseTotal);

    renderProfit(profit);
  }

  // =========================================================
  // REPORT TABS
  // =========================================================

  function selectReport(name) {
    document.querySelectorAll("[data-report-tab]").forEach(tab => {
      const active = tab.getAttribute("data-report-tab") === name;

      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });

    document.querySelectorAll(".report-panel[data-report]").forEach(panel => {
      panel.hidden = panel.getAttribute("data-report") !== name;
    });
  }

  function initializeDates() {
    if (!fromDate || !toDate) return;

    const today = localDateString(new Date());

    if (!fromDate.value && !toDate.value) {
      fromDate.value = today.slice(0, 8) + "01";
      toDate.value = today;
    }
  }

  // =========================================================
  // PDF / PRINT BRANDING
  // =========================================================

  function settingText(settings, keys, fallback) {
    return String(firstValue(settings, keys, fallback) || fallback || "");
  }

  function getShopDetails() {
    const settings = readSettings();

    return {
      name: settingText(settings, [
        "shopName",
        "storeName",
        "businessName",
        "companyName",
        "name"
      ], "कृष्ण किराना पसल"),

      address: settingText(settings, [
        "address",
        "shopAddress",
        "storeAddress",
        "businessAddress"
      ], ""),

      phone: settingText(settings, [
        "phone",
        "phoneNumber",
        "mobile",
        "mobileNumber",
        "contact",
        "contactNumber"
      ], ""),

      email: settingText(settings, [
        "email",
        "emailAddress",
        "shopEmail"
      ], ""),

      owner: settingText(settings, [
        "owner",
        "ownerName",
        "proprietor"
      ], "")
    };
  }

  function getReportTitle(panel) {
    const name = panel.getAttribute("data-report") || "sales";

    const titles = {
      sales: "SALES REPORT",
      purchases: "PURCHASE REPORT",
      stock: "STOCK REPORT",
      customers: "CUSTOMER REPORT",
      suppliers: "SUPPLIER REPORT",
      profit: "PROFIT REPORT",
      expenses: "EXPENSE REPORT",
      finance: "FINANCIAL REPORT"
    };

    if (titles[name]) return titles[name];

    const heading = panel.querySelector("h1, h2, h3, h4");

    return heading
      ? heading.textContent.trim()
      : "BUSINESS REPORT";
  }

  function getReportRange() {
    const start = fromDate && fromDate.value
      ? formatDate(fromDate.value)
      : "All dates";

    const end = toDate && toDate.value
      ? formatDate(toDate.value)
      : "All dates";

    return start + " — " + end;
  }

  function cleanClone(panel) {
    const clone = panel.cloneNode(true);

    clone.hidden = false;
    clone.removeAttribute("hidden");

    clone.querySelectorAll(
      "button, .no-print, [data-no-print], input, select, textarea"
    ).forEach(element => element.remove());

    clone.querySelectorAll("*").forEach(element => {
      element.removeAttribute("onclick");
      element.removeAttribute("onchange");
    });

    return clone;
  }

  function buildPrintDocument(panel) {
    const shop = getShopDetails();
    const title = getReportTitle(panel);
    const clone = cleanClone(panel);

    const reportDate = formatDate(localDateString(new Date()));

    const header = `
      <header class="invoice-header">
        <div class="shop-brand">
          <div class="shop-mark">GS</div>

          <div class="shop-details">
            <h1>${escapeHTML(shop.name)}</h1>

            ${shop.address
              ? `<p>${escapeHTML(shop.address)}</p>`
              : ""
            }

            ${shop.owner
              ? `<p>Owner: ${escapeHTML(shop.owner)}</p>`
              : ""
            }

            <div class="contact-row">
              ${shop.phone
                ? `<span>Phone: ${escapeHTML(shop.phone)}</span>`
                : ""
              }

              ${shop.email
                ? `<span>Email: ${escapeHTML(shop.email)}</span>`
                : ""
              }
            </div>
          </div>
        </div>

        <div class="header-rule"></div>

        <div class="document-heading">
          <h2>${escapeHTML(title)}</h2>
          <span class="original-label">OFFICIAL REPORT</span>
        </div>

        <div class="report-meta">
          <div>
            <span class="meta-label">Report Period</span>
            <strong>${escapeHTML(getReportRange())}</strong>
          </div>

          <div>
            <span class="meta-label">Printed Date</span>
            <strong>${escapeHTML(reportDate)}</strong>
          </div>
        </div>
      </header>
    `;

    const footer = `
      <footer class="invoice-footer">
        <div class="signature-row">
          <div class="signature-box">
            <div class="signature-line"></div>
            <p>Prepared By</p>
          </div>

          <div class="signature-box">
            <div class="signature-line"></div>
            <p>Checked By</p>
          </div>

          <div class="signature-box">
            <div class="signature-line"></div>
            <p>Authorized Signature</p>
          </div>
        </div>

        <div class="footer-rule"></div>

        <p class="thank-you">Thank you, visit again 🙏</p>

        <p class="computer-note">
          This is a computer-generated report.
        </p>

        <div class="footer-contact">
          ${shop.phone
            ? `<span>Phone: ${escapeHTML(shop.phone)}</span>`
            : ""
          }

          ${shop.email
            ? `<span>Email: ${escapeHTML(shop.email)}</span>`
            : ""
          }
        </div>
      </footer>
    `;

    const styles = `
      @page {
        size: A4 portrait;
        margin: 12mm;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #fff;
        color: #26352e;
        font-family: Arial, "Noto Sans Devanagari", sans-serif;
        font-size: 10px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      body {
        width: 100%;
      }

      .invoice-header {
        margin-bottom: 17px;
      }

      .shop-brand {
        display: flex;
        align-items: center;
        gap: 13px;
        padding: 0 0 12px;
      }

      .shop-mark {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 48px;
        width: 48px;
        height: 48px;
        border: 1px solid #d9e9df;
        border-radius: 8px;
        background: #f2f8f4;
        color: #17683d;
        font-size: 17px;
        font-weight: 800;
      }

      .shop-details {
        min-width: 0;
        flex: 1;
      }

      .shop-details h1 {
        margin: 0 0 4px;
        color: #17683d;
        font-size: 20px;
        font-weight: 800;
      }

      .shop-details p {
        margin: 2px 0;
        color: #58665e;
        font-size: 9px;
      }

      .contact-row {
        display: flex;
        flex-wrap: wrap;
        gap: 5px 20px;
        margin-top: 5px;
        color: #44564b;
        font-size: 9px;
      }

      .header-rule {
        height: 3px;
        margin: 0 0 13px;
        background: #17683d;
      }

      .document-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }

      .document-heading h2 {
        margin: 0;
        color: #25372c;
        font-size: 17px;
        font-weight: 800;
      }

      .original-label {
        color: #17683d;
        font-size: 9px;
        font-weight: 800;
      }

      .report-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 10px 12px;
        border: 1px solid #dce9e0;
        border-radius: 6px;
        background: #f3f7f4;
      }

      .report-meta > div {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .meta-label {
        color: #6b786f;
        font-size: 8px;
      }

      .report-meta strong {
        color: #26352e;
        font-size: 10px;
      }

      .report-panel {
        display: block !important;
        width: 100%;
        margin: 0;
        padding: 0;
        border: 0;
        box-shadow: none;
        overflow: visible !important;
      }

      .report-panel h1,
      .report-panel h2,
      .report-panel h3,
      .report-panel h4 {
        color: #26352e;
      }

      .report-panel table {
        width: 100% !important;
        max-width: 100%;
        margin: 0 0 12px;
        border-collapse: collapse;
        border-spacing: 0;
        font-size: 9px;
      }

      .report-panel thead {
        display: table-header-group;
      }

      .report-panel th {
        padding: 8px 6px;
        border: 1px solid #17683d;
        background: #17683d !important;
        color: #fff !important;
        text-align: left;
        font-weight: 700;
        vertical-align: middle;
      }

      .report-panel td {
        padding: 7px 6px;
        border: 1px solid #d8e1db;
        color: #2d3b32;
        vertical-align: middle;
        overflow-wrap: anywhere;
      }

      .report-panel tbody tr:nth-child(even) td {
        background: #f4f8f5;
      }

      .report-panel tr {
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .report-panel .report-status {
        display: inline-block;
        padding: 3px 5px;
        border-radius: 3px;
        font-size: 8px;
      }

      .report-panel .report-status.ok {
        background: #e1f2e7;
        color: #17683d;
      }

      .report-panel .report-status.low {
        background: #fff0ce;
        color: #8b6100;
      }

      .report-panel .report-status.out {
        background: #fbe4e4;
        color: #a32626;
      }

      .report-panel .report-green {
        color: #17683d;
      }

      .report-panel .report-red {
        color: #b42318;
      }

      .report-panel .report-orange {
        color: #a65b00;
      }

      .report-panel .report-empty {
        padding: 18px;
        text-align: center;
        color: #68756c;
      }

      .report-panel .report-warning,
      .report-panel #profitWarning {
        color: #6c5b2d;
      }

      .invoice-footer {
        margin-top: 24px;
        padding-top: 4px;
        page-break-inside: avoid;
        break-inside: avoid;
      }

      .signature-row {
        display: flex;
        justify-content: space-between;
        gap: 25px;
        margin: 16px 0 22px;
      }

      .signature-box {
        flex: 1;
        min-width: 0;
        text-align: center;
      }

      .signature-line {
        height: 28px;
        border-bottom: 1px solid #66746b;
      }

      .signature-box p {
        margin: 6px 0 0;
        color: #48574d;
        font-size: 9px;
      }

      .footer-rule {
        height: 1px;
        margin: 12px 0;
        background: #d4ddd7;
      }

      .thank-you {
        margin: 12px 0 5px;
        color: #17683d;
        font-size: 13px;
        font-weight: 800;
        text-align: center;
      }

      .computer-note {
        margin: 4px 0 8px;
        color: #778078;
        font-size: 8px;
        text-align: center;
      }

      .footer-contact {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px 24px;
        margin-top: 8px;
        color: #48574d;
        font-size: 9px;
      }

      @media screen {
        body {
          max-width: 210mm;
          margin: 0 auto;
          padding: 12mm;
        }
      }

      @media print {
        body {
          padding: 0;
        }

        .report-panel {
          overflow: visible !important;
        }

        a {
          color: inherit;
          text-decoration: none;
        }
      }
    `;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHTML(title)} - ${escapeHTML(shop.name)}</title>
  <style>${styles}</style>
</head>
<body>
  ${header}

  <main>
    ${clone.outerHTML}
  </main>

  ${footer}
</body>
</html>`;
  }

  function printReport(panel) {
    if (!panel) {
      setError("PDF बनाउन रिपोर्ट भेटिएन।");
      return;
    }

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      setError(
        "Print window खोल्न सकिएन। Browser को pop-up अनुमति दिएर फेरि प्रयास गर्नुहोस्।"
      );
      return;
    }

    try {
      const html = buildPrintDocument(panel);

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();

      printWindow.addEventListener("load", function () {
        printWindow.focus();

        setTimeout(function () {
          printWindow.print();
        }, 400);
      });

      clearError();
    } catch (error) {
      console.error("Report print error:", error);

      printWindow.close();

      setError("रिपोर्ट तयार गर्दा समस्या आयो। फेरि प्रयास गर्नुहोस्।");
    }
  }

  // =========================================================
  // ADD PDF BUTTONS WITHOUT CHANGING EXISTING HTML IDS
  // =========================================================

  function installReportPrintButtons() {
    const panels = document.querySelectorAll(
      ".report-panel[data-report]"
    );

    panels.forEach(panel => {
      if (panel.querySelector(".report-print-btn")) return;

      const button = document.createElement("button");

      button.type = "button";
      button.className = "report-print-btn no-print";
      button.textContent = "🖨️ Print / Save PDF";

      button.setAttribute("aria-label", "Print or save this report as PDF");

      button.style.cssText = [
        "display:inline-flex",
        "align-items:center",
        "justify-content:center",
        "gap:8px",
        "margin:0 0 16px",
        "padding:10px 16px",
        "border:0",
        "border-radius:7px",
        "background:#17683d",
        "color:#fff",
        "font-size:13px",
        "font-weight:700",
        "cursor:pointer",
        "box-shadow:0 2px 5px rgba(0,0,0,.12)"
      ].join(";");

      button.addEventListener("click", function () {
        renderReports();
        printReport(panel);
      });

      panel.insertBefore(button, panel.firstChild);
    });
  }

  // =========================================================
  // EVENTS
  // =========================================================

  document.querySelectorAll("[data-report-tab]").forEach(tab => {
    tab.addEventListener("click", function () {
      selectReport(tab.getAttribute("data-report-tab"));
    });
  });

  const applyButton = $("applyReportFilterBtn");
  const refreshButton = $("refreshReportsBtn");
  const clearButton = $("clearReportFilterBtn");

  if (applyButton) {
    applyButton.addEventListener("click", renderReports);
  }

  if (refreshButton) {
    refreshButton.addEventListener("click", renderReports);
  }

  if (clearButton) {
    clearButton.addEventListener("click", function () {
      if (fromDate) fromDate.value = "";
      if (toDate) toDate.value = "";

      renderReports();
    });
  }

  window.addEventListener("storage", function (event) {
    if (!event.key || Object.values(KEYS).includes(event.key)) {
      renderReports();
    }
  });

  // =========================================================
  // INITIALIZE
  // =========================================================

  initializeDates();
  selectReport("sales");
  renderReports();
  installReportPrintButtons();
});
