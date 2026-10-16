
/* =========================================================
   GENERAL STORE MANAGEMENT SYSTEM
   Dashboard - Complete Replacement
   Existing localStorage keys and index.html IDs preserved
   ========================================================= */

(function () {
    "use strict";

    // =========================================
    // CONFIGURATION
    // =========================================

    const KEYS = {
        sales: "gs_sales",
        products: "gs_products",
        lots: "gs_stock_lots",
        purchases: "gs_purchases",
        finance: "gs_finance",
        customers: "gs_customers",
        suppliers: "gs_suppliers",
        returns: "gs_sales_returns",
        settings: "gs_settings"
    };

    const $ = function (id) {
        return document.getElementById(id);
    };

    // =========================================
    // BASIC HELPERS
    // =========================================

    function number(value) {
        const result = Number(value);
        return Number.isFinite(result) ? result : 0;
    }

    function money(value) {
        return number(value).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function text(id, value) {
        const element = $(id);
        if (element) element.textContent = value;
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, function (char) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[char];
        });
    }

    function localDate(date) {
        date = date || new Date();

        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0")
        ].join("-");
    }

    function dateOf(record) {
        if (!record) return "";

        const value =
            record.date ||
            record.saleDate ||
            record.purchaseDate ||
            record.createdAt ||
            record.timestamp ||
            "";

        if (!value) return "";

        const str = String(value);

        if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
            return str.slice(0, 10);
        }

        const parsed = new Date(value);

        return Number.isNaN(parsed.getTime())
            ? ""
            : localDate(parsed);
    }

    function readArray(key) {
        try {
            const raw = localStorage.getItem(key);

            if (!raw) return [];

            const parsed = JSON.parse(raw);

            if (Array.isArray(parsed)) return parsed;

            console.warn("Expected an array in storage:", key);
            return [];

        } catch (error) {
            console.error("Unable to read storage:", key, error);
            return [];
        }
    }

    function readSettings() {
        try {
            const parsed = JSON.parse(
                localStorage.getItem(KEYS.settings) || "{}"
            );

            return parsed &&
                typeof parsed === "object" &&
                !Array.isArray(parsed)
                ? parsed
                : {};

        } catch (error) {
            console.error("Unable to read store settings:", error);
            return {};
        }
    }

    function isVoided(record) {
        return Boolean(
            record &&
            (
                record.voided === true ||
                record.isVoid === true ||
                record.status === "VOID" ||
                record.status === "CANCELLED"
            )
        );
    }

    function validSales() {
        return readArray(KEYS.sales).filter(function (sale) {
            return sale && !isVoided(sale);
        });
    }

    function validPurchases() {
        return readArray(KEYS.purchases).filter(function (purchase) {
            return purchase && !isVoided(purchase);
        });
    }

    function activeProducts() {
        return readArray(KEYS.products).filter(function (product) {
            return product &&
                product.active !== false &&
                product.status !== "INACTIVE";
        });
    }

    function quantityOfSale(sale) {
        return number(
            sale.qty ??
            sale.quantity ??
            sale.soldQty ??
            sale.totalQty
        );
    }

    function totalOfSale(sale) {
        if (sale.total !== undefined) return number(sale.total);
        if (sale.totalAmount !== undefined) return number(sale.totalAmount);
        if (sale.grandTotal !== undefined) return number(sale.grandTotal);
        if (sale.netTotal !== undefined) return number(sale.netTotal);
        return number(sale.amount);
    }

    function totalOfPurchase(purchase) {
        if (purchase.total !== undefined) return number(purchase.total);
        if (purchase.totalAmount !== undefined) return number(purchase.totalAmount);
        if (purchase.grandTotal !== undefined) return number(purchase.grandTotal);
        return number(purchase.amount);
    }

    function todayRecords(records) {
        const today = localDate();

        return records.filter(function (record) {
            return dateOf(record) === today;
        });
    }

    function getProfit(sale) {
        if (sale.profit !== undefined && sale.profit !== null) {
            return number(sale.profit);
        }

        if (sale.fifoCost !== undefined && sale.fifoCost !== null) {
            return totalOfSale(sale) - number(sale.fifoCost);
        }

        if (
            sale.costTotal !== undefined &&
            sale.costTotal !== null
        ) {
            return totalOfSale(sale) - number(sale.costTotal);
        }

        return 0;
    }

    // =========================================
    // STORE PROFILE DISPLAY
    // =========================================

    function initials(name) {
        const value = String(name || "GS").trim();
        return value ? value.charAt(0).toUpperCase() : "GS";
    }

    function renderPhoto(element, photo, name) {
        if (!element) return;

        element.replaceChildren();

        if (!photo) {
            element.textContent = initials(name);
            return;
        }

        const image = document.createElement("img");
        image.src = photo;
        image.alt = "Store profile photo";
        image.draggable = false;

        image.onerror = function () {
            element.replaceChildren();
            element.textContent = initials(name);
        };

        element.appendChild(image);
    }

    function renderStoreProfile() {
        const settings = readSettings();

        const storeName = String(
            settings.storeName || "Krishna G.C."
        );

        const ownerName = String(
            settings.ownerName || "Management System"
        );

        text("gsSidebarStoreTitle", storeName);
        text("gsProfilePreviewName", storeName);
        text("gsProfilePreviewOwner", ownerName);
        text("welcomeTitle", "नमस्ते " + ownerName + " 👋");

        document.title = storeName + " - Dashboard";

        renderPhoto(
            $("gsProfilePhotoPreview"),
            settings.operatorPhoto || "",
            storeName
        );

        renderPhoto(
            $("gsDashboardAvatar"),
            settings.operatorPhoto || "",
            storeName
        );
    }

    // =========================================
    // DATE DISPLAY
    // =========================================

    function renderDate() {
        const element = $("todayDate");
        if (!element) return;

        element.textContent = new Date().toLocaleDateString("ne-NP", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    }

    // =========================================
    // SALES CHART
    // =========================================

    function renderChart() {
        const area = $("salesChart");
        if (!area) return;

        const periodInput = $("salesPeriod");
        const days = Math.max(
            1,
            Math.min(30, number(periodInput && periodInput.value) || 7)
        );

        const sales = validSales();
        const today = new Date();
        const items = [];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(
                today.getFullYear(),
                today.getMonth(),
                today.getDate() - i
            );

            const key = localDate(date);

            const amount = sales.reduce(function (sum, sale) {
                return dateOf(sale) === key
                    ? sum + totalOfSale(sale)
                    : sum;
            }, 0);

            items.push({
                key: key,
                label: date.toLocaleDateString("en", {
                    day: "numeric",
                    month: "short"
                }),
                amount: amount
            });
        }

        const maxAmount = Math.max(
            1,
            ...items.map(function (item) {
                return item.amount;
            })
        );

        const total = items.reduce(function (sum, item) {
            return sum + item.amount;
        }, 0);

        area.innerHTML = `
            <div style="
                display:flex;
                align-items:flex-end;
                gap:8px;
                height:190px;
                padding:12px 4px 4px;
                min-width:0;
            ">
                ${items.map(function (item) {
                    const height = item.amount > 0
                        ? Math.max(5, item.amount / maxAmount * 130)
                        : 3;

                    return `
                        <div
                            title="${escapeHTML(item.key)}: Rs. ${money(item.amount)}"
                            style="
                                flex:1;
                                min-width:0;
                                display:flex;
                                flex-direction:column;
                                align-items:center;
                                justify-content:flex-end;
                                height:100%;
                                gap:7px;
                            "
                        >
                            <span style="
                                font-size:10px;
                                text-align:center;
                                overflow-wrap:anywhere;
                            ">
                                ${item.amount ? escapeHTML(money(item.amount)) : ""}
                            </span>

                            <div style="
                                width:min(100%,30px);
                                height:${height}px;
                                background:var(--gs-pink,#ec00ed);
                                border-radius:5px 5px 0 0;
                            "></div>

                            <span style="
                                font-size:10px;
                                white-space:nowrap;
                            ">
                                ${escapeHTML(item.label)}
                            </span>
                        </div>
                    `;
                }).join("")}
            </div>

            <div style="
                text-align:center;
                font-size:12px;
                margin-top:8px;
            ">
                कुल बिक्री: Rs. ${money(total)}
            </div>
        `;
    }

    // =========================================
    // FAST-MOVING PRODUCTS
    // =========================================

    function renderFastMoving() {
        const area = $("fastMovingArea");
        if (!area) return;

        const totals = new Map();

        validSales().forEach(function (sale) {
            const productId = String(
                sale.productId ??
                sale.itemId ??
                sale.productName ??
                sale.name ??
                "unknown"
            );

            const name = String(
                sale.productName ??
                sale.itemName ??
                sale.name ??
                "Unknown product"
            );

            const previous = totals.get(productId) || {
                name: name,
                qty: 0,
                amount: 0
            };

            previous.qty += quantityOfSale(sale);
            previous.amount += totalOfSale(sale);

            totals.set(productId, previous);
        });

        const rows = Array.from(totals.values())
            .sort(function (a, b) {
                return b.qty - a.qty;
            })
            .slice(0, 5);

        if (!rows.length) {
            area.innerHTML = `
                <p style="padding:16px">
                    अहिलेसम्म बिक्रीको रेकर्ड छैन।
                </p>
            `;
            return;
        }

        area.innerHTML = `
            <table style="width:100%;border-collapse:collapse">
                <thead>
                    <tr>
                        <th style="text-align:left;padding:10px">Product</th>
                        <th style="text-align:right;padding:10px">Qty Sold</th>
                        <th style="text-align:right;padding:10px">Sales</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(function (row) {
                        return `
                            <tr>
                                <td style="padding:10px">
                                    ${escapeHTML(row.name)}
                                </td>
                                <td style="padding:10px;text-align:right">
                                    ${money(row.qty)}
                                </td>
                                <td style="padding:10px;text-align:right;white-space:nowrap">
                                    Rs. ${money(row.amount)}
                                </td>
                            </tr>
                        `;
                    }).join("")}
                </tbody>
            </table>
        `;
    }

    // =========================================
    // RECENT ACTIVITY
    // =========================================

    function renderRecentActivity() {
        const area = $("recentActivityArea");
        if (!area) return;

        const entries = [];

        validSales().forEach(function (sale) {
            entries.push({
                date: dateOf(sale),
                createdAt: String(sale.createdAt || sale.date || ""),
                type: "Sale",
                name: sale.billNumber ||
                    sale.customerName ||
                    sale.productName ||
                    "बिक्री",
                amount: totalOfSale(sale),
                status: number(sale.balance) > 0
                    ? "बाँकी रकम"
                    : "बिक्री रेकर्ड"
            });
        });

        validPurchases().forEach(function (purchase) {
            entries.push({
                date: dateOf(purchase),
                createdAt: String(
                    purchase.createdAt || purchase.date || ""
                ),
                type: "Purchase",
                name: purchase.billNumber ||
                    purchase.supplierName ||
                    purchase.supplier ||
                    "खरिद",
                amount: totalOfPurchase(purchase),
                status: number(purchase.balance) > 0
                    ? "तिर्न बाँकी"
                    : "खरिद रेकर्ड"
            });
        });

        readArray(KEYS.finance).forEach(function (finance) {
            const type = String(finance.type || "Finance").toUpperCase();

            entries.push({
                date: dateOf(finance),
                createdAt: String(
                    finance.createdAt || finance.date || ""
                ),
                type: type,
                name: finance.category ||
                    finance.description ||
                    finance.note ||
                    finance.reference ||
                    "Finance",
                amount: number(finance.amount),
                status: type === "INCOME"
                    ? "आम्दानी"
                    : "वित्तीय कारोबार"
            });
        });

        readArray(KEYS.returns).forEach(function (item) {
            entries.push({
                date: dateOf(item),
                createdAt: String(
                    item.createdAt || item.date || ""
                ),
                type: "Sales Return",
                name: item.productName ||
                    item.billNumber ||
                    item.saleId ||
                    "बिक्री फिर्ता",
                amount: number(
                    item.returnAmount ??
                    item.totalAmount ??
                    item.amount
                ),
                status: "फिर्ता रेकर्ड"
            });
        });

        entries.sort(function (a, b) {
            return String(b.createdAt || b.date)
                .localeCompare(String(a.createdAt || a.date));
        });

        const recent = entries.slice(0, 8);

        if (!recent.length) {
            area.innerHTML = `
                <p style="padding:16px">
                    अहिलेसम्म कारोबारको रेकर्ड छैन।
                </p>
            `;
            return;
        }

        area.innerHTML = `
            <table style="width:100%;border-collapse:collapse">
                <thead>
                    <tr>
                        <th style="text-align:left;padding:10px">Date</th>
                        <th style="text-align:left;padding:10px">Type / Details</th>
                        <th style="text-align:right;padding:10px">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${recent.map(function (item) {
                        return `
                            <tr>
                                <td style="padding:10px;white-space:nowrap">
                                    ${escapeHTML(item.date || "-")}
                                </td>
                                <td style="padding:10px">
                                    <strong>${escapeHTML(item.type)}</strong>
                                    <div>${escapeHTML(item.name)}</div>
                                    <small>${escapeHTML(item.status)}</small>
                                </td>
                                <td style="padding:10px;text-align:right;white-space:nowrap">
                                    Rs. ${money(item.amount)}
                                </td>
                            </tr>
                        `;
                    }).join("")}
                </tbody>
            </table>
        `;
    }

    // =========================================
    // FINANCE BALANCE
    // =========================================

    function calculateAvailableBalance(finance) {
        let balance = 0;

        finance.forEach(function (item) {
            const type = String(item.type || "").toUpperCase();
            const amount = number(item.amount);

            if (amount <= 0) return;

            if ([
                "INCOME",
                "RECEIPT",
                "CUSTOMER_PAYMENT",
                "SALE_RECEIPT"
            ].includes(type)) {
                balance += amount;
            } else if ([
                "EXPENSE",
                "PAYMENT",
                "PURCHASE_PAYMENT",
                "SUPPLIER_PAYMENT"
            ].includes(type)) {
                balance -= amount;
            }
        });

        return balance;
    }

    // =========================================
    // MAIN DASHBOARD
    // =========================================

    function renderDashboard() {
        const sales = validSales();
        const purchases = validPurchases();
        const products = activeProducts();
        const lots = readArray(KEYS.lots);
        const finance = readArray(KEYS.finance);
        const suppliers = readArray(KEYS.suppliers);

        const todaySales = todayRecords(sales);
        const todayFinance = todayRecords(finance);

        const todayGross = todaySales.reduce(function (sum, sale) {
            return sum + totalOfSale(sale);
        }, 0);

        const grossProfit = todaySales.reduce(function (sum, sale) {
            return sum + getProfit(sale);
        }, 0);

        const todayExpenses = todayFinance
            .filter(function (item) {
                const type = String(item.type || "").toUpperCase();
                const category = String(item.category || "").toUpperCase();

                return type === "EXPENSE" ||
                    category === "EXPENSE" ||
                    category === "SHOP_EXPENSE";
            })
            .reduce(function (sum, item) {
                return sum + number(item.amount);
            }, 0);

        text("todaySales", money(todayGross));
        text("grossProfit", money(grossProfit));
        text("expenses", money(todayExpenses));
        text("netProfit", money(grossProfit - todayExpenses));
        text("salesChange", todaySales.length + " bills");

        // Customer receivable
        const receivable = sales.reduce(function (sum, sale) {
            return sum + Math.max(0, number(sale.balance));
        }, 0);

        text("customerReceivable", money(receivable));

        // Supplier payable
        const payable = suppliers.reduce(function (sum, supplier) {
            if (
                supplier.currentBalance !== undefined &&
                supplier.currentBalance !== null
            ) {
                return sum + Math.max(
                    0,
                    number(supplier.currentBalance)
                );
            }

            const opening = supplier.balanceType === "ADVANCE"
                ? -Math.abs(number(supplier.openingBalance))
                : Math.abs(number(supplier.openingBalance));

            const calculated = opening +
                number(supplier.purchaseTotal) -
                number(supplier.paymentTotal) -
                number(supplier.returnTotal);

            return sum + Math.max(0, calculated);
        }, 0);

        text("supplierPayable", money(payable));

        // Stock valuation
        let stockValue = 0;

        if (lots.length) {
            stockValue = lots.reduce(function (sum, lot) {
                const remaining = number(
                    lot.remainingQty ??
                    lot.remainingQuantity ??
                    lot.qtyRemaining
                );

                const cost = number(
                    lot.effectiveCost ??
                    lot.unitCost ??
                    lot.costPrice ??
                    lot.purchasePrice
                );

                return sum + Math.max(0, remaining) * Math.max(0, cost);
            }, 0);
        } else {
            stockValue = products.reduce(function (sum, product) {
                return sum +
                    Math.max(0, number(product.stock)) *
                    Math.max(0, number(
                        product.purchasePrice ??
                        product.costPrice ??
                        product.unitCost
                    ));
            }, 0);
        }

        text("stockValue", money(stockValue));
        text("availableBalance", money(
            calculateAvailableBalance(finance)
        ));

        // Low stock
        const lowStock = products.filter(function (product) {
            return number(product.stock) <= number(product.minStock);
        });

        text("lowStockCount", lowStock.length + " products");

        // Expiring stock within 30 days
        const today = localDate();
        const expiryLimit = new Date();

        expiryLimit.setDate(expiryLimit.getDate() + 30);

        const lastDate = localDate(expiryLimit);
        const expiringIds = new Set();

        lots.forEach(function (lot) {
            const expiry = String(
                lot.expiryDate || lot.expiry || ""
            ).slice(0, 10);

            const remaining = number(
                lot.remainingQty ??
                lot.remainingQuantity ??
                lot.qtyRemaining
            );

            if (
                expiry &&
                expiry >= today &&
                expiry <= lastDate &&
                remaining > 0
            ) {
                expiringIds.add(String(
                    lot.productId ?? lot.itemId ?? lot.productName
                ));
            }
        });

        products.forEach(function (product) {
            const expiry = String(
                product.expiryDate || product.expiry || ""
            ).slice(0, 10);

            if (
                expiry &&
                expiry >= today &&
                expiry <= lastDate
            ) {
                expiringIds.add(String(product.id ?? product.name));
            }
        });

        text("expiryCount", expiringIds.size + " products");

        // Customers with unpaid balances
        const dueCustomers = new Set();

        sales.forEach(function (sale) {
            if (number(sale.balance) > 0) {
                dueCustomers.add(String(
                    sale.customerId ??
                    sale.customerName ??
                    "walk-in"
                ));
            }
        });

        text("creditDueCount", dueCustomers.size + " customers");

        // Suppliers with outstanding balance
        const supplierDueCount = suppliers.filter(function (supplier) {
            if (
                supplier.currentBalance !== undefined &&
                supplier.currentBalance !== null
            ) {
                return number(supplier.currentBalance) > 0;
            }

            const opening = supplier.balanceType === "ADVANCE"
                ? -Math.abs(number(supplier.openingBalance))
                : Math.abs(number(supplier.openingBalance));

            const balance = opening +
                number(supplier.purchaseTotal) -
                number(supplier.paymentTotal) -
                number(supplier.returnTotal);

            return balance > 0;
        }).length;

        text("supplierDueCount", supplierDueCount + " suppliers");

        renderChart();
        renderFastMoving();
        renderRecentActivity();
    }

    // =========================================
    // STORAGE CHANGE LISTENER
    // =========================================

    window.addEventListener("storage", function (event) {
        const watchedKeys = Object.values(KEYS);

        if (!event.key || watchedKeys.includes(event.key)) {
            renderDashboard();
        }

        if (!event.key || event.key === KEYS.settings) {
            renderStoreProfile();
        }
    });

    // Other modules can request a refresh
    window.addEventListener("gs:settings-updated", function () {
        renderStoreProfile();
        renderDashboard();
    });

    // =========================================
    // INITIALIZATION
    // =========================================

    function init() {
        renderDate();
        renderStoreProfile();
        renderDashboard();

        const period = $("salesPeriod");

        if (period) {
            period.addEventListener("change", renderChart);
        }

        console.log(
            "Dashboard initialized with current index.html IDs."
        );
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    window.refreshDashboard = renderDashboard;

})();
