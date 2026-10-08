const PRODUCT_KEY = "gs_products";
const SALE_KEY = "gs_sales";
const RETURN_KEY = "gs_sales_returns";

const returnSale =
document.getElementById("returnSale");

const returnDetailsCard =
document.getElementById(
"returnDetailsCard"
);

const returnBillNumber =
document.getElementById(
"returnBillNumber"
);

const returnCustomer =
document.getElementById(
"returnCustomer"
);

const returnProduct =
document.getElementById(
"returnProduct"
);

const soldQty =
document.getElementById(
"soldQty"
);

const alreadyReturnedQty =
document.getElementById(
"alreadyReturnedQty"
);

const returnQty =
document.getElementById(
"returnQty"
);

const returnCondition =
document.getElementById(
"returnCondition"
);

const returnReason =
document.getElementById(
"returnReason"
);

const returnNote =
document.getElementById(
"returnNote"
);

const returnQtyPreview =
document.getElementById(
"returnQtyPreview"
);

const returnAmountPreview =
document.getElementById(
"returnAmountPreview"
);

const saveReturnBtn =
document.getElementById(
"saveReturnBtn"
);

const clearReturnBtn =
document.getElementById(
"clearReturnBtn"
);

const returnHistoryBody =
document.getElementById(
"returnHistoryBody"
);

let selectedSale = null;

function getSales() {

try {

    return JSON.parse(
        localStorage.getItem(
            SALE_KEY
        )
    ) || [];

} catch (error) {

    console.error(
        "Unable to read sales:",
        error
    );

    return [];
}

}

function getProducts() {

try {

    return JSON.parse(
        localStorage.getItem(
            PRODUCT_KEY
        )
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

function getReturns() {

try {

    return JSON.parse(
        localStorage.getItem(
            RETURN_KEY
        )
    ) || [];

} catch (error) {

    console.error(
        "Unable to read returns:",
        error
    );

    return [];
}

}

function saveReturns(returns) {

localStorage.setItem(
    RETURN_KEY,
    JSON.stringify(returns)
);

}

function money(value) {

return "Rs. " +
    Number(
        value || 0
    ).toFixed(2);

}

function escapeHTML(value) {

return String(
    value ?? ""
)
.replace(
    /&/g,
    "&amp;"
)
.replace(
    /</g,
    "&lt;"
)
.replace(
    />/g,
    "&gt;"
)
.replace(
    /"/g,
    "&quot;"
)
.replace(
    /'/g,
    "&#039;"
);

}

function today() {

const date =
    new Date();

const year =
    date.getFullYear();

const month =
    String(
        date.getMonth() + 1
    ).padStart(
        2,
        "0"
    );

const day =
    String(
        date.getDate()
    ).padStart(
        2,
        "0"
    );

return `${year}-${month}-${day}`;

}

function loadSales() {

const sales =
    getSales();

returnSale.innerHTML =
    '<option value="">Select Sale</option>';

sales
    .filter(function (sale) {

        return !sale.voided;

    })
    .sort(function (a, b) {

        return String(
            b.createdAt || ""
        ).localeCompare(
            String(
                a.createdAt || ""
            )
        );

    })
    .forEach(function (sale) {

        const option =
            document.createElement(
                "option"
            );

        option.value =
            sale.id;

        option.textContent =
            `${sale.billNumber || "-"} | ${sale.productName || "-"} | Qty: ${Number(sale.qty || 0)} | ${money(sale.total)}`;

        returnSale.appendChild(
            option
        );

    });

}

function getReturnedQtyForSale(
saleId
) {

const returns =
    getReturns();

return returns
    .filter(function (item) {

        return item.saleId ===
            saleId;

    })
    .reduce(
        function (
            total,
            item
        ) {

            return total +
                Number(
                    item.qty || 0
                );

        },
        0
    );

}

function showSaleDetails() {

const saleId =
    returnSale.value;

selectedSale = null;

if (!saleId) {

    returnDetailsCard.style.display =
        "none";

    return;

}

const sales =
    getSales();

selectedSale =
    sales.find(
        function (sale) {

            return sale.id ===
                saleId;

        }
    ) || null;


if (!selectedSale) {

    returnDetailsCard.style.display =
        "none";

    return;

}


const returnedQty =
    getReturnedQtyForSale(
        selectedSale.id
    );


returnBillNumber.value =
    selectedSale.billNumber ||
    "";

returnCustomer.value =
    selectedSale.customerName ||
    "Walk-in Customer";

returnProduct.value =
    selectedSale.productName ||
    "";

soldQty.value =
    Number(
        selectedSale.qty || 0
    );

alreadyReturnedQty.value =
    returnedQty;

returnQty.value =
    "0";

returnReason.value =
    "";

returnNote.value =
    "";

returnCondition.value =
    "GOOD";


returnDetailsCard.style.display =
    "block";

calculateReturnPreview();

}

function calculateReturnPreview() {

if (!selectedSale) {

    returnQtyPreview.textContent =
        "0";

    returnAmountPreview.textContent =
        money(0);

    return;

}


const qty =
    Number(
        returnQty.value || 0
    );

const rate =
    Number(
        selectedSale.rate || 0
    );

const amount =
    qty * rate;


returnQtyPreview.textContent =
    qty;

returnAmountPreview.textContent =
    money(amount);

}

function resetReturnForm() {

selectedSale = null;

returnSale.value =
    "";

returnDetailsCard.style.display =
    "none";

returnQty.value =
    "0";

returnReason.value =
    "";

returnNote.value =
    "";

returnCondition.value =
    "GOOD";

loadSales();

renderReturnHistory();

}

function saveReturn() {

if (!selectedSale) {

    alert(
        "कृपया पहिले Sale चयन गर्नुहोस्।"
    );

    return;

}


const qty =
    Number(
        returnQty.value || 0
    );

const sold =
    Number(
        selectedSale.qty || 0
    );

const alreadyReturned =
    getReturnedQtyForSale(
        selectedSale.id
    );

const remaining =
    sold - alreadyReturned;


if (qty <= 0) {

    alert(
        "Return Quantity राख्नुहोस्।"
    );

    return;

}


if (qty > remaining) {

    alert(
        `यति मात्र return गर्न मिल्छ: ${remaining}`
    );

    return;

}


const reason =
    returnReason.value.trim();


if (!reason) {

    alert(
        "Return Reason राख्नुहोस्।"
    );

    return;

}


const products =
    getProducts();


const productIndex =
    products.findIndex(
        function (product) {

            return product.id ===
                selectedSale.productId;

        }
    );


if (productIndex === -1) {

    alert(
        "Sale को product Inventory मा भेटिएन।"
    );

    return;

}


const condition =
    returnCondition.value;


if (condition === "GOOD") {

    products[
        productIndex
    ].stock =
        Number(
            products[
                productIndex
            ].stock || 0
        ) + qty;

    saveProducts(
        products
    );

}


const returns =
    getReturns();


const returnRecord = {

    id:
        "RET-" +
        Date.now() +
        "-" +
        Math.floor(
            Math.random() * 10000
        ),

    date:
        today(),

    saleId:
        selectedSale.id,

    billNumber:
        selectedSale.billNumber,

    customerName:
        selectedSale.customerName ||
        "Walk-in Customer",

    productId:
        selectedSale.productId,

    productName:
        selectedSale.productName,

    unit:
        selectedSale.unit || "",

    qty:
        qty,

    rate:
        Number(
            selectedSale.rate || 0
        ),

    amount:
        qty *
        Number(
            selectedSale.rate || 0
        ),

    condition:
        condition,

    reason:
        reason,

    note:
        returnNote.value.trim(),

    createdAt:
        new Date().toISOString()

};


returns.push(
    returnRecord
);

saveReturns(
    returns
);


alert(
    "Sales Return सफल भयो।"
);


resetReturnForm();

}

function renderReturnHistory() {

const returns =
    getReturns();

returns.sort(
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


if (!returns.length) {

    returnHistoryBody.innerHTML =
        `
        <tr>

            <td
                colspan="8"
                class="empty-state"
            >
                No returns found
            </td>

        </tr>
        `;

    return;

}


returnHistoryBody.innerHTML =
    returns.map(
        function (item) {

            const conditionText =
                item.condition ===
                "DAMAGED"
                    ? "Damaged"
                    : "Good";

            return `
            <tr>

                <td>
                    ${escapeHTML(
                        item.date
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.id
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.billNumber
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.productName
                    )}
                </td>

                <td>
                    ${Number(
                        item.qty || 0
                    )}
                    ${escapeHTML(
                        item.unit || ""
                    )}
                </td>

                <td>
                    ${conditionText}
                </td>

                <td>
                    ${money(
                        item.amount
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        item.reason
                    )}
                </td>

            </tr>
            `;

        }
    )
    .join("");

}

returnSale.addEventListener(
"change",
showSaleDetails
);

returnQty.addEventListener(
"input",
calculateReturnPreview
);

saveReturnBtn.addEventListener(
"click",
saveReturn
);

clearReturnBtn.addEventListener(
"click",
resetReturnForm
);

document.addEventListener(
"DOMContentLoaded",
function () {

    loadSales();

    renderReturnHistory();

}

);
