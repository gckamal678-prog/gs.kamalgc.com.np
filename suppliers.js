"use strict";

(() => {
  const STORAGE_KEY = "gs_suppliers";

  const $ = (id) => document.getElementById(id);

  const elements = {
    newButton: $("newSupplierBtn"),
    modal: $("supplierModal"),
    closeButton: $("closeSupplierModal"),
    cancelButton: $("cancelSupplierBtn"),
    form: $("supplierForm"),
    id: $("supplierId"),
    name: $("supplierName"),
    phone: $("supplierPhone"),
    address: $("supplierAddress"),
    taxType: $("supplierTaxType"),
    taxNumber: $("supplierTaxNumber"),
    openingBalance: $("supplierOpeningBalance"),
    balanceType: $("supplierBalanceType"),
    note: $("supplierNote"),
    active: $("supplierActive"),
    search: $("supplierSearch"),
    tableBody: $("supplierTableBody"),
    total: $("totalSuppliers"),
    payable: $("totalSupplierPayable"),
    advance: $("totalSupplierPaid"),
    activeCount: $("activeSuppliers"),
    modalTitle: $("supplierModalTitle"),
    saveButton: $("saveSupplierBtn"),
    message: $("supplierMessage")
  };

  let suppliers = [];
  let previousFocus = null;
  let messageTimer = null;

  function money(value) {
    const amount = Number(value) || 0;

    return "रु " + amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function numberValue(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return "sup_" + Date.now() + "_" +
      Math.random().toString(36).slice(2, 10);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      };

      return entities[character];
    });
  }

  function signedOpeningBalance(supplier) {
    const opening = numberValue(supplier.openingBalance);

    if (supplier.balanceType === "ADVANCE") {
      return -Math.abs(opening);
    }

    return Math.abs(opening);
  }

  function getCurrentBalance(supplier) {
    if (supplier.currentBalance !== undefined &&
        supplier.currentBalance !== null &&
        Number.isFinite(Number(supplier.currentBalance))) {
      return Number(supplier.currentBalance);
    }

    // पुराना record मा currentBalance नभए opening बाट गणना गर्ने।
    return signedOpeningBalance(supplier) +
      numberValue(supplier.purchaseTotal) -
      numberValue(supplier.paymentTotal) -
      numberValue(supplier.returnTotal);
  }

  function loadSuppliers() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (!saved) {
        suppliers = [];
        return;
      }

      const parsed = JSON.parse(saved);
      suppliers = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Supplier data load error:", error);
      suppliers = [];
      showMessage(
        "Supplier data पढ्न सकिएन। Browser storage मा समस्या हुन सक्छ।",
        "error"
      );
    }
  }

  function saveSuppliers() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(suppliers));
      return true;
    } catch (error) {
      console.error("Supplier data save error:", error);
      showMessage(
        "Supplier save भएन। Browser storage भरिएको वा उपलब्ध नभएको हुन सक्छ।",
        "error"
      );
      return false;
    }
  }

  function showMessage(message, type = "success") {
    if (!elements.message) return;

    clearTimeout(messageTimer);
    elements.message.textContent = message;
    elements.message.className = "supplier-message show " + type;

    messageTimer = setTimeout(() => {
      elements.message.className = "supplier-message";
      elements.message.textContent = "";
    }, 4500);
  }

  function openModal(supplier = null) {
    previousFocus = document.activeElement;

    elements.form.reset();
    elements.id.value = "";
    elements.openingBalance.value = "0";
    elements.balanceType.value = "PAYABLE";
    elements.taxType.value = "NON_TAX";
    elements.active.checked = true;

    elements.message.className = "supplier-message";
    elements.message.textContent = "";

    if (supplier) {
      elements.modalTitle.textContent = "Edit Supplier";
      elements.saveButton.textContent = "Update Supplier";

      elements.id.value = supplier.id;
      elements.name.value = supplier.name || "";
      elements.phone.value = supplier.phone || "";
      elements.address.value = supplier.address || "";
      elements.taxType.value = supplier.taxType || "NON_TAX";
      elements.taxNumber.value = supplier.taxNumber || "";
      elements.openingBalance.value = String(
        Math.abs(numberValue(supplier.openingBalance))
      );
      elements.balanceType.value =
        supplier.balanceType === "ADVANCE" ? "ADVANCE" : "PAYABLE";
      elements.note.value = supplier.note || "";
      elements.active.checked = supplier.active !== false;
    } else {
      elements.modalTitle.textContent = "New Supplier";
      elements.saveButton.textContent = "Save Supplier";
    }

    elements.modal.classList.add("show");
    elements.modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    // Modal देखिने भएपछि input मा focus।
    window.requestAnimationFrame(() => {
      elements.name.focus();
    });
  }

  function closeModal() {
    elements.modal.classList.remove("show");
    elements.modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";

    if (previousFocus && typeof previousFocus.focus === "function") {
      previousFocus.focus();
    }
  }

  function renderSummary() {
    const activeSuppliers = suppliers.filter(
      (supplier) => supplier.active !== false
    );

    const totalPayable = suppliers.reduce((sum, supplier) => {
      const balance = getCurrentBalance(supplier);
      return sum + Math.max(balance, 0);
    }, 0);

    const totalAdvance = suppliers.reduce((sum, supplier) => {
      const balance = getCurrentBalance(supplier);
      return sum + Math.max(-balance, 0);
    }, 0);

    elements.total.textContent = String(suppliers.length);
    elements.payable.textContent = money(totalPayable);
    elements.advance.textContent = money(totalAdvance);
    elements.activeCount.textContent = String(activeSuppliers.length);
  }

  function renderSuppliers() {
    const searchTerm = (elements.search.value || "").trim().toLowerCase();

    const filtered = suppliers.filter((supplier) => {
      const searchable = [
        supplier.name,
        supplier.phone,
        supplier.address,
        supplier.taxType,
        supplier.taxNumber
      ].join(" ").toLowerCase();

      return searchable.includes(searchTerm);
    });

    if (filtered.length === 0) {
      elements.tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="supplier-empty">
            ${searchTerm
              ? "खोजिएको Supplier भेटिएन।"
              : "Supplier छैन। सुरु गर्न “+ New Supplier” थिच्नुहोस्।"}
          </td>
        </tr>
      `;

      renderSummary();
      return;
    }

    elements.tableBody.innerHTML = filtered.map((supplier) => {
      const balance = getCurrentBalance(supplier);
      const taxType = supplier.taxType || "NON_TAX";
      const taxNumber = supplier.taxNumber
        ? `${taxType === "NON_TAX" ? "" : taxType + ": "}${escapeHtml(supplier.taxNumber)}`
        : (taxType === "NON_TAX" ? "Non Tax" : escapeHtml(taxType));

      const status = supplier.active !== false
        ? '<span class="supplier-status active">Active</span>'
        : '<span class="supplier-status inactive">Inactive</span>';

      const balanceLabel = balance > 0
        ? "Payable"
        : balance < 0
          ? "Advance"
          : "Settled";

      const balanceClass = balance > 0
        ? "supplier-balance-payable"
        : balance < 0
          ? "supplier-balance-advance"
          : "";

      return `
        <tr>
          <td>
            <strong>${escapeHtml(supplier.name || "")}</strong>
            ${supplier.address
              ? `<div style="color:#6b7280;font-size:11px;margin-top:4px">${escapeHtml(supplier.address)}</div>`
              : ""}
          </td>
          <td>${escapeHtml(supplier.phone || "—")}</td>
          <td>${taxNumber}</td>
          <td>${balanceLabel}</td>
          <td class="${balanceClass}">${money(Math.abs(balance))}</td>
          <td>${status}</td>
          <td>
            <button
              type="button"
              class="supplier-btn supplier-btn-small"
              data-action="edit"
              data-id="${escapeHtml(supplier.id)}"
            >Edit</button>
          </td>
        </tr>
      `;
    }).join("");

    renderSummary();
  }

  function handleSave(event) {
    event.preventDefault();

    const name = elements.name.value.trim();

    if (!name) {
      showMessage("Supplier Name भर्नुहोस्।", "error");
      elements.name.focus();
      return;
    }

    const openingBalance = Math.abs(numberValue(elements.openingBalance.value));
    const balanceType = elements.balanceType.value === "ADVANCE"
      ? "ADVANCE"
      : "PAYABLE";

    if (!Number.isFinite(openingBalance)) {
      showMessage("Opening Balance सही रकम राख्नुहोस्।", "error");
      elements.openingBalance.focus();
      return;
    }

    const editingId = elements.id.value;
    const now = new Date().toISOString();

    const formData = {
      name,
      phone: elements.phone.value.trim(),
      address: elements.address.value.trim(),
      taxType: elements.taxType.value,
      taxNumber: elements.taxNumber.value.trim(),
      openingBalance,
      balanceType,
      note: elements.note.value.trim(),
      active: elements.active.checked
    };

    if (editingId) {
      const index = suppliers.findIndex(
        (supplier) => String(supplier.id) === String(editingId)
      );

      if (index === -1) {
        showMessage("यो Supplier भेटिएन। सूची refresh गरेर फेरि प्रयास गर्नुहोस्।", "error");
        return;
      }

      const oldSupplier = suppliers[index];
      const oldOpeningSigned = signedOpeningBalance(oldSupplier);
      const oldCurrentBalance = getCurrentBalance(oldSupplier);
      const newOpeningSigned = balanceType === "ADVANCE"
        ? -openingBalance
        : openingBalance;

      // पुराना purchase/payment/return ले बनाएको फरक जोगाउने।
      const transactionDifference = oldCurrentBalance - oldOpeningSigned;

      suppliers[index] = {
        ...oldSupplier,
        ...formData,
        currentBalance: newOpeningSigned + transactionDifference,
        purchaseTotal: numberValue(oldSupplier.purchaseTotal),
        paymentTotal: numberValue(oldSupplier.paymentTotal),
        returnTotal: numberValue(oldSupplier.returnTotal),
        createdAt: oldSupplier.createdAt || now,
        updatedAt: now
      };
    } else {
      const openingSigned = balanceType === "ADVANCE"
        ? -openingBalance
        : openingBalance;

      const newSupplier = {
        id: createId(),
        ...formData,
        currentBalance: openingSigned,
        purchaseTotal: 0,
        paymentTotal: 0,
        returnTotal: 0,
        createdAt: now,
        updatedAt: now
      };

      suppliers.unshift(newSupplier);
    }

    if (!saveSuppliers()) {
      // Storage मा save हुन नसके परिवर्तनलाई सफल भनेर देखाउँदैन।
      loadSuppliers();
      renderSuppliers();
      return;
    }

    closeModal();
    renderSuppliers();
    showMessage(
      editingId ? "Supplier सफलतापूर्वक update भयो।" : "Supplier सफलतापूर्वक save भयो।",
      "success"
    );
  }

  // Event handlers: script लोड भएपछि सीधै bind हुन्छन्।
  elements.newButton.addEventListener("click", () => {
    openModal();
  });

  elements.closeButton.addEventListener("click", closeModal);
  elements.cancelButton.addEventListener("click", closeModal);

  elements.modal.addEventListener("click", (event) => {
    // Dialog बाहिरको overlay मा क्लिक गर्दा बन्द हुन्छ।
    if (event.target === elements.modal) {
      closeModal();
    }
  });

  elements.form.addEventListener("submit", handleSave);

  elements.search.addEventListener("input", renderSuppliers);

  elements.tableBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action='edit']");

    if (!button) return;

    const supplier = suppliers.find(
      (item) => String(item.id) === String(button.dataset.id)
    );

    if (supplier) {
      openModal(supplier);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" &&
        elements.modal.classList.contains("show")) {
      closeModal();
    }
  });

  // Initial load
  loadSuppliers();
  renderSuppliers();
})();
