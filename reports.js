document.addEventListener("DOMContentLoaded", function () {

    const SALE_KEY = "gs_sales";
    const PURCHASE_KEY = "gs_purchases";
    const PRODUCT_KEY = "gs_products";
    const CUSTOMER_KEY = "gs_customers";
    const SUPPLIER_KEY = "gs_suppliers";
    const FINANCE_KEY = "gs_finance";


    // ================================
    // HELPERS
    // ================================

    function getData(key) {

        try {

            const data =
                localStorage.getItem(key);

            if (!data) {
                return [];
            }

            const parsed =
                JSON.parse(data);

            return Array.isArray(parsed)
                ? parsed
                : [];

        } catch (error) {

            console.error(
                "Report data error:",
                error
            );

            return [];
        }
    }


    function numberValue(value) {

        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : 0;
    }


    function money(value) {

        return "Rs. " +
            numberValue(value)
                .toLocaleString(
                    "en-IN",
                    {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    }
                );
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

        const d =
            new Date();

        return (
            d.getFullYear() +
            "-" +
            String(
                d.getMonth() + 1
            ).padStart(2, "0") +
            "-" +
            String(
                d.getDate()
            ).padStart(2, "0")
        );
    }


    function firstDayOfMonth() {

        const d =
            new Date();

        return (
            d.getFullYear() +
            "-" +
            String(
                d.getMonth() + 1
            ).padStart(2, "0") +
            "-01"
        );
    }


    // ================================
    // DOM
    // ================================

    const fromDate =
        document.getElementById(
            "reportFromDate"
        );

    const toDate =
        document.getElementById(
            "reportToDate"
        );

    const applyFilterBtn =
        document.getElementById(
            "applyReportFilterBtn"
        );

    const refreshBtn =
        document.getElementById(
            "refreshReportsBtn"
        );


    // ================================
    // DATE FILTER
    // ================================

    fromDate.value =
        firstDayOfMonth();

    toDate.value =
        today();


    function dateAllowed(
        date
    ) {

        if (!date) {
            return true;
        }

        const from =
            fromDate.value;

        const to =
            toDate.value;


        if (
            from &&
            date < from
        ) {
            return false;
        }


        if (
            to &&
            date > to
        ) {
            return false;
        }


        return true;
    }


    // ================================
    // LOAD DATA
    // ================================

    function loadAllData() {

        return {

            sales:
                getData(SALE_KEY),

            purchases:
                getData(PURCHASE_KEY),

            products:
                getData(PRODUCT_KEY),

            customers:
                getData(CUSTOMER_KEY),

            suppliers:
                getData(SUPPLIER_KEY),

            finance:
                getData(FINANCE_KEY)
        };
    }


    // ================================
    // SALES REPORT
    // ================================

    function renderSalesReport(
        sales
    ) {

        const filtered =
            sales.filter(
                function (sale) {

                    return dateAllowed(
                        sale.date
                    );
                }
            );


        const body =
            document.getElementById(
                "salesReportBody"
            );


        if (!filtered.length) {

            body.innerHTML = `
                <tr>
                    <td
                        colspan="8"
                        class="report-empty"
                    >
                        No sales found.
                    </td>
                </tr>
            `;

            return 0;
        }


        body.innerHTML =
            filtered
                .slice()
                .reverse()
                .map(
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
                                        "Walk-in"
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        sale.productName ||
                                        "-"
                                    )}
                                </td>

                                <td>
                                    ${numberValue(
                                        sale.qty
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

                            </tr>

                        `;
                    }
                )
                .join("");


        return filtered.reduce(
            function (sum, sale) {

                return sum +
                    numberValue(
                        sale.total
                    );

            },
            0
        );
    }


    // ================================
    // PURCHASE REPORT
    // ================================

    function renderPurchaseReport(
        purchases
    ) {

        const filtered =
            purchases.filter(
                function (purchase) {

                    return dateAllowed(
                        purchase.date
                    );
                }
            );


        const body =
            document.getElementById(
                "purchaseReportBody"
            );


        if (!filtered.length) {

            body.innerHTML = `
                <tr>
                    <td
                        colspan="8"
                        class="report-empty"
                    >
                        No purchases found.
                    </td>
                </tr>
            `;

            return 0;
        }


        body.innerHTML =
            filtered
                .slice()
                .reverse()
                .map(
                    function (purchase) {

                        return `

                            <tr>

                                <td>
                                    ${escapeHTML(
                                        purchase.date || "-"
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        purchase.billNumber || "-"
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        purchase.supplierName ||
                                        "-"
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        purchase.productName ||
                                        "-"
                                    )}
                                </td>

                                <td>
                                    ${numberValue(
                                        purchase.qty
                                    )}
                                </td>

                                <td>
                                    ${money(
                                        purchase.rate
                                    )}
                                </td>

                                <td>
                                    ${money(
                                        purchase.total
                                    )}
                                </td>

                                <td>
                                    ${money(
                                        purchase.paidAmount
                                    )}
                                </td>

                            </tr>

                        `;
                    }
                )
                .join("");


        return filtered.reduce(
            function (sum, purchase) {

                return sum +
                    numberValue(
                        purchase.total
                    );

            },
            0
        );
    }


    // ================================
    // STOCK REPORT
    // ================================

    function renderStockReport(
        products
    ) {

        const body =
            document.getElementById(
                "stockReportBody"
            );


        if (!products.length) {

            body.innerHTML = `
                <tr>
                    <td
                        colspan="8"
                        class="report-empty"
                    >
                        No products found.
                    </td>
                </tr>
            `;

            return;
        }


        body.innerHTML =
            products.map(
                function (product) {

                    const stock =
                        numberValue(
                            product.stock
                        );

                    const purchasePrice =
                        numberValue(
                            product.purchasePrice
                        );

                    const salePrice =
                        numberValue(
                            product.salePrice
                        );

                    const minStock =
                        numberValue(
                            product.minStock
                        );


                    let status =
                        "OK";


                    if (stock <= 0) {

                        status =
                            "OUT OF STOCK";

                    } else if (
                        stock <= minStock
                    ) {

                        status =
                            "LOW STOCK";
                    }


                    return `

                        <tr>

                            <td>
                                ${escapeHTML(
                                    product.name
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    product.category ||
                                    "-"
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    product.unit ||
                                    "-"
                                )}
                            </td>

                            <td>
                                ${stock}
                            </td>

                            <td>
                                ${money(
                                    purchasePrice
                                )}
                            </td>

                            <td>
                                ${money(
                                    salePrice
                                )}
                            </td>

                            <td>
                                ${money(
                                    stock *
                                    purchasePrice
                                )}
                            </td>

                            <td>
                                ${status}
                            </td>

                        </tr>

                    `;
                }
            )
            .join("");
    }


    // ================================
    // CUSTOMER REPORT
    // ================================

    function renderCustomerReport(
        customers
    ) {

        const body =
            document.getElementById(
                "customerReportBody"
            );


        if (!customers.length) {

            body.innerHTML = `
                <tr>
                    <td
                        colspan="6"
                        class="report-empty"
                    >
                        No customers found.
                    </td>
                </tr>
            `;

            return;
        }


        body.innerHTML =
            customers.map(
                function (customer) {

                    const opening =
                        numberValue(
                            customer.openingBalance
                        );

                    const credit =
                        numberValue(
                            customer.creditSaleTotal
                        );

                    const payment =
                        numberValue(
                            customer.paymentTotal
                        );

                    const current =
                        numberValue(
                            customer.currentBalance
                        );


                    return `

                        <tr>

                            <td>
                                ${escapeHTML(
                                    customer.name
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    customer.phone ||
                                    "-"
                                )}
                            </td>

                            <td>
                                ${money(
                                    Math.abs(opening)
                                )}
                            </td>

                            <td>
                                ${money(
                                    credit
                                )}
                            </td>

                            <td>
                                ${money(
                                    payment
                                )}
                            </td>

                            <td>
                                <strong>
                                    ${money(
                                        Math.max(
                                            current,
                                            0
                                        )
                                    )}
                                </strong>
                            </td>

                        </tr>

                    `;
                }
            )
            .join("");
    }


    // ================================
    // SUPPLIER REPORT
    // ================================

    function renderSupplierReport(
        suppliers
    ) {

        const body =
            document.getElementById(
                "supplierReportBody"
            );


        if (!suppliers.length) {

            body.innerHTML = `
                <tr>
                    <td
                        colspan="6"
                        class="report-empty"
                    >
                        No suppliers found.
                    </td>
                </tr>
            `;

            return;
        }


        body.innerHTML =
            suppliers.map(
                function (supplier) {

                    const opening =
                        numberValue(
                            supplier.openingBalance
                        );

                    const purchase =
                        numberValue(
                            supplier.purchaseTotal
                        );

                    const payment =
                        numberValue(
                            supplier.paymentTotal
                        );

                    const current =
                        numberValue(
                            supplier.currentBalance
                        );


                    return `

                        <tr>

                            <td>
                                ${escapeHTML(
                                    supplier.name
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    supplier.phone ||
                                    "-"
                                )}
                            </td>

                            <td>
                                ${money(
                                    Math.abs(opening)
                                )}
                            </td>

                            <td>
                                ${money(
                                    purchase
                                )}
                            </td>

                            <td>
                                ${money(
                                    payment
                                )}
                            </td>

                            <td>
                                <strong>
                                    ${money(
                                        Math.max(
                                            current,
                                            0
                                        )
                                    )}
                                </strong>
                            </td>

                        </tr>

                    `;
                }
            )
            .join("");
    }


    // ================================
    // PROFIT / LOSS
    // ================================

    function calculateProfit(
        sales,
        purchases,
        finance
    ) {

        const filteredSales =
            sales.filter(
                function (sale) {

                    return dateAllowed(
                        sale.date
                    );
                }
            );


        const filteredPurchases =
            purchases.filter(
                function (purchase) {

                    return dateAllowed(
                        purchase.date
                    );
                }
            );


        const filteredFinance =
            finance.filter(
                function (transaction) {

                    return dateAllowed(
                        transaction.date
                    );
                }
            );


        const salesTotal =
            filteredSales.reduce(
                function (sum, sale) {

                    return sum +
                        numberValue(
                            sale.total
                        );

                },
                0
            );


        /*
         * Current purchase total is used
         * as an estimated cost.
         *
         * True FIFO COGS will be added
         * later when FIFO lot accounting
         * is implemented.
         */
        const purchaseCost =
            filteredSales.reduce(
                function (sum, sale) {

                    const qty =
                        numberValue(
                            sale.qty
                        );

                    const rate =
                        numberValue(
                            sale.rate
                        );

                    return sum +
                        (
                            qty * rate
                        );

                },
                0
            );


        const expenseTotal =
            filteredFinance.reduce(
                function (sum, transaction) {

                    if (
                        transaction.type ===
                        "EXPENSE"
                    ) {

                        return sum +
                            numberValue(
                                transaction.amount
                            );
                    }

                    return sum;

                },
                0
            );


        const grossProfit =
            salesTotal -
            purchaseCost;


        const netProfit =
            grossProfit -
            expenseTotal;


        return {

            salesTotal,

            purchaseTotal:
                filteredPurchases.reduce(
                    function (sum, purchase) {

                        return sum +
                            numberValue(
                                purchase.total
                            );

                    },
                    0
                ),

            purchaseCost,

            expenseTotal,

            grossProfit,

            netProfit
        };
    }


    // ================================
    // SUMMARY RENDER
    // ================================

    function renderReports() {

        const data =
            loadAllData();


        const salesTotal =
            renderSalesReport(
                data.sales
            );


        const purchaseTotal =
            renderPurchaseReport(
                data.purchases
            );


        renderStockReport(
            data.products
        );


        renderCustomerReport(
            data.customers
        );


        renderSupplierReport(
            data.suppliers
        );


        const profit =
            calculateProfit(
                data.sales,
                data.purchases,
                data.finance
            );


        document.getElementById(
            "reportSales"
        ).textContent =
            money(salesTotal);


        document.getElementById(
            "reportPurchases"
        ).textContent =
            money(purchaseTotal);


        document.getElementById(
            "reportExpenses"
        ).textContent =
            money(
                profit.expenseTotal
            );


        document.getElementById(
            "reportGrossProfit"
        ).textContent =
            money(
                profit.grossProfit
            );


        document.getElementById(
            "profitSales"
        ).textContent =
            money(
                profit.salesTotal
            );


        document.getElementById(
            "profitCost"
        ).textContent =
            money(
                profit.purchaseCost
            );


        document.getElementById(
            "profitGross"
        ).textContent =
            money(
                profit.grossProfit
            );


        document.getElementById(
            "profitExpense"
        ).textContent =
            money(
                profit.expenseTotal
            );


        const netElement =
            document.getElementById(
                "profitNet"
            );


        netElement.textContent =
            money(
                profit.netProfit
            );


        netElement.classList.remove(
            "report-positive",
            "report-negative"
        );


        if (
            profit.netProfit > 0
        ) {

            netElement.classList.add(
                "report-positive"
            );

        } else if (
            profit.netProfit < 0
        ) {

            netElement.classList.add(
                "report-negative"
            );
        }
    }


    // ================================
    // TABS
    // ================================

    document
        .querySelectorAll(
            ".report-tab"
        )
        .forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        document
                            .querySelectorAll(
                                ".report-tab"
                            )
                            .forEach(
                                function (item) {

                                    item.classList.remove(
                                        "active"
                                    );
                                }
                            );


                        document
                            .querySelectorAll(
                                ".report-panel"
                            )
                            .forEach(
                                function (panel) {

                                    panel.classList.remove(
                                        "active"
                                    );
                                }
                            );


                        button.classList.add(
                            "active"
                        );


                        const reportName =
                            button.dataset.report;


                        const panel =
                            document.getElementById(
                                "report-" +
                                reportName
                            );


                        if (panel) {

                            panel.classList.add(
                                "active"
                            );
                        }

                    }
                );
            }
        );


    // ================================
    // EVENTS
    // ================================

    applyFilterBtn.addEventListener(
        "click",
        function () {

            if (
                fromDate.value &&
                toDate.value &&
                fromDate.value >
                toDate.value
            ) {

                alert(
                    "From Date cannot be later than To Date."
                );

                return;
            }


            renderReports();
        }
    );


    refreshBtn.addEventListener(
        "click",
        function () {

            renderReports();
        }
    );


    // ================================
    // INITIAL LOAD
    // ================================

    renderReports();

});
