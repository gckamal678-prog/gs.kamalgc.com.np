document.addEventListener("DOMContentLoaded", function () {

    "use strict";

    // =====================================
    // CONFIGURATION
    // =====================================

    const FINANCE_KEY = "gs_finance";

    const VALID_TYPES = [
        "INCOME",
        "EXPENSE",
        "PAYMENT"
    ];

    const VALID_ACCOUNTS = [
        "CASH",
        "BANK",
        "QR"
    ];

    const CATEGORY_LABELS = {
        SALES: "Sales",
        CUSTOMER_COLLECTION: "Customer Collection",
        OTHER_INCOME: "Other Income",
        PURCHASE_PAYMENT: "Purchase Payment",
        SUPPLIER_PAYMENT: "Supplier Payment",
        EXPENSE: "Expense",
        WITHDRAWAL: "Cash Withdrawal",
        OTHER: "Other"
    };


    // =====================================
    // DOM ELEMENTS
    // =====================================

    const $ = function (id) {
        return document.getElementById(id);
    };

    const newFinanceBtn = $("newFinanceBtn");
    const financeModal = $("financeModal");
    const financeForm = $("financeForm");

    const closeFinanceModal = $("closeFinanceModal");
    const cancelFinanceBtn = $("cancelFinanceBtn");
    const clearFinanceBtn = $("clearFinanceBtn");

    const financeId = $("financeId");
    const financeDate = $("financeDate");
    const financeType = $("financeType");
    const financeCategory = $("financeCategory");
    const financeAccount = $("financeAccount");
    const financeAmount = $("financeAmount");
    const financeReference = $("financeReference");
    const financeNote = $("financeNote");

    const financeSearch = $("financeSearch");
    const financeTableBody = $("financeTableBody");

    const financeModalTitle = $("financeModalTitle");
    const financeMessage = $("financeMessage");
    const financeFormMessage = $("financeFormMessage");

    const saveFinanceBtn = $("saveFinanceBtn");

    const cashBalance = $("cashBalance");
    const bankBalance = $("bankBalance");
    const qrBalance = $("qrBalance");
    const totalBalance = $("totalBalance");

    const totalIncome = $("totalIncome");
    const totalExpense = $("totalExpense");
    const totalPayment = $("totalPayment");
    const totalTransactions = $("totalTransactions");


    // =====================================
    // CHECK REQUIRED ELEMENTS
    // =====================================

    const requiredElements = [
        newFinanceBtn,
        financeModal,
        financeForm,
        closeFinanceModal,
        cancelFinanceBtn,
        clearFinanceBtn,
        financeId,
        financeDate,
        financeType,
        financeCategory,
        financeAccount,
        financeAmount,
        financeReference,
        financeNote,
        financeSearch,
        financeTableBody,
        financeModalTitle,
        financeMessage,
        financeFormMessage,
        saveFinanceBtn,
        cashBalance,
        bankBalance,
        qrBalance,
        totalBalance,
        totalIncome,
        totalExpense,
        totalPayment,
        totalTransactions
    ];

    if (requiredElements.some(function (element) {
        return !element;
    })) {
        console.error(
            "Finance initialization failed. Check finance.html element IDs."
        );
        return;
    }


    // =====================================
    // STORAGE
    // =====================================

    function getTransactions() {
        try {
            const raw = localStorage.getItem(FINANCE_KEY);

            if (!raw) {
                return [];
            }

            const data = JSON.parse(raw);

            if (!Array.isArray(data)) {
                console.error("Finance storage is not an array.");
                return [];
            }

            return data.filter(function (item) {
                return item &&
                    typeof item === "object" &&
                    !Array.isArray(item);
            });

        } catch (error) {
            console.error("Unable to read finance data:", error);
            return [];
        }
    }


    function saveTransactions(transactions) {
        try {
            localStorage.setItem(
                FINANCE_KEY,
                JSON.stringify(transactions)
            );

            return true;

        } catch (error) {
            console.error("Unable to save finance data:", error);

            alert(
                "Transaction save हुन सकेन। " +
                "Browser storage full वा unavailable हुन सक्छ।"
            );

            return false;
        }
    }


    // =====================================
    // HELPERS
    // =====================================

    function money(value) {
        const number = Number(value) || 0;

        return "Rs. " + number.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }


    function numberValue(value) {
        const number = Number(value);

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


    function generateId() {
        if (window.crypto && window.crypto.randomUUID) {
            return "FIN-" + window.crypto.randomUUID();
        }

        return "FIN-" +
            Date.now() +
            "-" +
            Math.random().toString(36).slice(2, 11);
    }


    function today() {
        const date = new Date();

        const year = date.getFullYear();

        const month = String(
            date.getMonth() + 1
        ).padStart(2, "0");

        const day = String(
            date.getDate()
        ).padStart(2, "0");

        return year + "-" + month + "-" + day;
    }


    function categoryLabel(category) {
        return CATEGORY_LABELS[category] ||
            String(category || "Other")
                .replace(/_/g, " ");
    }


    function accountLabel(account) {
        const labels = {
            CASH: "Cash",
            BANK: "Bank",
            QR: "QR"
        };

        return labels[account] || account || "-";
    }


    function typeLabel(type) {
        const labels = {
            INCOME: "Income",
            EXPENSE: "Expense",
            PAYMENT: "Payment"
        };

        return labels[type] || type || "-";
    }


    function showMessage(element, message, type) {
        element.textContent = message;

        element.className =
            "finance-message show " + type;
    }


    function hideMessage(element) {
        element.textContent = "";
        element.className = "finance-message";
    }


    // =====================================
    // MODAL OPEN
    // =====================================

    let previousFocus = null;

    function openFinanceModal(transaction = null) {

        previousFocus = document.activeElement;

        // Reset before filling edit data.
        financeForm.reset();

        hideMessage(financeFormMessage);

        financeId.value = "";
        financeDate.value = today();
        financeType.value = "INCOME";
        financeCategory.value = "SALES";
        financeAccount.value = "CASH";
        financeAmount.value = "";
        financeReference.value = "";
        financeNote.value = "";

        if (transaction) {

            financeModalTitle.textContent = "Edit Transaction";

            financeId.value = transaction.id || "";

            financeDate.value =
                transaction.date || today();

            financeType.value =
                VALID_TYPES.includes(transaction.type)
                    ? transaction.type
                    : "INCOME";

            financeCategory.value =
                transaction.category || "OTHER";

            financeAccount.value =
                VALID_ACCOUNTS.includes(transaction.account)
                    ? transaction.account
                    : "CASH";

            financeAmount.value =
                transaction.amount ?? "";

            financeReference.value =
                transaction.reference || "";

            financeNote.value =
                transaction.note || "";

            saveFinanceBtn.textContent = "Update Transaction";

        } else {

            financeModalTitle.textContent = "New Transaction";

            saveFinanceBtn.textContent = "Save Transaction";
        }

        // Show the modal.
        financeModal.classList.add("show");
        financeModal.setAttribute("aria-hidden", "false");

        document.body.classList.add("finance-modal-open");

        // Focus only after the modal is visible.
        requestAnimationFrame(function () {
            if (financeModal.classList.contains("show")) {
                financeAmount.focus();
            }
        });
    }


    // =====================================
    // MODAL CLOSE
    // =====================================

    function closeFinanceModalFn() {

        financeModal.classList.remove("show");
        financeModal.setAttribute("aria-hidden", "true");

        document.body.classList.remove("finance-modal-open");

        hideMessage(financeFormMessage);

        if (
            previousFocus &&
            typeof previousFocus.focus === "function" &&
            document.contains(previousFocus)
        ) {
            previousFocus.focus();
        }
    }


    // =====================================
    // BALANCE CALCULATION
    // =====================================

    function calculateFinance(transactions) {

        const accounts = {
            CASH: 0,
            BANK: 0,
            QR: 0
        };

        let income = 0;
        let expense = 0;
        let payment = 0;

        transactions.forEach(function (transaction) {

            const amount = numberValue(transaction.amount);

            const account = transaction.account;

            if (
                !VALID_ACCOUNTS.includes(account) ||
                !VALID_TYPES.includes(transaction.type) ||
                amount <= 0
            ) {
                return;
            }

            if (transaction.type === "INCOME") {

                accounts[account] += amount;
                income += amount;

            } else if (transaction.type === "EXPENSE") {

                accounts[account] -= amount;
                expense += amount;

            } else if (transaction.type === "PAYMENT") {

                accounts[account] -= amount;
                payment += amount;
            }
        });

        return {
            accounts: accounts,
            income: income,
            expense: expense,
            payment: payment
        };
    }


    // =====================================
    // SUMMARY UPDATE
    // =====================================

    function updateSummary(transactions) {

        const result = calculateFinance(transactions);

        cashBalance.textContent =
            money(result.accounts.CASH);

        bankBalance.textContent =
            money(result.accounts.BANK);

        qrBalance.textContent =
            money(result.accounts.QR);

        totalBalance.textContent = money(
            result.accounts.CASH +
            result.accounts.BANK +
            result.accounts.QR
        );

        totalIncome.textContent = money(result.income);

        totalExpense.textContent = money(result.expense);

        totalPayment.textContent = money(result.payment);

        totalTransactions.textContent = transactions.length;
    }


    // =====================================
    // RENDER TRANSACTION TABLE
    // =====================================

    function renderTransactions(
        transactions = getTransactions()
    ) {

        updateSummary(transactions);

        const searchText = financeSearch.value
            .trim()
            .toLowerCase();

        const filtered = transactions
            .slice()
            .reverse()
            .filter(function (transaction) {

                if (!searchText) {
                    return true;
                }

                const searchableText = [
                    transaction.date,
                    typeLabel(transaction.type),
                    transaction.type,
                    categoryLabel(transaction.category),
                    transaction.category,
                    accountLabel(transaction.account),
                    transaction.account,
                    transaction.amount,
                    transaction.reference,
                    transaction.note
                ]
                    .join(" ")
                    .toLowerCase();

                return searchableText.includes(searchText);
            });

        if (!filtered.length) {

            financeTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="finance-empty">
                        No transactions found.
                    </td>
                </tr>
            `;

            return;
        }

        financeTableBody.innerHTML = filtered.map(
            function (transaction) {

                const amount = numberValue(transaction.amount);

                const isIncome = transaction.type === "INCOME";

                const typeClass =
                    isIncome
                        ? "income"
                        : transaction.type === "EXPENSE"
                            ? "expense"
                            : "payment";

                const amountClass = isIncome
                    ? "finance-positive"
                    : "finance-negative";

                const amountText =
                    (isIncome ? "+ " : "- ") + money(amount);

                const noteText =
                    transaction.note ||
                    transaction.reference ||
                    "-";

                return `
                    <tr>
                        <td>${escapeHTML(transaction.date || "-")}</td>

                        <td>
                            <span class="finance-type ${typeClass}">
                                ${escapeHTML(typeLabel(transaction.type))}
                            </span>
                        </td>

                        <td>
                            ${escapeHTML(categoryLabel(transaction.category))}
                        </td>

                        <td>
                            ${escapeHTML(accountLabel(transaction.account))}
                        </td>

                        <td>
                            <strong class="${amountClass}">
                                ${escapeHTML(amountText)}
                            </strong>
                        </td>

                        <td>${escapeHTML(noteText)}</td>

                        <td>
                            <div style="display:flex;gap:6px;flex-wrap:wrap">
                                <button
                                    type="button"
                                    class="finance-btn edit-finance-btn"
                                    data-id="${escapeHTML(transaction.id)}">
                                    Edit
                                </button>

                                <button
                                    type="button"
                                    class="finance-btn danger delete-finance-btn"
                                    data-id="${escapeHTML(transaction.id)}">
                                    Delete
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }
        ).join("");
    }


    // =====================================
    // VALIDATE FORM
    // =====================================

    function validateTransaction() {

        if (!financeDate.value) {
            return "Please select the transaction date.";
        }

        if (!VALID_TYPES.includes(financeType.value)) {
            return "Please select a valid transaction type.";
        }

        if (!financeCategory.value) {
            return "Please select a transaction category.";
        }

        if (!VALID_ACCOUNTS.includes(financeAccount.value)) {
            return "Please select a valid account.";
        }

        const amount = Number(financeAmount.value);

        if (
            !Number.isFinite(amount) ||
            amount <= 0 ||
            financeAmount.value.trim() === ""
        ) {
            return "Amount must be greater than zero.";
        }

        if (amount > Number.MAX_SAFE_INTEGER) {
            return "Amount is too large.";
        }

        return "";
    }


    // =====================================
    // SAVE / UPDATE TRANSACTION
    // =====================================

    financeForm.addEventListener("submit", function (event) {

        event.preventDefault();

        hideMessage(financeFormMessage);

        const validationError = validateTransaction();

        if (validationError) {

            showMessage(
                financeFormMessage,
                validationError,
                "error"
            );

            financeAmount.focus();

            return;
        }

        const transactions = getTransactions();

        const editingId = financeId.value.trim();

        const existingIndex = editingId
            ? transactions.findIndex(function (item) {
                return item.id === editingId;
            })
            : -1;

        // Prevent accidentally creating a duplicate when editing.
        if (editingId && existingIndex === -1) {

            showMessage(
                financeFormMessage,
                "This transaction was not found. Close and reopen the form.",
                "error"
            );

            return;
        }

        const now = new Date().toISOString();

        const oldTransaction =
            existingIndex >= 0
                ? transactions[existingIndex]
                : null;

        const transaction = {

            id: oldTransaction
                ? oldTransaction.id
                : generateId(),

            date: financeDate.value,

            type: financeType.value,

            category: financeCategory.value,

            account: financeAccount.value,

            amount: Number(
                Number(financeAmount.value).toFixed(2)
            ),

            reference: financeReference.value.trim(),

            note: financeNote.value.trim(),

            createdAt: oldTransaction
                ? oldTransaction.createdAt || now
                : now,

            updatedAt: now
        };

        if (existingIndex === -1) {

            transactions.push(transaction);

        } else {

            transactions[existingIndex] = transaction;
        }

        // Close only after storage succeeds.
        if (!saveTransactions(transactions)) {
            return;
        }

        closeFinanceModalFn();

        renderTransactions(transactions);

        showMessage(
            financeMessage,
            existingIndex === -1
                ? "Transaction saved successfully."
                : "Transaction updated successfully.",
            "success"
        );
    });


    // =====================================
    // EDIT / DELETE
    // =====================================

    financeTableBody.addEventListener("click", function (event) {

        const target = event.target;

        if (!(target instanceof Element)) {
            return;
        }

        const editButton = target.closest(".edit-finance-btn");

        const deleteButton = target.closest(".delete-finance-btn");

        if (!editButton && !deleteButton) {
            return;
        }

        const transactions = getTransactions();

        if (editButton) {

            const transaction = transactions.find(function (item) {
                return item.id === editButton.dataset.id;
            });

            if (!transaction) {

                alert("Transaction not found.");

                renderTransactions();

                return;
            }

            openFinanceModal(transaction);

            return;
        }

        if (deleteButton) {

            const id = deleteButton.dataset.id;

            const confirmed = confirm(
                "Are you sure you want to delete this transaction?"
            );

            if (!confirmed) {
                return;
            }

            const updated = transactions.filter(function (item) {
                return item.id !== id;
            });

            if (!saveTransactions(updated)) {
                return;
            }

            renderTransactions(updated);

            showMessage(
                financeMessage,
                "Transaction deleted successfully.",
                "success"
            );
        }
    });


    // =====================================
    // NEW TRANSACTION BUTTON
    // =====================================

    newFinanceBtn.addEventListener("click", function () {
        openFinanceModal();
    });


    // =====================================
    // CLOSE BUTTONS
    // =====================================

    closeFinanceModal.addEventListener(
        "click",
        closeFinanceModalFn
    );

    cancelFinanceBtn.addEventListener(
        "click",
        closeFinanceModalFn
    );


    // =====================================
    // CLEAR FORM
    // =====================================

    clearFinanceBtn.addEventListener("click", function (event) {

        // Prevent the browser's default reset from clearing edit IDs.
        event.preventDefault();

        financeAmount.value = "";
        financeReference.value = "";
        financeNote.value = "";

        hideMessage(financeFormMessage);

        financeAmount.focus();
    });


    // =====================================
    // CLICK OUTSIDE TO CLOSE
    // =====================================

    financeModal.addEventListener("click", function (event) {

        if (event.target === financeModal) {
            closeFinanceModalFn();
        }
    });


    // =====================================
    // ESCAPE KEY TO CLOSE
    // =====================================

    document.addEventListener("keydown", function (event) {

        if (
            event.key === "Escape" &&
            financeModal.classList.contains("show")
        ) {
            closeFinanceModalFn();
        }
    });


    // =====================================
    // SEARCH
    // =====================================

    financeSearch.addEventListener("input", function () {

        renderTransactions(getTransactions());
    });


    // =====================================
    // INITIAL LOAD
    // =====================================

    renderTransactions();

});
