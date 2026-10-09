
"use strict";

document.addEventListener("DOMContentLoaded", function () {
  const KEYS = {
    sales: "gs_sales",
    purchases: "gs_purchases",
    products: "gs_products",
    customers: "gs_customers",
    suppliers: "gs_suppliers",
    finance: "gs_finance"
  };

  const $ = (id) => document.getElementById(id);

  const fromDate = $("reportFromDate");
  const toDate = $("reportToDate");
  const applyButton = $("applyReportFilterBtn");
  const refreshButton = $("refreshReportsBtn");
  const errorBox = $("reportError");

  const today = localDateString(new Date());
  fromDate.value = today.slice(0, 8) + "01";
  toDate.value = today;

  function localDateString(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function readArray(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Could not read " + key, error);
      return [];
    }
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

  function firstNumber(object, keys, fallback = 0) {
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

    return fallback;
  }

  function firstValue(object, keys, fallback = "") {
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

    return fallback;
  }

  function money(value) {
    return "Rs. " + num(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);
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

    // ISO date/time र YYYY-MM-DD format।
    const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return "";

    return localDateString(parsed);
  }

  function dateAllowed(record) {
    const date = dateOf(record);
    const from = fromDate.value;
    const to = toDate.value;

    // Date नभएका पुराना records लाई स्वतः छानेको अवधिमा समावेश नगर्ने।
    if (!date) return false;
    if (from && date < from) return false;
    if (to && date > to) return false;

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

  function descendingByDate(a, b) {
    return dateOf(b).localeCompare(dateOf(a));
  }

  // Product र bill दुवै format लाई report row मा बदल्ने।
  function expandTransactions(records, kind) {
    const result = [];

    records.forEach((record) => {
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

      const items = firstValue(record, [
        "items", "cart", "products", "lines", "details"
      ], null);

      if (Array.isArray(items) && items.length > 0) {
        items.forEach((item, index) => {
          const qty = firstNumber(item, [
            "qty", "quantity", "soldQty", "purchaseQty"
          ]);

          const rate = firstNumber(item, [
            "rate", "price", "salePrice", "purchasePrice", "unitPrice"
          ]);

          const total = firstNumber(item, [
            "total", "lineTotal", "amount", "subtotal"
          ], qty * rate);

          result.push({
            date,
            billNumber: items.length > 1
              ? String(billNumber) + (index ? "" : "")
              : String(billNumber),
            customerName,
            supplierName,
            productName: firstValue(item, [
              "productName", "name", "itemName", "title"
            ], "-"),
            qty,
            rate,
            total,
            paidAmount: 0,
            balance: 0,
            source: record,
            item
          });
        });

        // भुक्तानी/balance लाई पहिलो row मा मात्र राख्ने।
        const group = result.slice(-items.length);
        if (group.length) {
          group[0].paidAmount = firstNumber(record, [
            "paidAmount", "paid", "amountPaid", "payment"
          ]);

          group[0].balance = firstNumber(record, [
            "balance", "due", "remainingBalance"
          ], Math.max(
            firstNumber(record, ["total", "grandTotal", "netTotal"]) -
            group[0].paidAmount,
            0
          ));
        }

        return;
      }

      const qty = firstNumber(record, [
        "qty", "quantity", "soldQty", "purchaseQty"
      ]);

      const rate = firstNumber(record, [
        "rate", "price", "salePrice", "purchasePrice", "unitPrice"
      ]);

      const total = firstNumber(record, [
        "total", "grandTotal", "netTotal", "amount", "subtotal"
      ], qty * rate);

      result.push({
        date,
        billNumber,
        customerName,
        supplierName,
        productName: firstValue(record, [
          "productName", "name", "itemName", "product"
        ], "-"),
        qty,
        rate,
        total,
        paidAmount: firstNumber(record, [
          "paidAmount", "paid", "amountPaid", "payment"
        ]),
        balance: firstNumber(record, [
          "balance", "due", "remainingBalance"
        ], Math.max(
          total - firstNumber(record, ["paidAmount", "paid", "amountPaid"]),
          0
        )),
        source: record,
        item: record
      });
    });

    return result.filter((row) => {
      return row.date && dateAllowed({ date: row.date });
    });
  }

  function renderSalesReport(sales) {
    const body = $("salesReportBody");
    const rows = expandTransactions(sales, "sale").sort(descendingByDate);

    setCount("salesReportCount", rows.length, "items");

    if (!rows.length) {
      showEmpty(body, 8, "No sales found for the selected period.");
      return 0;
    }

    body.innerHTML = rows.map((sale) => `
      <tr>
        <td>${escapeHTML(sale.date || "-")}</td>
        <td>${escapeHTML(sale.billNumber)}</td>
        <td>${escapeHTML(sale.customerName)}</td>
        <td>${escapeHTML(sale.productName)}</td>
        <td>${sale.qty.toLocaleString("en-IN")}</td>
        <td>${money(sale.total)}</td>
        <td>${money(sale.paidAmount)}</td>
        <td>${money(sale.balance)}</td>
      </tr>
    `).join("");

    // Bill मा multiple item भए bill total दोहोरिन नदिन source record बाट total निकाल्ने।
    return sales.filter(dateAllowed).reduce((sum, sale) => {
      return sum + firstNumber(sale, [
        "total", "grandTotal", "netTotal", "amount"
      ], 0);
    }, 0);
  }

  function renderPurchaseReport(purchases) {
    const body = $("purchaseReportBody");
    const rows = expandTransactions(purchases, "purchase").sort(descendingByDate);

    setCount("purchaseReportCount", rows.length, "items");

    if (!rows.length) {
      showEmpty(body, 8, "No purchases found for the selected period.");
      return 0;
    }

    body.innerHTML = rows.map((purchase) => `
      <tr>
        <td>${escapeHTML(purchase.date || "-")}</td>
        <td>${escapeHTML(purchase.billNumber)}</td>
        <td>${escapeHTML(purchase.supplierName)}</td>
        <td>${escapeHTML(purchase.productName)}</td>
        <td>${purchase.qty.toLocaleString("en-IN")}</td>
        <td>${money(purchase.rate)}</td>
        <td>${money(purchase.total)}</td>
        <td>${money(purchase.paidAmount)}</td>
      </tr>
    `).join("");

    return purchases.filter(dateAllowed).reduce((sum, purchase) => {
      return sum + firstNumber(purchase, [
        "total", "grandTotal", "netTotal", "amount"
      ], 0);
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
      showEmpty(body, 8, "No products found.");
      return;
    }

    body.innerHTML = sorted.map((product) => {
      const stock = firstNumber(product, ["stock", "quantity", "currentStock"]);
      const purchasePrice = firstNumber(product, [
        "purchasePrice", "costPrice", "cost", "purchaseRate"
      ]);
      const salePrice = firstNumber(product, [
        "salePrice", "sellingPrice", "price", "rate"
      ]);
      const minStock = firstNumber(product, ["minStock", "minimumStock", "reorderLevel"]);

      let status = '<span class="report-status ok">In Stock</span>';

      if (stock <= 0) {
        status = '<span class="report-status out">Out of Stock</span>';
      } else if (stock <= minStock) {
        status = '<span class="report-status low">Low Stock</span>';
      }

      return `
        <tr>
          <td>${escapeHTML(firstValue(product, ["name", "productName"], "-"))}</td>
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
    const explicit = customer.currentBalance;

    if (explicit !== undefined && explicit !== null && explicit !== "") {
      return num(explicit);
    }

    const opening = num(customer.openingBalance);
    const credit = firstNumber(customer, [
      "creditSaleTotal", "creditSales", "totalCreditSales"
    ]);
    const payment = firstNumber(customer, [
      "paymentTotal", "totalPayments", "receivedTotal"
    ]);
    const returns = firstNumber(customer, [
      "returnTotal", "salesReturnTotal"
    ]);

    return opening + credit - payment - returns;
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

    body.innerHTML = sorted.map((customer) => {
      const opening = num(customer.openingBalance);
      const credit = firstNumber(customer, [
        "creditSaleTotal", "creditSales", "totalCreditSales"
      ]);
      const payment = firstNumber(customer, [
        "paymentTotal", "totalPayments", "receivedTotal"
      ]);
      const due = currentCustomerDue(customer);

      return `
        <tr>
          <td>${escapeHTML(customer.name || "-")}</td>
          <td>${escapeHTML(customer.phone || "-")}</td>
          <td>${money(Math.abs(opening))}</td>
          <td>${money(credit)}</td>
          <td>${money(payment)}</td>
          <td class="${due > 0 ? "report-orange" : "report-green"}">
            <strong>${money(Math.max(due, 0))}</strong>
            ${due < 0 ? " (Advance " + escapeHTML(money(Math.abs(due))) + ")" : ""}
          </td>
        </tr>
      `;
    }).join("");
  }

  function currentSupplierBalance(supplier) {
    if (
      supplier.currentBalance !== undefined &&
      supplier.currentBalance !== null &&
      supplier.currentBalance !== ""
    ) {
      return num(supplier.currentBalance);
    }

    const opening = num(supplier.openingBalance);
    const signedOpening = supplier.balanceType === "ADVANCE"
      ? -Math.abs(opening)
      : Math.abs(opening);

    return signedOpening +
      firstNumber(supplier, ["purchaseTotal", "totalPurchases"]) -
      firstNumber(supplier, ["paymentTotal", "totalPayments"]) -
      firstNumber(supplier, ["returnTotal", "purchaseReturnTotal"]);
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

    body.innerHTML = sorted.map((supplier) => {
      const opening = num(supplier.openingBalance);
      const purchase = firstNumber(supplier, ["purchaseTotal", "totalPurchases"]);
      const payment = firstNumber(supplier, ["paymentTotal", "totalPayments"]);
      const balance = currentSupplierBalance(supplier);

      return `
        <tr>
          <td>${escapeHTML(supplier.name || "-")}</td>
          <td>${escapeHTML(supplier.phone || "-")}</td>
          <td>${money(Math.abs(opening))}</td>
          <td>${money(purchase)}</td>
          <td>${money(payment)}</td>
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

    return type === "EXPENSE" ||
      type === "EXPENSES" ||
      type === "OUTFLOW";
  }

  function calculateProfit(data, saleTotal) {
    const filteredSales = data.sales.filter(dateAllowed);
    const filteredFinance = data.finance.filter(dateAllowed);

    const expenses = filteredFinance.reduce((sum, transaction) => {
      return isExpense(transaction)
        ? sum + firstNumber(transaction, ["amount", "total", "value"])
        : sum;
    }, 0);

    // Map products by ID and name for legacy sales with a product reference.
    const productMap = new Map();

    data.products.forEach((product) => {
      const id = firstValue(product, ["id", "productId"], "");
      const name = String(firstValue(product, ["name", "productName"], ""))
        .trim().toLowerCase();

      if (id !== "") productMap.set("id:" + id, product);
      if (name) productMap.set("name:" + name, product);
    });

    let cost = 0;
    let costKnown = true;
    let costRows = 0;

    filteredSales.forEach((sale) => {
      const items = firstValue(sale, [
        "items", "cart", "products", "lines", "details"
      ], null);

      const lines = Array.isArray(items) && items.length
        ? items
        : [sale];

      lines.forEach((item) => {
        const qty = firstNumber(item, [
          "qty", "quantity", "soldQty"
        ]);

        const explicitCost = firstValue(item, [
          "unitCost", "costPrice", "purchasePrice", "costRate",
          "averageCost", "fifoCost"
        ], null);

        let unitCost = explicitCost === null
          ? null
          : num(explicitCost);

        if (unitCost === null) {
          const productId = firstValue(item, ["productId", "product_id"], "");
          const productName = String(firstValue(item, [
            "productName", "name", "itemName"
          ], "")).trim().toLowerCase();

          const product = (productId !== "" && productMap.get("id:" + productId)) ||
            (productName && productMap.get("name:" + productName));

          if (product) {
            const fallbackCost = firstValue(product, [
              "purchasePrice", "costPrice", "purchaseRate"
            ], null);

            if (fallbackCost !== null) {
              unitCost = num(fallbackCost);
            }
          }
        }

        if (unitCost === null) {
          costKnown = false;
          return;
        }

        cost += qty * unitCost;
        costRows++;
      });
    });

    // कुनै पनि sales line को लागत नचिनिएमा अपूर्ण cost लाई पूरा भनेर देखाउँदैन।
    const hasSales = filteredSales.length > 0;
    const costAvailable = hasSales && costKnown && costRows > 0;

    return {
      salesTotal: saleTotal,
      expenseTotal: expenses,
      purchaseTotal: data.purchases.filter(dateAllowed).reduce((sum, purchase) =>
        sum + firstNumber(purchase, ["total", "grandTotal", "netTotal", "amount"]), 0
      ),
      purchaseCost: cost,
      grossProfit: costAvailable ? saleTotal - cost : null,
      netProfit: costAvailable ? saleTotal - cost - expenses : null,
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

      warning.style.display = "block";
      warning.textContent =
        "नाफा सही निकाल्न बिक्रीका item मा unitCost/costPrice/purchasePrice " +
        "वा product मा purchasePrice चाहिन्छ। लागत उपलब्ध नभएकाले Gross Profit " +
        "र Net Profit अहिले देखाइएको छैन। Product को अहिलेको लागत प्रयोग भएको " +
        "अवस्थामा नतिजा अनुमानित हुन सक्छ, ऐतिहासिक FIFO cost होइन।";
      return;
    }

    warning.style.display = "none";

    setMoney("profitCost", profit.purchaseCost);
    setMoney("profitGross", profit.grossProfit);
    setMoney("profitNet", profit.netProfit);
    setMoney("reportGrossProfit", profit.grossProfit);

    const grossElement = $("profitGross");
    const netElement = $("profitNet");

    grossElement.classList.toggle("report-green", profit.grossProfit >= 0);
    grossElement.classList.toggle("report-red", profit.grossProfit < 0);
    netElement.classList.toggle("report-green", profit.netProfit >= 0);
    netElement.classList.toggle("report-red", profit.netProfit < 0);
    grossSummary.classList.toggle("report-green", profit.grossProfit >= 0);
    grossSummary.classList.toggle("report-red", profit.grossProfit < 0);
  }

  function renderReports() {
    clearError();

    if (fromDate.value && toDate.value && fromDate.value > toDate.value) {
      setError("From Date, To Date भन्दा पछाडिको मिति हुन मिल्दैन।");
      return;
    }

    const data = loadData();

    $("reportPeriodNote").textContent =
      "Transactions: " + (fromDate.value || "Any date") +
      " to " + (toDate.value || "Any date") +
      ". Stock and current balances show the present position.";

    const salesTotal = renderSalesReport(data.sales);
    renderPurchaseReport(data.purchases);
    renderStockReport(data.products);
    renderCustomerReport(data.customers);
    renderSupplierReport(data.suppliers);

    const profit = calculateProfit(data, salesTotal);

    setMoney("reportSales", salesTotal);
    setMoney("reportPurchases", profit.purchaseTotal);
    setMoney("reportExpenses", profit.expenseTotal);

    renderProfit(profit);
  }

  // Tab switching
  document.querySelectorAll(".report-tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".report-tab").forEach((tab) => {
        tab.classList.remove("active");
        tab.setAttribute("aria-selected", "false");
      });

      document.querySelectorAll(".report-panel").forEach((panel) => {
        panel.classList.remove("active");
      });

      button.classList.add("active");
      button.setAttribute("aria-selected", "true");

      const panel = $("report-" + button.dataset.report);
      if (panel) panel.classList.add("active");
    });
  });

  applyButton.addEventListener("click", renderReports);
  refreshButton.addEventListener("click", renderReports);

  // अन्य tab वा browser मा data परिवर्तन भएको भए refresh गर्दा पुनः पढिन्छ।
  window.addEventListener("storage", (event) => {
    if (!event.key || Object.values(KEYS).includes(event.key)) {
      renderReports();
    }
  });

  renderReports();
});
