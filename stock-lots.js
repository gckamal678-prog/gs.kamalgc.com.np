
"use strict";

const PURCHASE_KEY = "gs_purchases";
const PRODUCT_KEY = "gs_products";
const LOT_KEY = "gs_stock_lots";
const SETTINGS_KEY = "gs_settings";

const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const lotTableBody = document.getElementById("lotTableBody");
const totalLots = document.getElementById("totalLots");
const remainingQty = document.getElementById("remainingQty");
const stockCost = document.getElementById("stockCost");
const productCount = document.getElementById("productCount");

function getData(key, fallback = []) {
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return value == null ? fallback : value;
    } catch (error) {
        console.error("Could not read localStorage:", key, error);
        return fallback;
    }
}

function saveData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error("Could not save localStorage:", key, error);
        return false;
    }
}

function getSettings() {
    const settings = getData(SETTINGS_KEY, {});
    return settings && typeof settings === "object" && !Array.isArray(settings)
        ? settings
        : {};
}

function getCurrency() {
    const settings = getSettings();

    return (
        settings.currencySymbol ||
        settings.currency ||
        "Rs."
    );
}

function money(value) {
    const amount = Number(value || 0);

    return getCurrency() + " " +
        (Number.isFinite(amount) ? amount : 0).toFixed(2);
}

function escapeHTML(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function validDate(value) {
    if (!value) return null;

    const date = new Date(String(value).slice(0, 10) + "T00:00:00");

    return Number.isNaN(date.getTime()) ? null : date;
}

function todayDate() {
    const now = new Date();

    return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );
}

function getExpiryInfo(expiryDate) {
    if (!expiryDate) {
        return {
            label: "Not set",
            className: "neutral"
        };
    }

    const expiry = validDate(expiryDate);

    if (!expiry) {
        return {
            label: "Invalid date",
            className: "neutral"
        };
    }

    const today = todayDate();
    const days = Math.round(
        (expiry.getTime() - today.getTime()) / 86400000
    );

    if (days < 0) {
        return {
            label: "Expired",
            className: "expired"
        };
    }

    if (days === 0) {
        return {
            label: "Expires today",
            className: "soon"
        };
    }

    if (days <= 30) {
        return {
            label: "Expires in " + days + " day(s)",
            className: "soon"
        };
    }

    return {
        label: "Valid",
        className: "valid"
    };
}

function createLotFromPurchase(purchase) {
    const qty = Number(purchase.qty || 0);
    const freeQty = Number(purchase.freeQty || 0);

    const totalReceived = Number(
        purchase.totalReceivedQty || (qty + freeQty)
    );

    if (!purchase.productId || totalReceived <= 0) {
        return null;
    }

    const rawCost = Number(
        purchase.effectiveCost ||
        (
            (
                qty * Number(purchase.rate || 0)
            ) - Number(purchase.discount || 0)
        ) / totalReceived
    );

    return {
        id: "LOT-" + (purchase.id || Date.now()),
        purchaseId: purchase.id || "",
        date: purchase.date ||
            new Date().toISOString().slice(0, 10),
        productId: purchase.productId,
        productName: purchase.productName || "",
        supplierName: purchase.supplierName || "",
        billNumber: purchase.billNumber || "",
        receivedQty: totalReceived,
        remainingQty: totalReceived,
        effectiveCost: Number.isFinite(rawCost) ? rawCost : 0,
        expiryDate: purchase.expiryDate || "",
        source: "PURCHASE",
        createdAt: purchase.createdAt || new Date().toISOString()
    };
}

/*
 * Import legacy purchase records only when their purchase ID
 * is not already represented by a lot.
 * Existing lot quantities are never reset by this migration.
 */
function migratePurchasesToLots() {
    const existingLots = getData(LOT_KEY);
    const purchases = getData(PURCHASE_KEY);

    if (!Array.isArray(existingLots) || !Array.isArray(purchases)) {
        return;
    }

    const existingPurchaseIds = new Set(
        existingLots
            .map(lot => lot && lot.purchaseId)
            .filter(Boolean)
            .map(String)
    );

    let changed = false;

    purchases.forEach(purchase => {
        if (!purchase || !purchase.id) return;

        if (existingPurchaseIds.has(String(purchase.id))) {
            return;
        }

        const lot = createLotFromPurchase(purchase);

        if (lot) {
            existingLots.push(lot);
            existingPurchaseIds.add(String(purchase.id));
            changed = true;
        }
    });

    if (changed) {
        existingLots.sort((a, b) => {
            return new Date(a.date || 0) - new Date(b.date || 0);
        });

        saveData(LOT_KEY, existingLots);
    }
}

function getLots() {
    migratePurchasesToLots();

    const lots = getData(LOT_KEY);
    return Array.isArray(lots) ? lots : [];
}

function getRemaining(lot) {
    const qty = Number(lot.remainingQty || 0);
    return Number.isFinite(qty) ? qty : 0;
}

function getReceived(lot) {
    const qty = Number(lot.receivedQty || 0);
    return Number.isFinite(qty) ? qty : 0;
}

function getUnitCost(lot) {
    const cost = Number(lot.effectiveCost || 0);
    return Number.isFinite(cost) ? cost : 0;
}

function renderSummary(lots) {
    const remaining = lots.reduce((sum, lot) => {
        return sum + Math.max(0, getRemaining(lot));
    }, 0);

    const cost = lots.reduce((sum, lot) => {
        return sum + Math.max(0, getRemaining(lot)) * getUnitCost(lot);
    }, 0);

    const products = new Set(
        lots
            .filter(lot => getRemaining(lot) > 0)
            .map(lot => String(lot.productId || lot.productName || ""))
            .filter(Boolean)
    );

    totalLots.textContent = lots.length;
    remainingQty.textContent = remaining;
    stockCost.textContent = money(cost);
    productCount.textContent = products.size;
}

function getFilteredLots() {
    const lots = getLots();
    const search = (searchInput.value || "").trim().toLowerCase();
    const status = statusFilter.value;

    return lots.filter(lot => {
        const text = [
            lot.id,
            lot.productName,
            lot.productId,
            lot.supplierName,
            lot.billNumber,
            lot.expiryDate
        ].join(" ").toLowerCase();

        const matchesSearch = !search || text.includes(search);
        const remaining = getRemaining(lot);

        let matchesStatus = true;

        if (status === "REMAINING") {
            matchesStatus = remaining > 0;
        } else if (status === "EMPTY") {
            matchesStatus = remaining <= 0;
        } else if (status === "EXPIRED") {
            matchesStatus =
                remaining > 0 &&
                getExpiryInfo(lot.expiryDate).className === "expired";
        } else if (status === "EXPIRING") {
            matchesStatus =
                remaining > 0 &&
                getExpiryInfo(lot.expiryDate).className === "soon";
        }

        return matchesSearch && matchesStatus;
    });
}

function addExpiryStyles() {
    if (document.getElementById("stockLotExpiryStyles")) return;

    const style = document.createElement("style");
    style.id = "stockLotExpiryStyles";

    style.textContent = `
        .lot-expiry {
            display: inline-block;
            margin-top: 5px;
            padding: 4px 7px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            white-space: normal;
        }
        .lot-expiry.expired {
            background: #fee2e2;
            color: #991b1b;
        }
        .lot-expiry.soon {
            background: #fef3c7;
            color: #92400e;
        }
        .lot-expiry.valid {
            background: #dcfce7;
            color: #166534;
        }
        .lot-expiry.neutral {
            background: #e5e7eb;
            color: #374151;
        }
        .lot-status {
            display: inline-block;
            padding: 5px 9px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 650;
        }
        .lot-status.remaining {
            background: #dcfce7;
            color: #166534;
        }
        .lot-status.partial {
            background: #fef3c7;
            color: #92400e;
        }
        .lot-status.empty {
            background: #fee2e2;
            color: #991b1b;
        }
    `;

    document.head.appendChild(style);
}

function renderTable() {
    const lots = getFilteredLots();

    if (lots.length === 0) {
        lotTableBody.innerHTML = `
            <tr>
                <td colspan="10" class="lots-empty">
                    कुनै FIFO lot भेटिएन।
                </td>
            </tr>
        `;
        return;
    }

    lotTableBody.innerHTML = lots.map(lot => {
        const received = getReceived(lot);
        const remaining = getRemaining(lot);
        const value = Math.max(0, remaining) * getUnitCost(lot);
        const expiry = getExpiryInfo(lot.expiryDate);

        let statusHTML = `
            <span class="lot-status remaining">Remaining</span>
        `;

        if (remaining <= 0) {
            statusHTML = `
                <span class="lot-status empty">Empty</span>
            `;
        } else if (remaining < received) {
            statusHTML = `
                <span class="lot-status partial">Partially Used</span>
            `;
        }

        const productHTML = `
            <strong>${escapeHTML(lot.productName || lot.productId || "-")}</strong>
            <br>
            <span class="lot-expiry ${expiry.className}">
                Expiry: ${escapeHTML(lot.expiryDate || "Not set")}
                · ${escapeHTML(expiry.label)}
            </span>
        `;

        return `
            <tr>
                <td>${escapeHTML(lot.date || "-")}</td>
                <td>${escapeHTML(lot.id || "-")}</td>
                <td>${productHTML}</td>
                <td>${escapeHTML(lot.supplierName || "-")}</td>
                <td>${escapeHTML(lot.billNumber || "-")}</td>
                <td>${received}</td>
                <td><strong>${remaining}</strong></td>
                <td>${money(getUnitCost(lot))}</td>
                <td>${money(value)}</td>
                <td>${statusHTML}</td>
            </tr>
        `;
    }).join("");
}

function render() {
    const lots = getLots();

    addExpiryStyles();
    renderSummary(lots);
    renderTable();
}

searchInput.addEventListener("input", renderTable);
statusFilter.addEventListener("change", renderTable);

if (!Array.from(statusFilter.options).some(option => option.value === "EXPIRED")) {
    const expiredOption = document.createElement("option");
    expiredOption.value = "EXPIRED";
    expiredOption.textContent = "Expired Stock";
    statusFilter.appendChild(expiredOption);
}

if (!Array.from(statusFilter.options).some(option => option.value === "EXPIRING")) {
    const expiringOption = document.createElement("option");
    expiringOption.value = "EXPIRING";
    expiringOption.textContent = "Expiring Within 30 Days";
    statusFilter.appendChild(expiringOption);
}

render();
