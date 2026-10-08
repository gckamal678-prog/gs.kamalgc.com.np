const PURCHASE_KEY = "gs_purchases";
const PRODUCT_KEY = "gs_products";
const LOT_KEY = "gs_stock_lots";


const searchInput =
    document.getElementById("searchInput");

const statusFilter =
    document.getElementById("statusFilter");

const lotTableBody =
    document.getElementById("lotTableBody");

const totalLots =
    document.getElementById("totalLots");

const remainingQty =
    document.getElementById("remainingQty");

const stockCost =
    document.getElementById("stockCost");

const productCount =
    document.getElementById("productCount");


function getData(key) {

    try {

        return JSON.parse(
            localStorage.getItem(key)
        ) || [];

    } catch (error) {

        return [];

    }

}


function saveData(key, data) {

    localStorage.setItem(
        key,
        JSON.stringify(data)
    );

}


function money(value) {

    return "Rs. " +
        Number(value || 0).toFixed(2);

}


function createLotFromPurchase(purchase) {

    const qty =
        Number(purchase.qty || 0);

    const freeQty =
        Number(purchase.freeQty || 0);

    const totalReceived =
        Number(
            purchase.totalReceivedQty ||
            (qty + freeQty)
        );


    if (
        !purchase.productId ||
        totalReceived <= 0
    ) {
        return null;
    }


    const effectiveCost =
        Number(
            purchase.effectiveCost ||
            (
                (
                    qty *
                    Number(purchase.rate || 0)
                ) -
                Number(purchase.discount || 0)
            ) /
            totalReceived
        );


    return {

        id:
            "LOT-" +
            (
                purchase.id ||
                Date.now()
            ),

        purchaseId:
            purchase.id || "",

        date:
            purchase.date ||
            new Date().toISOString().slice(0, 10),

        productId:
            purchase.productId,

        productName:
            purchase.productName || "",

        supplierName:
            purchase.supplierName || "",

        billNumber:
            purchase.billNumber || "",

        receivedQty:
            totalReceived,

        remainingQty:
            totalReceived,

        effectiveCost:
            Number(
                effectiveCost || 0
            ),

        source:
            "PURCHASE",

        createdAt:
            purchase.createdAt ||
            new Date().toISOString()

    };

}


function migratePurchasesToLots() {

    const existingLots =
        getData(LOT_KEY);

    const purchases =
        getData(PURCHASE_KEY);


    if (!Array.isArray(purchases)) {
        return;
    }


    const existingPurchaseIds =
        new Set(
            existingLots.map(
                lot => lot.purchaseId
            )
        );


    let changed = false;


    purchases.forEach(purchase => {

        if (
            !purchase ||
            !purchase.id ||
            existingPurchaseIds.has(
                purchase.id
            )
        ) {
            return;
        }


        const lot =
            createLotFromPurchase(
                purchase
            );


        if (lot) {

            existingLots.push(lot);

            changed = true;

        }

    });


    if (changed) {

        existingLots.sort(
            (a, b) =>
                new Date(a.date) -
                new Date(b.date)
        );


        saveData(
            LOT_KEY,
            existingLots
        );

    }

}


function getLots() {

    migratePurchasesToLots();

    return getData(LOT_KEY);

}


function renderSummary(lots) {

    const remaining =
        lots.reduce(
            (sum, lot) =>
                sum +
                Number(
                    lot.remainingQty || 0
                ),
            0
        );


    const cost =
        lots.reduce(
            (sum, lot) =>
                sum +
                (
                    Number(
                        lot.remainingQty || 0
                    ) *
                    Number(
                        lot.effectiveCost || 0
                    )
                ),
            0
        );


    const products =
        new Set(
            lots
                .filter(
                    lot =>
                        Number(
                            lot.remainingQty || 0
                        ) > 0
                )
                .map(
                    lot =>
                        lot.productId
                )
        );


    totalLots.textContent =
        lots.length;

    remainingQty.textContent =
        remaining;

    stockCost.textContent =
        money(cost);

    productCount.textContent =
        products.size;

}


function getFilteredLots() {

    const lots =
        getLots();

    const search =
        searchInput.value
            .trim()
            .toLowerCase();

    const status =
        statusFilter.value;


    return lots.filter(lot => {

        const text =
            [
                lot.id,
                lot.productName,
                lot.supplierName,
                lot.billNumber
            ]
            .join(" ")
            .toLowerCase();


        const matchesSearch =
            !search ||
            text.includes(search);


        const remaining =
            Number(
                lot.remainingQty || 0
            );


        let matchesStatus = true;


        if (status === "REMAINING") {

            matchesStatus =
                remaining > 0;

        }


        if (status === "EMPTY") {

            matchesStatus =
                remaining <= 0;

        }


        return (
            matchesSearch &&
            matchesStatus
        );

    });

}


function renderTable() {

    const lots =
        getFilteredLots();


    if (lots.length === 0) {

        lotTableBody.innerHTML = `
            <tr>
                <td colspan="10" class="empty">
                    कुनै FIFO lot भेटिएन।
                </td>
            </tr>
        `;

        return;
    }


    lotTableBody.innerHTML =
        lots.map(lot => {

            const received =
                Number(
                    lot.receivedQty || 0
                );

            const remaining =
                Number(
                    lot.remainingQty || 0
                );

            const value =
                remaining *
                Number(
                    lot.effectiveCost || 0
                );


            let badge =
                `<span class="badge badge-green">
                    Remaining
                </span>`;


            if (remaining <= 0) {

                badge =
                    `<span class="badge badge-red">
                        Empty
                    </span>`;

            } else if (
                remaining < received
            ) {

                badge =
                    `<span class="badge badge-yellow">
                        Partially Used
                    </span>`;

            }


            return `
                <tr>

                    <td>
                        ${lot.date || "-"}
                    </td>

                    <td>
                        ${lot.id || "-"}
                    </td>

                    <td>
                        ${lot.productName || "-"}
                    </td>

                    <td>
                        ${lot.supplierName || "-"}
                    </td>

                    <td>
                        ${lot.billNumber || "-"}
                    </td>

                    <td>
                        ${received}
                    </td>

                    <td>
                        <strong>
                            ${remaining}
                        </strong>
                    </td>

                    <td>
                        ${money(lot.effectiveCost)}
                    </td>

                    <td>
                        ${money(value)}
                    </td>

                    <td>
                        ${badge}
                    </td>

                </tr>
            `;

        })
        .join("");

}


function render() {

    const lots =
        getLots();


    renderSummary(lots);

    renderTable();

}


searchInput.addEventListener(
    "input",
    renderTable
);


statusFilter.addEventListener(
    "change",
    renderTable
);


render();
