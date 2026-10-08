const CUSTOMER_KEY = "gs_customers";
const SUPPLIER_KEY = "gs_suppliers";
const SALE_KEY = "gs_sales";
const PURCHASE_KEY = "gs_purchases";

const messageFor = document.getElementById("messageFor");
const personSelect = document.getElementById("personSelect");
const personGroup = document.getElementById("personGroup");
const customPhoneGroup = document.getElementById("customPhoneGroup");
const customPhone = document.getElementById("customPhone");

const messageType = document.getElementById("messageType");
const referenceGroup = document.getElementById("referenceGroup");
const referenceSelect = document.getElementById("referenceSelect");

const messageText = document.getElementById("messageText");
const phoneInfo = document.getElementById("phoneInfo");

const openWhatsAppBtn = document.getElementById("openWhatsAppBtn");
const copyMessageBtn = document.getElementById("copyMessageBtn");
const clearBtn = document.getElementById("clearBtn");

const statusBox = document.getElementById("statusBox");


function getData(key) {
    try {
        return JSON.parse(localStorage.getItem(key)) || [];
    } catch (error) {
        return [];
    }
}


function cleanPhone(phone) {
    if (!phone) return "";

    let number = String(phone).replace(/\D/g, "");

    /*
        Nepal:
        98XXXXXXXX -> 97798XXXXXXXX
        97XXXXXXXX -> 97797XXXXXXXX

        India:
        98XXXXXXXXXX -> 9198XXXXXXXXXX
    */

    if (number.length === 10 && number.startsWith("9")) {
        number = "977" + number;
    }

    return number;
}


function showStatus(message, type) {
    statusBox.textContent = message;
    statusBox.className = "status " + type;
}


function clearStatus() {
    statusBox.textContent = "";
    statusBox.className = "status";
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

        const customers = getCustomers();

        return customers.find(
            customer => customer.id === personSelect.value
        );

    }

    if (messageFor.value === "supplier") {

        const suppliers = getSuppliers();

        return suppliers.find(
            supplier => supplier.id === personSelect.value
        );

    }

    return null;
}


function populatePersons() {

    personSelect.innerHTML =
        `<option value="">-- नाम छान्नुहोस् --</option>`;

    if (messageFor.value === "customer") {

        const customers = getCustomers();

        customers
            .filter(customer => customer.active !== false)
            .forEach(customer => {

                const option = document.createElement("option");

                option.value = customer.id;

                option.textContent =
                    `${customer.name || "Unnamed"}${customer.phone ? " - " + customer.phone : ""}`;

                personSelect.appendChild(option);
            });

    } else if (messageFor.value === "supplier") {

        const suppliers = getSuppliers();

        suppliers
            .filter(supplier => supplier.active !== false)
            .forEach(supplier => {

                const option = document.createElement("option");

                option.value = supplier.id;

                option.textContent =
                    `${supplier.name || "Unnamed"}${supplier.phone ? " - " + supplier.phone : ""}`;

                personSelect.appendChild(option);
            });
    }

    updateReferences();
    updatePhone();
    generateMessage();
}


function populateSalesReferences() {

    referenceSelect.innerHTML =
        `<option value="">-- Bill छान्नुहोस् --</option>`;

    const sales = getSales();

    sales
        .slice()
        .reverse()
        .forEach(sale => {

            const option = document.createElement("option");

            option.value = sale.id;

            option.textContent =
                `${sale.billNumber || sale.id} - ${sale.customerName || "Cash Customer"} - Rs. ${Number(sale.total || 0).toFixed(2)}`;

            referenceSelect.appendChild(option);
        });
}


function populatePurchaseReferences() {

    referenceSelect.innerHTML =
        `<option value="">-- Purchase Bill छान्नुहोस् --</option>`;

    const purchases = getPurchases();

    purchases
        .slice()
        .reverse()
        .forEach(purchase => {

            const option = document.createElement("option");

            option.value = purchase.id;

            option.textContent =
                `${purchase.billNumber || purchase.id} - ${purchase.supplierName || "Supplier"} - Rs. ${Number(purchase.total || 0).toFixed(2)}`;

            referenceSelect.appendChild(option);
        });
}


function updateReferences() {

    const type = messageType.value;

    if (
        type === "bill"
    ) {
        referenceGroup.style.display = "flex";
        populateSalesReferences();
        return;
    }

    if (
        type === "supplier_order"
    ) {
        referenceGroup.style.display = "none";
        return;
    }

    if (
        type === "customer_statement" ||
        type === "supplier_statement"
    ) {
        referenceGroup.style.display = "none";
        return;
    }

    if (type === "due_reminder") {
        referenceGroup.style.display = "none";
        return;
    }

    if (type === "custom") {
        referenceGroup.style.display = "none";
        return;
    }

    referenceGroup.style.display = "none";
}


function updatePhone() {

    if (messageFor.value === "custom") {

        personGroup.style.display = "none";
        customPhoneGroup.style.display = "flex";

        const number = cleanPhone(customPhone.value);

        phoneInfo.textContent =
            number
                ? "WhatsApp Number: " + number
                : "WhatsApp Number: -";

        return;
    }


    personGroup.style.display = "flex";
    customPhoneGroup.style.display = "none";


    const person = getSelectedPerson();

    if (!person) {

        phoneInfo.textContent =
            "WhatsApp Number: -";

        return;
    }


    const number = cleanPhone(person.phone);

    phoneInfo.textContent =
        number
            ? "WhatsApp Number: " + number
            : "WhatsApp Number उपलब्ध छैन";
}


function getCustomerBalance(customer) {

    if (!customer) return 0;

    return Number(customer.currentBalance || 0);
}


function getSupplierBalance(supplier) {

    if (!supplier) return 0;

    return Number(supplier.currentBalance || 0);
}


function customerDueMessage(customer) {

    const balance = getCustomerBalance(customer);

    if (balance <= 0) {

        return `नमस्ते ${customer.name || ""},

तपाईंको खातामा हाल कुनै बाँकी रकम छैन।

धन्यवाद।
General Store`;
    }

    return `नमस्ते ${customer.name || ""},

तपाईंको खातामा हाल रु. ${balance.toFixed(2)} बाँकी रहेको छ।

कृपया सुविधा अनुसार बाँकी रकम भुक्तानी गरिदिनुहोला।

धन्यवाद।
General Store`;
}


function customerStatementMessage(customer) {

    const balance = getCustomerBalance(customer);

    const opening = Number(customer.openingBalance || 0);
    const creditSale = Number(customer.creditSaleTotal || 0);
    const payment = Number(customer.paymentTotal || 0);

    let balanceText = "Advance";

    if (balance > 0) {
        balanceText = "Due";
    }

    if (balance === 0) {
        balanceText = "Clear";
    }

    return `नमस्ते ${customer.name || ""},

तपाईंको खाताको छोटो विवरण:

Opening Balance: Rs. ${opening.toFixed(2)}
Credit Sale: Rs. ${creditSale.toFixed(2)}
Payment: Rs. ${payment.toFixed(2)}

Current Balance: Rs. ${Math.abs(balance).toFixed(2)}
Status: ${balanceText}

धन्यवाद।
General Store`;
}


function supplierStatementMessage(supplier) {

    const balance = getSupplierBalance(supplier);

    const opening = Number(supplier.openingBalance || 0);
    const purchase = Number(supplier.purchaseTotal || 0);
    const payment = Number(supplier.paymentTotal || 0);

    let status = "Advance";

    if (balance > 0) {
        status = "Payable";
    }

    if (balance === 0) {
        status = "Clear";
    }

    return `नमस्ते ${supplier.name || ""},

तपाईंको खाताको छोटो विवरण:

Opening Balance: Rs. ${opening.toFixed(2)}
Purchase: Rs. ${purchase.toFixed(2)}
Payment Made: Rs. ${payment.toFixed(2)}

Current Balance: Rs. ${Math.abs(balance).toFixed(2)}
Status: ${status}

धन्यवाद।
General Store`;
}


function supplierOrderMessage(supplier) {

    return `नमस्ते ${supplier.name || ""},

हामीलाई केही सामान आवश्यक छ।

कृपया उपलब्ध stock, rate र delivery सम्बन्धी जानकारी पठाइदिनुहोला।

धन्यवाद।
General Store`;
}


function billMessage(sale) {

    if (!sale) {
        return "";
    }

    return `नमस्ते ${sale.customerName || "Customer"},

Bill No.: ${sale.billNumber || sale.id}
Date: ${sale.date || ""}

Product: ${sale.productName || ""}
Qty: ${Number(sale.qty || 0)}
Total: Rs. ${Number(sale.total || 0).toFixed(2)}
Paid: Rs. ${Number(sale.paidAmount || 0).toFixed(2)}
Balance: Rs. ${Number(sale.balance || 0).toFixed(2)}

धन्यवाद।
General Store`;
}


function generateMessage() {

    const type = messageType.value;

    let message = "";


    if (type === "due_reminder") {

        const customer = getSelectedPerson();

        if (!customer) {
            messageText.value = "";
            return;
        }

        message = customerDueMessage(customer);
    }


    else if (type === "customer_statement") {

        const customer = getSelectedPerson();

        if (!customer) {
            messageText.value = "";
            return;
        }

        message = customerStatementMessage(customer);
    }


    else if (type === "supplier_statement") {

        const supplier = getSelectedPerson();

        if (!supplier) {
            messageText.value = "";
            return;
        }

        message = supplierStatementMessage(supplier);
    }


    else if (type === "supplier_order") {

        const supplier = getSelectedPerson();

        if (!supplier) {
            messageText.value = "";
            return;
        }

        message = supplierOrderMessage(supplier);
    }


    else if (type === "bill") {

        const sales = getSales();

        const sale = sales.find(
            item => item.id === referenceSelect.value
        );

        if (!sale) {
            messageText.value = "";
            return;
        }

        message = billMessage(sale);
    }


    else if (type === "custom") {

        if (!messageText.value.trim()) {
            message = "";
        } else {
            return;
        }
    }


    messageText.value = message;
}


function validatePhone() {

    let number = "";

    if (messageFor.value === "custom") {
        number = cleanPhone(customPhone.value);
    } else {
        const person = getSelectedPerson();

        if (person) {
            number = cleanPhone(person.phone);
        }
    }

    if (!number) {
        showStatus(
            "पहिले सही WhatsApp number राख्नुहोस्।",
            "error"
        );

        return null;
    }

    return number;
}


function openWhatsApp() {

    clearStatus();

    const number = validatePhone();

    if (!number) {
        return;
    }


    const message = messageText.value.trim();

    if (!message) {

        showStatus(
            "Message खाली छ। पहिले message तयार गर्नुहोस्।",
            "error"
        );

        return;
    }


    const url =
        "https://wa.me/" +
        number +
        "?text=" +
        encodeURIComponent(message);


    window.open(url, "_blank");

    showStatus(
        "WhatsApp खोलिँदैछ...",
        "success"
    );
}


async function copyMessage() {

    clearStatus();

    const message = messageText.value.trim();

    if (!message) {

        showStatus(
            "Copy गर्न message छैन।",
            "error"
        );

        return;
    }


    try {

        await navigator.clipboard.writeText(message);

        showStatus(
            "Message copy भयो।",
            "success"
        );

    } catch (error) {

        messageText.select();

        document.execCommand("copy");

        showStatus(
            "Message copy भयो।",
            "success"
        );
    }
}


function clearForm() {

    messageText.value = "";

    customPhone.value = "";

    personSelect.value = "";

    referenceSelect.value = "";

    clearStatus();

    updatePhone();
}


messageFor.addEventListener(
    "change",
    function () {

        populatePersons();

    }
);


personSelect.addEventListener(
    "change",
    function () {

        updatePhone();

        generateMessage();

    }
);


customPhone.addEventListener(
    "input",
    function () {

        updatePhone();

    }
);


messageType.addEventListener(
    "change",
    function () {

        updateReferences();

        generateMessage();

    }
);


referenceSelect.addEventListener(
    "change",
    function () {

        generateMessage();

    }
);


messageText.addEventListener(
    "input",
    function () {

        if (messageType.value === "custom") {
            return;
        }

        /*
            User can manually edit generated message.
            त्यसैले यहाँ automatic overwrite गर्दैनौं।
        */
    }
);


openWhatsAppBtn.addEventListener(
    "click",
    openWhatsApp
);


copyMessageBtn.addEventListener(
    "click",
    copyMessage
);


clearBtn.addEventListener(
    "click",
    clearForm
);


// Initial Load
populatePersons();
updateReferences();
updatePhone();
