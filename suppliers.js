document.addEventListener("DOMContentLoaded", function () {

    const SUPPLIER_KEY = "gs_suppliers";


    // ================================
    // DOM
    // ================================

    const newSupplierBtn =
        document.getElementById("newSupplierBtn");

    const supplierModal =
        document.getElementById("supplierModal");

    const closeSupplierModal =
        document.getElementById("closeSupplierModal");

    const cancelSupplierBtn =
        document.getElementById("cancelSupplierBtn");

    const supplierForm =
        document.getElementById("supplierForm");

    const supplierId =
        document.getElementById("supplierId");

    const supplierName =
        document.getElementById("supplierName");

    const supplierPhone =
        document.getElementById("supplierPhone");

    const supplierAddress =
        document.getElementById("supplierAddress");

    const supplierTaxType =
        document.getElementById("supplierTaxType");

    const supplierTaxNumber =
        document.getElementById("supplierTaxNumber");

    const supplierOpeningBalance =
        document.getElementById("supplierOpeningBalance");

    const supplierBalanceType =
        document.getElementById("supplierBalanceType");

    const supplierNote =
        document.getElementById("supplierNote");

    const supplierActive =
        document.getElementById("supplierActive");

    const supplierSearch =
        document.getElementById("supplierSearch");

    const supplierTableBody =
        document.getElementById("supplierTableBody");


    // Summary

    const totalSuppliers =
        document.getElementById("totalSuppliers");

    const totalSupplierPayable =
        document.getElementById("totalSupplierPayable");

    const totalSupplierPaid =
        document.getElementById("totalSupplierPaid");

    const activeSuppliers =
        document.getElementById("activeSuppliers");


    // ================================
    // STORAGE
    // ================================

    function getSuppliers() {

        try {

            const data =
                localStorage.getItem(SUPPLIER_KEY);

            if (!data) {
                return [];
            }

            const suppliers =
                JSON.parse(data);

            return Array.isArray(suppliers)
                ? suppliers
                : [];

        } catch (error) {

            console.error(
                "Supplier data error:",
                error
            );

            return [];
        }
    }


    function saveSuppliers(suppliers) {

        localStorage.setItem(
            SUPPLIER_KEY,
            JSON.stringify(suppliers)
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


    function generateSupplierId() {

        return (
            "SUP-" +
            Date.now() +
            "-" +
            Math.floor(
                Math.random() * 10000
            )
        );
    }


    // ================================
    // MODAL
    // ================================

    function openSupplierModal(
        supplier = null
    ) {

        supplierForm.reset();

        supplierId.value = "";

        supplierOpeningBalance.value =
            "0";

        supplierBalanceType.value =
            "PAYABLE";

        supplierTaxType.value =
            "VAT";

        supplierActive.value =
            "true";


        const title =
            document.getElementById(
                "supplierModalTitle"
            );


        if (supplier) {

            title.textContent =
                "Edit Supplier";


            supplierId.value =
                supplier.id || "";

            supplierName.value =
                supplier.name || "";

            supplierPhone.value =
                supplier.phone || "";

            supplierAddress.value =
                supplier.address || "";

            supplierTaxType.value =
                supplier.taxType || "VAT";

            supplierTaxNumber.value =
                supplier.taxNumber || "";


            supplierOpeningBalance.value =
                Math.abs(
                    numberValue(
                        supplier.openingBalance
                    )
                );


            supplierBalanceType.value =
                supplier.balanceType ===
                "ADVANCE"
                    ? "ADVANCE"
                    : "PAYABLE";


            supplierNote.value =
                supplier.note || "";


            supplierActive.value =
                supplier.active === false
                    ? "false"
                    : "true";

        } else {

            title.textContent =
                "New Supplier";
        }


        supplierModal.classList.add(
            "show"
        );


        setTimeout(
            function () {
                supplierName.focus();
            },
            100
        );
    }


    function closeModal() {

        supplierModal.classList.remove(
            "show"
        );
    }


    // ================================
    // SUMMARY
    // ================================

    function updateSummary(
        suppliers
    ) {

        let payable = 0;

        let paid = 0;

        let active = 0;


        suppliers.forEach(
            function (supplier) {

                const balance =
                    numberValue(
                        supplier.currentBalance
                    );


                if (balance > 0) {

                    payable += balance;
                }


                paid +=
                    numberValue(
                        supplier.paymentTotal
                    );


                if (
                    supplier.active !== false
                ) {

                    active++;
                }
            }
        );


        totalSuppliers.textContent =
            suppliers.length;


        totalSupplierPayable.textContent =
            money(payable);


        totalSupplierPaid.textContent =
            money(paid);


        activeSuppliers.textContent =
            active;
    }


    // ================================
    // RENDER
    // ================================

    function renderSuppliers(
        suppliers = getSuppliers()
    ) {

        updateSummary(
            suppliers
        );


        const searchText =
            supplierSearch.value
                .trim()
                .toLowerCase();


        const filtered =
            suppliers.filter(
                function (supplier) {

                    if (!searchText) {
                        return true;
                    }


                    const text = [

                        supplier.name,

                        supplier.phone,

                        supplier.address,

                        supplier.taxType,

                        supplier.taxNumber,

                        supplier.note,

                        supplier.id

                    ]
                        .join(" ")
                        .toLowerCase();


                    return text.includes(
                        searchText
                    );
                }
            );


        if (!filtered.length) {

            supplierTableBody.innerHTML = `
                <tr>
                    <td
                        colspan="8"
                        class="supplier-empty"
                    >
                        No suppliers found.
                    </td>
                </tr>
            `;

            return;
        }


        supplierTableBody.innerHTML =
            filtered.map(
                function (supplier) {

                    const opening =
                        numberValue(
                            supplier.openingBalance
                        );


                    const purchaseTotal =
                        numberValue(
                            supplier.purchaseTotal
                        );


                    const paymentTotal =
                        numberValue(
                            supplier.paymentTotal
                        );


                    const current =
                        numberValue(
                            supplier.currentBalance
                        );


                    let currentText;


                    if (current > 0) {

                        currentText =
                            money(current) +
                            " Payable";

                    } else if (current < 0) {

                        currentText =
                            money(
                                Math.abs(current)
                            ) +
                            " Advance";

                    } else {

                        currentText =
                            money(0);
                    }


                    const status =
                        supplier.active === false
                            ? `
                                <small
                                    class="supplier-status-inactive"
                                >
                                    Inactive
                                </small>
                              `
                            : "";


                    return `

                        <tr>

                            <td>

                                <strong>
                                    ${escapeHTML(
                                        supplier.name
                                    )}
                                </strong>

                                ${status}

                            </td>


                            <td>
                                ${escapeHTML(
                                    supplier.phone || "-"
                                )}
                            </td>


                            <td>

                                ${escapeHTML(
                                    supplier.taxType || "-"
                                )}

                                <br>

                                <small>
                                    ${escapeHTML(
                                        supplier.taxNumber || "-"
                                    )}
                                </small>

                            </td>


                            <td>
                                ${money(
                                    Math.abs(opening)
                                )}
                            </td>


                            <td>
                                ${money(
                                    purchaseTotal
                                )}
                            </td>


                            <td>
                                ${money(
                                    paymentTotal
                                )}
                            </td>


                            <td>

                                <strong>
                                    ${escapeHTML(
                                        currentText
                                    )}
                                </strong>

                            </td>


                            <td>

                                <button
                                    type="button"
                                    class="btn edit-supplier-btn"
                                    data-id="${escapeHTML(
                                        supplier.id
                                    )}"
                                >
                                    Edit
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

    supplierForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();


            const name =
                supplierName.value.trim();


            if (!name) {

                alert(
                    "Supplier name is required."
                );

                supplierName.focus();

                return;
            }


            const suppliers =
                getSuppliers();


            const id =
                supplierId.value ||
                generateSupplierId();


            const openingAmount =
                Math.abs(
                    numberValue(
                        supplierOpeningBalance.value
                    )
                );


            const balanceType =
                supplierBalanceType.value ===
                "ADVANCE"
                    ? "ADVANCE"
                    : "PAYABLE";


            const openingSigned =
                balanceType === "ADVANCE"
                    ? -openingAmount
                    : openingAmount;


            const existingIndex =
                suppliers.findIndex(
                    function (supplier) {

                        return (
                            supplier.id === id
                        );
                    }
                );


            // ============================
            // NEW SUPPLIER
            // ============================

            if (existingIndex === -1) {

                const newSupplier = {

                    id: id,

                    name: name,

                    phone:
                        supplierPhone.value
                            .trim(),

                    address:
                        supplierAddress.value
                            .trim(),

                    taxType:
                        supplierTaxType.value,

                    taxNumber:
                        supplierTaxNumber.value
                            .trim(),

                    openingBalance:
                        openingSigned,

                    balanceType:
                        balanceType,

                    currentBalance:
                        openingSigned,

                    purchaseTotal: 0,

                    paymentTotal: 0,

                    returnTotal: 0,

                    note:
                        supplierNote.value
                            .trim(),

                    active:
                        supplierActive.value !==
                        "false",

                    createdAt:
                        new Date()
                            .toISOString(),

                    updatedAt:
                        new Date()
                            .toISOString()
                };


                suppliers.push(
                    newSupplier
                );

            }

            // ============================
            // EDIT SUPPLIER
            // ============================

            else {

                const oldSupplier =
                    suppliers[
                        existingIndex
                    ];


                const oldOpening =
                    numberValue(
                        oldSupplier.openingBalance
                    );


                const oldCurrent =
                    numberValue(
                        oldSupplier.currentBalance
                    );


                /*
                 * Keep purchase/payment
                 * transaction balance.
                 */
                const transactionBalance =
                    oldCurrent -
                    oldOpening;


                const newCurrentBalance =
                    openingSigned +
                    transactionBalance;


                suppliers[
                    existingIndex
                ] = {

                    ...oldSupplier,

                    name: name,

                    phone:
                        supplierPhone.value
                            .trim(),

                    address:
                        supplierAddress.value
                            .trim(),

                    taxType:
                        supplierTaxType.value,

                    taxNumber:
                        supplierTaxNumber.value
                            .trim(),

                    openingBalance:
                        openingSigned,

                    balanceType:
                        balanceType,

                    currentBalance:
                        newCurrentBalance,

                    note:
                        supplierNote.value
                            .trim(),

                    active:
                        supplierActive.value !==
                        "false",

                    updatedAt:
                        new Date()
                            .toISOString()
                };
            }


            saveSuppliers(
                suppliers
            );


            closeModal();


            renderSuppliers(
                suppliers
            );


            alert(
                existingIndex === -1
                    ? "Supplier saved successfully."
                    : "Supplier updated successfully."
            );
        }
    );


    // ================================
    // EDIT
    // ================================

    supplierTableBody.addEventListener(
        "click",
        function (event) {

            const button =
                event.target.closest(
                    ".edit-supplier-btn"
                );


            if (!button) {
                return;
            }


            const id =
                button.dataset.id;


            const suppliers =
                getSuppliers();


            const supplier =
                suppliers.find(
                    function (item) {

                        return item.id === id;
                    }
                );


            if (!supplier) {

                alert(
                    "Supplier not found."
                );

                return;
            }


            openSupplierModal(
                supplier
            );
        }
    );


    // ================================
    // EVENTS
    // ================================

    newSupplierBtn.addEventListener(
        "click",
        function () {

            openSupplierModal();
        }
    );


    closeSupplierModal.addEventListener(
        "click",
        closeModal
    );


    cancelSupplierBtn.addEventListener(
        "click",
        closeModal
    );


    supplierModal.addEventListener(
        "click",
        function (event) {

            if (
                event.target ===
                supplierModal
            ) {

                closeModal();
            }
        }
    );


    supplierSearch.addEventListener(
        "input",
        function () {

            renderSuppliers(
                getSuppliers()
            );
        }
    );


    document.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Escape" &&
                supplierModal.classList.contains(
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

    renderSuppliers();

});
