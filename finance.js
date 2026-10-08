document.addEventListener("DOMContentLoaded", function () {

    const FINANCE_KEY = "gs_finance";


    // ================================
    // DOM
    // ================================

    const newFinanceBtn =
        document.getElementById("newFinanceBtn");

    const financeModal =
        document.getElementById("financeModal");

    const closeFinanceModal =
        document.getElementById("closeFinanceModal");

    const cancelFinanceBtn =
        document.getElementById("cancelFinanceBtn");

    const financeForm =
        document.getElementById("financeForm");

    const financeId =
        document.getElementById("financeId");

    const financeDate =
        document.getElementById("financeDate");

    const financeType =
        document.getElementById("financeType");

    const financeCategory =
        document.getElementById("financeCategory");

    const financeAccount =
        document.getElementById("financeAccount");

    const financeAmount =
        document.getElementById("financeAmount");

    const financeReference =
        document.getElementById("financeReference");

    const financeNote =
        document.getElementById("financeNote");

    const financeSearch =
        document.getElementById("financeSearch");

    const financeTableBody =
        document.getElementById("financeTableBody");


    // Summary

    const cashBalance =
        document.getElementById("cashBalance");

    const bankBalance =
        document.getElementById("bankBalance");

    const qrBalance =
        document.getElementById("qrBalance");

    const totalBalance =
        document.getElementById("totalBalance");

    const totalIncome =
        document.getElementById("totalIncome");

    const totalExpense =
        document.getElementById("totalExpense");

    const totalPayment =
        document.getElementById("totalPayment");

    const totalTransactions =
        document.getElementById("totalTransactions");


    // ================================
    // STORAGE
    // ================================

    function getTransactions() {

        try {

            const data =
                localStorage.getItem(
                    FINANCE_KEY
                );

            if (!data) {
                return [];
            }

            const transactions =
                JSON.parse(data);

            return Array.isArray(
                transactions
            )
                ? transactions
                : [];

        } catch (error) {

            console.error(
                "Finance data error:",
                error
            );

            return [];
        }
    }


    function saveTransactions(
        transactions
    ) {

        localStorage.setItem(
            FINANCE_KEY,
            JSON.stringify(
                transactions
            )
        );
    }


    // ================================
    // HELPERS
    // ================================

    function money(value) {

        const number =
            Number(value) || 0;

        return "Rs. " +
            number.toLocaleString(
                "en-IN",
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            );
    }


    function numberValue(value) {

        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : 0;
    }


    function escapeHTML(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function generateId() {

        return (
            "FIN-" +
            Date.now() +
            "-" +
            Math.floor(
                Math.random() * 10000
            )
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
            ).padStart(2, "0");

        const day =
            String(
                date.getDate()
            ).padStart(2, "0");

        return (
            year +
            "-" +
            month +
            "-" +
            day
        );
    }


    // ================================
    // MODAL
    // ================================

    function openFinanceModal(
        transaction = null
    ) {

        financeForm.reset();

        financeId.value = "";

        financeDate.value =
            today();

        financeType.value =
            "INCOME";

        financeCategory.value =
            "SALES";

        financeAccount.value =
            "CASH";


        const title =
            document.getElementById(
                "financeModalTitle"
            );


        if (transaction) {

            title.textContent =
                "Edit Transaction";


            financeId.value =
                transaction.id || "";

            financeDate.value =
                transaction.date || today();

            financeType.value =
                transaction.type || "INCOME";

            financeCategory.value =
                transaction.category || "OTHER";

            financeAccount.value =
                transaction.account || "CASH";

            financeAmount.value =
                transaction.amount || "";

            financeReference.value =
                transaction.reference || "";

            financeNote.value =
                transaction.note || "";

        } else {

            title.textContent =
                "New Transaction";
        }


        financeModal.classList.add(
            "show"
        );


        setTimeout(
            function () {
                financeAmount.focus();
            },
            100
        );
    }


    function closeModal() {

        financeModal.classList.remove(
            "show"
        );
    }


    // ================================
    // CALCULATE BALANCES
    // ================================

    function calculateFinance(
        transactions
    ) {

        const accounts = {
            CASH: 0,
            BANK: 0,
            QR: 0
        };


        let income = 0;

        let expense = 0;

        let payment = 0;


        transactions.forEach(
            function (transaction) {

                const amount =
                    numberValue(
                        transaction.amount
                    );


                const account =
                    transaction.account;


                if (
                    transaction.type ===
                    "INCOME"
                ) {

                    accounts[account] =
                        (
                            accounts[account] ||
                            0
                        ) + amount;

                    income += amount;

                }


                else if (
                    transaction.type ===
                    "EXPENSE"
                ) {

                    accounts[account] =
                        (
                            accounts[account] ||
                            0
                        ) - amount;

                    expense += amount;

                }


                else if (
                    transaction.type ===
                    "PAYMENT"
                ) {

                    accounts[account] =
                        (
                            accounts[account] ||
                            0
                        ) - amount;

                    payment += amount;
                }

            }
        );


        return {
            accounts,
            income,
            expense,
            payment
        };
    }


    // ================================
    // SUMMARY
    // ================================

    function updateSummary(
        transactions
    ) {

        const result =
            calculateFinance(
                transactions
            );


        cashBalance.textContent =
            money(
                result.accounts.CASH
            );


        bankBalance.textContent =
            money(
                result.accounts.BANK
            );


        qrBalance.textContent =
            money(
                result.accounts.QR
            );


        const total =
            result.accounts.CASH +
            result.accounts.BANK +
            result.accounts.QR;


        totalBalance.textContent =
            money(total);


        totalIncome.textContent =
            money(result.income);


        totalExpense.textContent =
            money(result.expense);


        totalPayment.textContent =
            money(result.payment);


        totalTransactions.textContent =
            transactions.length;
    }


    // ================================
    // RENDER
    // ================================

    function renderTransactions(
        transactions = getTransactions()
    ) {

        updateSummary(
            transactions
        );


        const searchText =
            financeSearch.value
                .trim()
                .toLowerCase();


        const filtered =
            transactions
                .slice()
                .reverse()
                .filter(
                    function (transaction) {

                        if (!searchText) {
                            return true;
                        }


                        const text = [

                            transaction.date,

                            transaction.type,

                            transaction.category,

                            transaction.account,

                            transaction.amount,

                            transaction.reference,

                            transaction.note

                        ]
                            .join(" ")
                            .toLowerCase();


                        return text.includes(
                            searchText
                        );
                    }
                );


        if (!filtered.length) {

            financeTableBody.innerHTML = `
                <tr>
                    <td
                        colspan="7"
                        class="finance-empty"
                    >
                        No transactions found.
                    </td>
                </tr>
            `;

            return;
        }


        financeTableBody.innerHTML =
            filtered.map(
                function (transaction) {

                    const amount =
                        numberValue(
                            transaction.amount
                        );


                    let amountText =
                        money(amount);


                    if (
                        transaction.type ===
                        "INCOME"
                    ) {

                        amountText =
                            "+ " +
                            amountText;

                    } else {

                        amountText =
                            "- " +
                            amountText;
                    }


                    const typeText =
                        transaction.type ===
                        "INCOME"
                            ? "Income"
                            : transaction.type ===
                              "EXPENSE"
                                ? "Expense"
                                : "Payment";


                    const categoryText =
                        String(
                            transaction.category ||
                            "-"
                        )
                        .replace(
                            /_/g,
                            " "
                        );


                    return `

                        <tr>

                            <td>
                                ${escapeHTML(
                                    transaction.date
                                )}
                            </td>


                            <td>
                                <strong>
                                    ${typeText}
                                </strong>
                            </td>


                            <td>
                                ${escapeHTML(
                                    categoryText
                                )}
                            </td>


                            <td>
                                ${escapeHTML(
                                    transaction.account ||
                                    "-"
                                )}
                            </td>


                            <td>
                                <strong>
                                    ${escapeHTML(
                                        amountText
                                    )}
                                </strong>
                            </td>


                            <td>

                                ${escapeHTML(
                                    transaction.note ||
                                    transaction.reference ||
                                    "-"
                                )}

                            </td>


                            <td>

                                <button
                                    type="button"
                                    class="btn edit-finance-btn"
                                    data-id="${escapeHTML(
                                        transaction.id
                                    )}"
                                >
                                    Edit
                                </button>

                                <button
                                    type="button"
                                    class="btn delete-finance-btn"
                                    data-id="${escapeHTML(
                                        transaction.id
                                    )}"
                                >
                                    Delete
                                </button>

                            </td>

                        </tr>

                    `;
                }
            ).join("");
    }


    // ================================
    // SAVE
    // ================================

    financeForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();


            const amount =
                numberValue(
                    financeAmount.value
                );


            if (amount <= 0) {

                alert(
                    "Amount must be greater than 0."
                );

                financeAmount.focus();

                return;
            }


            const transactions =
                getTransactions();


            const id =
                financeId.value ||
                generateId();


            const existingIndex =
                transactions.findIndex(
                    function (item) {

                        return item.id === id;
                    }
                );


            const transaction = {

                id: id,

                date:
                    financeDate.value,

                type:
                    financeType.value,

                category:
                    financeCategory.value,

                account:
                    financeAccount.value,

                amount:
                    amount,

                reference:
                    financeReference.value
                        .trim(),

                note:
                    financeNote.value
                        .trim(),

                createdAt:
                    existingIndex === -1
                        ? new Date()
                            .toISOString()
                        : (
                            transactions[
                                existingIndex
                            ].createdAt ||
                            new Date()
                                .toISOString()
                        ),

                updatedAt:
                    new Date()
                        .toISOString()
            };


            if (
                existingIndex === -1
            ) {

                transactions.push(
                    transaction
                );

            } else {

                transactions[
                    existingIndex
                ] = transaction;
            }


            saveTransactions(
                transactions
            );


            closeModal();


            renderTransactions(
                transactions
            );


            alert(
                existingIndex === -1
                    ? "Transaction saved successfully."
                    : "Transaction updated successfully."
            );
        }
    );


    // ================================
    // EDIT / DELETE
    // ================================

    financeTableBody.addEventListener(
        "click",
        function (event) {

            const editButton =
                event.target.closest(
                    ".edit-finance-btn"
                );


            const deleteButton =
                event.target.closest(
                    ".delete-finance-btn"
                );


            const transactions =
                getTransactions();


            if (editButton) {

                const transaction =
                    transactions.find(
                        function (item) {

                            return (
                                item.id ===
                                editButton.dataset.id
                            );
                        }
                    );


                if (!transaction) {

                    alert(
                        "Transaction not found."
                    );

                    return;
                }


                openFinanceModal(
                    transaction
                );

                return;
            }


            if (deleteButton) {

                const id =
                    deleteButton.dataset.id;


                const confirmed =
                    confirm(
                        "Delete this transaction?"
                    );


                if (!confirmed) {
                    return;
                }


                const updated =
                    transactions.filter(
                        function (item) {

                            return item.id !== id;
                        }
                    );


                saveTransactions(
                    updated
                );


                renderTransactions(
                    updated
                );
            }

        }
    );


    // ================================
    // BUTTON EVENTS
    // ================================

    newFinanceBtn.addEventListener(
        "click",
        function () {

            openFinanceModal();
        }
    );


    closeFinanceModal.addEventListener(
        "click",
        closeModal
    );


    cancelFinanceBtn.addEventListener(
        "click",
        closeModal
    );


    financeModal.addEventListener(
        "click",
        function (event) {

            if (
                event.target ===
                financeModal
            ) {

                closeModal();
            }
        }
    );


    financeSearch.addEventListener(
        "input",
        function () {

            renderTransactions(
                getTransactions()
            );
        }
    );


    document.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Escape" &&
                financeModal.classList.contains(
                    "show"
                )
            ) {

                closeModal();
            }
        }
    );


    // ================================
    // INITIAL LOAD
    // ================================

    renderTransactions();

});
