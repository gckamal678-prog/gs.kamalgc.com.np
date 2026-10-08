const PRODUCT_KEY = "gs_products";
const SALE_KEY = "gs_sales";

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

const stockInfo = document.getElementById("stockInfo");

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

const salesHistoryBody =
document.getElementById("salesHistoryBody");

const saleSearch =
document.getElementById("saleSearch");

function getProducts() {
try {
return JSON.parse(
localStorage.getItem(PRODUCT_KEY)
) || [];
} catch (error) {
console.error(
"Unable to read products:",
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

function getSales() {
try {
return JSON.parse(
localStorage.getItem(SALE_KEY)
) || [];
} catch (error) {
console.error(
"Unable to read sales:",
error
);
return [];
}
}

function saveSales(sales) {
localStorage.setItem(
SALE_KEY,
JSON.stringify(sales)
);
}

function money(value) {
return "Rs. " +
Number(value || 0).toFixed(2);
}

function escapeHTML(value) {

return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}

function today() {

const date = new Date();

const year =
    date.getFullYear();

const month =
    String(
        date.getMonth() + 1
    ).padStart(2, "0");

const day =
    String(
        date.getDate()
    ).padStart(2, "0");

return `${year}-${month}-${day}`;

}

function generateBillNumber() {

const now = new Date();

const year =
    now.getFullYear();

const month =
    String(
        now.getMonth() + 1
    ).padStart(2, "0");

const day =
    String(
        now.getDate()
    ).padStart(2, "0");

const time =
    String(
        now.getHours()
    ).padStart(2, "0")
    +
    String(
        now.getMinutes()
    ).padStart(2, "0")
    +
    String(
        now.getSeconds()
    ).padStart(2, "0");

return `SALE-${year}${month}${day}-${time}`;

}

function loadProducts() {

const products =
    getProducts();

saleProduct.innerHTML =
    '<option value="">Select Product</option>';

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
            `${product.name} | Stock: ${Number(product.stock || 0)} ${product.unit || ""}`;

        option.dataset.rate =
            product.salePrice || 0;

        saleProduct.appendChild(
            option
        );
    });

updateProductInfo();

}

function getSelectedProduct() {

const productId =
    saleProduct.value;

if (!productId) {
    return null;
}

const products =
    getProducts();

return products.find(
    function (product) {
        return product.id === productId;
    }
) || null;

}

function updateProductInfo() {

const product =
    getSelectedProduct();

if (!product) {

    stockInfo.textContent =
        "Available stock: -";

    infoProduct.textContent =
        "-";

    infoUnit.textContent =
        "-";

    infoStock.textContent =
        "-";

    infoQty.textContent =
        "0";

    return;
}

const stock =
    Number(product.stock || 0);

stockInfo.textContent =
    `Available stock: ${stock} ${product.unit || ""}`;

infoProduct.textContent =
    product.name || "-";

infoUnit.textContent =
    product.unit || "-";

infoStock.textContent =
    `${stock} ${product.unit || ""}`;

saleRate.value =
    Number(product.salePrice || 0);

calculatePreview();

}

function calculatePreview() {

const qty =
    Number(
        saleQty.value || 0
    );

const rate =
    Number(
        saleRate.value || 0
    );

const discount =
    Number(
        saleDiscount.value || 0
    );

const paid =
    Number(
        paidAmount.value || 0
    );

const itemAmount =
    qty * rate;

const total =
    Math.max(
        itemAmount - discount,
        0
    );

const balance =
    Math.max(
        total - paid,
        0
    );

previewItemAmount.textContent =
    money(itemAmount);

previewDiscount.textContent =
    money(discount);

previewTotal.textContent =
    money(total);

previewPaid.textContent =
    money(paid);

previewBalance.textContent =
    money(balance);

infoQty.textContent =
    qty;

infoPayment.textContent =
    paymentMethod.value;

}

function clearForm() {

saleForm.reset();

saleDate.value =
    today();

billNumber.value =
    generateBillNumber();

paidAmount.value =
    "0";

saleDiscount.value =
    "0";

loadProducts();

calculatePreview();

}

function renderSalesHistory() {

const search =
    (
        saleSearch.value || ""
    )
    .trim()
    .toLowerCase();

let sales =
    getSales();

sales.sort(
    function (a, b) {

        return String(
            b.createdAt || ""
        ).localeCompare(
            String(
                a.createdAt || ""
            )
        );
    }
);

if (search) {

    sales =
        sales.filter(
            function (sale) {

                const text =
                    [
                        sale.billNumber,
                        sale.customerName,
                        sale.productName,
                        sale.paymentMethod,
                        sale.date
                    ]
                    .join(" ")
                    .toLowerCase();

                return text.includes(
                    search
                );
            }
        );
}

if (!sales.length) {

    salesHistoryBody.innerHTML =
        `
        <tr>
            <td
                colspan="10"
                class="empty-state"
            >
                No sales found
            </td>
        </tr>
        `;

    return;
}

salesHistoryBody.innerHTML =
    sales.map(
        function (sale) {

            return `
            <tr>

                <td>
                    ${escapeHTML(
                        sale.date || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        sale.billNumber || "-"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        sale.customerName ||
                        "Walk-in Customer"
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        sale.productName || "-"
                    )}
                </td>

                <td>
                    ${Number(
                        sale.qty || 0
                    )}
                    ${escapeHTML(
                        sale.unit || ""
                    )}
                </td>

                <td>
                    ${money(
                        sale.total
                    )}
                </td>

                <td>
                    ${money(
                        sale.paidAmount
                    )}
                </td>

                <td>
                    ${money(
                        sale.balance
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        sale.paymentMethod ||
                        "-"
                    )}
                </td>

                <td>

                    <button
                        type="button"
                        class="secondary-btn"
                        onclick="viewSaleBill('${sale.id}')"
                    >
                        View Bill
                    </button>

                </td>

            </tr>
            `;
        }
    )
    .join("");

}

function findSaleById(id) {

const sales =
    getSales();

return sales.find(
    function (sale) {
        return sale.id === id;
    }
) || null;

}

function viewSaleBill(id) {

const sale =
    findSaleById(id);

if (!sale) {

    alert(
        "Sale record भेटिएन।"
    );

    return;
}

const billWindow =
    window.open(
        "",
        "_blank",
        "width=500,height=700"
    );

if (!billWindow) {

    alert(
        "Bill खोल्न browser popup अनुमति दिनुहोस्।"
    );

    return;
}

const html = `

<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta
name="viewport"
content="width=device-width, initial-scale=1.0"

«»

<title>
    ${escapeHTML(
        sale.billNumber || "Sales Bill"
    )}
</title><style>

    body {
        font-family:
            Arial,
            sans-serif;

        margin: 0;
        padding: 20px;

        background: #fff;

        color: #222;
    }

    .bill {
        max-width: 420px;
        margin: auto;
    }

    .center {
        text-align: center;
    }

    h1 {
        margin:
            0 0 5px;
    }

    p {
        margin:
            4px 0;
    }

    hr {
        border: 0;
        border-top:
            1px dashed #999;

        margin:
            15px 0;
    }

    table {
        width: 100%;
        border-collapse:
            collapse;
    }

    td {
        padding:
            7px 0;

        vertical-align:
            top;
    }

    .right {
        text-align:
            right;
    }

    .total {
        font-size:
            18px;

        font-weight:
            bold;
    }

    .actions {
        margin-top:
            20px;

        text-align:
            center;
    }

    button {
        padding:
            10px 18px;

        border: 0;

        border-radius:
            6px;

        cursor: pointer;
    }

    @media print {

        .actions {
            display: none;
        }

        body {
            padding: 0;
        }

    }

</style></head><body><div class="bill"><div class="center">

    <h1>
        GENERAL STORE
    </h1>

    <p>
        Sales Receipt
    </p>

</div>

<hr>

<table>

    <tr>
        <td>Bill No.</td>
        <td class="right">
            ${escapeHTML(
                sale.billNumber || "-"
            )}
        </td>
    </tr>

    <tr>
        <td>Date</td>
        <td class="right">
            ${escapeHTML(
                sale.date || "-"
            )}
        </td>
    </tr>

    <tr>
        <td>Customer</td>
        <td class="right">
            ${escapeHTML(
                sale.customerName ||
                "Walk-in Customer"
            )}
        </td>
    </tr>

</table>

<hr>

<table>

    <tr>

        <td>
            ${escapeHTML(
                sale.productName || "-"
            )}
            <br>
            ${Number(
                sale.qty || 0
            )}
            ${escapeHTML(
                sale.unit || ""
            )}
            ×
            ${money(
                sale.rate
            )}
        </td>

        <td class="right">
            ${money(
                sale.itemAmount
            )}
        </td>

    </tr>

</table>

<hr>

<table>

    <tr>

        <td>
            Discount
        </td>

        <td class="right">
            ${money(
                sale.discount
            )}
        </td>

    </tr>

    <tr class="total">

        <td>
            TOTAL
        </td>

        <td class="right">
            ${money(
                sale.total
            )}
        </td>

    </tr>

    <tr>

        <td>
            Paid
        </td>

        <td class="right">
            ${money(
                sale.paidAmount
            )}
        </td>

    </tr>

    <tr>

        <td>
            Balance
        </td>

        <td class="right">
            ${money(
                sale.balance
            )}
        </td>

    </tr>

    <tr>

        <td>
            Payment
        </td>

        <td class="right">
            ${escapeHTML(
                sale.paymentMethod ||
                "-"
            )}
        </td>

    </tr>

</table>

${
    sale.note
    ? `
    <hr>

    <p>
        <strong>Note:</strong>
        ${escapeHTML(
            sale.note
        )}
    </p>
    `
    : ""
}

<hr>

<div class="center">

    <p>
        Thank you!
    </p>

</div>

<div class="actions">

    <button
        onclick="window.print()"
    >
        🖨️ Print Bill
    </button>

</div>

</div></body></html>
`;billWindow.document.open();

billWindow.document.write(
    html
);

billWindow.document.close();

}

saleProduct.addEventListener(
"change",
function () {

    updateProductInfo();

}

);

saleQty.addEventListener(
"input",
calculatePreview
);

saleRate.addEventListener(
"input",
calculatePreview
);

saleDiscount.addEventListener(
"input",
calculatePreview
);

paidAmount.addEventListener(
"input",
calculatePreview
);

paymentMethod.addEventListener(
"change",
calculatePreview
);

saleSearch.addEventListener(
"input",
renderSalesHistory
);

saleForm.addEventListener(
"reset",
function () {

    setTimeout(
        function () {

            saleDate.value =
                today();

            billNumber.value =
                generateBillNumber();

            paidAmount.value =
                "0";

            saleDiscount.value =
                "0";

            loadProducts();

            calculatePreview();

        },
        0
    );
}

);

saleForm.addEventListener(
"submit",
function (event) {

    event.preventDefault();

    const product =
        getSelectedProduct();

    if (!product) {

        alert(
            "कृपया Product चयन गर्नुहोस्।"
        );

        return;
    }

    const qty =
        Number(
            saleQty.value || 0
        );

    const rate =
        Number(
            saleRate.value || 0
        );

    const discount =
        Number(
            saleDiscount.value || 0
        );

    const paid =
        Number(
            paidAmount.value || 0
        );

    const stock =
        Number(
            product.stock || 0
        );

    if (qty <= 0) {

        alert(
            "कृपया Sale Quantity राख्नुहोस्।"
        );

        return;
    }

    if (rate < 0) {

        alert(
            "Sale Rate गलत छ।"
        );

        return;
    }

    if (discount < 0) {

        alert(
            "Discount गलत छ।"
        );

        return;
    }

    if (discount > qty * rate) {

        alert(
            "Discount item amount भन्दा बढी हुन सक्दैन।"
        );

        return;
    }

    if (qty > stock) {

        alert(
            `पर्याप्त stock छैन। Available stock: ${stock}`
        );

        return;
    }

    const itemAmount =
        qty * rate;

    const total =
        Math.max(
            itemAmount - discount,
            0
        );

    if (paid < 0) {

        alert(
            "Paid Amount गलत छ।"
        );

        return;
    }

    if (paid > total) {

        alert(
            "Paid Amount total भन्दा बढी हुन सक्दैन।"
        );

        return;
    }

    const balance =
        total - paid;

    const products =
        getProducts();

    const productIndex =
        products.findIndex(
            function (item) {

                return item.id ===
                    product.id;

            }
        );

    if (productIndex === -1) {

        alert(
            "Product भेटिएन। फेरि प्रयास गर्नुहोस्।"
        );

        return;
    }

    products[productIndex].stock =
        Number(
            products[productIndex].stock || 0
        ) - qty;

    saveProducts(
        products
    );


    const sales =
        getSales();


    const sale = {

        id:
            "SALE-" +
            Date.now() +
            "-" +
            Math.floor(
                Math.random() * 10000
            ),

        date:
            saleDate.value ||
            today(),

        billNumber:
            billNumber.value.trim() ||
            generateBillNumber(),

        customerName:
            customerName.value.trim() ||
            "Walk-in Customer",

        productId:
            product.id,

        productName:
            product.name,

        unit:
            product.unit || "",

        qty:
            qty,

        rate:
            rate,

        discount:
            discount,

        itemAmount:
            itemAmount,

        total:
            total,

        paidAmount:
            paid,

        balance:
            balance,

        paymentMethod:
            paymentMethod.value,

        note:
            saleNote.value.trim(),

        createdAt:
            new Date().toISOString()

    };


    sales.push(
        sale
    );

    saveSales(
        sales
    );


    alert(
        `Sale सफल भयो।\n\n` +
        `Product: ${product.name}\n` +
        `Qty: ${qty}\n` +
        `Total: ${money(total)}\n` +
        `Balance: ${money(balance)}`
    );


    clearForm();

    renderSalesHistory();

}

);

document.addEventListener(
"DOMContentLoaded",
function () {

    saleDate.value =
        today();

    billNumber.value =
        generateBillNumber();

    loadProducts();

    calculatePreview();

    renderSalesHistory();

}

);

window.viewSaleBill =
viewSaleBill;
