
"use strict";

/*
  General Store WhatsApp Module

  LocalStorage:
  gs_customers
  gs_suppliers
  gs_sales
  gs_purchases

  यो module ले WhatsApp API प्रयोग गर्दैन।
  यसले wa.me link बाट message तयार गर्छ।
*/

const CUSTOMER_KEY = "gs_customers";
const SUPPLIER_KEY = "gs_suppliers";
const SALE_KEY = "gs_sales";
const PURCHASE_KEY = "gs_purchases";

const $ = (id) => document.getElementById(id);

const messageFor = $("messageFor");
const personSelect = $("personSelect");
const personGroup = $("personGroup");
const customPhoneGroup = $("customPhoneGroup");
const customPhone = $("customPhone");

const messageType = $("messageType");
const referenceGroup = $("referenceGroup");
const referenceSelect = $("referenceSelect");

const messageText = $("messageText");
const phoneInfo = $("phoneInfo");
const statusBox = $("statusBox");

const openWhatsAppBtn = $("openWhatsAppBtn");
const copyMessageBtn = $("copyMessageBtn");
const clearBtn = $("clearBtn");

const DEFAULT_MESSAGE_TYPES = [
  { value: "due_reminder", label: "Customer Due Reminder" },
  { value: "customer_statement", label: "Customer Statement" },
  { value: "supplier_statement", label: "Supplier Statement" },
  { value: "supplier_order", label: "Supplier Order" },
  { value: "bill", label: "Bill / Receipt Message" },
  { value: "custom", label: "Custom Message" }
];

/* -------------------------
   Common Helpers
------------------------- */

function getData(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("LocalStorage data पढ्न समस्या:", key, error);
    return [];
  }
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function money(value) {
  return toNumber(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapeText(value) {
  return String(value ?? "").trim();
}

function personName(person, fallback = "Customer") {
  return escapeText(
    person?.name ||
    person?.customerName ||
    person?.supplierName ||
    fallback
  );
}

function getRecordId(record) {
  return record?.id == null ? "" : String(record.id);
}

function findById(records, id) {
  const wanted = String(id ?? "");
  return records.find(record => getRecordId(record) === wanted);
}

function showStatus(message, type = "success") {
  statusBox.textContent = message;
  statusBox.className = "status " + type;
}

function clearStatus() {
  statusBox.textContent = "";
  statusBox.className = "status";
}

function addOption(select, value, text) {
  const option = document.createElement("option");
  option.value = String(value ?? "");
  option.textContent = String(text ?? "");
  select.appendChild(option);
}

function resetSelect(select, placeholder) {
  select.replaceChildren();
  addOption(select, "", placeholder);
}

/*
  नेपालका 10-digit mobile number मा 977 थप्छ।
  पहिले नै 977 भएको नम्बरमा फेरि 977 थप्दैन।
  अरू देशका नम्बरका लागि country code सहित राख्नुहोस्।
*/
function cleanPhone(phone) {
  let number = String(phone ?? "").replace(/\D/g, "");

  if (!number) return "";

  // International dialing prefix 00 हटाउने
  if (number.startsWith("00")) {
    number = number.slice(2);
  }

  // नेपाल: 98XXXXXXXX वा 97XXXXXXXX
  if (
    number.length === 10 &&
    (number.startsWith("98") || number.startsWith("97"))
  ) {
    number = "977" + number;
  }

  // नेपाल: 0 बाट सुरु गरिएको local mobile number
  if (
    number.length === 11 &&
    number.startsWith("0") &&
    (number.startsWith("098") || number.startsWith("097"))
  ) {
    number = "977" + number.slice(1);
  }

  // International format मा 8–15 digits स्वीकार
  if (number.length < 8 || number.length > 15) {
    return "";
  }

  return number;
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

function getSelectedPerson() {
  if (messageFor.value === "customer") {
    return findById(getCustomers(), personSelect.value);
  }

  if (messageFor.value === "supplier") {
    return findById(getSuppliers(), personSelect.value);
  }

  return null;
}

function getSelectedPhone() {
  if (messageFor.value === "custom") {
    return cleanPhone(customPhone.value);
  }

  const person = getSelectedPerson();
  return cleanPhone(person?.phone || person?.mobile || person?.whatsapp);
}

/* -------------------------
   Message Type Options
------------------------- */

function populateMessageTypes(preferredType) {
  const target = messageFor.value;
  let allowedTypes = [];

  if (target === "customer") {
    allowedTypes = DEFAULT_MESSAGE_TYPES.filter(item =>
      ["due_reminder", "customer_statement", "bill", "custom"].includes(item.value)
    );
  } else if (target === "supplier") {
    allowedTypes = DEFAULT_MESSAGE_TYPES.filter(item =>
      ["supplier_statement", "supplier_order", "custom"].includes(item.value)
    );
  } else {
    allowedTypes = DEFAULT_MESSAGE_TYPES.filter(item =>
      item.value === "custom"
    );
  }

  messageType.replaceChildren();

  allowedTypes.forEach(item => {
    addOption(messageType, item.value, item.label);
  });

  const exists = allowedTypes.some(item => item.value === preferredType);

  messageType.value = exists
    ? preferredType
    : (allowedTypes[0]?.value || "custom");
}

/* -------------------------
   Customer / Supplier List
------------------------- */

function populatePersons() {
  resetSelect(personSelect, "-- नाम छान्नुहोस् --");

  const target = messageFor.value;

  if (target === "customer") {
    getCustomers()
      .filter(person => person && person.active !== false)
      .forEach(person => {
        const name = personName(person, "Unnamed Customer");
        const phone = person.phone || person.mobile || "";
        addOption(
          personSelect,
          getRecordId(person),
          phone ? `${name} - ${phone}` : name
        );
      });
  }

  if (target === "supplier") {
    getSuppliers()
      .filter(person => person && person.active !== false)
      .forEach(person => {
        const name = personName(person, "Unnamed Supplier");
        const phone = person.phone || person.mobile || "";
        addOption(
          personSelect,
          getRecordId(person),
          phone ? `${name} - ${phone}` : name
        );
      });
  }

  updatePersonVisibility();
  updatePhone();
}

function updatePersonVisibility() {
  const isCustom = messageFor.value === "custom";

  personGroup.hidden = isCustom;
  customPhoneGroup.hidden = !isCustom;
}

/* -------------------------
   Bill References
------------------------- */

function saleTotal(sale) {
  const directTotal =
    sale?.total ??
    sale?.grandTotal ??
    sale?.netTotal ??
    sale?.totalAmount;

  if (directTotal != null && directTotal !== "") {
    return toNumber(directTotal);
  }

  if (Array.isArray(sale?.items)) {
    return sale.items.reduce((sum, item) => {
      const qty = toNumber(item.qty ?? item.quantity);
      const rate = toNumber(item.rate ?? item.price ?? item.sellingPrice);
      const lineTotal = item.total ?? item.amount;
      return sum + (
        lineTotal != null && lineTotal !== ""
          ? toNumber(lineTotal)
          : qty * rate
      );
    }, 0);
  }

  return 0;
}

function saleBillNumber(sale) {
  return escapeText(sale?.billNumber || sale?.invoiceNumber || sale?.id || "Bill");
}

function populateSalesReferences() {
  resetSelect(referenceSelect, "-- Bill छान्नुहोस् --");

  getSales()
    .slice()
    .reverse()
    .forEach(sale => {
      if (!sale) return;

      const customer = sale.customerName || sale.customer?.name || "Cash Customer";
      const label = `${saleBillNumber(sale)} - ${customer} - Rs. ${money(saleTotal(sale))}`;

      addOption(referenceSelect, getRecordId(sale), label);
    });
}

function updateReferences() {
  const isBill = messageType.value === "bill";

  referenceGroup.hidden = !isBill;

  if (isBill) {
    populateSalesReferences();
  } else {
    resetSelect(referenceSelect, "-- Bill छान्नुहोस् --");
  }
}

/* -------------------------
   Balance & Statement
------------------------- */

function getCustomerBalance(customer) {
  if (!customer) return 0;

  if (customer.currentBalance != null && customer.currentBalance !== "") {
    return toNumber(customer.currentBalance);
  }

  const opening = toNumber(customer.openingBalance);
  const creditSales = toNumber(customer.creditSaleTotal);
  const payments = toNumber(customer.paymentTotal);
  const returns = toNumber(customer.returnTotal);

  return opening + creditSales - payments - returns;
}

function getSupplierBalance(supplier) {
  if (!supplier) return 0;

  if (supplier.currentBalance != null && supplier.currentBalance !== "") {
    return toNumber(supplier.currentBalance);
  }

  const opening = toNumber(supplier.openingBalance);
  const purchases = toNumber(supplier.purchaseTotal);
  const payments = toNumber(supplier.paymentTotal);
  const returns = toNumber(supplier.returnTotal);

  return opening + purchases - payments - returns;
}

function customerDueMessage(customer) {
  const balance = getCustomerBalance(customer);
  const name = personName(customer);

  if (balance <= 0) {
    return `नमस्ते ${name},

तपाईंको खातामा हाल कुनै बाँकी रकम छैन।

धन्यवाद।
General Store`;
  }

  return `नमस्ते ${name},

तपाईंको खातामा हाल रु. ${money(balance)} बाँकी रहेको छ।

कृपया सुविधा अनुसार बाँकी रकम भुक्तानी गरिदिनुहोला।

धन्यवाद।
General Store`;
}

function customerStatementMessage(customer) {
  const balance = getCustomerBalance(customer);

  const opening = toNumber(customer.openingBalance);
  const creditSales = toNumber(customer.creditSaleTotal);
  const payments = toNumber(customer.paymentTotal);

  let status = "Clear";

  if (balance > 0) status = "Due";
  if (balance < 0) status = "Advance";

  return `नमस्ते ${personName(customer)},

तपाईंको खाताको छोटो विवरण:

Opening Balance: Rs. ${money(opening)}
Credit Sale: Rs. ${money(creditSales)}
Payment Received: Rs. ${money(payments)}

Current Balance: Rs. ${money(Math.abs(balance))}
Status: ${status}

धन्यवाद।
General Store`;
}

function supplierStatementMessage(supplier) {
  const balance = getSupplierBalance(supplier);

  const opening = toNumber(supplier.openingBalance);
  const purchases = toNumber(supplier.purchaseTotal);
  const payments = toNumber(supplier.paymentTotal);

  let status = "Clear";

  if (balance > 0) status = "Payable";
  if (balance < 0) status = "Advance";

  return `नमस्ते ${personName(supplier, "Supplier")},

तपाईंको खाताको छोटो विवरण:

Opening Balance: Rs. ${money(opening)}
Purchase: Rs. ${money(purchases)}
Payment Made: Rs. ${money(payments)}

Current Balance: Rs. ${money(Math.abs(balance))}
Status: ${status}

धन्यवाद।
General Store`;
}

function supplierOrderMessage(supplier) {
  return `नमस्ते ${personName(supplier, "Supplier")},

हामीलाई केही सामान आवश्यक छ।

कृपया उपलब्ध stock, rate र delivery सम्बन्धी जानकारी पठाइदिनुहोला।

धन्यवाद।
General Store`;
}

/* -------------------------
   Bill Message
------------------------- */

function billMessage(sale) {
  if (!sale) return "";

  const customerName =
    sale.customerName ||
    sale.customer?.name ||
    "Customer";

  const billNo = saleBillNumber(sale);
  const date = sale.date || sale.createdAt || "";

  const items = Array.isArray(sale.items) ? sale.items : [];
  let productLines = "";

  if (items.length > 0) {
    productLines = items.map((item, index) => {
      const name = item.productName || item.name || item.product?.name || "Product";
      const qty = toNumber(item.qty ?? item.quantity);
      const rate = toNumber(item.rate ?? item.price ?? item.sellingPrice);

      const lineTotal =
        item.total != null
          ? toNumber(item.total)
          : item.amount != null
            ? toNumber(item.amount)
            : qty * rate;

      return `${index + 1}. ${name} | Qty: ${qty} | Rate: Rs. ${money(rate)} | Total: Rs. ${money(lineTotal)}`;
    }).join("\n");
  } else {
    const product = sale.productName || sale.itemName || "Product";
    const qty = toNumber(sale.qty ?? sale.quantity);
    const rate = toNumber(sale.rate ?? sale.price);

    productLines =
      `${product} | Qty: ${qty}` +
      (rate ? ` | Rate: Rs. ${money(rate)}` : "");
  }

  const total = saleTotal(sale);
  const paid = toNumber(
    sale.paidAmount ?? sale.paid ?? sale.amountPaid
  );

  const balanceValue =
    sale.balance != null
      ? toNumber(sale.balance)
      : Math.max(0, total - paid);

  return `नमस्ते ${customerName},

तपाईंको बिल विवरण:

Bill No.: ${billNo}
Date: ${date}

सामान:
${productLines}

Total: Rs. ${money(total)}
Paid: Rs. ${money(paid)}
Balance: Rs. ${money(balanceValue)}

धन्यवाद।
General Store`;
}

/* -------------------------
   Generate Message
------------------------- */

function generateMessage() {
  const type = messageType.value;

  // Custom message प्रयोगकर्ताले लेखेको अवस्थामा overwrite नगर्ने
  if (type === "custom") return;

  const person = getSelectedPerson();

  if (type === "bill") {
    const sale = findById(getSales(), referenceSelect.value);

    if (!sale) {
      messageText.value = "";
      return;
    }

    messageText.value = billMessage(sale);
    return;
  }

  if (!person) {
    messageText.value = "";
    return;
  }

  switch (type) {
    case "due_reminder":
      messageText.value = customerDueMessage(person);
      break;

    case "customer_statement":
      messageText.value = customerStatementMessage(person);
      break;

    case "supplier_statement":
      messageText.value = supplierStatementMessage(person);
      break;

    case "supplier_order":
      messageText.value = supplierOrderMessage(person);
      break;

    default:
      messageText.value = "";
  }
}

/* -------------------------
   Phone Display
------------------------- */

function updatePhone() {
  updatePersonVisibility();

  const number = getSelectedPhone();

  if (!number) {
    phoneInfo.textContent = messageFor.value === "custom"
      ? "WhatsApp Number: -"
      : "WhatsApp Number उपलब्ध छैन वा व्यक्ति छानिएको छैन।";
    return;
  }

  phoneInfo.textContent = "WhatsApp Number: " + number;
}

/* -------------------------
   Open WhatsApp
------------------------- */

function validateMessageAndPhone() {
  clearStatus();

  const number = getSelectedPhone();

  if (!number) {
    showStatus(
      "सही WhatsApp नम्बर राख्नुहोस् वा नम्बर भएको व्यक्ति छान्नुहोस्।",
      "error"
    );
    return null;
  }

  const message = messageText.value.trim();

  if (!message) {
    showStatus("Message खाली छ। पहिले message तयार गर्नुहोस्।", "error");
    return null;
  }

  if (messageFor.value !== "custom" && !getSelectedPerson()) {
    showStatus("पहिले Customer वा Supplier छान्नुहोस्।", "error");
    return null;
  }

  if (messageType.value === "bill" && !referenceSelect.value) {
    showStatus("पहिले Bill Reference छान्नुहोस्।", "error");
    return null;
  }

  return { number, message };
}

function openWhatsApp() {
  const data = validateMessageAndPhone();

  if (!data) return;

  const url =
    "https://wa.me/" +
    data.number +
    "?text=" +
    encodeURIComponent(data.message);

  // प्रयोगकर्ताले click गरेको समयमा मात्र खोल्ने
  const openedWindow = window.open(url, "_blank", "noopener,noreferrer");

  if (!openedWindow) {
    showStatus(
      "Browser ले नयाँ window रोक्यो। Pop-up अनुमति दिनुहोस् वा यो page बाट फेरि प्रयास गर्नुहोस्।",
      "error"
    );
    return;
  }

  showStatus(
    "WhatsApp खोलिएको छ। Message र नम्बर जाँचेर WhatsApp बाट Send गर्नुहोस्।",
    "success"
  );
}

/* -------------------------
   Copy Message
------------------------- */

async function copyMessage() {
  clearStatus();

  const message = messageText.value.trim();

  if (!message) {
    showStatus("Copy गर्न message छैन।", "error");
    return;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(message);
    } else {
      const temp = document.createElement("textarea");
      temp.value = message;
      temp.style.position = "fixed";
      temp.style.opacity = "0";
      document.body.appendChild(temp);
      temp.select();

      const copied = document.execCommand("copy");
      temp.remove();

      if (!copied) throw new Error("Copy failed");
    }

    showStatus("Message copy भयो।", "success");
  } catch (error) {
    console.error("Copy error:", error);
    showStatus(
      "Message स्वतः copy भएन। Message मा क्लिक गरेर manually copy गर्नुहोस्।",
      "error"
    );
  }
}

/* -------------------------
   Clear Form
------------------------- */

function clearForm() {
  clearStatus();

  customPhone.value = "";
  personSelect.value = "";
  referenceSelect.value = "";
  messageText.value = "";

  updatePhone();

  if (messageFor.value !== "custom") {
    personSelect.value = "";
  }
}

/* -------------------------
   Event Listeners
------------------------- */

messageFor.addEventListener("change", () => {
  const previousType = messageType.value;

  populateMessageTypes(previousType);
  populatePersons();
  updateReferences();
  updatePhone();
  generateMessage();
});

personSelect.addEventListener("change", () => {
  clearStatus();
  updatePhone();
  generateMessage();
});

customPhone.addEventListener("input", () => {
  updatePhone();
  clearStatus();
});

messageType.addEventListener("change", () => {
  clearStatus();
  updateReferences();
  generateMessage();
});

referenceSelect.addEventListener("change", () => {
  clearStatus();
  generateMessage();
});

messageText.addEventListener("input", () => {
  clearStatus();
});

openWhatsAppBtn.addEventListener("click", openWhatsApp);
copyMessageBtn.addEventListener("click", copyMessage);
clearBtn.addEventListener("click", clearForm);

/* -------------------------
   Initial Load
------------------------- */

function initWhatsAppPage() {
  populateMessageTypes(messageType.value);
  populatePersons();
  updateReferences();
  updatePhone();
  generateMessage();
}

initWhatsAppPage();
