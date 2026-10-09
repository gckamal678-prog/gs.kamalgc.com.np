"use strict";

(function () {
  const PRODUCT_KEY = "gs_products";
  const SALE_KEY = "gs_sales";
  const RETURN_KEY = "gs_sales_returns";
  const LOT_KEY = "gs_stock_lots";

  let selectedSale = null;
  let initialized = false;

  const $ = (id) => document.getElementById(id);

  function readArray(key) {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      throw new Error(key + " मा सुरक्षित डेटा सूचीको रूपमा छैन।");
    }
    return data;
  }

  function writeArray(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function money(value) {
    return number(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function today() {
    const d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(
      /[&<>"']/g,
      function (char) {
        return {
          "&": "&amp;", "<": "&lt;", ">": "&gt;",
          '"': "&quot;", "'": "&#39;"
        }[char];
      }
    );
  }

  function getSales() {
    return readArray(SALE_KEY).filter(function (sale) {
      return sale && !sale.voided && !sale.isVoid &&
        (sale.id || sale.saleId);
    });
  }

  function getProducts() { return readArray(PRODUCT_KEY); }
  function getReturns() { return readArray(RETURN_KEY); }
  function getLots() { return readArray(LOT_KEY); }

  function saleId(sale) {
    return String(sale.id || sale.saleId || "");
  }

  function soldQty(sale) {
    return Math.max(0, number(sale.qty ?? sale.quantity));
  }

  function returnedQty(sale, returnsList) {
    const id = saleId(sale);
    return returnsList.reduce(function (total, item) {
      if (String(item.saleId || "") === id) {
        return total + Math.max(0, number(item.qty ?? item.quantity));
      }
      return total;
    }, 0);
  }

  function productName(sale) {
    return sale.productName || sale.name || "Unknown Product";
  }

  function saleRate(sale) {
    const qty = soldQty(sale);
    if (sale.rate !== undefined && sale.rate !== null) {
      return number(sale.rate);
    }
    if (qty > 0) return number(sale.total ?? sale.amount) / qty;
    return 0;
  }

  function remainingQty(sale, returnsList) {
    return Math.max(0, soldQty(sale) - returnedQty(sale, returnsList));
  }

  function showError(message) {
    const box = $("returnError");
    if (box) {
      box.textContent = message;
      box.style.display = "block";
    } else {
      alert(message);
    }
  }

  function clearError() {
    const box = $("returnError");
    if (box) {
      box.textContent = "";
      box.style.display = "none";
    }
  }

  /* Popup खोल्ने */
  function showPanel() {
    const modal = $("returnModal");
    if (!modal) {
      alert("Return Popup भेटिएन। sales-return.html को पूरा कोड राख्नुहोस्।");
      return;
    }

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    window.setTimeout(function () {
      if ($("returnSale")) $("returnSale").focus();
    }, 50);
  }

  /* Popup बन्द गर्ने */
  function hidePanel() {
    const modal = $("returnModal");
    if (modal) {
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");
    }
    document.body.style.removeProperty("overflow");
  }

  function resetForm() {
    const form = $("returnForm");
    if (form) form.reset();

    selectedSale = null;

    [
      "returnBillNumber",
      "returnCustomer",
      "returnProduct",
      "soldQty",
      "alreadyReturnedQty",
      "remainingReturnQty"
    ].forEach(function (id) {
      const field = $(id);
      if (field) field.value = "";
    });

    const preview = $("returnAmountPreview");
    if (preview) preview.textContent = "Rs. 0.00";

    const qty = $("returnQty");
    if (qty) {
      qty.value = "";
      qty.removeAttribute("max");
    }

    clearError();
  }

  function fillSaleOptions() {
    const select = $("returnSale");
    if (!select) return;

    const oldValue = select.value;
    const sales = getSales();
    const returnsList = getReturns();

    select.innerHTML =
      '<option value="">-- बिक्रीको बिल छान्नुहोस् --</option>';

    sales.forEach(function (sale) {
      const remaining = remainingQty(sale, returnsList);
      if (remaining <= 0) return;

      const id = saleId(sale);
      const bill = sale.billNumber || id;
      const customer = sale.customerName || sale.customer || "Walk-in Customer";

      const option = document.createElement("option");
      option.value = id;
      option.textContent = bill + " | " + productName(sale) +
        " | ग्राहक: " + customer + " | बाँकी Return: " + remaining;
      select.appendChild(option);
    });

    if (oldValue && Array.from(select.options).some(function (option) {
      return option.value === oldValue;
    })) {
      select.value = oldValue;
    }
  }

  function updateSelectedSale() {
    clearError();

    const id = $("returnSale") ? $("returnSale").value : "";
    selectedSale = null;

    if (!id) {
      [
        "returnBillNumber", "returnCustomer", "returnProduct",
        "soldQty", "alreadyReturnedQty", "remainingReturnQty"
      ].forEach(function (fieldId) {
        if ($(fieldId)) $(fieldId).value = "";
      });
      updatePreview();
      return;
    }

    const sale = getSales().find(function (item) {
      return saleId(item) === id;
    });

    if (!sale) {
      showError("छानिएको बिक्री भेटिएन। कृपया फेरि बिल छान्नुहोस्।");
      return;
    }

    selectedSale = sale;

    const returnsList = getReturns();
    const sold = soldQty(sale);
    const returned = returnedQty(sale, returnsList);
    const remaining = Math.max(0, sold - returned);

    $("returnBillNumber").value = sale.billNumber || saleId(sale);
    $("returnCustomer").value = sale.customerName || sale.customer || "Walk-in Customer";
    $("returnProduct").value = productName(sale);
    $("soldQty").value = sold;
    $("alreadyReturnedQty").value = returned;
    $("remainingReturnQty").textContent = remaining;

    const qtyInput = $("returnQty");
    if (qtyInput) {
      qtyInput.max = String(remaining);
      qtyInput.value = "";
    }

    updatePreview();
  }

  function updatePreview() {
    const qty = number($("returnQty") && $("returnQty").value);
    const rate = selectedSale ? saleRate(selectedSale) : 0;
    const amount = Math.max(0, qty) * rate;
    const preview = $("returnAmountPreview");
    if (preview) preview.textContent = "Rs. " + money(amount);
  }

  function renderSummary() {
    const returnsList = getReturns();
    const totalAmount = returnsList.reduce(function (sum, item) {
      return sum + number(item.amount);
    }, 0);

    const goodCount = returnsList.filter(function (item) {
      return String(item.condition || "").toUpperCase() === "GOOD";
    }).length;

    const damagedCount = returnsList.filter(function (item) {
      return String(item.condition || "").toUpperCase() === "DAMAGED";
    }).length;

    if ($("totalReturns")) $("totalReturns").textContent = returnsList.length;
    if ($("totalReturnAmount")) $("totalReturnAmount").textContent = "Rs. " + money(totalAmount);
    if ($("goodReturnCount")) $("goodReturnCount").textContent = goodCount;
    if ($("damagedReturnCount")) $("damagedReturnCount").textContent = damagedCount;
  }

  function renderHistory() {
    const tbody = $("returnHistoryBody");
    if (!tbody) return;

    const query = String($("returnSearch") ? $("returnSearch").value : "")
      .trim().toLowerCase();

    const filtered = getReturns().slice().reverse().filter(function (item) {
      return [
        item.id, item.billNumber, item.customerName,
        item.productName, item.condition, item.reason, item.date
      ].join(" ").toLowerCase().includes(query);
    });

    if (!filtered.length) {
      tbody.innerHTML =
        '<tr><td colspan="9" class="return-empty">Return रेकर्ड भेटिएन।</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(function (item) {
      const condition = String(item.condition || "").toUpperCase();
      const badgeClass = condition === "GOOD" ? "good" :
        condition === "DAMAGED" ? "damaged" : "";

      return "<tr>" +
        "<td>" + escapeHTML(item.date || "") + "</td>" +
        "<td>" + escapeHTML(item.id || "") + "</td>" +
        "<td>" + escapeHTML(item.billNumber || item.saleId || "") + "</td>" +
        "<td>" + escapeHTML(item.customerName || "") + "</td>" +
        "<td>" + escapeHTML(item.productName || "") + "</td>" +
        "<td>" + escapeHTML(item.qty ?? item.quantity ?? 0) + "</td>" +
        '<td><span class="return-badge ' + badgeClass + '">' + escapeHTML(condition) + "</span></td>" +
        "<td>Rs. " + money(item.amount) + "</td>" +
        "<td>" + escapeHTML(item.reason || "") + "</td>" +
        "</tr>";
    }).join("");
  }

  function getSaleUnitCost(sale) {
    const qty = soldQty(sale);
    if (qty <= 0) return 0;

    const allocations = Array.isArray(sale.fifoAllocations)
      ? sale.fifoAllocations : [];

    if (allocations.length) {
      const totalCost = allocations.reduce(function (sum, allocation) {
        if (allocation.cost !== undefined && allocation.cost !== null) {
          return sum + number(allocation.cost);
        }
        return sum + number(allocation.qty) * number(allocation.unitCost);
      }, 0);
      return Math.max(0, totalCost / qty);
    }

    if (sale.fifoCost !== undefined && sale.fifoCost !== null) {
      return Math.max(0, number(sale.fifoCost) / qty);
    }

    return 0;
  }

  function restoreKey(key, value) {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  }

  function saveReturn(event) {
    event.preventDefault();
    clearError();

    let snapshots = null;

    try {
      const selectedId = $("returnSale").value;
      if (!selectedId) {
        showError("कृपया बिक्रीको बिल छान्नुहोस्।");
        return;
      }

      const currentSale = getSales().find(function (sale) {
        return saleId(sale) === selectedId;
      });

      if (!currentSale) {
        showError("बिक्री रेकर्ड भेटिएन।");
        return;
      }

      const returnsList = getReturns();
      const qty = number($("returnQty").value);
      const available = remainingQty(currentSale, returnsList);
      const condition = String($("returnCondition").value).toUpperCase();
      const reason = String($("returnReason").value).trim();

      if (!Number.isFinite(qty) || qty <= 0) {
        showError("Return मात्रा शून्यभन्दा बढी राख्नुहोस्।");
        return;
      }

      if (qty > available) {
        showError("Return मात्रा बाँकी मात्राभन्दा बढी भयो। बाँकी मात्रा: " + available);
        return;
      }

      if (condition !== "GOOD" && condition !== "DAMAGED") {
        showError("सामानको अवस्था GOOD वा DAMAGED छान्नुहोस्।");
        return;
      }

      if (!reason) {
        showError("Return को कारण छान्नुहोस्।");
        return;
      }

      const products = getProducts();
      const lots = getLots();

      const productIndex = products.findIndex(function (product) {
        return String(product.id) === String(currentSale.productId);
      });

      if (productIndex < 0) {
        showError("यो बिक्रीसँग सम्बन्धित सामान Inventory मा भेटिएन। डेटा परिवर्तन गरिएको छैन।");
        return;
      }

      const product = products[productIndex];
      const rate = saleRate(currentSale);
      const id = "RET-" + Date.now() + "-" +
        Math.random().toString(36).slice(2, 7).toUpperCase();

      const record = {
        id: id,
        date: today(),
        saleId: saleId(currentSale),
        billNumber: currentSale.billNumber || saleId(currentSale),
        customerName: currentSale.customerName || currentSale.customer || "Walk-in Customer",
        productId: currentSale.productId,
        productName: productName(currentSale),
        unit: currentSale.unit || product.unit || "",
        qty: qty,
        rate: rate,
        amount: qty * rate,
        condition: condition,
        reason: reason,
        note: String($("returnNote").value || "").trim(),
        createdAt: new Date().toISOString()
      };

      snapshots = {
        products: localStorage.getItem(PRODUCT_KEY),
        returns: localStorage.getItem(RETURN_KEY),
        lots: localStorage.getItem(LOT_KEY)
      };

      if (condition === "GOOD") {
        product.stock = number(product.stock) + qty;
        products[productIndex] = product;

        lots.push({
          id: "LOT-" + id,
          purchaseId: id,
          purchaseItemIndex: 0,
          date: today(),
          productId: currentSale.productId,
          productName: productName(currentSale),
          supplierName: "Sales Return",
          billNumber: record.billNumber,
          receivedQty: qty,
          remainingQty: qty,
          effectiveCost: getSaleUnitCost(currentSale),
          source: "SALES_RETURN",
          returnId: id,
          saleId: saleId(currentSale),
          createdAt: new Date().toISOString()
        });

        writeArray(PRODUCT_KEY, products);
        writeArray(LOT_KEY, lots);
      }

      returnsList.push(record);
      writeArray(RETURN_KEY, returnsList);

      alert(
        "Return सफलतापूर्वक सुरक्षित भयो।\n" +
        "Return नं.: " + id + "\n" +
        "मात्रा: " + qty + "\n" +
        "रकम: Rs. " + money(record.amount) + "\n" +
        (condition === "GOOD"
          ? "GOOD सामान स्टक र FIFO Lot मा थपियो।"
          : "DAMAGED सामान स्टकमा थपिएको छैन।")
      );

      resetForm();
      hidePanel();
      refreshPage();
    } catch (error) {
      if (snapshots) {
        try {
          restoreKey(PRODUCT_KEY, snapshots.products);
          restoreKey(RETURN_KEY, snapshots.returns);
          restoreKey(LOT_KEY, snapshots.lots);
        } catch (restoreError) {
          console.error("Return rollback error:", restoreError);
        }
      }

      console.error("Sales Return error:", error);
      showError(
        "Return सुरक्षित गर्न सकिएन। विवरण: " + error.message
      );
    }
  }

  function refreshPage() {
    fillSaleOptions();
    renderSummary();
    renderHistory();
    if ($("returnSale") && $("returnSale").value) {
      updateSelectedSale();
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;

    const requiredIds = [
      "clearReturnBtn", "cancelReturnBtn", "closeReturnModal",
      "returnModal", "returnForm", "returnDetailsCard",
      "returnSale", "returnQty", "returnHistoryBody", "returnSearch"
    ];

    const missing = requiredIds.filter(function (id) {
      return !$(id);
    });

    if (missing.length) {
      console.error("Sales Return HTML मा आवश्यक ID भेटिएन:", missing);
      alert("Sales Return पेजका आवश्यक तत्व भेटिएनन्: " + missing.join(", "));
      return;
    }

    $("clearReturnBtn").addEventListener("click", function () {
      resetForm();
      fillSaleOptions();
      showPanel();
    });

    $("cancelReturnBtn").addEventListener("click", function () {
      resetForm();
      hidePanel();
    });

    $("closeReturnModal").addEventListener("click", function () {
      resetForm();
      hidePanel();
    });

    $("returnModal").addEventListener("click", function (event) {
      if (event.target === $("returnModal")) {
        resetForm();
        hidePanel();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && $("returnModal").classList.contains("show")) {
        resetForm();
        hidePanel();
      }
    });

    $("returnSale").addEventListener("change", updateSelectedSale);
    $("returnQty").addEventListener("input", updatePreview);
    $("returnSearch").addEventListener("input", renderHistory);
    $("returnForm").addEventListener("submit", saveReturn);

    hidePanel();

    try {
      refreshPage();
    } catch (error) {
      console.error("Sales Return load error:", error);
      showError("Return पेजको डेटा लोड भएन। विवरण: " + error.message);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
