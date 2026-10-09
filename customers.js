
"use strict";

(function () {
  const CUSTOMER_KEY = "gs_customers";
  const SALE_KEY = "gs_sales";
  let editingId = null;

  const $ = (id) => document.getElementById(id);

  function readArray(key) {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];

    const value = JSON.parse(raw);

    if (!Array.isArray(value)) {
      throw new Error(key + " को डेटा सूचीको रूपमा छैन।");
    }

    return value;
  }

  function writeArray(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function num(value) {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
  }

  function money(value) {
    return "रु. " + num(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(
      /[&<>"']/g,
      function (char) {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        }[char];
      }
    );
  }

  function showError(message) {
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

  function getCustomers() {
    return readArray(CUSTOMER_KEY);
  }

  function getSales() {
    return readArray(SALE_KEY).filter(function (sale) {
      return sale && !sale.voided && !sale.isVoid;
    });
  }

  function customerName(customer) {
    return String(customer.name || customer.customerName || "").trim();
  }

  function saleName(sale) {
    return String(sale.customerName || sale.customer || "").trim();
  }

  function saleTotal(sale) {
    return num(sale.total ?? sale.amount);
  }

  function salePaid(sale) {
    return num(sale.paidAmount ?? sale.paid);
  }

  function saleBalance(sale) {
    if (sale.balance !== undefined && sale.balance !== null) {
      return Math.max(0, num(sale.balance));
    }

    return Math.max(0, saleTotal(sale) - salePaid(sale));
  }

  function customerSales(customer, sales) {
    const id = String(customer.id || "");
    const name = customerName(customer).toLowerCase();
    const phone = String(customer.phone || "").trim();

    return sales.filter(function (sale) {
      if (sale.customerId && id && String(sale.customerId) === id) {
        return true;
      }

      const saleCustomer = saleName(sale).toLowerCase();

      if (!name || !saleCustomer || name !== saleCustomer) {
        return false;
      }

      // Older sales usually only have a customer name, not a customer ID.
      return true;
    });
  }

  function showForm(isEditing) {
    const panel = $("customerFormCard");
    if (!panel) return;

    panel.classList.remove("customer-form-hidden");
    $("customerFormTitle").textContent = isEditing
      ? "ग्राहक विवरण सम्पादन"
      : "नयाँ ग्राहक विवरण";

    panel.scrollIntoView({ behavior: "smooth", block: "start" });
    $("customerName").focus();
  }

  function hideForm() {
    $("customerFormCard").classList.add("customer-form-hidden");
    $("customerForm").reset();
    $("customerId").value = "";
    $("customerOpeningBalance").value = "0";
    editingId = null;
    clearError();
  }

  function render() {
    const customers = getCustomers();
    const sales = getSales();
    const tbody = $("customersTableBody");
    const query = String($("customerSearch").value || "")
      .trim()
      .toLowerCase();

    let allSalesTotal = 0;
    let allBalanceTotal = 0;

    customers.forEach(function (customer) {
      const matchedSales = customerSales(customer, sales);

      allSalesTotal += matchedSales.reduce(function (sum, sale) {
        return sum + saleTotal(sale);
      }, 0);

      allBalanceTotal += matchedSales.reduce(function (sum, sale) {
        return sum + saleBalance(sale);
      }, 0);
    });

    $("totalCustomers").textContent = customers.length;
    $("customerSalesTotal").textContent = money(allSalesTotal);
    $("customerBalanceTotal").textContent = money(allBalanceTotal);

    const filtered = customers.filter(function (customer) {
      const text = [
        customer.name,
        customer.customerName,
        customer.phone,
        customer.email,
        customer.address
      ].join(" ").toLowerCase();

      return text.includes(query);
    });

    if (!filtered.length) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center;padding:20px;">' +
        (query ? "खोजिएको ग्राहक भेटिएन।" : "अहिलेसम्म ग्राहक थपिएको छैन।") +
        "</td></tr>";
      return;
    }

    tbody.innerHTML = filtered.map(function (customer, index) {
      const matchedSales = customerSales(customer, sales);

      const salesTotal = matchedSales.reduce(function (sum, sale) {
        return sum + saleTotal(sale);
      }, 0);

      const balanceTotal = matchedSales.reduce(function (sum, sale) {
        return sum + saleBalance(sale);
      }, 0);

      return (
        "<tr>" +
          "<td>" + (index + 1) + "</td>" +
          "<td><strong>" + escapeHTML(customerName(customer) || "नाम छैन") + "</strong></td>" +
          "<td>" + escapeHTML(customer.phone || "—") + "</td>" +
          "<td>" + escapeHTML(customer.address || "—") + "</td>" +
          "<td>" + money(salesTotal) + "</td>" +
          "<td>" + money(balanceTotal) + "</td>" +
          '<td><div class="customer-actions">' +
            '<button type="button" class="customer-edit" data-edit="' +
              escapeHTML(customer.id) + '">सम्पादन</button>' +
            '<button type="button" class="customer-delete" data-delete="' +
              escapeHTML(customer.id) + '">हटाउनुहोस्</button>' +
          "</div></td>" +
        "</tr>"
      );
    }).join("");
  }

  function editCustomer(id) {
    const customers = getCustomers();

    const customer = customers.find(function (item) {
      return String(item.id) === String(id);
    });

    if (!customer) {
      showError("यो ग्राहक रेकर्ड भेटिएन।");
      return;
    }

    editingId = String(customer.id);
    $("customerId").value = editingId;
    $("customerName").value = customer.name || customer.customerName || "";
    $("customerPhone").value = customer.phone || "";
    $("customerEmail").value = customer.email || "";
    $("customerAddress").value = customer.address || "";
    $("customerNote").value = customer.note || "";
    $("customerOpeningBalance").value = num(customer.openingBalance);

    showForm(true);
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

      if (!name) {
        showError("कृपया ग्राहकको नाम राख्नुहोस्।");
        return;
      }

      if (openingBalance < 0) {
        showError("सुरुको बाँकी रकम ऋणात्मक हुन मिल्दैन।");
        return;
      }

      const customers = getCustomers();

      const duplicate = customers.find(function (customer) {
        return String(customer.id) !== String(editingId || "") &&
          customerName(customer).toLowerCase() === name.toLowerCase() &&
          phone &&
          String(customer.phone || "").trim() === phone;
      });

      if (duplicate) {
        showError("यही नाम र मोबाइल नम्बर भएको ग्राहक पहिल्यै छ।");
        return;
      }

      const now = new Date().toISOString();

      if (editingId) {
        const index = customers.findIndex(function (customer) {
          return String(customer.id) === String(editingId);
        });

        if (index < 0) {
          showError("सम्पादन गर्न खोजिएको ग्राहक भेटिएन।");
          return;
        }

        const old = customers[index];

        customers[index] = {
          ...old,
          name: name,
          phone: phone,
          email: email,
          address: address,
          note: note,
          openingBalance: openingBalance,
          updatedAt: now
        };
      } else {
        customers.push({
          id: "CUST-" + Date.now() + "-" +
            Math.random().toString(36).slice(2, 7).toUpperCase(),
          name: name,
          phone: phone,
          email: email,
          address: address,
          note: note,
          openingBalance: openingBalance,
          active: true,
          createdAt: now,
          updatedAt: now
        });
      }

      writeArray(CUSTOMER_KEY, customers);

      hideForm();
      render();

      alert(editingId
        ? "ग्राहक विवरण अपडेट भयो।"
        : "नयाँ ग्राहक सुरक्षित भयो।");
    } catch (error) {
      console.error("Customer save error:", error);
      showError(
        "ग्राहक सुरक्षित गर्न सकिएन। पुरानो डेटा नहटाउनुहोस्। विवरण: " +
        error.message
      );
    }
  }

  function deleteCustomer(id) {
    try {
      const customers = getCustomers();
      const customer = customers.find(function (item) {
        return String(item.id) === String(id);
      });

      if (!customer) {
        showError("ग्राहक रेकर्ड भेटिएन।");
        return;
      }

      const sales = getSales();
      const linkedSales = customerSales(customer, sales);

      if (linkedSales.length > 0) {
        alert(
          "यो ग्राहकको बिक्री इतिहास छ। बिक्रीसँग जोडिएको ग्राहक हटाउँदा इतिहासमा समस्या आउन सक्छ।\n\n" +
          "सुरक्षित विकल्प: ग्राहकलाई हटाउनुको सट्टा विवरण सम्पादन गर्नुहोस्।"
        );
        return;
      }

      const confirmed = confirm(
        "के तपाईं " + customerName(customer) +
        " लाई ग्राहक सूचीबाट हटाउन चाहनुहुन्छ?"
      );

      if (!confirmed) return;

      const updated = customers.filter(function (item) {
        return String(item.id) !== String(id);
      });

      writeArray(CUSTOMER_KEY, updated);
      render();
      alert("ग्राहक सूचीबाट हटाइयो।");
    } catch (error) {
      console.error("Customer delete error:", error);
      showError("ग्राहक हटाउन सकिएन: " + error.message);
    }
  }

  function init() {
    $("newCustomerBtn").addEventListener("click", function () {
      clearError();
      editingId = null;
      $("customerForm").reset();
      $("customerId").value = "";
      $("customerOpeningBalance").value = "0";
      showForm(false);
    });

    $("cancelCustomerBtn").addEventListener("click", hideForm);
    $("customerForm").addEventListener("submit", saveCustomer);
    $("customerSearch").addEventListener("input", function () {
      try {
        render();
      } catch (error) {
        showError("ग्राहक सूची देखाउन सकिएन: " + error.message);
      }
    });

    $("customersTableBody").addEventListener("click", function (event) {
      const editButton = event.target.closest("[data-edit]");
      const deleteButton = event.target.closest("[data-delete]");

      if (editButton) {
        editCustomer(editButton.dataset.edit);
      } else if (deleteButton) {
        deleteCustomer(deleteButton.dataset.delete);
      }
    });

    hideForm();

    try {
      render();
    } catch (error) {
      console.error("Customer load error:", error);
      showError(
        "ग्राहक डेटा लोड गर्न सकिएन। डेटा सुरक्षित राखिएको छ। विवरण: " +
        error.message
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
