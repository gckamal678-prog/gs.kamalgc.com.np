
"use strict";

(function () {
  const CUSTOMER_KEY = "gs_customers";
  const SALE_KEY = "gs_sales";
  const PAYMENT_KEY = "gs_customer_payments";
  const FINANCE_KEY = "gs_finance";

  let editingId = null;
  let activeCustomerId = null;

  const $ = id => document.getElementById(id);

  function readArray(key) {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) {
      throw new Error(key + " को डेटा सूची होइन।");
    }
    return value;
  }

  function writeArray(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function money(value) {
    return "रु. " + num(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[ch]);
  }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function showError(message) {
    const box = $("customerError");
    if (box) {
      box.textContent = message;
      box.style.display = "block";
    } else {
      console.error(message);
    }
  }

  function clearError() {
    const box = $("customerError");
    if (box) {
      box.textContent = "";
      box.style.display = "none";
    }
  }

  function customerName(c) {
    return String(c.name || c.customerName || "").trim();
  }

  function saleName(s) {
    return String(s.customerName || s.customer || "").trim();
  }

  function salesList() {
    return readArray(SALE_KEY).filter(s => s && !s.voided && !s.isVoid);
  }

  function saleTotal(s) {
    return num(s.total ?? s.amount);
  }

  function saleBalance(s) {
    if (s.balance !== undefined && s.balance !== null) {
      return Math.max(0, num(s.balance));
    }
    return Math.max(0, saleTotal(s) - num(s.paidAmount ?? s.paid));
  }

  function salePaid(s) {
    if (s.paidAmount !== undefined && s.paidAmount !== null) {
      return Math.max(0, num(s.paidAmount));
    }
    if (s.paid !== undefined && s.paid !== null) {
      return Math.max(0, num(s.paid));
    }
    return Math.max(0, saleTotal(s) - saleBalance(s));
  }

  function customerSales(c, sales) {
    const id = String(c.id || "");
    const name = customerName(c).toLowerCase();

    return sales.filter(s => {
      if (s.customerId && id &&
          String(s.customerId) === id) {
        return true;
      }

      // पुराना बिक्री डेटा customerId बिना भएको अवस्थामा नामबाट मिलाउने
      const n = saleName(s).toLowerCase();
      return Boolean(name && n && name === n);
    });
  }

  // Customer details popup dynamically बनाउने
  function ensureDetailsModal() {
    if ($("customerDetailsModal")) return;

    const style = document.createElement("style");
    style.textContent = `
      .customer-name-link {
        border:0;background:none;padding:0;
        color:var(--accent-color,#166534);
        font:inherit;font-weight:700;text-align:left;
        text-decoration:underline;text-underline-offset:3px;
        cursor:pointer;
      }
      .customer-detail-summary {
        display:grid;grid-template-columns:repeat(3,minmax(0,1fr));
        gap:10px;margin:16px 0;
      }
      .customer-detail-card {
        border:1px solid var(--border-color,#e5e7eb);
        border-radius:10px;padding:12px;min-width:0;
      }
      .customer-detail-card span {
        display:block;font-size:12px;
        color:var(--muted-color,#6b7280);
      }
      .customer-detail-card strong {
        display:block;margin-top:6px;overflow-wrap:anywhere;
      }
      .customer-detail-section {margin-top:20px}
      .customer-detail-section h3 {margin:0 0 10px}
      .customer-detail-table-wrap {overflow-x:auto}
      .customer-detail-table {
        width:100%;border-collapse:collapse;min-width:490px;
      }
      .customer-detail-table th,.customer-detail-table td {
        padding:9px;border-bottom:1px solid var(--border-color,#e5e7eb);
        text-align:left;font-size:13px;white-space:nowrap;
      }
      .customer-payment-form {
        display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
        gap:12px;margin-top:12px;
      }
      .customer-payment-form .full {grid-column:1/-1}
      .customer-payment-form input,.customer-payment-form select {
        width:100%;box-sizing:border-box;padding:10px;
        border:1px solid var(--border-color,#d1d5db);
        border-radius:8px;background:var(--input-bg,transparent);
        color:inherit;font:inherit;
      }
      .customer-detail-status {
        display:none;margin:12px 0;padding:10px;border-radius:8px;
        background:#ecfdf5;color:#166534;overflow-wrap:anywhere;
      }
      .customer-detail-status.error {background:#fef2f2;color:#991b1b}
      @media(max-width:520px) {
        .customer-detail-summary,.customer-payment-form {
          grid-template-columns:1fr;
        }
        .customer-payment-form .full {grid-column:auto}
      }
    `;
    document.head.appendChild(style);

    const modal = document.createElement("div");
    modal.className = "customer-modal";
    modal.id = "customerDetailsModal";
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
      <section class="customer-dialog" role="dialog"
        aria-modal="true" aria-labelledby="customerDetailsTitle">
        <div class="customer-dialog-head">
          <div>
            <h2 id="customerDetailsTitle">ग्राहक विवरण</h2>
            <p id="customerDetailsContact"></p>
          </div>
          <button type="button" id="closeCustomerDetails"
            class="customer-btn" aria-label="बन्द गर्नुहोस्">✕</button>
        </div>

        <div id="customerDetailsStatus"
          class="customer-detail-status" role="status" aria-live="polite"></div>

        <div class="customer-detail-summary">
          <div class="customer-detail-card">
            <span>कुल बिक्री</span><strong id="detailSalesTotal">रु. 0.00</strong>
          </div>
          <div class="customer-detail-card">
            <span>जम्मा तिरेको</span><strong id="detailPaidTotal">रु. 0.00</strong>
          </div>
          <div class="customer-detail-card">
            <span>बाँकी उधारो</span><strong id="detailBalanceTotal">रु. 0.00</strong>
          </div>
        </div>

        <div class="customer-detail-section">
          <h3>पैसा प्राप्त गर्ने</h3>
          <form id="customerPaymentForm" class="customer-payment-form">
            <div class="customer-field">
              <label for="customerPaymentDate">मिति *</label>
              <input id="customerPaymentDate" type="date" required>
            </div>
            <div class="customer-field">
              <label for="customerPaymentAmount">प्राप्त रकम *</label>
              <input id="customerPaymentAmount" type="number"
                min="0.01" step="0.01" required>
            </div>
            <div class="customer-field">
              <label for="customerPaymentMethod">भुक्तानी माध्यम *</label>
              <select id="customerPaymentMethod" required>
                <option value="CASH">Cash / नगद</option>
                <option value="BANK">Bank / बैंक</option>
                <option value="QR">QR</option>
              </select>
            </div>
            <div class="customer-field">
              <label for="customerPaymentReference">रेफरेन्स / रसिद नं.</label>
              <input id="customerPaymentReference" maxlength="100">
            </div>
            <div class="customer-field full">
              <label for="customerPaymentNote">टिप्पणी</label>
              <input id="customerPaymentNote" maxlength="250"
                placeholder="ऐच्छिक">
            </div>
            <div class="customer-field full">
              <button type="submit" class="customer-btn primary">
                पैसा प्राप्त सुरक्षित गर्नुहोस्
              </button>
            </div>
          </form>
        </div>

        <div class="customer-detail-section">
          <h3>बिक्री / बिल इतिहास</h3>
          <div class="customer-detail-table-wrap">
            <table class="customer-detail-table">
              <thead><tr>
                <th>मिति</th><th>बिल नं.</th><th>बिल रकम</th>
                <th>तिरेको</th><th>बाँकी</th>
              </tr></thead>
              <tbody id="customerBillHistory"></tbody>
            </table>
          </div>
        </div>

        <div class="customer-detail-section">
          <h3>भुक्तानी इतिहास</h3>
          <div class="customer-detail-table-wrap">
            <table class="customer-detail-table">
              <thead><tr>
                <th>मिति</th><th>रकम</th><th>माध्यम</th><th>रेफरेन्स</th>
              </tr></thead>
              <tbody id="customerPaymentHistory"></tbody>
            </table>
          </div>
        </div>

        <div class="customer-form-actions">
          <button type="button" id="closeCustomerDetailsBottom"
            class="customer-btn">बन्द गर्नुहोस्</button>
        </div>
      </section>
    `;

    document.body.appendChild(modal);

    $("closeCustomerDetails").addEventListener("click", closeCustomerDetails);
    $("closeCustomerDetailsBottom").addEventListener("click", closeCustomerDetails);

    modal.addEventListener("click", event => {
      if (event.target === modal) closeCustomerDetails();
    });

    $("customerPaymentForm").addEventListener("submit", receiveCustomerPayment);
  }

  function setDetailStatus(message, isError) {
    const el = $("customerDetailsStatus");
    el.textContent = message;
    el.className = "customer-detail-status" + (isError ? " error" : "");
    el.style.display = "block";
  }

  function paymentHistoryFor(customer) {
    const payments = readArray(PAYMENT_KEY);
    const id = String(customer.id || "");
    return payments.filter(p =>
      p && String(p.customerId || "") === id
    );
  }

  function showCustomerDetails(id) {
    try {
      ensureDetailsModal();

      const customer = readArray(CUSTOMER_KEY)
        .find(c => String(c.id) === String(id));

      if (!customer) {
        showError("ग्राहक भेटिएन।");
        return;
      }

      activeCustomerId = String(customer.id);

      const sales = customerSales(customer, salesList()).sort((a, b) =>
        String(a.date || a.createdAt || "")
          .localeCompare(String(b.date || b.createdAt || ""))
      );

      const payments = paymentHistoryFor(customer).sort((a, b) =>
        String(b.createdAt || b.date || "")
          .localeCompare(String(a.createdAt || a.date || ""))
      );

      const total = sales.reduce((sum, s) => sum + saleTotal(s), 0);
      const paid = sales.reduce((sum, s) => sum + salePaid(s), 0);
      const due = sales.reduce((sum, s) => sum + saleBalance(s), 0);

      $("customerDetailsTitle").textContent = customerName(customer) || "ग्राहक विवरण";
      $("customerDetailsContact").textContent =
        [customer.phone, customer.address].filter(Boolean).join(" • ") ||
        "सम्पर्क विवरण छैन";

      $("detailSalesTotal").textContent = money(total);
      $("detailPaidTotal").textContent = money(paid);
      $("detailBalanceTotal").textContent = money(due);

      $("customerPaymentDate").value = todayISO();
      $("customerPaymentAmount").value = "";
      $("customerPaymentReference").value = "";
      $("customerPaymentNote").value = "";
      $("customerDetailsStatus").style.display = "none";

      $("customerBillHistory").innerHTML = sales.length
        ? sales.map(s => `
          <tr>
            <td>${escapeHTML(s.date || "-")}</td>
            <td>${escapeHTML(s.billNumber || s.id || "-")}</td>
            <td>${money(saleTotal(s))}</td>
            <td>${money(salePaid(s))}</td>
            <td>${money(saleBalance(s))}</td>
          </tr>
        `).join("")
        : '<tr><td colspan="5">बिक्री बिल छैन।</td></tr>';

      $("customerPaymentHistory").innerHTML = payments.length
        ? payments.map(p => `
          <tr>
            <td>${escapeHTML(p.date || "-")}</td>
            <td>${money(p.amount)}</td>
            <td>${escapeHTML(p.method || "-")}</td>
            <td>${escapeHTML(p.reference || "-")}</td>
          </tr>
        `).join("")
        : '<tr><td colspan="4">भुक्तानी इतिहास छैन।</td></tr>';

      $("customerDetailsModal").classList.add("show");
      $("customerDetailsModal").setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    } catch (e) {
      showError("ग्राहक विवरण खोल्न सकिएन: " + e.message);
    }
  }

  function closeCustomerDetails() {
    const modal = $("customerDetailsModal");
    if (!modal) return;
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.removeProperty("overflow");
    activeCustomerId = null;
  }

  function receiveCustomerPayment(event) {
    event.preventDefault();

    try {
      const customer = readArray(CUSTOMER_KEY)
        .find(c => String(c.id) === String(activeCustomerId));

      if (!customer) {
        setDetailStatus("ग्राहक भेटिएन। फेरि खोल्नुहोस्।", true);
        return;
      }

      const amount = num($("customerPaymentAmount").value);
      const date = $("customerPaymentDate").value || todayISO();
      const method = $("customerPaymentMethod").value;
      const reference = $("customerPaymentReference").value.trim();
      const note = $("customerPaymentNote").value.trim();

      if (!(amount > 0)) {
        setDetailStatus("प्राप्त रकम शून्यभन्दा बढी हुनुपर्छ।", true);
        return;
      }

      const sales = readArray(SALE_KEY);
      const linked = customerSales(customer, sales)
        .filter(s => s && !s.voided && !s.isVoid)
        .sort((a, b) =>
          String(a.date || a.createdAt || "")
            .localeCompare(String(b.date || b.createdAt || ""))
        );

      const dueBefore = linked.reduce((sum, s) => sum + saleBalance(s), 0);

      if (dueBefore <= 0) {
        setDetailStatus("यस ग्राहकको बिक्रीमा बाँकी उधारो छैन।", true);
        return;
      }

      if (amount - dueBefore > 0.000001) {
        setDetailStatus(
          "प्राप्त रकम बाँकी उधारोभन्दा बढी भयो। बाँकी: " + money(dueBefore),
          true
        );
        return;
      }

      // पुरानो बाँकी बिलबाट सुरु गर्दै भुक्तानी बाँड्ने
      let remaining = amount;

      linked.forEach(s => {
        if (remaining <= 0.000001) return;

        const due = saleBalance(s);
        if (due <= 0) return;

        const applied = Math.min(due, remaining);
        s.paidAmount = salePaid(s) + applied;
        s.balance = Math.max(0, due - applied);
        remaining -= applied;
      });

      const paymentId = "CPAY-" + Date.now() + "-" +
        Math.random().toString(36).slice(2, 7).toUpperCase();

      const payment = {
        id: paymentId,
        customerId: customer.id,
        customerName: customerName(customer),
        date,
        amount,
        method,
        reference,
        note,
        createdAt: new Date().toISOString()
      };

      const payments = readArray(PAYMENT_KEY);
      payments.push(payment);

      const finance = readArray(FINANCE_KEY);
      const financeTransaction = {
        id: "FIN-" + paymentId,
        date,
        type: "INCOME",
        category: "CUSTOMER_COLLECTION",
        account: method,
        amount,
        reference: reference || paymentId,
        note: "Customer collection: " + customerName(customer) +
          (note ? " — " + note : ""),
        linkedPaymentId: paymentId,
        createdAt: new Date().toISOString()
      };

      // Save असफल भए तीनवटै पुराना रेकर्ड फर्काउने प्रयास
      const keys = [SALE_KEY, PAYMENT_KEY, FINANCE_KEY];
      const previous = {};

      keys.forEach(key => {
        previous[key] = localStorage.getItem(key);
      });

      try {
        const saleJSON = JSON.stringify(sales);
        const paymentJSON = JSON.stringify(payments);
        const financeJSON = JSON.stringify(finance.concat(financeTransaction));

        localStorage.setItem(SALE_KEY, saleJSON);
        localStorage.setItem(PAYMENT_KEY, paymentJSON);
        localStorage.setItem(FINANCE_KEY, financeJSON);
      } catch (saveError) {
        keys.forEach(key => {
          try {
            if (previous[key] === null) {
              localStorage.removeItem(key);
            } else {
              localStorage.setItem(key, previous[key]);
            }
          } catch (rollbackError) {
            console.error("Rollback failed:", key, rollbackError);
          }
        });
        throw saveError;
      }

      render();
      showCustomerDetails(customer.id);
      setDetailStatus(
        money(amount) + " प्राप्त रकम सुरक्षित भयो। बाँकी उधारो: " +
        money(dueBefore - amount),
        false
      );
    } catch (e) {
      setDetailStatus("भुक्तानी सुरक्षित गर्न सकिएन: " + e.message, true);
    }
  }

  function render() {
    const customers = readArray(CUSTOMER_KEY);
    const sales = salesList();
    const tbody = $("customersTableBody");
    const query = $("customerSearch").value.trim().toLowerCase();

    let total = 0;
    let paid = 0;
    let balance = 0;
    const counted = new Set();

    customers.forEach(c => {
      customerSales(c, sales).forEach(s => {
        const key = s.id ? "id:" + s.id :
          s.billNumber ? "bill:" + s.billNumber : s;

        if (!counted.has(key)) {
          counted.add(key);
          total += saleTotal(s);
          paid += salePaid(s);
          balance += saleBalance(s);
        }
      });
    });

    $("totalCustomers").textContent = customers.length;
    $("customerSalesTotal").textContent = money(total);
    $("customerPaidTotal").textContent = money(paid);
    $("customerBalanceTotal").textContent = money(balance);

    const filtered = customers.filter(c =>
      [c.name, c.customerName, c.phone, c.email, c.address]
        .join(" ").toLowerCase().includes(query)
    );

    if (!filtered.length) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="customer-empty">' +
        (query ? "खोजिएको ग्राहक भेटिएन।" : "अहिलेसम्म ग्राहक थपिएको छैन।") +
        "</td></tr>";
      return;
    }

    tbody.innerHTML = filtered.map((c, i) => {
      const linked = customerSales(c, sales);
      const amount = linked.reduce((sum, s) => sum + saleTotal(s), 0);
      const due = linked.reduce((sum, s) => sum + saleBalance(s), 0);

      return "<tr>" +
        "<td>" + (i + 1) + "</td>" +
        '<td><button type="button" class="customer-name-link" data-view-customer="' +
        escapeHTML(c.id) + '">' +
        escapeHTML(customerName(c) || "नाम छैन") +
        "</button></td>" +
        "<td>" + escapeHTML(c.phone || "—") + "</td>" +
        "<td>" + escapeHTML(c.address || "—") + "</td>" +
        "<td>" + money(amount) + "</td>" +
        "<td>" + money(due) + "</td>" +
        '<td><div class="customer-actions">' +
        '<button type="button" class="customer-btn" data-edit="' +
        escapeHTML(c.id) + '">सम्पादन</button>' +
        '<button type="button" class="customer-btn danger" data-delete="' +
        escapeHTML(c.id) + '">हटाउनुहोस्</button>' +
        "</div></td></tr>";
    }).join("");
  }

  function editCustomer(id) {
    try {
      const c = readArray(CUSTOMER_KEY)
        .find(x => String(x.id) === String(id));

      if (!c) {
        showError("ग्राहक भेटिएन।");
        return;
      }

      editingId = String(c.id);
      $("customerId").value = editingId;
      $("customerName").value = c.name || c.customerName || "";
      $("customerPhone").value = c.phone || "";
      $("customerEmail").value = c.email || "";
      $("customerAddress").value = c.address || "";
      $("customerNote").value = c.note || "";
      $("customerOpeningBalance").value = num(c.openingBalance);
      $("customerFormTitle").textContent = "ग्राहक विवरण सम्पादन";
      clearError();

      $("customerFormCard").classList.add("show");
      $("customerFormCard").setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    } catch (e) {
      showError("ग्राहक खोल्न सकिएन: " + e.message);
    }
  }

  function saveCustomer(event) {
    event.preventDefault();
    clearError();

    try {
      const name = $("customerName").value.trim();
      const phone = $("customerPhone").value.trim();
      const email = $("customerEmail").value.trim();
      const address = $("customerAddress").value.trim();
      const note = $("customerNote").value.trim();
      const openingBalance = num($("customerOpeningBalance").value);

      if (!name) return showError("ग्राहकको नाम राख्नुहोस्।");
      if (openingBalance < 0) {
        return showError("सुरुको बाँकी रकम ऋणात्मक हुन मिल्दैन।");
      }

      const customers = readArray(CUSTOMER_KEY);
      const duplicate = customers.find(c =>
        String(c.id) !== String(editingId || "") &&
        customerName(c).toLowerCase() === name.toLowerCase() &&
        phone !== "" && String(c.phone || "").trim() === phone
      );

      if (duplicate) {
        return showError("यही नाम र मोबाइल नम्बर भएको ग्राहक पहिल्यै छ।");
      }

      const now = new Date().toISOString();
      const wasEditing = Boolean(editingId);

      if (wasEditing) {
        const index = customers.findIndex(c =>
          String(c.id) === editingId
        );

        if (index < 0) {
          return showError("सम्पादन गर्ने ग्राहक भेटिएन।");
        }

        customers[index] = {
          ...customers[index],
          name, phone, email, address, note, openingBalance,
          updatedAt: now
        };
      } else {
        customers.push({
          id: "CUST-" + Date.now() + "-" +
            Math.random().toString(36).slice(2, 7).toUpperCase(),
          name, phone, email, address, note, openingBalance,
          active: true,
          createdAt: now,
          updatedAt: now
        });
      }

      writeArray(CUSTOMER_KEY, customers);

      window.closeCustomerPopup();
      $("customerForm").reset();
      $("customerId").value = "";
      $("customerOpeningBalance").value = "0";
      editingId = null;

      render();
    } catch (e) {
      showError("ग्राहक सुरक्षित गर्न सकिएन: " + e.message);
    }
  }

  function deleteCustomer(id) {
    try {
      const customers = readArray(CUSTOMER_KEY);
      const c = customers.find(x => String(x.id) === String(id));

      if (!c) {
        showError("ग्राहक भेटिएन।");
        return;
      }

      if (customerSales(c, salesList()).length) {
        showError("यो ग्राहकको बिक्री इतिहास छ। इतिहास सुरक्षित राख्न ग्राहक हटाउन मिल्दैन।");
        return;
      }

      if (!window.confirm("के " + customerName(c) + " लाई हटाउन चाहनुहुन्छ?")) {
        return;
      }

      writeArray(
        CUSTOMER_KEY,
        customers.filter(x => String(x.id) !== String(id))
      );
      render();
    } catch (e) {
      showError("ग्राहक हटाउन सकिएन: " + e.message);
    }
  }

  function init() {
    ensureDetailsModal();

    $("customerForm").addEventListener("submit", saveCustomer);

    $("customerSearch").addEventListener("input", function () {
      try {
        render();
      } catch (e) {
        showError("ग्राहक सूची लोड गर्न सकिएन: " + e.message);
      }
    });

    $("customersTableBody").addEventListener("click", function (event) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const view = target.closest("[data-view-customer]");
      const edit = target.closest("[data-edit]");
      const del = target.closest("[data-delete]");

      if (view) showCustomerDetails(view.getAttribute("data-view-customer"));
      if (edit) editCustomer(edit.getAttribute("data-edit"));
      if (del) deleteCustomer(del.getAttribute("data-delete"));
    });

    document.addEventListener("keydown", function (event) {
      if (
        event.key === "Escape" &&
        $("customerDetailsModal")?.classList.contains("show")
      ) {
        closeCustomerDetails();
      }
    });

    try {
      render();
    } catch (e) {
      showError("ग्राहक विवरण लोड गर्न सकिएन: " + e.message);
    }
  }

  window.submitCustomerForm = saveCustomer;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
