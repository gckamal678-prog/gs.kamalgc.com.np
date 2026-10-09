
"use strict";

(function () {
  const CUSTOMER_KEY = "gs_customers";
  const SALE_KEY = "gs_sales";

  let editingId = null;
  let initialized = false;

  const $ = function (id) {
    return document.getElementById(id);
  };

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
        const entities = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        };

        return entities[char];
      }
    );
  }

  function showError(message) {
    const box = $("customerError");

    if (box) {
      box.textContent = message;
      box.style.display = "block";
      box.scrollIntoView({ behavior: "smooth", block: "nearest" });
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

  function getCustomerName(customer) {
    return String(customer.name || customer.customerName || "").trim();
  }

  function getSaleCustomerName(sale) {
    return String(sale.customerName || sale.customer || "").trim();
  }

  function getSaleTotal(sale) {
    return num(sale.total ?? sale.amount);
  }

  function getSaleBalance(sale) {
    if (sale.balance !== undefined && sale.balance !== null) {
      return Math.max(0, num(sale.balance));
    }

    return Math.max(
      0,
      getSaleTotal(sale) - num(sale.paidAmount ?? sale.paid)
    );
  }

  function getCustomerSales(customer, sales) {
    const customerId = String(customer.id || "");
    const name = getCustomerName(customer).toLowerCase();

    return sales.filter(function (sale) {
      if (
        sale.customerId &&
        customerId &&
        String(sale.customerId) === customerId
      ) {
        return true;
      }

      const saleName = getSaleCustomerName(sale).toLowerCase();

      return Boolean(name && saleName && name === saleName);
    });
  }

  function showForm(isEditing) {
    const panel = $("customerFormCard");

    if (!panel) {
      showError("ग्राहक फारम भेटिएन।");
      return;
    }

    panel.classList.remove("customer-form-hidden");
    panel.style.removeProperty("display");

    if ($("customerFormTitle")) {
      $("customerFormTitle").textContent = isEditing
        ? "ग्राहक विवरण सम्पादन"
        : "नयाँ ग्राहक विवरण";
    }

    panel.scrollIntoView({ behavior: "smooth", block: "start" });

    if ($("customerName")) $("customerName").focus();
  }

  function hideForm() {
    const panel = $("customerFormCard");
    const form = $("customerForm");

    if (panel) {
      panel.classList.add("customer-form-hidden");
      panel.style.removeProperty("display");
    }

    if (form) form.reset();

    if ($("customerId")) $("customerId").value = "";
    if ($("customerOpeningBalance")) {
      $("customerOpeningBalance").value = "0";
    }

    editingId = null;
    clearError();
  }

  // HTML को बटनले यो फङ्सन बोलाउँछ।
  window.resetCustomerFormForNew = function () {
    editingId = null;

    const form = $("customerForm");

    if (form) form.reset();

    if ($("customerId")) $("customerId").value = "";
    if ($("customerOpeningBalance")) {
      $("customerOpeningBalance").value = "0";
    }

    clearError();
    showForm(false);
  };

  // पुरानो बिक्री र ग्राहक डेटा नबिगारी सूची देखाउने।
  function render() {
    const customers = getCustomers();
    const sales = getSales();
    const tbody = $("customersTableBody");

    if (!tbody) {
      throw new Error("ग्राहक सूचीको तालिका भेटिएन।");
    }

    const query = String(
      $("customerSearch") ? $("customerSearch").value : ""
    ).trim().toLowerCase();

    let totalSales = 0;
    let totalBalance = 0;

    // ग्राहक नामबाट मिल्ने बिक्रीलाई एकपटक मात्र जोड्ने।
    const assignedSales = new Set();

    customers.forEach(function (customer) {
      getCustomerSales(customer, sales).forEach(function (sale) {
        const key = sale.id || sale.billNumber || sale;

        if (!assignedSales.has(key)) {
          assignedSales.add(key);
          totalSales += getSaleTotal(sale);
          totalBalance += getSaleBalance(sale);
        }
      });
    });

    if ($("totalCustomers")) {
      $("totalCustomers").textContent = customers.length;
    }

    if ($("customerSalesTotal")) {
      $("customerSalesTotal").textContent = money(totalSales);
    }

    if ($("customerBalanceTotal")) {
      $("customerBalanceTotal").textContent = money(totalBalance);
    }

    const filtered = customers.filter(function (customer) {
      const searchText = [
        customer.name,
        customer.customerName,
        customer.phone,
        customer.email,
        customer.address
      ].join(" ").toLowerCase();

      return searchText.includes(query);
    });

    if (!filtered.length) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center;padding:20px;">' +
        (query
          ? "खोजिएको ग्राहक भेटिएन।"
          : "अहिलेसम्म ग्राहक थपिएको छैन।") +
        "</td></tr>";
      return;
    }

    tbody.innerHTML = filtered.map(function (customer, index) {
      const matchedSales = getCustomerSales(customer, sales);

      const salesTotal = matchedSales.reduce(function (sum, sale) {
        return sum + getSaleTotal(sale);
      }, 0);

      const balanceTotal = matchedSales.reduce(function (sum, sale) {
        return sum + getSaleBalance(sale);
      }, 0);

      return (
        "<tr>" +
          "<td>" + (index + 1) + "</td>" +
          "<td><strong>" +
            escapeHTML(getCustomerName(customer) || "नाम छैन") +
          "</strong></td>" +
          "<td>" + escapeHTML(customer.phone || "—") + "</td>" +
          "<td>" + escapeHTML(customer.address || "—") + "</td>" +
          "<td>" + money(salesTotal) + "</td>" +
          "<td>" + money(balanceTotal) + "</td>" +
          '<td><div class="customer-actions">' +
            '<button type="button" class="customer-edit" data-edit="' +
              escapeHTML(customer.id) +
            '">सम्पादन</button>' +
            '<button type="button" class="customer-delete" data-delete="' +
              escapeHTML(customer.id) +
            '">हटाउनुहोस्</button>' +
          "</div></td>" +
        "</tr>"
      );
    }).join("");
  }

  function editCustomer(id) {
    try {
      const customers = getCustomers();

      const customer = customers.find(function (item) {
        return String(item.id) === String(id);
      });

      if (!customer) {
        showError("सम्पादन गर्न खोजिएको ग्राहक भेटिएन।");
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
    } catch (error) {
      console.error("Edit customer error:", error);
      showError("ग्राहक विवरण खोल्न सकिएन: " + error.message);
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

      if (!name) {
        showError("कृपया ग्राहकको नाम राख्नुहोस्।");
        $("customerName").focus();
        return;
      }

      if (openingBalance < 0) {
        showError("सुरुको बाँकी रकम ऋणात्मक हुन मिल्दैन।");
        return;
      }

      const customers = getCustomers();

      const duplicate = customers.find(function (customer) {
        return (
          String(customer.id) !== String(editingId || "") &&
          getCustomerName(customer).toLowerCase() === name.toLowerCase() &&
          phone !== "" &&
          String(customer.phone || "").trim() === phone
        );
      });

      if (duplicate) {
        showError("यही नाम र मोबाइल नम्बर भएको ग्राहक पहिल्यै छ।");
        return;
      }

      const wasEditing = Boolean(editingId);
      const now = new Date().toISOString();

      if (wasEditing) {
        const index = customers.findIndex(function (customer) {
          return String(customer.id) === String(editingId);
        });

        if (index === -1) {
          showError("सम्पादन गर्न खोजिएको ग्राहक भेटिएन।");
          return;
        }

        customers[index] = {
          ...customers[index],
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

      alert(wasEditing
        ? "ग्राहक विवरण अपडेट भयो।"
        : "नयाँ ग्राहक सुरक्षित भयो।");
    } catch (error) {
      console.error("Save customer error:", error);
      showError(
        "ग्राहक सुरक्षित गर्न सकिएन। पुरानो डेटा सुरक्षित राखिएको छ। विवरण: " +
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

      const linkedSales = getCustomerSales(customer, getSales());

      if (linkedSales.length > 0) {
        alert(
          "यो ग्राहकको बिक्री इतिहास छ। बिक्री इतिहास सुरक्षित राख्न " +
          "यो ग्राहक हटाउन मिल्दैन। आवश्यक परे सम्पादन गर्नुहोस्।"
        );
        return;
      }

      if (!confirm(
        "के तपाईं " + getCustomerName(customer) +
        " लाई ग्राहक सूचीबाट हटाउन चाहनुहुन्छ?"
      )) {
        return;
      }

      writeArray(
        CUSTOMER_KEY,
        customers.filter(function (item) {
          return String(item.id) !== String(id);
        })
      );

      render();
      alert("ग्राहक सूचीबाट हटाइयो।");
    } catch (error) {
      console.error("Delete customer error:", error);
      showError("ग्राहक हटाउन सकिएन: " + error.message);
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;

    const requiredIds = [
      "newCustomerBtn",
      "customerFormCard",
      "customerForm",
      "customerId",
      "customerName",
      "customerPhone",
      "customerEmail",
      "customerAddress",
      "customerNote",
      "customerOpeningBalance",
      "cancelCustomerBtn",
      "customerSearch",
      "customersTableBody"
    ];

    const missing = requiredIds.filter(function (id) {
      return !$(id);
    });

    if (missing.length) {
      showError("HTML मा आवश्यक ID भेटिएन: " + missing.join(", "));
      return;
    }

    $("newCustomerBtn").addEventListener("click", function (event) {
      event.preventDefault();
      window.resetCustomerFormForNew();
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
      const target = event.target;

      if (!(target instanceof Element)) return;

      const editButton = target.closest("[data-edit]");
      const deleteButton = target.closest("[data-delete]");

      if (editButton) {
        editCustomer(editButton.getAttribute("data-edit"));
      } else if (deleteButton) {
        deleteCustomer(deleteButton.getAttribute("data-delete"));
      }
    });

    hideForm();

    try {
      render();
    } catch (error) {
      console.error("Customer load error:", error);
      showError(
        "ग्राहक डेटा लोड गर्न सकिएन। विवरण: " + error.message
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
