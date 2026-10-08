const CUSTOMER_KEY = "gs_customers";

document.addEventListener("DOMContentLoaded", function () {

    // ==============================
    // ELEMENTS
    // ==============================

    const customerForm = document.getElementById("customerForm");
    const customerModal = document.getElementById("customerModal");
    const customerModalTitle = document.getElementById("customerModalTitle");

    const newCustomerBtn = document.getElementById("newCustomerBtn");
    const closeCustomerModal = document.getElementById("closeCustomerModal");
    const cancelCustomerBtn = document.getElementById("cancelCustomerBtn");

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


    // ==============================
    // STORAGE
    // ==============================

    function getCustomers() {

        try {

            return JSON.parse(
                localStorage.getItem(CUSTOMER_KEY)
            ) || [];

        } catch (error) {

            console.error(
                "Customer data error:",
                error
            );

            return [];
        }
    }


    function saveCustomers(customers) {

        localStorage.setItem(
            CUSTOMER_KEY,
            JSON.stringify(customers)
        );
    }


    // ==============================
    // HELPERS
    // ==============================

    function money(value) {

        const number = Number(value) || 0;

        return "Rs. " + number.toLocaleString(
            "en-IN",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );
    }


    function numberValue(value) {

        const number = parseFloat(value);

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


    function generateCustomerId() {

        return (
            "CUS-" +
            Date.now() +
            "-" +
            Math.floor(Math.random() * 10000)
        );
    }


    // ==============================
    // MODAL
    // ==============================

    function openCustomerModal(customer) {

        if (!customerModal) return;

        customerModal.classList.add("show");

        if (customer) {

            if (customerModalTitle) {
                customerModalTitle.textContent =
                    "Edit Customer";
            }

            customerId.value =
                customer.id || "";

            customerName.value =
                customer.name || "";

            customerPhone.value =
                customer.phone || "";

            customerAddress.value =
                customer.address || "";

            customerOpeningBalance.value =
                Math.abs(
                    Number(customer.openingBalance) || 0
                );

            customerBalanceType.value =
                customer.balanceType || "DUE";

            customerNote.value =
                customer.note || "";

            customerActive.value =
                customer.active === false
                    ? "false"
                    : "true";

        } else {

            if (customerModalTitle) {
                customerModalTitle.textContent =
                    "New Customer";
            }

            customerForm.reset();

            customerId.value = "";

            customerOpeningBalance.value = "0";

            customerBalanceType.value = "DUE";

            customerActive.value = "true";
        }
    }


    function closeModal() {

        if (!customerModal) return;

        customerModal.classList.remove("show");
    }


    // ==============================
    // SUMMARY
    // ==============================

    function updateSummary() {

        const customers = getCustomers();

        let due = 0;
        let advance = 0;
        let active = 0;

        customers.forEach(function (customer) {

            const balance =
                Number(customer.currentBalance) || 0;

            if (balance > 0) {

                due += balance;

            } else if (balance < 0) {

                advance += Math.abs(balance);
            }


            if (customer.active !== false) {

                active++;
            }
        });


        if (totalCustomers) {

            totalCustomers.textContent =
                customers.length;
        }


        if (totalCustomerDue) {

            totalCustomerDue.textContent =
                money(due);
        }


        if (totalCustomerAdvance) {

            totalCustomerAdvance.textContent =
                money(advance);
        }


        if (activeCustomers) {

            activeCustomers.textContent =
                active;
        }
    }


    // ==============================
    // RENDER CUSTOMERS
    // ==============================

    function renderCustomers(searchText) {

        if (!customerTableBody) return;

        const customers = getCustomers();

        const search =
            String(searchText || "")
                .trim()
                .toLowerCase();


        let filtered = customers;


        if (search) {

            filtered = customers.filter(
                function (customer) {

                    const name =
                        String(customer.name || "")
                            .toLowerCase();

                    const phone =
                        String(customer.phone || "")
                            .toLowerCase();

                    const address =
                        String(customer.address || "")
                            .toLowerCase();

                    return (
                        name.includes(search) ||
                        phone.includes(search) ||
                        address.includes(search)
                    );
                }
            );
        }


        if (filtered.length === 0) {

            customerTableBody.innerHTML = `
                <tr>
                    <td
                        colspan="7"
                        class="empty-state"
                    >
                        ${
                            search
                                ? "Search गर्दा Customer भेटिएन।"
                                : "अहिलेसम्म कुनै Customer छैन।"
                        }
                    </td>
                </tr>
            `;

            updateSummary();

            return;
        }


        customerTableBody.innerHTML =
            filtered.map(
                function (customer) {

                    const opening =
                        Number(
                            customer.openingBalance
                        ) || 0;

                    const balance =
                        Number(
                            customer.currentBalance
                        ) || 0;


                    let balanceType =
                        "Clear";

                    let balanceDisplay =
                        money(0);


                    if (balance > 0) {

                        balanceType = "Due";

                        balanceDisplay =
                            money(balance);

                    } else if (balance < 0) {

                        balanceType = "Advance";

                        balanceDisplay =
                            money(
                                Math.abs(balance)
                            );
                    }


                    return `
                        <tr>

                            <td>
                                <strong>
                                    ${escapeHTML(
                                        customer.name || "-"
                                    )}
                                </strong>
                            </td>

                            <td>
                                ${escapeHTML(
                                    customer.phone || "-"
                                )}
                            </td>

                            <td>
                                ${money(opening)}
                            </td>

                            <td>
                                ${balanceDisplay}
                            </td>

                            <td>
                                ${balanceType}
                            </td>

                            <td>
                                ${
                                    customer.active !== false
                                        ? "Active"
                                        : "Inactive"
                                }
                            </td>

                            <td>

                                <button
                                    type="button"
                                    class="secondary-btn edit-customer-btn"
                                    data-id="${escapeHTML(
                                        customer.id
                                    )}"
                                >
                                    Edit
                                </button>

                            </td>

                        </tr>
                    `;
                }
            ).join("");


        updateSummary();
    }


    // ==============================
    // SAVE CUSTOMER
    // ==============================

    function saveCustomer() {

        if (!customerForm) return;


        const name =
            customerName.value.trim();

        const phone =
            customerPhone.value.trim();

        const address =
            customerAddress.value.trim();

        const openingBalance =
            numberValue(
                customerOpeningBalance.value
            );

        const balanceType =
            customerBalanceType.value || "DUE";

        const note =
            customerNote.value.trim();

        const active =
            customerActive.value !== "false";


        if (!name) {

            alert(
                "Customer Name राख्नुहोस्।"
            );

            customerName.focus();

            return;
        }


        const customers =
            getCustomers();


        const existingId =
            customerId.value.trim();


        // ==========================
        // EDIT EXISTING CUSTOMER
        // ==========================

        if (existingId) {

            const index =
                customers.findIndex(
                    function (customer) {
                        return customer.id === existingId;
                    }
                );


            if (index === -1) {

                alert(
                    "Customer record भेटिएन।"
                );

                return;
            }


            const oldCustomer =
                customers[index];


            /*
             * Existing customer's current
             * transaction balance should
             * not be destroyed during edit.
             *
             * Opening balance is updated
             * while current transaction
             * balance is preserved.
             */

            const oldOpening =
                Number(
                    oldCustomer.openingBalance
                ) || 0;


            let newOpeningSigned =
                openingBalance;


            if (balanceType === "ADVANCE") {

                newOpeningSigned =
                    -openingBalance;
            }


            const transactionBalance =
                (
                    Number(
                        oldCustomer.currentBalance
                    ) || 0
                ) -
                oldOpening;


            const newCurrentBalance =
                newOpeningSigned +
                transactionBalance;


            customers[index] = {

                ...oldCustomer,

                name,
                phone,
                address,

                openingBalance:
                    newOpeningSigned,

                balanceType,

                currentBalance:
                    newCurrentBalance,

                note,

                active,

                updatedAt:
                    new Date().toISOString()
            };


            saveCustomers(customers);

            closeModal();

            renderCustomers(
                customerSearch
                    ? customerSearch.value
                    : ""
            );

            alert(
                "Customer update सफल भयो।"
            );

            return;
        }


        // ==========================
        // NEW CUSTOMER
        // ==========================

        let openingSigned =
            openingBalance;


        if (balanceType === "ADVANCE") {

            openingSigned =
                -openingBalance;
        }


        const newCustomer = {

            id:
                generateCustomerId(),

            name,

            phone,

            address,

            openingBalance:
                openingSigned,

            balanceType,

            currentBalance:
                openingSigned,

            note,

            active,

            createdAt:
                new Date().toISOString(),

            updatedAt:
                new Date().toISOString()
        };


        customers.push(
            newCustomer
        );


        saveCustomers(
            customers
        );


        closeModal();


        renderCustomers(
            customerSearch
                ? customerSearch.value
                : ""
        );


        alert(
            "Customer सफलतापूर्वक save भयो।"
        );
    }


    // ==============================
    // EDIT CUSTOMER
    // ==============================

    function editCustomer(id) {

        const customers =
            getCustomers();


        const customer =
            customers.find(
                function (item) {
                    return item.id === id;
                }
            );


        if (!customer) {

            alert(
                "Customer record भेटिएन।"
            );

            return;
        }


        openCustomerModal(
            customer
        );
    }


    // ==============================
    // EVENTS
    // ==============================

    if (newCustomerBtn) {

        newCustomerBtn.addEventListener(
            "click",
            function () {

                openCustomerModal();
            }
        );
    }


    if (closeCustomerModal) {

        closeCustomerModal.addEventListener(
            "click",
            closeModal
        );
    }


    if (cancelCustomerBtn) {

        cancelCustomerBtn.addEventListener(
            "click",
            closeModal
        );
    }


    if (customerModal) {

        customerModal.addEventListener(
            "click",
            function (event) {

                if (
                    event.target ===
                    customerModal
                ) {
                    closeModal();
                }
            }
        );
    }


    if (customerForm) {

        customerForm.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();

                saveCustomer();
            }
        );
    }


    if (customerSearch) {

        customerSearch.addEventListener(
            "input",
            function () {

                renderCustomers(
                    customerSearch.value
                );
            }
        );
    }


    if (customerTableBody) {

        customerTableBody.addEventListener(
            "click",
            function (event) {

                const button =
                    event.target.closest(
                        ".edit-customer-btn"
                    );


                if (!button) return;


                const id =
                    button.getAttribute(
                        "data-id"
                    );


                if (id) {

                    editCustomer(id);
                }
            }
        );
    }


    // ==============================
    // INITIALIZE
    // ==============================

    renderCustomers();

    updateSummary();

});
