/* =====================================================
   GENERAL STORE MANAGEMENT SYSTEM
   PURCHASE MODULE
   ===================================================== */

const PURCHASE_KEY = "gs_purchases";
const PRODUCT_KEY = "gs_products";


/* =====================================================
   DOM
   ===================================================== */

const newPurchaseBtn =
    document.getElementById("newPurchaseBtn");

const purchaseModal =
    document.getElementById("purchaseModal");

const closePurchaseModal =
    document.getElementById("closePurchaseModal");

const cancelPurchaseBtn =
    document.getElementById("cancelPurchaseBtn");

const purchaseForm =
    document.getElementById("purchaseForm");

const purchaseTableBody =
    document.getElementById("purchaseTableBody");

const purchaseSearch =
    document.getElementById("purchaseSearch");

const purchaseMenuBtn =
    document.getElementById("purchaseMenuBtn");


/* SUMMARY */

const totalPurchases =
    document.getElementById("totalPurchases");

const purchaseValue =
    document.getElementById("purchaseValue");

const paidValue =
    document.getElementById("paidValue");

const payableValue =
    document.getElementById("payableValue");


/* FORM */

const purchaseDate =
    document.getElementById("purchaseDate");

const billNumber =
    document.getElementById("billNumber");

const supplierName =
    document.getElementById("supplierName");

const supplierTaxType =
    document.getElementById("supplierTaxType");

const supplierTaxNumber =
    document.getElementById("supplierTaxNumber");

const purchaseProduct =
    document.getElementById("purchaseProduct");

const purchaseQty =
    document.getElementById("purchaseQty");

const purchaseRate =
    document.getElementById("purchaseRate");

const freeQty =
    document.getElementById("freeQty");

const purchaseDiscount =
    document.getElementById("purchaseDiscount");

const purchaseVat =
    document.getElementById("purchaseVat");

const paymentMethod =
    document.getElementById("paymentMethod");

const paidAmount =
    document.getElementById("paidAmount");

const purchaseNote =
    document.getElementById("purchaseNote");


/* PREVIEW */

const previewItemAmount =
    document.getElementById("previewItemAmount");

const previewDiscount =
    document.getElementById("previewDiscount");

const previewVat =
    document.getElementById("previewVat");

const previewTotal =
    document.getElementById("previewTotal");

const previewBalance =
    document.getElementById("previewBalance");


/* =====================================================
   STORAGE
   ===================================================== */

function getPurchases() {

    try {

        const data =
            localStorage.getItem(PURCHASE_KEY);

        if (!data) {
            return [];
        }

        const purchases =
            JSON.parse(data);

        return Array.isArray(purchases)
            ? purchases
            : [];

    } catch (error) {

        console.error(
            "Purchase read error:",
            error
        );

        return [];
    }
}


function savePurchases(purchases) {

    localStorage.setItem(
        PURCHASE_KEY,
        JSON.stringify(purchases)
    );

}


/* =====================================================
   PRODUCTS
   ===================================================== */

function getProducts() {

    try {

        const data =
            localStorage.getItem(PRODUCT_KEY);

        if (!data) {
            return [];
        }

        const products =
            JSON.parse(data);

        return Array.isArray(products)
            ? products
            : [];

    } catch (error) {

        console.error(
            "Product read error:",
            error
        );

        return [];
    }

}


function saveProducts(products) {

    localStorage.setItem(
        PRODUCT_KEY,
        JSON.stringify(products)
    );

}


/* =====================================================
   MONEY
   ===================================================== */

function money(value) {

    return (
        Number(value) || 0
    ).toLocaleString(
        "en-IN",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    );

}


/* =====================================================
   TODAY
   ===================================================== */

function setToday() {

    if (!purchaseDate) {
        return;
    }

    const today =
        new Date();

    const year =
        today.getFullYear();

    const month =
        String(
            today.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            today.getDate()
        ).padStart(2, "0");

    purchaseDate.value =
        `${year}-${month}-${day}`;

}


/* =====================================================
   PRODUCT DROPDOWN
   ===================================================== */

function loadProducts() {

    if (!purchaseProduct) {
        return;
    }


    const products =
        getProducts();


    purchaseProduct.innerHTML = "";


    if (products.length === 0) {

        const option =
            document.createElement("option");

        option.value = "";

        option.textContent =
            "पहिले Inventory मा Product बनाउनुहोस्";

        purchaseProduct.appendChild(
            option
        );

        return;
    }


    const defaultOption =
        document.createElement("option");

    defaultOption.value = "";

    defaultOption.textContent =
        "Product छान्नुहोस्";

    purchaseProduct.appendChild(
        defaultOption
    );


    products
        .filter(function (product) {

            return product.active !== false;

        })
        .forEach(function (product) {

            const option =
                document.createElement("option");

            option.value =
                product.id;

            option.textContent =
                product.name +
                " (" +
                product.unit +
                ")";

            option.dataset.rate =
                product.purchasePrice || 0;

            purchaseProduct.appendChild(
                option
            );

        });

}


/* =====================================================
   AUTO RATE
   ===================================================== */

function setProductRate() {

    if (!purchaseProduct) {
        return;
    }


    const selected =
        purchaseProduct.options[
            purchaseProduct.selectedIndex
        ];


    if (
        selected &&
        selected.dataset.rate
    ) {

        purchaseRate.value =
            selected.dataset.rate;

    }


    calculatePreview();

}


/* =====================================================
   CALCULATE
   ===================================================== */

function calculatePreview() {

    const qty =
        Number(purchaseQty?.value) || 0;

    const rate =
        Number(purchaseRate?.value) || 0;

    const discount =
        Number(purchaseDiscount?.value) || 0;

    const vat =
        Number(purchaseVat?.value) || 0;

    const paid =
        Number(paidAmount?.value) || 0;


    const itemAmount =
        qty * rate;


    const subtotal =
        Math.max(
            0,
            itemAmount - discount
        );


    const total =
        subtotal + vat;


    const balance =
        Math.max(
            0,
            total - paid
        );


    if (previewItemAmount) {

        previewItemAmount.textContent =
            "Rs. " +
            money(itemAmount);

    }


    if (previewDiscount) {

        previewDiscount.textContent =
            "Rs. " +
            money(discount);

    }


    if (previewVat) {

        previewVat.textContent =
            "Rs. " +
            money(vat);

    }


    if (previewTotal) {

        previewTotal.textContent =
            "Rs. " +
            money(total);

    }


    if (previewBalance) {

        previewBalance.textContent =
            "Rs. " +
            money(balance);

    }


    return {
        qty,
        rate,
        itemAmount,
        discount,
        vat,
        total,
        paid,
        balance
    };

}


/* =====================================================
   UPDATE SUMMARY
   ===================================================== */

function updateSummary() {

    const purchases =
        getPurchases();


    let total =
        0;

    let paid =
        0;

    let payable =
        0;


    purchases.forEach(function (purchase) {

        total +=
            Number(purchase.total) || 0;

        paid +=
            Number(purchase.paidAmount) || 0;

        payable +=
            Number(purchase.balance) || 0;

    });


    if (totalPurchases) {

        totalPurchases.textContent =
            purchases.length;

    }


    if (purchaseValue) {

        purchaseValue.textContent =
            money(total);

    }


    if (paidValue) {

        paidValue.textContent =
            money(paid);

    }


    if (payableValue) {

        payableValue.textContent =
            money(payable);

    }

}


/* =====================================================
   RENDER PURCHASES
   ===================================================== */

function renderPurchases() {

    if (!purchaseTableBody) {
        return;
    }


    const purchases =
        getPurchases();


    updateSummary();


    const search =
        (
            purchaseSearch?.value ||
            ""
        )
        .trim()
        .toLowerCase();


    const filtered =
        purchases.filter(
            function (purchase) {

                const text = [

                    purchase.billNumber,
                    purchase.supplierName,
                    purchase.supplierTaxType

                ]
                    .join(" ")
                    .toLowerCase();


                return (
                    !search ||
                    text.includes(search)
                );

            }
        );


    if (filtered.length === 0) {

        purchaseTableBody.innerHTML = `

            <tr>

                <td
                    colspan="8"
                    class="empty-inventory"
                >

                    <div>📦</div>

                    <strong>
                        ${
                            purchases.length === 0
                                ? "अहिलेसम्म Purchase छैन"
                                : "Purchase भेटिएन"
                        }
                    </strong>

                    <span>
                        ${
                            purchases.length === 0
                                ? 'सुरु गर्न "New Purchase" थिच्नुहोस्।'
                                : "Search परिवर्तन गर्नुहोस्।"
                        }
                    </span>

                </td>

            </tr>

        `;

        return;
    }


    purchaseTableBody.innerHTML =
        filtered.map(function (purchase) {

            return `

                <tr>

                    <td>
                        ${purchase.date}
                    </td>

                    <td>
                        ${purchase.billNumber}
                    </td>

                    <td>
                        ${purchase.supplierName}
                    </td>

                    <td>
                        ${purchase.supplierTaxType}
                    </td>

                    <td>
                        ${purchase.qty}
                    </td>

                    <td>
                        Rs. ${money(purchase.total)}
                    </td>

                    <td>
                        Rs. ${money(purchase.paidAmount)}
                    </td>

                    <td>
                        Rs. ${money(purchase.balance)}
                    </td>

                </tr>

            `;

        }).join("");

}


/* =====================================================
   OPEN MODAL
   ===================================================== */

function openPurchaseModal() {

    if (!purchaseModal) {
        return;
    }


    loadProducts();

    setToday();


    if (purchaseForm) {
        purchaseForm.reset();
    }


    setToday();

    loadProducts();


    purchaseModal.classList.add(
        "show"
    );


    calculatePreview();

}


/* =====================================================
   CLOSE MODAL
   ===================================================== */

function closePurchaseModalFunc() {

    if (!purchaseModal) {
        return;
    }


    purchaseModal.classList.remove(
        "show"
    );


    if (purchaseForm) {
        purchaseForm.reset();
    }


    setToday();

    calculatePreview();

}


/* =====================================================
   SAVE PURCHASE
   ===================================================== */

function savePurchase(event) {

    event.preventDefault();


    const selectedProductId =
        purchaseProduct.value;


    const products =
        getProducts();


    const product =
        products.find(
            function (item) {

                return (
                    item.id ===
                    selectedProductId
                );

            }
        );


    if (!product) {

        alert(
            "Product select गर्नुहोस्।"
        );

        return;
    }


    const values =
        calculatePreview();


    if (
        !purchaseDate.value ||
        !billNumber.value.trim() ||
        !supplierName.value.trim()
    ) {

        alert(
            "Purchase Date, Bill No. र Supplier Name भर्नुहोस्।"
        );

        return;
    }


    if (
        values.qty <= 0 ||
        values.rate < 0
    ) {

        alert(
            "Quantity र Purchase Rate सही राख्नुहोस्।"
        );

        return;
    }


    if (
        values.paid > values.total
    ) {

        alert(
            "Paid Amount कुल रकमभन्दा बढी हुन सक्दैन।"
        );

        return;
    }


    const extraQty =
        Number(freeQty.value) || 0;


    /*
     * Supplier extra/free goods:
     *
     * Paid cost ÷ total received quantity
     *
     * Example:
     * 10 × 1000 = 10000
     * + 1 free
     * Total received = 11
     * Effective cost = 909.09
     */

    const totalReceivedQty =
        values.qty + extraQty;


    const effectiveCost =
        totalReceivedQty > 0
            ? (
                values.qty *
                values.rate -
                values.discount
            ) /
            totalReceivedQty
            : 0;


    /* CREATE PURCHASE */

    const purchase = {

        id:
            "PUR-" +
            Date.now() +
            "-" +
            Math.floor(
                Math.random() * 10000
            ),

        date:
            purchaseDate.value,

        billNumber:
            billNumber.value.trim(),

        supplierName:
            supplierName.value.trim(),

        supplierTaxType:
            supplierTaxType.value,

        supplierTaxNumber:
            supplierTaxNumber.value.trim(),

        productId:
            product.id,

        productName:
            product.name,

        unit:
            product.unit,

        qty:
            values.qty,

        freeQty:
            extraQty,

        totalReceivedQty:
            totalReceivedQty,

        rate:
            values.rate,

        discount:
            values.discount,

        vat:
            values.vat,

        total:
            values.total,

        paidAmount:
            values.paid,

        balance:
            values.balance,

        paymentMethod:
            paymentMethod.value,

        effectiveCost:
            effectiveCost,

        note:
            purchaseNote.value.trim(),

        createdAt:
            new Date().toISOString()

    };


    /* SAVE PURCHASE */

    const purchases =
        getPurchases();


    purchases.unshift(
        purchase
    );


    savePurchases(
        purchases
    );


    /*
     * UPDATE PRODUCT STOCK
     */

    product.stock =
        (
            Number(product.stock) || 0
        ) +
        totalReceivedQty;


    /*
     * Latest purchase rate
     * inventory product मा पनि update गर्ने।
     */

    product.purchasePrice =
        values.rate;


    saveProducts(
        products
    );


    /* CLOSE */

    closePurchaseModalFunc();


    /* REFRESH */

    renderPurchases();


    /* SUCCESS */

    alert(
        "Purchase successfully save भयो।\n\n" +
        "Stock पनि update भयो।"
    );


    console.log(
        "Purchase saved:",
        purchase
    );

}


/* =====================================================
   EVENTS
   ===================================================== */

function setupEvents() {


    if (newPurchaseBtn) {

        newPurchaseBtn.addEventListener(
            "click",
            openPurchaseModal
        );

    }


    if (closePurchaseModal) {

        closePurchaseModal.addEventListener(
            "click",
            closePurchaseModalFunc
        );

    }


    if (cancelPurchaseBtn) {

        cancelPurchaseBtn.addEventListener(
            "click",
            closePurchaseModalFunc
        );

    }


    if (purchaseForm) {

        purchaseForm.addEventListener(
            "submit",
            savePurchase
        );

    }


    if (purchaseModal) {

        purchaseModal.addEventListener(
            "click",
            function (event) {

                if (
                    event.target ===
                    purchaseModal
                ) {

                    closePurchaseModalFunc();

                }

            }
        );

    }


    if (purchaseProduct) {

        purchaseProduct.addEventListener(
            "change",
            setProductRate
        );

    }


    [
        purchaseQty,
        purchaseRate,
        purchaseDiscount,
        purchaseVat,
        paidAmount,
        freeQty

    ].forEach(function (input) {

        if (input) {

            input.addEventListener(
                "input",
                calculatePreview
            );

        }

    });


    if (purchaseSearch) {

        purchaseSearch.addEventListener(
            "input",
            renderPurchases
        );

    }

}


/* =====================================================
   MOBILE SIDEBAR
   ===================================================== */

function setupMobileSidebar() {

    const sidebar =
        document.querySelector(
            ".sidebar"
        );


    if (
        !sidebar ||
        !purchaseMenuBtn
    ) {
        return;
    }


    let overlay =
        document.querySelector(
            ".mobile-overlay"
        );


    if (!overlay) {

        overlay =
            document.createElement(
                "div"
            );

        overlay.className =
            "mobile-overlay";

        document.body.appendChild(
            overlay
        );

    }


    purchaseMenuBtn.addEventListener(
        "click",
        function () {

            sidebar.classList.toggle(
                "open"
            );

            overlay.classList.toggle(
                "show"
            );

        }
    );


    overlay.addEventListener(
        "click",
        function () {

            sidebar.classList.remove(
                "open"
            );

            overlay.classList.remove(
                "show"
            );

        }
    );

}


/* =====================================================
   SIDEBAR LINKS
   ===================================================== */

function setupSidebarLinks() {

    const menuItems =
        document.querySelectorAll(
            ".sidebar .menu-item"
        );


    menuItems.forEach(
        function (item) {

            item.addEventListener(
                "click",
                function (event) {

                    const href =
                        this.getAttribute(
                            "href"
                        );


                    if (
                        href &&
                        href !== "#" &&
                        href !== ""
                    ) {

                        return;

                    }


                    event.preventDefault();

                }
            );

        }
    );

}


/* =====================================================
   INIT
   ===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        setupEvents();

        setupMobileSidebar();

        setupSidebarLinks();

        renderPurchases();

        console.log(
            "Purchase module loaded successfully."
        );

    }
);
