const PRODUCT_KEY = "gs_products";
const SALE_KEY = "gs_sales";

document.addEventListener("DOMContentLoaded", function () {
    // ==============================
    // ELEMENTS
    // ==============================

    const saleForm = document.getElementById("saleForm");

    const saleDate = document.getElementById("saleDate");
    const billNumber = document.getElementById("billNumber");
    const saleProduct = document.getElementById("saleProduct");
    const saleQty = document.getElementById("saleQty");
    const saleRate = document.getElementById("saleRate");
    const saleDiscount = document.getElementById("saleDiscount");
    const customerName = document.getElementById("customerName");
    const paymentMethod = document.getElementById("paymentMethod");
    const paidAmount = document.getElementById("paidAmount");
    const saleNote = document.getElementById("saleNote");

    const previewItemAmount = document.getElementById("previewItemAmount");
    const previewDiscount = document.getElementById("previewDiscount");
    const previewTotal = document.getElementById("previewTotal");
    const previewPaid = document.getElementById("previewPaid");
    const previewBalance = document.getElementById("previewBalance");

    const infoProduct = document.getElementById("infoProduct");
    const infoUnit = document.getElementById("infoUnit");
    const infoStock = document.getElementById("infoStock");
    const infoQty = document.getElementById("infoQty");
    const infoPayment = document.getElementById("infoPayment");

    const saleSearch = document.getElementById("saleSearch");
    const salesHistoryBody = document.getElementById("salesHistoryBody");

    const sidebar = document.querySelector(".sidebar");
    const overlay = document.querySelector(".overlay");

    // ==============================
    // STORAGE
    // ==============================

    function getProducts() {
        try {
            return JSON.parse(localStorage.getItem(PRODUCT_KEY)) || [];
        } catch (error) {
            console.error("Product data error:", error);
            return [];
        }
    }

    function saveProducts(products) {
        localStorage.setItem(PRODUCT_KEY, JSON.stringify(products));
    }

    function getSales() {
        try {
            return JSON.parse(localStorage.getItem(SALE_KEY)) || [];
        } catch (error) {
            console.error("Sales data error:", error);
            return [];
        }
    }

    function saveSales(sales) {
        localStorage.setItem(SALE_KEY, JSON.stringify(sales));
    }

    // ==============================
    // HELPERS
    // ==============================

    function money(value) {
        const number = Number(value) || 0;

        return "Rs. " + number.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function numberValue(value) {
        const number = parseFloat(value);

        return Number.isFinite(number) ? number : 0;
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function todayDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function generateBillNumber() {
        const sales = getSales();

        const today = todayDate();

        const todaySales = sales.filter(function (sale) {
            return sale.date === today;
        });

        const sequence = todaySales.length + 1;

        return "SALE-" + today.replace(/-/g, "") + "-" + String(sequence).padStart(3, "0");
    }

    // ==============================
    // INITIAL FORM SETUP
    // ==============================

    function setToday() {
        if (saleDate) {
            saleDate.value = todayDate();
        }
    }

    function setBillNumber() {
        if (billNumber && !billNumber.value.trim()) {
            billNumber.value = generateBillNumber();
        }
    }

    // ==============================
    // LOAD PRODUCTS
    // ==============================

    function loadProducts() {
        if (!saleProduct) return;

        const products = getProducts();

        saleProduct.innerHTML = '<option value="">-- Product Select गर्नुहोस् --</option>';

        products.forEach(function (product) {
            if (product.active === false) return;

            const option = document.createElement("option");

            option.value = product.id;

            option.textContent =
                product.name +
                " | Stock: " +
                (Number(product.stock) || 0) +
                " " +
                (product.unit || "");

            saleProduct.appendChild(option);
        });
    }

    // ==============================
    // SELECTED PRODUCT INFO
    // ==============================

    function updateProductInfo() {
        if (!saleProduct) return;

        const productId = saleProduct.value;
        const products = getProducts();

        const product = products.find(function (item) {
            return item.id === productId;
        });

        if (!product) {
            if (infoProduct) infoProduct.textContent = "-";
            if (infoUnit) infoUnit.textContent = "-";
            if (infoStock) infoStock.textContent = "0";
            if (infoQty) infoQty.textContent = "0";
            return;
        }

        if (infoProduct) {
            infoProduct.textContent = product.name || "-";
        }

        if (infoUnit) {
            infoUnit.textContent = product.unit || "-";
        }

        if (infoStock) {
            infoStock.textContent = Number(product.stock) || 0;
        }

        if (saleRate) {
            saleRate.value = Number(product.salePrice) || 0;
        }

        updateProductQtyInfo();
        calculateSale();
    }

    // ==============================
    // QUANTITY INFO
    // ==============================

    function updateProductQtyInfo() {
        if (!infoQty) return;

        const qty = numberValue(saleQty ? saleQty.value : 0);

        infoQty.textContent = qty;
    }

    // ==============================
    // CALCULATE SALE
    // ==============================

    function calculateSale() {
        const qty = numberValue(saleQty ? saleQty.value : 0);
        const rate = numberValue(saleRate ? saleRate.value : 0);
        const discount = numberValue(saleDiscount ? saleDiscount.value : 0);
        const paid = numberValue(paidAmount ? paidAmount.value : 0);

        const itemAmount = qty * rate;

        const total = Math.max(0, itemAmount - discount);

        const balance = Math.max(0, total - paid);

        if (previewItemAmount) {
            previewItemAmount.textContent = money(itemAmount);
        }

        if (previewDiscount) {
            previewDiscount.textContent = money(discount);
        }

        if (previewTotal) {
            previewTotal.textContent = money(total);
        }

        if (previewPaid) {
            previewPaid.textContent = money(paid);
        }

        if (previewBalance) {
            previewBalance.textContent = money(balance);
        }

        updateProductQtyInfo();

        if (infoPayment && paymentMethod) {
            infoPayment.textContent = paymentMethod.value || "-";
        }

        return {
            qty,
            rate,
            discount,
            paid,
            itemAmount,
            total,
            balance
        };
    }

    // ==============================
    // SALES HISTORY
    // ==============================

    function renderSalesHistory(searchText) {
        if (!salesHistoryBody) return;

        const sales = getSales();

        const search = String(searchText || "")
            .trim()
            .toLowerCase();

        let filteredSales = sales.slice();

        if (search) {
            filteredSales = filteredSales.filter(function (sale) {
                const bill = String(sale.billNumber || "").toLowerCase();
                const customer = String(sale.customerName || "").toLowerCase();
                const product = String(sale.productName || "").toLowerCase();
                const date = String(sale.date || "").toLowerCase();
                const payment = String(sale.paymentMethod || "").toLowerCase();

                return (
                    bill.includes(search) ||
                    customer.includes(search) ||
                    product.includes(search) ||
                    date.includes(search) ||
                    payment.includes(search)
                );
            });
        }

        // Latest sale first
        filteredSales.sort(function (a, b) {
            return String(b.createdAt || "").localeCompare(
                String(a.createdAt || "")
            );
        });

        if (filteredSales.length === 0) {
            salesHistoryBody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align:center; padding:20px;">
                        ${search
                            ? "Search गर्दा कुनै Sales Record भेटिएन।"
                            : "अहिलेसम्म कुनै Sales Record छैन।"}
                    </td>
                </tr>
            `;

            return;
        }

        salesHistoryBody.innerHTML = filteredSales.map(function (sale) {
            return `
                <tr>
                    <td>${escapeHTML(sale.date || "-")}</td>

                    <td>
                        <strong>${escapeHTML(sale.billNumber || "-")}</strong>
                    </td>

                    <td>
                        ${escapeHTML(sale.customerName || "Cash Customer")}
                    </td>

                    <td>
                        ${escapeHTML(sale.productName || "-")}
                    </td>

                    <td>
                        ${Number(sale.qty) || 0}
                        ${escapeHTML(sale.unit || "")}
                    </td>

                    <td>
                        ${money(sale.total)}
                    </td>

                    <td>
                        ${money(sale.paidAmount)}
                    </td>

                    <td>
                        ${money(sale.balance)}
                    </td>

                    <td>
                        ${escapeHTML(sale.paymentMethod || "-")}
                    </td>

                    <td>
                        <button
                            type="button"
                            class="view-sale-bill-btn"
                            data-sale-id="${escapeHTML(sale.id)}"
                        >
                            View Bill
                        </button>
                    </td>
                </tr>
            `;
        }).join("");
    }

    // ==============================
    // VIEW BILL
    // ==============================

    function viewSaleBill(id) {
        const sales = getSales();

        const sale = sales.find(function (item) {
            return item.id === id;
        });

        if (!sale) {
            alert("Sales record भेटिएन।");
            return;
        }

        const billWindow = window.open(
            "",
            "_blank",
            "width=500,height=700"
        );

        if (!billWindow) {
            alert(
                "Bill खोल्न सकेन। Browser मा popup अनुमति दिनुहोस्।"
            );
            return;
        }

        const billHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">

<title>${escapeHTML(sale.billNumber || "Sales Bill")}</title>

<style>
    * {
        box-sizing: border-box;
    }

    body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 20px;
        background: #ffffff;
        color: #111111;
    }

    .receipt {
        max-width: 420px;
        margin: 0 auto;
    }

    h2 {
        text-align: center;
        margin: 0 0 5px;
    }

    .subtitle {
        text-align: center;
        margin-bottom: 20px;
        color: #555;
    }

    .line {
        border-top: 1px dashed #777;
        margin: 12px 0;
    }

    .row {
        display: flex;
        justify-content: space-between;
        gap: 15px;
        margin: 7px 0;
    }

    .label {
        color: #555;
    }

    .value {
        text-align: right;
        font-weight: 600;
    }

    .total {
        font-size: 18px;
        font-weight: bold;
    }

    .actions {
        text-align: center;
        margin-top: 25px;
    }

    button {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        background: #111;
        color: #fff;
        font-size: 15px;
    }

    @media print {
        .actions {
            display: none;
        }

        body {
            padding: 0;
        }
    }
</style>
</head>

<body>

<div class="receipt">

    <h2>GENERAL STORE</h2>

    <div class="subtitle">
        Sales Receipt
    </div>

    <div class="line"></div>

    <div class="row">
        <span class="label">Bill No.</span>
        <span class="value">
            ${escapeHTML(sale.billNumber || "-")}
        </span>
    </div>

    <div class="row">
        <span class="label">Date</span>
        <span class="value">
            ${escapeHTML(sale.date || "-")}
        </span>
    </div>

    <div class="row">
        <span class="label">Customer</span>
        <span class="value">
            ${escapeHTML(sale.customerName || "Cash Customer")}
        </span>
    </div>

    <div class="line"></div>

    <div class="row">
        <span class="label">Product</span>
        <span class="value">
            ${escapeHTML(sale.productName || "-")}
        </span>
    </div>

    <div class="row">
        <span class="label">Quantity</span>
        <span class="value">
            ${Number(sale.qty) || 0}
            ${escapeHTML(sale.unit || "")}
        </span>
    </div>

    <div class="row">
        <span class="label">Rate</span>
        <span class="value">
            ${money(sale.rate)}
        </span>
    </div>

    <div class="row">
        <span class="label">Amount</span>
        <span class="value">
            ${money(sale.itemAmount)}
        </span>
    </div>

    <div class="row">
        <span class="label">Discount</span>
        <span class="value">
            ${money(sale.discount)}
        </span>
    </div>

    <div class="line"></div>

    <div class="row total">
        <span>Total</span>
        <span>${money(sale.total)}</span>
    </div>

    <div class="row">
        <span class="label">Paid</span>
        <span class="value">
            ${money(sale.paidAmount)}
        </span>
    </div>

    <div class="row">
        <span class="label">Balance</span>
        <span class="value">
            ${money(sale.balance)}
        </span>
    </div>

    <div class="row">
        <span class="label">Payment</span>
        <span class="value">
            ${escapeHTML(sale.paymentMethod || "-")}
        </span>
    </div>

    ${
        sale.note
            ? `
            <div class="line"></div>

            <div>
                <strong>Note:</strong>
                ${escapeHTML(sale.note)}
            </div>
            `
            : ""
    }

    <div class="line"></div>

    <div style="text-align:center;">
        Thank you for your purchase.
    </div>

    <div class="actions">
        <button onclick="window.print()">
            Print Bill
        </button>
    </div>

</div>

</body>
</html>
        `;

        billWindow.document.open();
        billWindow.document.write(billHTML);
        billWindow.document.close();
    }

    // Make available if HTML/other code needs it
    window.viewSaleBill = viewSaleBill;

    // ==============================
    // SAVE SALE
    // ==============================

    function saveSale() {
        if (!saleForm) return;

        const productId = saleProduct ? saleProduct.value : "";

        if (!productId) {
            alert("कृपया Product Select गर्नुहोस्।");
            return;
        }

        const products = getProducts();

        const productIndex = products.findIndex(function (product) {
            return product.id === productId;
        });

        if (productIndex === -1) {
            alert("Selected Product भेटिएन।");
            return;
        }

        const product = products[productIndex];

        const qty = numberValue(saleQty ? saleQty.value : 0);
        const rate = numberValue(saleRate ? saleRate.value : 0);
        const discount = numberValue(
            saleDiscount ? saleDiscount.value : 0
        );
        const paid = numberValue(
            paidAmount ? paidAmount.value : 0
        );

        if (qty <= 0) {
            alert("Quantity 0 भन्दा ठूलो हुनुपर्छ।");
            return;
        }

        const currentStock = numberValue(product.stock);

        if (qty > currentStock) {
            alert(
                "पर्याप्त Stock छैन।\n\n" +
                "Available Stock: " +
                currentStock +
                "\n" +
                "Requested Qty: " +
                qty
            );

            return;
        }

        if (rate <= 0) {
            alert("Sale Rate सही राख्नुहोस्।");
            return;
        }

        const itemAmount = qty * rate;

        if (discount > itemAmount) {
            alert("Discount Amount भन्दा बढी हुन सक्दैन।");
            return;
        }

        const total = Math.max(
            0,
            itemAmount - discount
        );

        if (paid > total) {
            alert("Paid Amount Total भन्दा बढी हुन सक्दैन।");
            return;
        }

        const balance = total - paid;

        const sales = getSales();

        const sale = {
            id:
                "SALE-" +
                Date.now() +
                "-" +
                Math.floor(Math.random() * 10000),

            date: saleDate && saleDate.value
                ? saleDate.value
                : todayDate(),

            billNumber:
                billNumber && billNumber.value.trim()
                    ? billNumber.value.trim()
                    : generateBillNumber(),

            customerName:
                customerName && customerName.value.trim()
                    ? customerName.value.trim()
                    : "Cash Customer",

            productId: product.id,

            productName: product.name || "",

            unit: product.unit || "",

            qty: qty,

            rate: rate,

            discount: discount,

            itemAmount: itemAmount,

            total: total,

            paidAmount: paid,

            balance: balance,

            paymentMethod:
                paymentMethod && paymentMethod.value
                    ? paymentMethod.value
                    : "CASH",

            note:
                saleNote && saleNote.value.trim()
                    ? saleNote.value.trim()
                    : "",

            createdAt: new Date().toISOString()
        };

        // Add sale record
        sales.push(sale);

        // Reduce stock
        products[productIndex].stock =
            Math.max(0, currentStock - qty);

        // Keep latest sale price
        products[productIndex].salePrice = rate;

        // Save both
        saveSales(sales);
        saveProducts(products);

        // Refresh UI
        renderSalesHistory(
            saleSearch ? saleSearch.value : ""
        );

        alert(
            "Sale सफल भयो।\n\n" +
            "Bill No: " +
            sale.billNumber
        );

        // Reset form
        saleForm.reset();

        setToday();
        setBillNumber();
        loadProducts();

        if (infoProduct) infoProduct.textContent = "-";
        if (infoUnit) infoUnit.textContent = "-";
        if (infoStock) infoStock.textContent = "0";
        if (infoQty) infoQty.textContent = "0";

        calculateSale();
    }

    // ==============================
    // FORM EVENTS
    // ==============================

    if (saleProduct) {
        saleProduct.addEventListener(
            "change",
            updateProductInfo
        );
    }

    if (saleQty) {
        saleQty.addEventListener(
            "input",
            calculateSale
        );
    }

    if (saleRate) {
        saleRate.addEventListener(
            "input",
            calculateSale
        );
    }

    if (saleDiscount) {
        saleDiscount.addEventListener(
            "input",
            calculateSale
        );
    }

    if (paidAmount) {
        paidAmount.addEventListener(
            "input",
            calculateSale
        );
    }

    if (paymentMethod) {
        paymentMethod.addEventListener(
            "change",
            calculateSale
        );
    }

    // ==============================
    // SALE FORM SUBMIT
    // ==============================

    if (saleForm) {
        saleForm.addEventListener(
            "submit",
            function (event) {
                event.preventDefault();
                saveSale();
            }
        );
    }

    // ==============================
    // SEARCH
    // ==============================

    if (saleSearch) {
        saleSearch.addEventListener(
            "input",
            function () {
                renderSalesHistory(
                    saleSearch.value
                );
            }
        );
    }

    // ==============================
    // VIEW BILL BUTTON
    // ==============================

    if (salesHistoryBody) {
        salesHistoryBody.addEventListener(
            "click",
            function (event) {
                const button =
                    event.target.closest(
                        ".view-sale-bill-btn"
                    );

                if (!button) return;

                const saleId =
                    button.getAttribute(
                        "data-sale-id"
                    );

                if (saleId) {
                    viewSaleBill(saleId);
                }
            }
        );
    }

    // ==============================
    // MOBILE SIDEBAR
    // ==============================

    const menuButton =
        document.querySelector(
            ".menu-btn, .mobile-menu-btn, .menu-toggle"
        );

    if (menuButton && sidebar) {
        menuButton.addEventListener(
            "click",
            function () {
                sidebar.classList.toggle("open");

                if (overlay) {
                    overlay.classList.toggle("show");
                }
            }
        );
    }

    if (overlay && sidebar) {
        overlay.addEventListener(
            "click",
            function () {
                sidebar.classList.remove("open");
                overlay.classList.remove("show");
            }
        );
    }

    // ==============================
    // INITIALIZE
    // ==============================

    setToday();
    setBillNumber();
    loadProducts();
    renderSalesHistory();
    calculateSale();
});
