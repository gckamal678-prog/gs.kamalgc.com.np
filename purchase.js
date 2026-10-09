
/* =========================================================
   GENERAL STORE MANAGEMENT SYSTEM
   PURCHASE MODULE - MULTI ITEM
   Storage keys remain compatible with existing modules.
   ========================================================= */

(() => {
  "use strict";

  const PURCHASE_KEY = "gs_purchases";
  const PRODUCT_KEY = "gs_products";
  const SUPPLIER_KEY = "gs_suppliers";
  const FINANCE_KEY = "gs_finance";
  const LOT_KEY = "gs_stock_lots";

  const $ = id => document.getElementById(id);

  const els = {
    newBtn: $("newPurchaseBtn"),
    modal: $("purchaseModal"),
    closeBtn: $("closePurchaseModal"),
    cancelBtn: $("cancelPurchaseBtn"),
    form: $("purchaseForm"),
    date: $("purchaseDate"),
    bill: $("billNumber"),
    supplier: $("supplierName"),
    taxType: $("supplierTaxType"),
    taxNumber: $("supplierTaxNumber"),
    payment: $("paymentMethod"),
    itemsBody: $("purchaseItemsBody"),
    addItem: $("addPurchaseItemBtn"),
    vat: $("purchaseVat"),
    paid: $("paidAmount"),
    note: $("purchaseNote"),
    search: $("purchaseSearch"),
    table: $("purchaseTableBody"),
    totalBills: $("totalPurchases"),
    totalValue: $("purchaseValue"),
    totalPaid: $("paidValue"),
    totalPayable: $("payableValue"),
    previewItems: $("previewItemAmount"),
    previewDiscount: $("previewDiscount"),
    previewVat: $("previewVat"),
    previewTotal: $("previewTotal"),
    previewPaid: $("previewPaid"),
    previewBalance: $("previewBalance")
  };

  function read(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (error) {
      console.error("Storage read error:", key, error);
      throw new Error(key + " को डाटा पढ्न सकिएन। Backup जाँच गर्नुहोस्।");
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function money(value) {
    return "Rs. " + num(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function id(prefix) {
    return prefix + "-" + Date.now() + "-" +
      Math.floor(Math.random() * 1000000);
  }

  function today() {
    const d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function getProducts() {
    return read(PRODUCT_KEY);
  }

  function getSuppliers() {
    return read(SUPPLIER_KEY);
  }

  function getPurchases() {
    return read(PURCHASE_KEY);
  }

  function getFinance() {
    return read(FINANCE_KEY);
  }

  function getLots() {
    return read(LOT_KEY);
  }

  function setText(element, value) {
    if (element) element.textContent = value;
  }

  function loadSuppliers() {
    const suppliers = getSuppliers();
    els.supplier.innerHTML = '<option value="">Supplier छान्नुहोस्</option>';

    suppliers
      .filter(s => s.active !== false)
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .forEach(supplier => {
        const option = document.createElement("option");
        option.value = supplier.id;
        option.textContent = supplier.name;
        els.supplier.appendChild(option);
      });

    if (suppliers.filter(s => s.active !== false).length === 0) {
      els.supplier.innerHTML =
        '<option value="">पहिले Suppliers मा Supplier बनाउनुहोस्</option>';
    }
  }

  function updateSupplierTax() {
    const supplier = getSuppliers().find(s => s.id === els.supplier.value);
    els.taxType.value = supplier?.taxType || "NON_TAX";
    els.taxNumber.value = supplier?.taxNumber || "";
  }

  function productOptions(selectedId = "") {
    const products = getProducts().filter(p => p.active !== false);

    return '<option value="">Product छान्नुहोस्</option>' +
      products.map(p =>
        `<option value="${escapeHTML(p.id)}"
          data-rate="${num(p.purchasePrice)}"
          data-unit="${escapeHTML(p.unit || "Unit")}"
          ${p.id === selectedId ? "selected" : ""}>
          ${escapeHTML(p.name)} (${escapeHTML(p.unit || "Unit")})
        </option>`
      ).join("");
  }

  function addItemRow(item = {}) {
    const tr = document.createElement("tr");
    tr.className = "purchase-item-row";

    tr.innerHTML = `
      <td><select class="item-product" required>${productOptions(item.productId || "")}</select></td>
      <td><input class="item-qty" type="number" min="0.001" step="any" value="${item.qty ?? 1}" required></td>
      <td><input class="item-free" type="number" min="0" step="any" value="${item.freeQty ?? 0}"></td>
      <td><input class="item-rate" type="number" min="0" step="0.01" value="${item.rate ?? ""}" required></td>
      <td><input class="item-discount" type="number" min="0" step="0.01" value="${item.discount ?? 0}"></td>
      <td class="item-total">${money(0)}</td>
      <td><button type="button" class="purchase-btn danger remove-item">Remove</button></td>
    `;

    els.itemsBody.appendChild(tr);

    const productSelect = tr.querySelector(".item-product");
    productSelect.addEventListener("change", () => {
      const opt = productSelect.selectedOptions[0];
      const rateInput = tr.querySelector(".item-rate");
      if (opt && opt.value) rateInput.value = opt.dataset.rate || "0";
      calculate();
    });

    tr.querySelectorAll("input").forEach(input => {
      input.addEventListener("input", calculate);
    });

    tr.querySelector(".remove-item").addEventListener("click", () => {
      if (els.itemsBody.querySelectorAll("tr").length <= 1) {
        alert("कम्तीमा एउटा Product राख्नुपर्छ।");
        return;
      }
      tr.remove();
      calculate();
    });

    calculate();
  }

  function collectItems() {
    return [...els.itemsBody.querySelectorAll(".purchase-item-row")].map(row => {
      const productId = row.querySelector(".item-product").value;
      const product = getProducts().find(p => p.id === productId);
      const qty = num(row.querySelector(".item-qty").value);
      const freeQty = num(row.querySelector(".item-free").value);
      const rate = num(row.querySelector(".item-rate").value);
      const discount = num(row.querySelector(".item-discount").value);
      const gross = qty * rate;
      const lineTotal = Math.max(0, gross - discount);

      return {
        productId,
        productName: product?.name || "",
        unit: product?.unit || "Unit",
        qty,
        freeQty,
        totalReceivedQty: qty + freeQty,
        rate,
        discount,
        gross,
        lineTotal,
        effectiveCost: qty + freeQty > 0
          ? Math.max(0, gross - discount) / (qty + freeQty)
          : 0
      };
    });
  }

  function calculate() {
    const items = collectItems();
    const subtotal = items.reduce((sum, item) => sum + item.gross, 0);
    const discount = items.reduce((sum, item) => sum + item.discount, 0);
    const vat = Math.max(0, num(els.vat.value));
    const total = Math.max(0, subtotal - discount) + vat;
    const paid = Math.max(0, num(els.paid.value));
    const balance = Math.max(0, total - paid);

    items.forEach((item, index) => {
      const row = els.itemsBody.querySelectorAll(".purchase-item-row")[index];
      if (row) setText(row.querySelector(".item-total"), money(item.lineTotal));
    });

    setText(els.previewItems, money(subtotal));
    setText(els.previewDiscount, money(discount));
    setText(els.previewVat, money(vat));
    setText(els.previewTotal, money(total));
    setText(els.previewPaid, money(paid));
    setText(els.previewBalance, money(balance));

    return { items, subtotal, discount, vat, total, paid, balance };
  }

  function openModal() {
    els.form.reset();
    els.itemsBody.innerHTML = "";
    els.date.value = today();
    els.vat.value = "0";
    els.paid.value = "0";
    els.payment.value = "CASH";

    loadSuppliers();
    updateSupplierTax();
    addItemRow();

    els.modal.classList.add("show");
    els.modal.setAttribute("aria-hidden", "false");
    calculate();
  }

  function closeModal() {
    els.modal.classList.remove("show");
    els.modal.setAttribute("aria-hidden", "true");
  }

  function updateSummary(purchases = getPurchases()) {
    const total = purchases.reduce((sum, p) => sum + num(p.total), 0);
    const paid = purchases.reduce((sum, p) => sum + num(p.paidAmount), 0);
    const balance = purchases.reduce((sum, p) => sum + num(p.balance), 0);

    setText(els.totalBills, purchases.length);
    setText(els.totalValue, money(total));
    setText(els.totalPaid, money(paid));
    setText(els.totalPayable, money(balance));
  }

  function purchaseItems(purchase) {
    if (Array.isArray(purchase.items) && purchase.items.length) {
      return purchase.items;
    }

    // Read compatibility for existing one-product purchase records.
    if (purchase.productId) {
      return [{
        productId: purchase.productId,
        productName: purchase.productName || "",
        unit: purchase.unit || "Unit",
        qty: num(purchase.qty),
        freeQty: num(purchase.freeQty),
        totalReceivedQty: num(purchase.totalReceivedQty) ||
          (num(purchase.qty) + num(purchase.freeQty)),
        rate: num(purchase.rate),
        discount: num(purchase.discount),
        effectiveCost: num(purchase.effectiveCost)
      }];
    }

    return [];
  }

  function renderPurchases() {
    const purchases = getPurchases();
    updateSummary(purchases);

    const search = (els.search.value || "").trim().toLowerCase();
    const filtered = purchases.filter(p => {
      const names = purchaseItems(p).map(i => i.productName).join(" ");
      const haystack = [
        p.billNumber, p.supplierName, p.supplierTaxNumber, names, p.date
      ].join(" ").toLowerCase();
      return !search || haystack.includes(search);
    });

    if (!filtered.length) {
      els.table.innerHTML = `<tr><td colspan="8" class="purchase-empty">
        ${purchases.length ? "Purchase भेटिएन।" : "अहिलेसम्म Purchase छैन।"}
      </td></tr>`;
      return;
    }

    els.table.innerHTML = filtered.map(p => {
      const items = purchaseItems(p);
      const itemNames = items.map(i => i.productName).filter(Boolean).join(", ");
      return `<tr>
        <td>${escapeHTML(p.date || "-")}</td>
        <td>${escapeHTML(p.billNumber || "-")}</td>
        <td>${escapeHTML(p.supplierName || "-")}</td>
        <td title="${escapeHTML(itemNames)}">${items.length} item(s)</td>
        <td>${money(p.total)}</td>
        <td>${money(p.paidAmount)}</td>
        <td>${money(p.balance)}</td>
        <td>${escapeHTML(p.paymentMethod || "-")}</td>
      </tr>`;
    }).join("");
  }

  function validate(values) {
    if (!els.date.value || !els.bill.value.trim() || !els.supplier.value) {
      alert("Date, Bill Number र Supplier अनिवार्य छन्।");
      return false;
    }

    const supplier = getSuppliers().find(s => s.id === els.supplier.value);
    if (!supplier || supplier.active === false) {
      alert("सक्रिय Supplier छान्नुहोस्।");
      return false;
    }

    if (!values.items.length) {
      alert("कम्तीमा एउटा Product राख्नुहोस्।");
      return false;
    }

    const products = getProducts();
    const seen = new Set();

    for (const item of values.items) {
      if (!item.productId || !products.some(p => p.id === item.productId && p.active !== false)) {
        alert("हरेक Row मा सही Product छान्नुहोस्।");
        return false;
      }
      if (item.qty <= 0 || item.freeQty < 0 || item.rate < 0 || item.discount < 0) {
        alert("Quantity, Free Qty, Rate र Discount सही राख्नुहोस्।");
        return false;
      }
      if (item.discount > item.gross) {
        alert("कुनै Product को Discount त्यसको रकमभन्दा बढी छ।");
        return false;
      }
      if (seen.has(item.productId)) {
        alert("एउटै Product दोहोरिएको छ। कृपया एउटै Row मा Quantity मिलाउनुहोस्।");
        return false;
      }
      seen.add(item.productId);
    }

    if (values.paid > values.total) {
      alert("Paid Amount कुल रकमभन्दा बढी हुन सक्दैन।");
      return false;
    }

    if (num(els.vat.value) < 0 || values.paid < 0) {
      alert("VAT र Paid Amount ऋणात्मक हुन सक्दैन।");
      return false;
    }

    if (els.payment.value === "CREDIT" && values.paid > 0) {
      alert("Credit Payment छानिएको छ। अहिले रकम तिरेको भए Cash, Bank वा QR छान्नुहोस्।");
      return false;
    }

    return true;
  }

  function makeFinanceTransaction(purchase, account) {
    if (purchase.paidAmount <= 0) return null;

    return {
      id: "FIN-" + purchase.id,
      source: "PURCHASE",
      sourceId: purchase.id,
      date: purchase.date,
      type: "PAYMENT",
      category: "PURCHASE_PAYMENT",
      account,
      amount: purchase.paidAmount,
      reference: purchase.billNumber,
      note: "Purchase payment - " + purchase.supplierName,
      createdAt: purchase.createdAt
    };
  }

  function savePurchase(event) {
    event.preventDefault();

    let purchases, products, suppliers, finance, lots;

    try {
      purchases = getPurchases();
      products = getProducts();
      suppliers = getSuppliers();
      finance = getFinance();
      lots = getLots();
    } catch (error) {
      alert(error.message);
      return;
    }

    const values = calculate();

    if (!validate(values)) return;

    const supplier = suppliers.find(s => s.id === els.supplier.value);
    const bill = els.bill.value.trim();

    const duplicate = purchases.some(p =>
      String(p.billNumber || "").trim().toLowerCase() === bill.toLowerCase() &&
      String(p.supplierId || "") === String(supplier.id)
    );

    if (duplicate) {
      alert("यो Supplier को Bill Number पहिले नै सुरक्षित छ। कृपया Bill Number जाँच गर्नुहोस्।");
      return;
    }

    const purchaseId = id("PUR");
    const createdAt = new Date().toISOString();

    const purchase = {
      id: purchaseId,
      date: els.date.value,
      billNumber: bill,
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierTaxType: els.taxType.value,
      supplierTaxNumber: els.taxNumber.value.trim(),
      items: values.items.map(item => ({ ...item })),
      // Compatibility fields for older one-item reports/pages:
      productId: values.items.length === 1 ? values.items[0].productId : "",
      productName: values.items.length === 1 ? values.items[0].productName : "",
      unit: values.items.length === 1 ? values.items[0].unit : "",
      qty: values.items.length === 1 ? values.items[0].qty : 0,
      freeQty: values.items.length === 1 ? values.items[0].freeQty : 0,
      totalReceivedQty: values.items.length === 1 ? values.items[0].totalReceivedQty : 0,
      rate: values.items.length === 1 ? values.items[0].rate : 0,
      discount: values.discount,
      vat: values.vat,
      subtotal: values.subtotal,
      total: values.total,
      paidAmount: values.paid,
      balance: values.balance,
      paymentMethod: els.payment.value,
      note: els.note.value.trim(),
      createdAt
    };

    const financeTransaction = makeFinanceTransaction(purchase, els.payment.value);

    // Keep snapshots so a failed write can attempt to restore previous data.
    const keys = [PURCHASE_KEY, PRODUCT_KEY, SUPPLIER_KEY, FINANCE_KEY, LOT_KEY];
    const before = {};
    try {
      keys.forEach(key => {
        before[key] = localStorage.getItem(key);
      });

      // Update each product stock once.
      values.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        product.stock = num(product.stock) + item.totalReceivedQty;
        product.purchasePrice = item.rate;
      });

      // Supplier currentBalance convention: positive means payable, negative means advance.
      const supplierIndex = suppliers.findIndex(s => s.id === supplier.id);
      const updatedSupplier = { ...suppliers[supplierIndex] };
      updatedSupplier.currentBalance =
        num(updatedSupplier.currentBalance) + purchase.balance;
      updatedSupplier.purchaseTotal =
        num(updatedSupplier.purchaseTotal) + purchase.total;
      updatedSupplier.updatedAt = createdAt;
      suppliers[supplierIndex] = updatedSupplier;

      // Create one FIFO lot per product row. purchaseId keeps migration idempotent.
      values.items.forEach((item, index) => {
        lots.push({
          id: "LOT-" + purchaseId + "-" + (index + 1),
          purchaseId,
          purchaseItemIndex: index,
          date: purchase.date,
          productId: item.productId,
          productName: item.productName,
          supplierName: purchase.supplierName,
          billNumber: purchase.billNumber,
          receivedQty: item.totalReceivedQty,
          remainingQty: item.totalReceivedQty,
          effectiveCost: item.effectiveCost,
          source: "PURCHASE",
          createdAt
        });
      });

      purchases.unshift(purchase);

      if (financeTransaction) {
        finance.push(financeTransaction);
      }

      // Write data stores. Roll back all stores if a write throws.
      write(PRODUCT_KEY, products);
      write(SUPPLIER_KEY, suppliers);
      write(LOT_KEY, lots);
      write(FINANCE_KEY, finance);
      write(PURCHASE_KEY, purchases);

    } catch (error) {
      keys.forEach(key => {
        try {
          if (before[key] === null || before[key] === undefined) {
            localStorage.removeItem(key);
          } else {
            localStorage.setItem(key, before[key]);
          }
        } catch (_) {}
      });

      console.error("Purchase save failed:", error);
      alert("Purchase सुरक्षित गर्न सकिएन। Storage खाली छ कि छैन जाँच गर्नुहोस्। कुनै पुरानो डाटा नमेट्नुहोस्।");
      return;
    }

    closeModal();
    renderPurchases();

    alert(
      "Purchase सुरक्षित भयो।\n" +
      "Product Stock, FIFO Lots र Supplier Payable अपडेट गरियो।" +
      (financeTransaction ? "\nFinance मा Payment Entry पनि बनाइयो।" : "")
    );
  }

  function bindEvents() {
    els.newBtn.addEventListener("click", openModal);
    els.closeBtn.addEventListener("click", closeModal);
    els.cancelBtn.addEventListener("click", closeModal);

    els.modal.addEventListener("click", event => {
      if (event.target === els.modal) closeModal();
    });

    els.addItem.addEventListener("click", () => addItemRow());
    els.supplier.addEventListener("change", updateSupplierTax);

    [els.vat, els.paid].forEach(input => input.addEventListener("input", calculate));
    els.payment.addEventListener("change", () => {
      if (els.payment.value === "CREDIT") {
        els.paid.value = "0";
      }
      calculate();
    });

    els.form.addEventListener("submit", savePurchase);
    els.search.addEventListener("input", renderPurchases);

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && els.modal.classList.contains("show")) {
        closeModal();
      }
    });
  }

  function init() {
    bindEvents();
    renderPurchases();
    console.log("Purchase module loaded.");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
