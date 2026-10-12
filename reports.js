
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
      ? value : {};
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
    if (typeof value === "string") value = value.replace(/,/g, "").trim();
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
  }

  function firstNumber(object, keys, fallback) {
    for (const key of keys) {
      if (object && object[key] !== undefined &&
          object[key] !== null && object[key] !== "") {
        return num(object[key]);
      }
    }
    return fallback === undefined ? 0 : fallback;
  }

  function firstValue(object, keys, fallback) {
    for (const key of keys) {
      if (object && object[key] !== undefined &&
          object[key] !== null && object[key] !== "") {
        return object[key];
      }
    }
    return fallback === undefined ? "" : fallback;
  }

  function currencySymbol() {
    const s = readSettings();
    const value = s.currencySymbol || s.currency || "Rs.";
    return typeof value === "string" || typeof value === "number"
      ? String(value) : "Rs.";
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
      "date", "saleDate", "purchaseDate",
      "transactionDate", "createdAt"
    ], "");

    if (!raw) return "";

    const text = String(raw);
    const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return "";
    return localDateString(parsed);
  }

  function dateAllowed(record) {
    const date = dateOf(record);
    if (!date) return false;
    if (fromDate.value && date < fromDate.value) return false;
    if (toDate.value && date > toDate.value) return false;
    return true;
  }

  function setError(message) {
    errorBox.textContent = message;
    errorBox.classList.add("show");
  }

  function clearError() {
    errorBox.textContent = "";
    errorBox.classList.remove("show");
  }

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
  }

  function setMoney(id, value) {
    setText(id, money(value));
  }

  function setCount(id, count, label) {
    setText(id, count + " " + label);
  }

  function showEmpty(body, columns, message) {
    body.innerHTML = `
      <tr>
        <td colspan="${columns}" class="report-empty">
          ${escapeHTML(message)}
        </td>
      </tr>
    `;
  }

  function transactionTotal(record) {
    return firstNumber(record, [
      "grandTotal", "netTotal", "total", "amount", "subtotal"
    ], 0);
  }

  function transactionItems(record) {
    const items = firstValue(record, [
      "items", "cart", "products", "lines", "details"
    ], null);
    return Array.isArray(items) ? items : [];
  }

  function buildProductLookups(products) {
    const byId = new Map();
    const byName = new Map();
    const byBarcode = new Map();

    products.forEach(product => {
      const id = firstValue(product, ["id", "productId", "product_id"], "");
      const name = String(firstValue(product, ["name", "productName"], ""))
        .trim().toLowerCase();
      const barcode = String(firstValue(product, [
        "barcode", "barCode", "productBarcode", "productCode"
      ], "")).trim();

      if (id !== "") byId.set(String(id), product);
      if (name) byName.set(name, product);
      if (barcode) byBarcode.set(barcode, product);
    });

    return { byId, byName, byBarcode };
  }

  function findProduct(item, lookups) {
    const id = firstValue(item, ["productId", "product_id", "id"], "");
    const name = String(firstValue(item, [
      "productName", "name", "itemName", "title"
    ], "")).trim().toLowerCase();
    const barcode = String(firstValue(item, [
      "barcode", "barCode", "productBarcode", "productCode"
    ], "")).trim();

    return (id !== "" && lookups.byId.get(String(id))) ||
      (name && lookups.byName.get(name)) ||
      (barcode && lookups.byBarcode.get(barcode)) ||
      null;
  }

  function itemBarcode(item, lookups) {
    const direct = firstValue(item, [
      "barcode", "barCode", "productBarcode", "productCode"
    ], "");

    if (direct !== "") return String(direct);

    const product = findProduct(item, lookups);
    return product ? String(firstValue(product, [
      "barcode", "barCode", "productBarcode", "productCode"
    ], "")) : "";
  }

  function expandTransactions(records, kind, products) {
    const result = [];
    const lookups = buildProductLookups(products);

    records.forEach(record => {
      if (!dateAllowed(record)) return;

      const date = dateOf(record);
      const billNumber = firstValue(record, [
        "billNumber", "invoiceNumber", "invoiceNo",
        "billNo", "reference", "id"
      ], "-");

      const customerName = firstValue(record, [
        "customerName", "customer", "partyName"
      ], "Walk-in");

      const supplierName = firstValue(record, [
        "supplierName", "supplier", "partyName"
      ], "-");

      const items = transactionItems(record);
      const lines = items.length ? items : [record];

      lines.forEach((item, index) => {
        const qty = firstNumber(item, [
          "qty", "quantity", "soldQty", "purchaseQty"
        ], 0);

        const rate = firstNumber(item, [
          "rate", "price", "salePrice", "purchasePrice", "unitPrice"
        ], 0);

        const lineTotal = firstNumber(item, [
          "lineTotal", "total", "amount", "subtotal"
        ], qty * rate);

        const product = findProduct(item, lookups);
        const productName = firstValue(item, [
          "productName", "name", "itemName", "title", "product"
        ], product ? firstValue(product, ["name", "productName"], "-") : "-");

        const paid = firstNumber(record, [
          "paidAmount", "paid", "amountPaid", "payment"
        ], 0);

        const total = transactionTotal(record);
        const balance = firstNumber(record, [
          "balance", "due", "remainingBalance"
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

  function renderSalesReport(data) {
    const body = $("salesReportBody");
    const rows = expandTransactions(data.sales, "sale", data.products);

    setCount("salesReportCount", rows.length, "items");

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

    // Summary मा प्रत्येक invoice को रकम एकपटक मात्र जोडिन्छ।
    return data.sales.filter(dateAllowed).reduce((sum, sale) => {
      return sum + transactionTotal(sale);
    }, 0);
  }

  function renderPurchaseReport(data) {
    const body = $("purchaseReportBody");
    const rows = expandTransactions(data.purchases, "purchase", data.products);

    setCount("purchaseReportCount", rows.length, "items");

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

  function renderStockReport(products) {
    const body = $("stockReportBody");
    const sorted = products.slice().sort((a, b) =>
      String(firstValue(a, ["name", "productName"], ""))
        .localeCompare(String(firstValue(b, ["name", "productName"], "")))
    );

    setCount("stockReportCount", sorted.length, "products");

    if (!sorted.length) {
      showEmpty(body, 9, "No products found.");
      return;
    }

    body.innerHTML = sorted.map(product => {
      const stock = firstNumber(product, [
        "stock", "quantity", "currentStock"
      ], 0);

      const purchasePrice = firstNumber(product, [
        "purchasePrice", "costPrice", "cost", "purchaseRate"
      ], 0);

      const salePrice = firstNumber(product, [
        "salePrice", "sellingPrice", "price", "rate"
      ], 0);

      const minimum = firstNumber(product, [
        "minStock", "minimumStock", "reorderLevel"
      ], 0);

      const barcode = firstValue(product, [
        "barcode", "barCode", "productBarcode", "productCode"
      ], "-");

      let status = '<span class="report-status ok">In Stock</span>';

      if (stock <= 0) {
        status = '<span class="report-status out">Out of Stock</span>';
      } else if (minimum > 0 && stock <= minimum) {
        status = '<span class="report-status low">Low Stock</span>';
      }

      return `
        <tr>
          <td>${escapeHTML(firstValue(product, ["name", "productName"], "-"))}</td>
          <td>${escapeHTML(barcode)}</td>
          <td>${escapeHTML(firstValue(product, ["category", "categoryName"], "-"))}</td>
          <td>${escapeHTML(firstValue(product, ["unit", "unitName"], "-"))}</td>
          <td>${stock.toLocaleString("en-IN")}</td>
          <td>${money(purchasePrice)}</td>
          <td>${money(salePrice)}</td>
          <td>${money(stock * purchasePrice)}</td>
          <td>${status}</td>
        </tr>
      `;
    }).join("");
  }

  function currentCustomerDue(customer) {
    const explicit = firstValue(customer, ["currentBalance"], null);
    if (explicit !== null) return num(explicit);

    return num(customer.openingBalance) +
      firstNumber(customer, ["creditSaleTotal", "creditSales", "totalCreditSales"], 0) -
      firstNumber(customer, ["paymentTotal", "totalPayments", "receivedTotal"], 0) -
      firstNumber(customer, ["returnTotal", "salesReturnTotal"], 0);
  }

  function renderCustomerReport(customers) {
    const body = $("customerReportBody");
    const sorted = customers.slice().sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""))
    );

    setCount("customerReportCount", sorted.length, "customers");

    if (!sorted.length) {
      showEmpty(body, 6, "No customers found.");
      return;
    }

    body.innerHTML = sorted.map(customer => {
      const opening = num(customer.openingBalance);
      const credit = firstNumber(customer, [
        "creditSaleTotal", "creditSales", "totalCreditSales"
      ], 0);
      const payments = firstNumber(customer, [
        "paymentTotal", "totalPayments", "receivedTotal"
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
            ${due < 0 ? " (Advance " + escapeHTML(money(Math.abs(due))) + ")" : ""}
          </td>
        </tr>
      `;
    }).join("");
  }

  function currentSupplierBalance(supplier) {
    const explicit = firstValue(supplier, ["currentBalance"], null);
    if (explicit !== null) return num(explicit);

    const opening = num(supplier.openingBalance);
    const signedOpening = String(supplier.balanceType || "").toUpperCase() === "ADVANCE"
      ? -Math.abs(opening) : Math.abs(opening);

    return signedOpening +
      firstNumber(supplier, ["purchaseTotal", "totalPurchases"], 0) -
      firstNumber(supplier, ["paymentTotal", "totalPayments"], 0) -
      firstNumber(supplier, ["returnTotal", "purchaseReturnTotal"], 0);
  }

  function renderSupplierReport(suppliers) {
    const body = $("supplierReportBody");
    const sorted = suppliers.slice().sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""))
    );

    setCount("supplierReportCount", sorted.length, "suppliers");

    if (!sorted.length) {
      showEmpty(body, 6, "No suppliers found.");
      return;
    }

    body.innerHTML = sorted.map(supplier => {
      const opening = num(supplier.openingBalance);
      const purchases = firstNumber(supplier, [
        "purchaseTotal", "totalPurchases"
      ], 0);
      const payments = firstNumber(supplier, [
        "paymentTotal", "totalPayments"
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
            ${balance < 0 ? " (Advance " + escapeHTML(money(Math.abs(balance))) + ")" : ""}
          </td>
        </tr>
      `;
    }).join("");
  }

  function isExpense(transaction) {
    const type = String(firstValue(transaction, [
      "type", "transactionType", "categoryType"
    ], "")).trim().toUpperCase();

    return ["EXPENSE", "EXPENSES", "OUTFLOW"].includes(type);
  }

  function calculateProfit(data, salesTotal, purchaseTotal) {
    const filteredSales = data.sales.filter(dateAllowed);
    const filteredFinance = data.finance.filter(dateAllowed);

    const expenses = filteredFinance.reduce((sum, transaction) => {
      return sum + (isExpense(transaction)
        ? firstNumber(transaction, ["amount", "total", "value"], 0)
        : 0);
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
          "qty", "quantity", "soldQty"
        ], 0);

        let unitCost = firstValue(item, [
          "unitCost", "costPrice", "purchasePrice", "costRate",
          "averageCost", "fifoCost"
        ], null);

        if (unitCost === null) {
          const product = findProduct(item, lookups);
          if (product) {
            unitCost = firstValue(product, [
              "purchasePrice", "costPrice", "purchaseRate"
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

    const costAvailable = filteredSales.length > 0 && costKnown && costRows > 0;

    return {
      salesTotal,
      expenseTotal: expenses,
      purchaseTotal,
      cost,
      grossProfit: costAvailable ? salesTotal - cost : null,
      netProfit: costAvailable ? salesTotal - cost - expenses : null,
      costAvailable
    };
  }

  function renderProfit(profit) {
    setMoney("profitSales", profit.salesTotal);
    setMoney("profitExpense", profit.expenseTotal);

    const warning = $("profitWarning");
    const grossSummary = $("reportGrossProfit");

    if (!profit.costAvailable) {
      setText("profitCost", "N/A");
      setText("profitGross", "N/A");
      setText("profitNet", "N/A");
      setText("reportGrossProfit", "N/A");

      warning.textContent =
        "नाफा निकाल्न बिक्रीका item मा unitCost/costPrice/purchasePrice " +
        "वा product मा purchasePrice चाहिन्छ। लागत उपलब्ध नभएकाले Gross Profit " +
        "र Net Profit देखाइएको छैन। हालको product लागत प्रयोग भए नतिजा अनुमानित " +
        "हुन सक्छ; यो ऐतिहासिक FIFO cost नहुन सक्छ।";
      return;
    }

    warning.textContent = "";
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

  function renderReports() {
    clearError();

    if (fromDate.value && toDate.value && fromDate.value > toDate.value) {
      setError("From Date, To Date भन्दा पछाडिको मिति हुन मिल्दैन।");
      return;
    }

    const data = loadData();

    setText("reportPeriodNote",
      "Transactions: " + (fromDate.value || "Any date") +
      " to " + (toDate.value || "Any date") +
      ". Stock and current balances show the present position."
    );

    const salesTotal = renderSalesReport(data);
    const purchaseTotal = renderPurchaseReport(data);

    renderStockReport(data.products);
    renderCustomerReport(data.customers);
    renderSupplierReport(data.suppliers);

    const profit = calculateProfit(data, salesTotal, purchaseTotal);

    setMoney("reportSales", salesTotal);
    setMoney("reportPurchases", purchaseTotal);
    setMoney("reportExpenses", profit.expenseTotal);

    renderProfit(profit);
  }

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
    const today = localDateString(new Date());
    if (!fromDate.value && !toDate.value) {
      fromDate.value = today.slice(0, 8) + "01";
      toDate.value = today;
    }
  }

  document.querySelectorAll("[data-report-tab]").forEach(tab => {
    tab.addEventListener("click", () => {
      selectReport(tab.getAttribute("data-report-tab"));
    });
  });

  $("applyReportFilterBtn").addEventListener("click", renderReports);
  $("refreshReportsBtn").addEventListener("click", renderReports);

  $("clearReportFilterBtn").addEventListener("click", () => {
    fromDate.value = "";
    toDate.value = "";
    renderReports();
  });

  window.addEventListener("storage", event => {
    if (!event.key || Object.values(KEYS).includes(event.key)) {
      renderReports();
    }
  });

  initializeDates();
  selectReport("sales");
  renderReports();
});
