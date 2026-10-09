"use strict";

(function () {
  const CUSTOMER_KEY = "gs_customers";
  const SALE_KEY = "gs_sales";

  let editingId = null;

  const $ = id => document.getElementById(id);

  function readArray(key) {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) throw new Error(key + " को डेटा सूची होइन।");
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
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
    })[ch]);
  }

  function error(message) {
    const box = $("customerError");
    if (box) {
      box.textContent = message;
      box.style.display = "block";
    } else {
      alert(message);
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
      if (s.customerId && id && String(s.customerId) === id) return true;
      const n = saleName(s).toLowerCase();
      return Boolean(name && n && name === n);
    });
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
      [
        c.name, c.customerName, c.phone, c.email, c.address
      ].join(" ").toLowerCase().includes(query)
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
        "<td><strong>" + escapeHTML(customerName(c) || "नाम छैन") + "</strong></td>" +
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
      const c = readArray(CUSTOMER_KEY).find(x => String(x.id) === String(id));
      if (!c) return error("ग्राहक भेटिएन।");

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
      error("ग्राहक खोल्न सकिएन: " + e.message);
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

      if (!name) return error("ग्राहकको नाम राख्नुहोस्।");
      if (openingBalance < 0) return error("सुरुको बाँकी रकम ऋणात्मक हुन मिल्दैन।");

      const customers = readArray(CUSTOMER_KEY);

      const duplicate = customers.find(c =>
        String(c.id) !== String(editingId || "") &&
        customerName(c).toLowerCase() === name.toLowerCase() &&
        phone !== "" && String(c.phone || "").trim() === phone
      );

      if (duplicate) return error("यही नाम र मोबाइल नम्बर भएको ग्राहक पहिल्यै छ।");

      const now = new Date().toISOString();
      const wasEditing = Boolean(editingId);

      if (wasEditing) {
        const index = customers.findIndex(c => String(c.id) === editingId);
        if (index < 0) return error("सम्पादन गर्ने ग्राहक भेटिएन।");

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
      alert(wasEditing ? "ग्राहक विवरण अपडेट भयो।" : "नयाँ ग्राहक सुरक्षित भयो।");
    } catch (e) {
      error("ग्राहक सुरक्षित गर्न सकिएन: " + e.message);
    }
  }

  function deleteCustomer(id) {
    try {
      const customers = readArray(CUSTOMER_KEY);
      const c = customers.find(x => String(x.id) === String(id));
      if (!c) return error("ग्राहक भेटिएन।");

      if (customerSales(c, salesList()).length) {
        alert("यो ग्राहकको बिक्री इतिहास छ। इतिहास सुरक्षित राख्न ग्राहक हटाउन मिल्दैन।");
        return;
      }

      if (!confirm("के " + customerName(c) + " लाई हटाउन चाहनुहुन्छ?")) return;

      writeArray(CUSTOMER_KEY, customers.filter(x => String(x.id) !== String(id)));
      render();
      alert("ग्राहक हटाइयो।");
    } catch (e) {
      error("ग्राहक हटाउन सकिएन: " + e.message);
    }
  }

  function init() {
    $("customerForm").addEventListener("submit", saveCustomer);

    $("customerSearch").addEventListener("input", function () {
      try {
        render();
      } catch (e) {
        error("ग्राहक सूची लोड गर्न सकिएन: " + e.message);
      }
    });

    $("customersTableBody").addEventListener("click", function (event) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const edit = target.closest("[data-edit]");
      const del = target.closest("[data-delete]");

      if (edit) editCustomer(edit.getAttribute("data-edit"));
      if (del) deleteCustomer(del.getAttribute("data-delete"));
    });

    try {
      render();
    } catch (e) {
      error("ग्राहक विवरण लोड गर्न सकिएन: " + e.message);
    }
  }

  window.submitCustomerForm = saveCustomer;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
