document.addEventListener("DOMContentLoaded", function () {

    const CUSTOMER_KEY = "gs_customers";

    const newCustomerBtn = document.getElementById("newCustomerBtn");
    const customerModal = document.getElementById("customerModal");
    const closeCustomerModal = document.getElementById("closeCustomerModal");
    const cancelCustomerBtn = document.getElementById("cancelCustomerBtn");

    const customerForm = document.getElementById("customerForm");

    const customerId = document.getElementById("customerId");
    const customerName = document.getElementById("customerName");
    const customerPhone = document.getElementById("customerPhone");
    const customerAddress = document.getElementById("customerAddress");
    const customerOpeningBalance = document.getElementById("customerOpeningBalance");
    const customerBalanceType = document.getElementById("customerBalanceType");
    const customerNote = document.getElementById("customerNote");
    const customerActive = document.getElementById("customerActive");

    const customerSearch = document.getElementById("customerSearch");
    const customerTableBody = document.getElementById("customerTableBody");

    const totalCustomers = document.getElementById("totalCustomers");
    const totalCustomerDue = document.getElementById("totalCustomerDue");
    const totalCustomerAdvance = document.getElementById("totalCustomerAdvance");
    const activeCustomers = document.getElementById("activeCustomers");


    // ================================
    // STORAGE
    // ================================

    function getCustomers() {

        try {
            const data = localStorage.getItem(CUSTOMER_KEY);

            if (!data) {
                return [];
            }

            const customers = JSON.parse(data);

            return Array.isArray(customers) ? customers : [];

        } catch (error) {

            console.error("Customer data error:", error);

            return [];
        }
    }


    function saveCustomers(customers) {

        localStorage.setItem(
            CUSTOMER_KEY,
            JSON.stringify(customers)
        );
    }


    // ================================
    // HELPERS
    // ================================

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


    function generateCustomerId() {

        return (
            "CUS-" +
            Date.now() +
            "-" +
            Math.floor(Math.random() * 10000)
        );
    }


    // ================================
    // MODAL
    // ================================

    function openCustomerModal(customer = null) {

        if (!customerModal) return;

        customerForm.reset();

        customerId.value = "";

        customerOpeningBalance.value = "0";
        customerBalanceType.value = "DUE";
        customerActive.value = "true";

        const title = document.getElementById("customerModalTitle");

        if (customer) {

            if (title) {
                title.textContent = "Edit Customer";
            }

            customerId.value = customer.id || "";
            customerName.value = customer.name || "";
            customerPhone.value = customer.phone || "";
            customerAddress.value = customer.address || "";

            const opening = Math.abs(
                numberValue(customer.openingBalance)
            );

            customerOpeningBalance.value = opening;

            customerBalanceType.value =
                customer.balanceType === "ADVANCE"
                    ? "ADVANCE"
                    : "DUE";

            customerNote.value = customer.note || "";

            customerActive.value =
                customer.active === false
                    ? "false"
                    : "true";

        } else {

            if (title) {
                title.textContent = "New Customer";
            }
        }

        customerModal.classList.add("show");

        setTimeout(function () {
            customerName.focus();
        }, 100);
    }


    function closeModal() {

        if (!customerModal) return;

        customerModal.classList.remove("show");
    }


    // ================================
    // SUMMARY
    // ================================

    function updateSummary(customers) {

        let due = 0;
        let advance = 0;
        let active = 0;

        customers.forEach(function (customer) {

            const balance = numberValue(
                customer.currentBalance
            );

            if (balance > 0) {
                due += balance;
            }

            if (balance < 0) {
                advance += Math.abs(balance);
            }

            if (customer.active !== false) {
                active++;
            }
        });


        totalCustomers.textContent = customers.length;

        totalCustomerDue.textContent = money(due);

        totalCustomerAdvance.textContent = money(advance);

        activeCustomers.textContent = active;
    }


    // ================================
    // RENDER TABLE
    // ================================

    function renderCustomers(customers = getCustomers()) {

        updateSummary(customers);

        const searchText =
            customerSearch.value
                .trim()
                .toLowerCase();


        const filtered = customers.filter(function (customer) {

            if (!searchText) {
                return true;
            }

            const text = [

                customer.name,
                customer.phone,
                customer.address,
                customer.note,
                customer.id

            ]
                .join(" ")
                .toLowerCase();

            return text.includes(searchText);
        });


        if (!filtered.length) {

            customerTableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="customer-empty">
                        No customers found.
                    </td>
                </tr>
            `;

            return;
        }


        customerTableBody.innerHTML = filtered.map(function (customer) {

            const opening = numberValue(
                customer.openingBalance
            );

            const current = numberValue(
                customer.currentBalance
            );

            const creditSale =
                numberValue(customer.creditSaleTotal);

            const collection =
                numberValue(customer.paymentTotal);


            let currentText = money(Math.abs(current));

            if (current > 0) {
                currentText += " Due";
            } else if (current < 0) {
                currentText += " Advance";
            } else {
                currentText = money(0);
            }


            const addressNote = [
                customer.address || "",
                customer.note || ""
            ]
                .filter(Boolean)
                .join(" / ");


            return `
                <tr>

                    <td>
                        <strong>
                            ${escapeHTML(customer.name)}
                        </strong>
                        ${
                            customer.active === false
                                ? `<small style="display:block;color:#999;">Inactive</small>`
                                : ""
                        }
                    </td>

                    <td>
                        ${escapeHTML(customer.phone || "-")}
                    </td>

                    <td>
                        ${escapeHTML(addressNote || "-")}
                    </td>

                    <td>
                        ${money(opening)}
                    </td>

                    <td>
                        ${money(creditSale)}
                    </td>

                    <td>
                        ${money(collection)}
                    </td>

                    <td>
                        <strong>
                            ${escapeHTML(currentText)}
                        </strong>
                    </td>

                    <td>

                        <button
                            type="button"
                            class="btn edit-customer-btn"
                            data-id="${escapeHTML(customer.id)}"
                        >
                            Edit
                        </button>

                    </td>

                </tr>
            `;

        }).join("");
    }


    // ================================
    // SAVE CUSTOMER
    // ================================

    customerForm.addEventListener("submit", function (event) {

        event.preventDefault();


        const name =
            customerName.value.trim();

        if (!name) {

            alert("Customer name is required.");

            customerName.focus();

            return;
        }


        const customers = getCustomers();


        const id =
            customerId.value ||
            generateCustomerId();


        const openingAmount =
            Math.abs(
                numberValue(
                    customerOpeningBalance.value
                )
            );


        const balanceType =
            customerBalanceType.value === "ADVANCE"
                ? "ADVANCE"
                : "DUE";


        const openingSigned =
            balanceType === "ADVANCE"
                ? -openingAmount
                : openingAmount;


        const existingIndex =
            customers.findIndex(function (customer) {
                return customer.id === id;
            });


        if (existingIndex === -1) {

            const newCustomer = {

                id: id,

                name: name,

                phone:
                    customerPhone.value.trim(),

                address:
                    customerAddress.value.trim(),

                openingBalance:
                    openingSigned,

                balanceType:
                    balanceType,

                currentBalance:
                    openingSigned,

                creditSaleTotal: 0,

                paymentTotal: 0,

                note:
                    customerNote.value.trim(),

                active:
                    customerActive.value !== "false",

                createdAt:
                    new Date().toISOString(),

                updatedAt:
                    new Date().toISOString()
            };


            customers.push(newCustomer);

        } else {

            const oldCustomer =
                customers[existingIndex];


            const oldOpening =
                numberValue(
                    oldCustomer.openingBalance
                );


            const oldCurrent =
                numberValue(
                    oldCustomer.currentBalance
                );


            /*
             * Keep transaction balance while
             * changing customer information.
             */
            const transactionBalance =
                oldCurrent - oldOpening;


            const newCurrentBalance =
                openingSigned +
                transactionBalance;


            customers[existingIndex] = {

                ...oldCustomer,

                name: name,

                phone:
                    customerPhone.value.trim(),

                address:
                    customerAddress.value.trim(),

                openingBalance:
                    openingSigned,

                balanceType:
                    balanceType,

                currentBalance:
                    newCurrentBalance,

                note:
                    customerNote.value.trim(),

                active:
                    customerActive.value !== "false",

                updatedAt:
                    new Date().toISOString()
            };
        }


        saveCustomers(customers);

        closeModal();

        renderCustomers(customers);

        alert(
            existingIndex === -1
                ? "Customer saved successfully."
                : "Customer updated successfully."
        );
    });


    // ================================
    // EDIT
    // ================================

    customerTableBody.addEventListener(
        "click",
        function (event) {

            const button =
                event.target.closest(
                    ".edit-customer-btn"
                );

            if (!button) return;


            const id =
                button.dataset.id;


            const customers =
                getCustomers();


            const customer =
                customers.find(function (item) {
                    return item.id === id;
                });


            if (!customer) {

                alert("Customer not found.");

                return;
            }


            openCustomerModal(customer);
        }
    );


    // ================================
    // BUTTON EVENTS
    // ================================

    newCustomerBtn.addEventListener(
        "click",
        function () {

            openCustomerModal();
        }
    );


    closeCustomerModal.addEventListener(
        "click",
        closeModal
    );


    cancelCustomerBtn.addEventListener(
        "click",
        closeModal
    );


    customerModal.addEventListener(
        "click",
        function (event) {

            if (event.target === customerModal) {
                closeModal();
            }
        }
    );


    customerSearch.addEventListener(
        "input",
        function () {

            renderCustomers(
                getCustomers()
            );
        }
    );


    // ESC key closes modal
    document.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Escape" &&
                customerModal.classList.contains("show")
            ) {
                closeModal();
            }
        }
    );


    // ================================
    // INITIAL LOAD
    // ================================

    renderCustomers();

});
