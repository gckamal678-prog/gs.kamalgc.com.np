const PRODUCT_KEY = "gs_products";
const CUSTOMER_KEY = "gs_customers";
const SUPPLIER_KEY = "gs_suppliers";
const SALE_KEY = "gs_sales";
const PURCHASE_KEY = "gs_purchases";
const FINANCE_KEY = "gs_finance";

const questionInput = document.getElementById("questionInput");
const askBtn = document.getElementById("askBtn");
const answerBox = document.getElementById("answerBox");

const productCount = document.getElementById("productCount");
const customerCount = document.getElementById("customerCount");
const supplierCount = document.getElementById("supplierCount");
const salesCount = document.getElementById("salesCount");

const alertsBox = document.getElementById("alertsBox");


function getData(key) {

    try {
        return JSON.parse(localStorage.getItem(key)) || [];
    } catch (error) {
        return [];
    }

}


function money(value) {
    return "Rs. " + Number(value || 0).toFixed(2);
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


function totalSales() {

    return getSales().reduce(
        (sum, sale) => sum + Number(sale.total || 0),
        0
    );

}


function totalPurchases() {

    return getPurchases().reduce(
        (sum, purchase) => sum + Number(purchase.total || 0),
        0
    );

}


function totalCustomerDue() {

    return getCustomers().reduce(
        (sum, customer) => {

            const balance = Number(customer.currentBalance || 0);

            return sum + (balance > 0 ? balance : 0);

        },
        0
    );

}


function totalSupplierPayable() {

    return getSuppliers().reduce(
        (sum, supplier) => {

            const balance = Number(supplier.currentBalance || 0);

            return sum + (balance > 0 ? balance : 0);

        },
        0
    );

}


function getLowStockProducts() {

    return getProducts().filter(product => {

        const stock = Number(product.stock || 0);

        const minimum = Number(product.minStock || 0);

        return stock <= minimum;

    });

}


function getOutOfStockProducts() {

    return getProducts().filter(product => {

        return Number(product.stock || 0) <= 0;

    });

}


function getSalesByProduct() {

    const sales = getSales();

    const result = {};

    sales.forEach(sale => {

        const name =
            sale.productName ||
            "Unknown Product";

        if (!result[name]) {
            result[name] = 0;
        }

        result[name] += Number(sale.qty || 0);

    });

    return result;

}


function getFastMovingProducts() {

    const data = getSalesByProduct();

    return Object.entries(data)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

}


function getSlowMovingProducts() {

    const data = getSalesByProduct();

    return Object.entries(data)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 5);

}


function businessSummary() {

    const products = getProducts();
    const customers = getCustomers();
    const suppliers = getSuppliers();
    const sales = getSales();
    const purchases = getPurchases();

    const saleTotal = totalSales();
    const purchaseTotal = totalPurchases();

    const customerDue = totalCustomerDue();
    const supplierPayable = totalSupplierPayable();

    return `📊 Business Summary

Products: ${products.length}
Customers: ${customers.length}
Suppliers: ${suppliers.length}

Sales Transactions: ${sales.length}
Total Sales: ${money(saleTotal)}

Purchase Transactions: ${purchases.length}
Total Purchases: ${money(purchaseTotal)}

Customer Due: ${money(customerDue)}
Supplier Payable: ${money(supplierPayable)}

ℹ️ Note:
Profit calculation यहाँबाट अनुमान मात्र होइन, Reports module को accounting data अनुसार हेर्नु राम्रो हुन्छ।`;

}


function lowStockAnswer() {

    const products = getLowStockProducts();

    const outOfStock = getOutOfStockProducts();

    if (products.length === 0) {

        return `✅ Low Stock

हाल minimum stock भन्दा कम वा बराबर भएको product छैन।`;

    }

    let text =
        `⚠️ Low Stock Products\n\n`;

    products.forEach((product, index) => {

        text +=
            `${index + 1}. ${product.name}\n` +
            `   Stock: ${Number(product.stock || 0)} ${product.unit || ""}\n` +
            `   Minimum: ${Number(product.minStock || 0)} ${product.unit || ""}\n\n`;

    });

    if (outOfStock.length > 0) {

        text +=
            `🚨 Out of Stock: ${outOfStock.length} product(s)`;

    }

    return text;

}


function customerDueAnswer() {

    const customers = getCustomers()
        .filter(customer => Number(customer.currentBalance || 0) > 0)
        .sort(
            (a, b) =>
                Number(b.currentBalance || 0) -
                Number(a.currentBalance || 0)
        );

    if (customers.length === 0) {

        return `✅ Customer Due

हाल कुनै customer को बाँकी रकम देखिएको छैन।`;

    }

    let text =
        `👥 Customer Due\n\n`;

    customers.forEach((customer, index) => {

        text +=
            `${index + 1}. ${customer.name}\n` +
            `   Due: ${money(customer.currentBalance)}\n` +
            `   Phone: ${customer.phone || "-"}\n\n`;

    });

    text +=
        `Total Due: ${money(totalCustomerDue())}`;

    return text;

}


function supplierPayableAnswer() {

    const suppliers = getSuppliers()
        .filter(supplier => Number(supplier.currentBalance || 0) > 0)
        .sort(
            (a, b) =>
                Number(b.currentBalance || 0) -
                Number(a.currentBalance || 0)
        );

    if (suppliers.length === 0) {

        return `✅ Supplier Payable

हाल कुनै supplier लाई बाँकी रकम देखिएको छैन।`;

    }

    let text =
        `🚚 Supplier Payable\n\n`;

    suppliers.forEach((supplier, index) => {

        text +=
            `${index + 1}. ${supplier.name}\n` +
            `   Payable: ${money(supplier.currentBalance)}\n` +
            `   Phone: ${supplier.phone || "-"}\n\n`;

    });

    text +=
        `Total Payable: ${money(totalSupplierPayable())}`;

    return text;

}


function fastMovingAnswer() {

    const products = getFastMovingProducts();

    if (products.length === 0) {

        return `🔥 Fast Moving

अहिलेसम्म बिक्री data पर्याप्त छैन।`;

    }

    let text =
        `🔥 Fast Moving Products\n\n`;

    products.forEach((item, index) => {

        text +=
            `${index + 1}. ${item[0]}\n` +
            `   Sold Qty: ${item[1]}\n\n`;

    });

    return text;

}


function slowMovingAnswer() {

    const products = getSlowMovingProducts();

    if (products.length === 0) {

        return `🐢 Slow Moving

अहिलेसम्म बिक्री data पर्याप्त छैन।`;

    }

    let text =
        `🐢 Low Sales / Slow Moving\n\n`;

    products.forEach((item, index) => {

        text +=
            `${index + 1}. ${item[0]}\n` +
            `   Sold Qty: ${item[1]}\n\n`;

    });

    return text;

}


function expenseAnswer() {

    const finance = getFinance();

    const expenses = finance.filter(
        item => item.type === "EXPENSE"
    );

    const total = expenses.reduce(
        (sum, item) =>
            sum + Number(item.amount || 0),
        0
    );

    return `💰 Expense Summary

Expense Transactions: ${expenses.length}
Total Expenses: ${money(total)}

Purchase Total: ${money(totalPurchases())}
Sales Total: ${money(totalSales())}`;

}


function generalAnswer() {

    return `🤖 Assistant

म तपाईंको local store data बाट यी कुराहरू हेर्न सक्छु:

• Business Summary
• Low Stock
• Out of Stock
• Customer Due
• Supplier Payable
• Fast Moving Products
• Slow Moving Products
• Expense Summary

माथिका Quick Action प्रयोग गर्नुहोस् वा प्रश्न लेख्नुहोस्।

उदाहरण:
"कुन सामान कम छ?"
"कसबाट पैसा लिन बाँकी छ?"
"Supplier लाई कति तिर्न बाँकी छ?"`;

}


function answerQuestion(question) {

    const q = question.toLowerCase().trim();

    if (!q) {
        return generalAnswer();
    }


    if (
        q.includes("summary") ||
        q.includes("business") ||
        q.includes("व्यवसाय") ||
        q.includes("आजको") ||
        q.includes("कति बिक्री")
    ) {
        return businessSummary();
    }


    if (
        q.includes("low stock") ||
        q.includes("कम stock") ||
        q.includes("कम स्टक") ||
        q.includes("stock कम") ||
        q.includes("सामान कम")
    ) {
        return lowStockAnswer();
    }


    if (
        q.includes("out of stock") ||
        q.includes("stock out") ||
        q.includes("सकियो") ||
        q.includes("स्टक सक")
    ) {
        const products = getOutOfStockProducts();

        if (products.length === 0) {
            return "✅ अहिले कुनै product Out of Stock छैन।";
        }

        return "🚨 Out of Stock\n\n" +
            products
                .map((p, i) =>
                    `${i + 1}. ${p.name}`
                )
                .join("\n");
    }


    if (
        q.includes("customer due") ||
        q.includes("customer") ||
        q.includes("customer को") ||
        q.includes("पैसा लिन")
    ) {
        return customerDueAnswer();
    }


    if (
        q.includes("supplier payable") ||
        q.includes("supplier") ||
        q.includes("supplier लाई") ||
        q.includes("तिर्न")
    ) {
        return supplierPayableAnswer();
    }


    if (
        q.includes("fast") ||
        q.includes("धेरै बिक्री") ||
        q.includes("बढी बिक्री")
    ) {
        return fastMovingAnswer();
    }


    if (
        q.includes("slow") ||
        q.includes("कम बिक्री") ||
        q.includes("कम बिक")
    ) {
        return slowMovingAnswer();
    }


    if (
        q.includes("expense") ||
        q.includes("खर्च")
    ) {
        return expenseAnswer();
    }


    return generalAnswer();

}


function askQuestion() {

    const question = questionInput.value;

    answerBox.textContent =
        answerQuestion(question);

}


askBtn.addEventListener(
    "click",
    askQuestion
);


questionInput.addEventListener(
    "keydown",
    function(event) {

        if (event.key === "Enter") {
            askQuestion();
        }

    }
);


document.querySelectorAll(".quick-btn").forEach(
    button => {

        button.addEventListener(
            "click",
            function() {

                const question =
                    this.dataset.question;

                questionInput.value = question;

                answerBox.textContent =
                    answerQuestion(question);

            }
        );

    }
);


function renderSnapshot() {

    productCount.textContent =
        getProducts().length;

    customerCount.textContent =
        getCustomers().length;

    supplierCount.textContent =
        getSuppliers().length;

    salesCount.textContent =
        getSales().length;

}


function renderAlerts() {

    const lowStock =
        getLowStockProducts();

    const outOfStock =
        getOutOfStockProducts();

    const customerDue =
        totalCustomerDue();

    const supplierPayable =
        totalSupplierPayable();


    let html = "";


    if (outOfStock.length > 0) {

        html += `
            <div class="alert danger">
                🚨 <strong>${outOfStock.length}</strong>
                product(s) Out of Stock छन्।
            </div>
        `;

    }


    if (lowStock.length > 0) {

        html += `
            <div class="alert">
                ⚠️ <strong>${lowStock.length}</strong>
                product(s) Low Stock मा छन्।
            </div>
        `;

    }


    if (customerDue > 0) {

        html += `
            <div class="alert">
                👥 Customer बाट
                <strong>${money(customerDue)}</strong>
                लिन बाँकी छ।
            </div>
        `;

    }


    if (supplierPayable > 0) {

        html += `
            <div class="alert">
                🚚 Supplier लाई
                <strong>${money(supplierPayable)}</strong>
                तिर्न बाँकी छ।
            </div>
        `;

    }


    if (!html) {

        html = `
            <div class="alert good">
                ✅ अहिले कुनै महत्वपूर्ण alert छैन।
            </div>
        `;

    }


    alertsBox.innerHTML = html;

}


renderSnapshot();
renderAlerts();
