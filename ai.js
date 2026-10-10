
"use strict";

/* =========================================
   GENERAL STORE AI ASSISTANT
   Local data analysis - no external AI API
   ========================================= */

const PRODUCT_KEY = "gs_products";
const CUSTOMER_KEY = "gs_customers";
const SUPPLIER_KEY = "gs_suppliers";
const SALE_KEY = "gs_sales";
const PURCHASE_KEY = "gs_purchases";
const FINANCE_KEY = "gs_finance";
const SETTINGS_KEY = "gs_settings";

const $ = id => document.getElementById(id);

/* =========================================
   DATA HELPERS
   ========================================= */

function getData(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("डेटा पढ्न सकिएन:", key, error);
    return [];
  }
}

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
}

function getProducts() {
  return getData(PRODUCT_KEY);
}

function getCustomers() {
  return getData(CUSTOMER_KEY);
}

function getSuppliers() {
  return getData(SUPPLIER_KEY);
}

function getSales() {
  return getData(SALE_KEY);
}

function getPurchases() {
  return getData(PURCHASE_KEY);
}

function getFinance() {
  return getData(FINANCE_KEY);
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function money(value) {
  const settings = getSettings();
  const currency = settings.currency || "NPR";

  const symbols = {
    NPR: "रु.",
    INR: "₹",
    USD: "$"
  };

  return `${symbols[currency] || currency} ${toNumber(value).toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  )}`;
}

function getProductName(product) {
  return String(
    product?.name ||
    product?.productName ||
    product?.itemName ||
    "नाम नभएको सामान"
  );
}

function getCustomerName(customer) {
  return String(customer?.name || customer?.customerName || "नाम नभएको ग्राहक");
}

function getSupplierName(supplier) {
  return String(supplier?.name || supplier?.supplierName || "नाम नभएको सप्लायर");
}

/* =========================================
   SALES AND PURCHASE TOTALS
   ========================================= */

function totalSales() {
  return getSales().reduce(
    (sum, sale) => sum + toNumber(sale.total),
    0
  );
}

function totalPurchases() {
  return getPurchases().reduce(
    (sum, purchase) => sum + toNumber(purchase.total),
    0
  );
}

function totalCustomerDue() {
  return getCustomers().reduce((sum, customer) => {
    const balance = toNumber(customer.currentBalance);
    return sum + (balance > 0 ? balance : 0);
  }, 0);
}

function totalSupplierPayable() {
  return getSuppliers().reduce((sum, supplier) => {
    const balance = toNumber(supplier.currentBalance);
    return sum + (balance > 0 ? balance : 0);
  }, 0);
}

/* =========================================
   STOCK ANALYSIS
   ========================================= */

function getStock(product) {
  return toNumber(product.stock ?? product.quantity ?? product.currentStock);
}

function getMinimumStock(product) {
  return toNumber(product.minStock ?? product.minimumStock ?? 0);
}

function getLowStockProducts() {
  return getProducts().filter(product => {
    return getStock(product) > 0 &&
      getStock(product) <= getMinimumStock(product);
  });
}

function getOutOfStockProducts() {
  return getProducts().filter(product => getStock(product) <= 0);
}

/* =========================================
   PRODUCT SALES ANALYSIS
   Supports single-product and items-array sales
   ========================================= */

function getSalesByProduct() {
  const totals = {};

  getSales().forEach(sale => {
    if (Array.isArray(sale.items) && sale.items.length > 0) {
      sale.items.forEach(item => {
        const name = getProductName(item);
        const qty = toNumber(item.qty ?? item.quantity);
        totals[name] = (totals[name] || 0) + qty;
      });

      return;
    }

    const name = getProductName(sale);
    const qty = toNumber(sale.qty ?? sale.quantity);

    if (qty > 0) {
      totals[name] = (totals[name] || 0) + qty;
    }
  });

  return totals;
}

function getFastMovingProducts() {
  return Object.entries(getSalesByProduct())
    .filter(([, qty]) => qty > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
}

function getSlowMovingProducts() {
  return Object.entries(getSalesByProduct())
    .filter(([, qty]) => qty > 0)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 5);
}

/* =========================================
   BUSINESS ANSWERS
   ========================================= */

function businessSummary() {
  const products = getProducts();
  const customers = getCustomers();
  const suppliers = getSuppliers();
  const sales = getSales();
  const purchases = getPurchases();

  return `📊 BUSINESS SUMMARY

📦 Products: ${products.length}
👥 Customers: ${customers.length}
🚚 Suppliers: ${suppliers.length}

🧾 Sales Transactions: ${sales.length}
💰 Recorded Sales Total: ${money(totalSales())}

📥 Purchase Transactions: ${purchases.length}
💸 Recorded Purchase Total: ${money(totalPurchases())}

👥 Customer Due: ${money(totalCustomerDue())}
🚚 Supplier Payable: ${money(totalSupplierPayable())}

नोट: यो सबै सुरक्षित बिक्री/खरिद रेकर्डको सारांश हो, आजको कारोबार मात्र होइन।
नाफा गणना गर्न लागत, बिक्री र अन्य खर्चको सही लेखा आवश्यक हुन्छ।`;
}

function lowStockAnswer() {
  const products = getLowStockProducts();
  const outOfStock = getOutOfStockProducts();

  if (products.length === 0 && outOfStock.length === 0) {
    return "✅ अहिले न्यूनतम स्टक सीमामा वा त्यसभन्दा तल पुगेको सामान छैन।";
  }

  const lines = ["⚠️ LOW STOCK PRODUCTS", ""];

  if (products.length === 0) {
    lines.push("कम स्टक भएका सामान छैनन्।");
  } else {
    products.forEach((product, index) => {
      const unit = product.unit || "unit";

      lines.push(
        `${index + 1}. ${getProductName(product)}`,
        `   बाँकी स्टक: ${getStock(product)} ${unit}`,
        `   न्यूनतम स्टक: ${getMinimumStock(product)} ${unit}`,
        ""
      );
    });
  }

  if (outOfStock.length > 0) {
    lines.push(`🚨 स्टक सकिएका सामान: ${outOfStock.length}`);
  }

  return lines.join("\n");
}

function outOfStockAnswer() {
  const products = getOutOfStockProducts();

  if (products.length === 0) {
    return "✅ अहिले कुनै सामान Out of Stock छैन।";
  }

  return [
    "🚨 OUT OF STOCK PRODUCTS",
    "",
    ...products.map((product, index) =>
      `${index + 1}. ${getProductName(product)}`
    ),
    "",
    `जम्मा: ${products.length} सामान`
  ].join("\n");
}

function customerDueAnswer() {
  const customers = getCustomers()
    .filter(customer => toNumber(customer.currentBalance) > 0)
    .sort((a, b) =>
      toNumber(b.currentBalance) - toNumber(a.currentBalance)
    );

  if (customers.length === 0) {
    return "✅ हाल कुनै ग्राहकको बाँकी रकम देखिएको छैन।";
  }

  const lines = ["👥 CUSTOMER DUE", ""];

  customers.forEach((customer, index) => {
    lines.push(
      `${index + 1}. ${getCustomerName(customer)}`,
      `   बाँकी रकम: ${money(customer.currentBalance)}`,
      `   फोन: ${customer.phone || customer.mobile || "-"}`,
      ""
    );
  });

  lines.push(`कुल उठाउन बाँकी: ${money(totalCustomerDue())}`);

  return lines.join("\n");
}

function supplierPayableAnswer() {
  const suppliers = getSuppliers()
    .filter(supplier => toNumber(supplier.currentBalance) > 0)
    .sort((a, b) =>
      toNumber(b.currentBalance) - toNumber(a.currentBalance)
    );

  if (suppliers.length === 0) {
    return "✅ हाल कुनै सप्लायरलाई तिर्न बाँकी रकम देखिएको छैन।";
  }

  const lines = ["🚚 SUPPLIER PAYABLE", ""];

  suppliers.forEach((supplier, index) => {
    lines.push(
      `${index + 1}. ${getSupplierName(supplier)}`,
      `   तिर्न बाँकी: ${money(supplier.currentBalance)}`,
      `   फोन: ${supplier.phone || supplier.mobile || "-"}`,
      ""
    );
  });

  lines.push(`कुल तिर्न बाँकी: ${money(totalSupplierPayable())}`);

  return lines.join("\n");
}

function fastMovingAnswer() {
  const products = getFastMovingProducts();

  if (products.length === 0) {
    return "🔥 Fast Moving\n\nअहिलेसम्म विश्लेषण गर्न मिल्ने बिक्री मात्रा भेटिएन।";
  }

  return [
    "🔥 FAST MOVING PRODUCTS",
    "",
    ...products.map(([name, qty], index) =>
      `${index + 1}. ${name}\n   बिक्री मात्रा: ${qty}`
    ),
    "",
    "नोट: यो उपलब्ध बिक्री रेकर्डमा आधारित क्रम हो।"
  ].join("\n\n");
}

function slowMovingAnswer() {
  const products = getSlowMovingProducts();

  if (products.length === 0) {
    return "🐢 Slow Moving\n\nअहिलेसम्म विश्लेषण गर्न मिल्ने बिक्री मात्रा भेटिएन।";
  }

  return [
    "🐢 SLOWER-SELLING PRODUCTS",
    "",
    ...products.map(([name, qty], index) =>
      `${index + 1}. ${name}\n   बिक्री मात्रा: ${qty}`
    ),
    "",
    "नोट: बिक्री भएको सामानमध्ये कम मात्रा बिक्री भएकालाई पहिले देखाइएको छ। बिक्री नै नभएका सामान यस सूचीमा समावेश हुँदैनन्।"
  ].join("\n\n");
}

function expenseAnswer() {
  const expenses = getFinance().filter(item =>
    String(item.type || "").toUpperCase() === "EXPENSE"
  );

  const total = expenses.reduce(
    (sum, item) => sum + toNumber(item.amount),
    0
  );

  return `💸 EXPENSE SUMMARY

खर्च रेकर्ड: ${expenses.length}
रेकर्ड गरिएको कुल खर्च: ${money(total)}

बिक्री कुल: ${money(totalSales())}
खरिद कुल: ${money(totalPurchases())}

नोट: यो Finance मा EXPENSE प्रकारका रेकर्डमा आधारित छ।`;
}

function generalAnswer() {
  return `🤖 तपाईंको Business Assistant

म तपाईंको ब्राउजरमा सुरक्षित स्टोर डेटा हेरेर यी विवरण दिन सक्छु:

📊 Business Summary
⚠️ Low Stock
🚨 Out of Stock
👥 Customer Due
🚚 Supplier Payable
🔥 Fast Moving Products
🐢 Slow Moving Products
💸 Expense Summary

उदाहरणका लागि:
• कुन सामान कम stock मा छ?
• ग्राहकबाट कति पैसा लिन बाँकी छ?
• Supplier लाई कति तिर्न बाँकी छ?
• कुन सामान धेरै बिक्री भएको छ?
• कुल खर्च कति छ?

माथिका Quick Actions पनि प्रयोग गर्न सक्नुहुन्छ।`;
}

/* =========================================
   QUESTION MATCHING
   Specific intents are checked before general ones.
   ========================================= */

function answerQuestion(question) {
  const q = String(question || "").toLowerCase().trim();

  if (!q) {
    return generalAnswer();
  }

  // Slow-moving पहिले जाँच्ने, किनकि यसमा "कम बिक्री" आउँछ।
  if (
    q.includes("slow moving") ||
    q.includes("slow-moving") ||
    q.includes("कम बिक्री") ||
    q.includes("कम बिक") ||
    q.includes("बिक्री नभएको") ||
    q.includes("थोरै बिक्री")
  ) {
    return slowMovingAnswer();
  }

  if (
    q.includes("fast moving") ||
    q.includes("fast-moving") ||
    q.includes("धेरै बिक्री") ||
    q.includes("बढी बिक्री") ||
    q.includes("धेरै बिक") ||
    q.includes("सबैभन्दा बढी बिक")
  ) {
    return fastMovingAnswer();
  }

  if (
    q.includes("out of stock") ||
    q.includes("stock out") ||
    q.includes("स्टक सक") ||
    q.includes("सामान सकियो") ||
    q.includes("सामान छैन")
  ) {
    return outOfStockAnswer();
  }

  if (
    q.includes("low stock") ||
    q.includes("कम stock") ||
    q.includes("स्टक कम") ||
    q.includes("कम स्टक") ||
    q.includes("सामान कम") ||
    q.includes("न्यूनतम स्टक")
  ) {
    return lowStockAnswer();
  }

  if (
    q.includes("supplier payable") ||
    q.includes("supplier") ||
    q.includes("सप्लायर") ||
    q.includes("तिर्न बाँकी") ||
    q.includes("तिर्नु बाँकी")
  ) {
    return supplierPayableAnswer();
  }

  if (
    q.includes("customer due") ||
    q.includes("customer") ||
    q.includes("ग्राहक") ||
    q.includes("पैसा लिन") ||
    q.includes("उठाउन बाँकी") ||
    q.includes("लिन बाँकी")
  ) {
    return customerDueAnswer();
  }

  if (
    q.includes("expense") ||
    q.includes("खर्च") ||
    q.includes("व्यय")
  ) {
    return expenseAnswer();
  }

  if (
    q.includes("summary") ||
    q.includes("business") ||
    q.includes("व्यवसाय") ||
    q.includes("सारांश") ||
    q.includes("कुल बिक्री") ||
    q.includes("कति बिक्री") ||
    q.includes("कारोबार")
  ) {
    return businessSummary();
  }

  return generalAnswer();
}

/* =========================================
   ANSWER RENDERING
   ========================================= */

function askQuestion(question = $("questionInput").value) {
  const answerBox = $("answerBox");
  answerBox.textContent = answerQuestion(question);
}

$("questionForm").addEventListener("submit", event => {
  event.preventDefault();
  askQuestion();
});

document.querySelectorAll(".quick-btn").forEach(button => {
  button.addEventListener("click", () => {
    const question = button.dataset.question || "";
    $("questionInput").value = question;
    askQuestion(question);
  });
});

$("clearAnswerBtn").addEventListener("click", () => {
  $("answerBox").textContent = "आफ्नो प्रश्न लेख्नुहोस् वा Quick Action छान्नुहोस्।";
  $("questionInput").value = "";
  $("questionInput").focus();
});

/* =========================================
   STORE SNAPSHOT
   ========================================= */

function renderSnapshot() {
  $("productCount").textContent = getProducts().length.toLocaleString("en-IN");
  $("customerCount").textContent = getCustomers().length.toLocaleString("en-IN");
  $("supplierCount").textContent = getSuppliers().length.toLocaleString("en-IN");
  $("salesCount").textContent = getSales().length.toLocaleString("en-IN");
}

/* =========================================
   ALERTS
   Uses DOM nodes and textContent, not raw data HTML.
   ========================================= */

function addAlert(container, icon, title, description, type = "") {
  const alert = document.createElement("div");
  alert.className = `alert ${type}`.trim();

  const iconNode = document.createElement("span");
  iconNode.className = "alert-icon";
  iconNode.textContent = icon;

  const textNode = document.createElement("div");
  textNode.className = "alert-text";

  const strong = document.createElement("strong");
  strong.textContent = title;

  const detail = document.createElement("span");
  detail.textContent = description;

  textNode.append(strong, detail);
  alert.append(iconNode, textNode);
  container.appendChild(alert);
}

function renderAlerts() {
  const container = $("alertsBox");
  container.replaceChildren();

  const outOfStock = getOutOfStockProducts();
  const lowStock = getLowStockProducts();
  const customerDue = totalCustomerDue();
  const supplierPayable = totalSupplierPayable();

  let alertCount = 0;

  if (outOfStock.length > 0) {
    addAlert(
      container,
      "🚨",
      `${outOfStock.length} सामानको स्टक सकिएको छ`,
      "बिक्री वा खरिद गर्नुअघि स्टक जाँच गर्नुहोस्।",
      "danger"
    );
    alertCount++;
  }

  if (lowStock.length > 0) {
    addAlert(
      container,
      "⚠️",
      `${lowStock.length} सामान Low Stock मा छन्`,
      "आवश्यक परे पुनः खरिद गर्ने योजना बनाउनुहोस्।"
    );
    alertCount++;
  }

  if (customerDue > 0) {
    addAlert(
      container,
      "👥",
      "ग्राहकबाट रकम उठाउन बाँकी छ",
      `कुल रकम: ${money(customerDue)}`
    );
    alertCount++;
  }

  if (supplierPayable > 0) {
    addAlert(
      container,
      "🚚",
      "सप्लायरलाई रकम तिर्न बाँकी छ",
      `कुल रकम: ${money(supplierPayable)}`
    );
    alertCount++;
  }

  if (alertCount === 0) {
    addAlert(
      container,
      "✅",
      "अहिले कुनै महत्वपूर्ण Alert छैन",
      "स्टोरको हालको रेकर्डमा विशेष ध्यान दिनुपर्ने कुरा भेटिएन।",
      "good"
    );
  }
}

/* =========================================
   APPEARANCE PREFERENCES
   ========================================= */

function applySavedAppearance() {
  const settings = getSettings();
  const appearance = settings.appearance || {};

  document.body.classList.toggle(
    "dark-theme",
    appearance.theme === "dark"
  );

  const allowedFonts = [
    "Arial, sans-serif",
    "system-ui, sans-serif",
    "Verdana, sans-serif",
    "Tahoma, sans-serif",
    "Georgia, serif",
    "'Noto Sans Devanagari', 'Mangal', sans-serif"
  ];

  if (allowedFonts.includes(appearance.fontFamily)) {
    document.documentElement.style.setProperty(
      "--font-family",
      appearance.fontFamily
    );
  }

  const allowedSizes = ["13", "15", "17", "19"];
  if (allowedSizes.includes(String(appearance.fontSize))) {
    document.documentElement.style.setProperty(
      "--font-size",
      `${appearance.fontSize}px`
    );
  }
}

/* =========================================
   INITIALIZE AND REFRESH
   ========================================= */

function refreshAssistant() {
  renderSnapshot();
  renderAlerts();
}

applySavedAppearance();
refreshAssistant();

// अन्य पेज वा browser tab बाट data परिवर्तन भएमा snapshot refresh गर्ने।
window.addEventListener("storage", event => {
  const watchedKeys = [
    PRODUCT_KEY,
    CUSTOMER_KEY,
    SUPPLIER_KEY,
    SALE_KEY,
    PURCHASE_KEY,
    FINANCE_KEY,
    SETTINGS_KEY
  ];

  if (event.key === null || watchedKeys.includes(event.key)) {
    applySavedAppearance();
    refreshAssistant();
  }
});

// हालको ट्याबमा अर्को पेजबाट फर्कँदा पनि refresh गर्ने।
window.addEventListener("focus", refreshAssistant);
