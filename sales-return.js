
"use strict";

(function () {
  const PRODUCT_KEY = "gs_products";
  const SALE_KEY = "gs_sales";
  const RETURN_KEY = "gs_sales_returns";
  const LOT_KEY = "gs_stock_lots";
  const SETTINGS_KEY = "gs_settings";

  let selectedSale = null;
  let initialized = false;
  let saving = false;

  const $ = (id) => document.getElementById(id);

  // -----------------------------
  // LocalStorage utilities
  // -----------------------------

  function readArray(key) {
    const raw = localStorage.getItem(key);

    if (raw === null || raw === "") return [];

    let data;

    try {
      data = JSON.parse(raw);
    } catch (error) {
      throw new Error(key + " को डेटा पढ्न सकिएन। JSON डेटा जाँच गर्नुहोस्।");
    }

    if (!Array.isArray(data)) {
      throw new Error(key + " मा सूची (array) हुनुपर्ने डेटा भेटिएन।");
    }

    return data;
  }

  function readObject(key) {
    const raw = localStorage.getItem(key);

    if (!raw) return {};

    try {
      const data = JSON.parse(raw);
      return data && typeof data === "object" && !Array.isArray(data)
        ? data
        : {};
    } catch (error) {
      return {};
    }
  }

  function writeArray(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function number(value) {
    if (value === null || value === undefined || value === "") return 0;

    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
  }

  function money(value) {
    return number(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function currencySymbol() {
    const settings = readObject(SETTINGS_KEY);
    return settings.currencySymbol || settings.currency || "Rs.";
  }

  function moneyText(value) {
    return currencySymbol() + " " + money(value);
  }

  function today() {
    const date = new Date();

    return (
      date.getFullYear() + "-" +
      String(date.getMonth() + 1).padStart(2, "0") + "-" +
      String(date.getDate()).padStart(2, "0")
    );
  }

  function createId(prefix) {
    return prefix + "-" + Date.now() + "-" +
      Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(
      /[&<>"']/g,
      function (character) {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        }[character];
      }
    );
  }

  function sameId(a, b) {
    return a !== undefined &&
      a !== null &&
      b !== undefined &&
      b !== null &&
      String(a) === String(b);
  }

  // -----------------------------
  // Data access
  // -----------------------------

  function getSales() {
    return readArray(SALE_KEY).filter(function (sale) {
      return sale &&
        !sale.voided &&
        !sale.isVoid &&
        !sale.cancelled &&
        (sale.id !== undefined || sale.saleId !== undefined);
    });
  }

  function getProducts() {
    return readArray(PRODUCT_KEY);
  }

  function getReturns() {
    return readArray(RETURN_KEY);
  }

  function getLots() {
    return readArray(LOT_KEY);
  }

  function saleId(sale) {
    return String(sale.id ?? sale.saleId ?? "");
  }

  function productIdFromSale(sale) {
    return sale.productId ??
      sale.itemId ??
      (sale.product && sale.product.id) ??
      null;
  }

  function saleQty(sale) {
    return Math.max(0, number(
      sale.qty ??
      sale.quantity ??
      sale.soldQty
    ));
  }

  function productName(sale) {
    return String(
      sale.productName ??
      sale.itemName ??
      sale.name ??
      (sale.product && sale.product.name) ??
      "Unknown Product"
    );
  }

  function customerName(sale) {
    return String(
      sale.customerName ??
      sale.customer ??
      sale.customer_name ??
      "Walk-in Customer"
    );
  }

  function billNumber(sale) {
    return String(
      sale.billNumber ??
      sale.invoiceNumber ??
      sale.invoiceNo ??
      sale.billNo ??
      saleId(sale)
    );
  }

  function saleDate(sale) {
    return sale.date ??
      sale.createdAt ??
      sale.saleDate ??
      "";
  }

  function saleRate(sale) {
    const qty = saleQty(sale);

    const directRate =
      sale.rate ??
      sale.unitPrice ??
      sale.sellingPrice ??
      sale.price;

    if (directRate !== undefined && directRate !== null && directRate !== "") {
      return Math.max(0, number(directRate));
    }

    const total = sale.totalAmount ?? sale.total ?? sale.amount;

    if (qty > 0 && total !== undefined && total !== null) {
      return Math.max(0, number(total) / qty);
    }

    return 0;
  }

  function saleUnitCost(sale) {
    const qty = saleQty(sale);

    if (qty <= 0) return 0;

    const allocations = Array.isArray(sale.fifoAllocations)
      ? sale.fifoAllocations
      : [];

    if (allocations.length > 0) {
      let totalCost = 0;

      allocations.forEach(function (allocation) {
        const allocatedQty = number(allocation.qty);

        if (allocation.cost !== undefined && allocation.cost !== null) {
          totalCost += number(allocation.cost);
        } else {
          totalCost += allocatedQty * number(
            allocation.unitCost ??
            allocation.costPrice ??
            allocation.effectiveCost
          );
        }
      });

      return Math.max(0, totalCost / qty);
    }

    if (sale.fifoCost !== undefined && sale.fifoCost !== null) {
      return Math.max(0, number(sale.fifoCost) / qty);
    }

    const cost = sale.unitCost ??
      sale.costPrice ??
      sale.purchasePrice;

    if (cost !== undefined && cost !== null) {
      return Math.max(0, number(cost));
    }

    return 0;
  }

  // -----------------------------
  // Return quantity calculations
  // -----------------------------

  function returnedQty(sale, returnsList) {
    const id = saleId(sale);

    return returnsList.reduce(function (total, item) {
      if (String(item.saleId ?? "") !== id) return total;

      return total + Math.max(
        0,
        number(item.qty ?? item.quantity)
      );
    }, 0);
  }

  function remainingQty(sale, returnsList) {
    return Math.max(
      0,
      saleQty(sale) - returnedQty(sale, returnsList)
    );
  }

  // -----------------------------
  // Error messages
  // -----------------------------

  function showError(message) {
    const box = $("returnError");

    if (box) {
      box.textContent = message;
      box.classList.add("show");
      box.style.display = "block";
    } else {
      alert(message);
    }
  }

  function clearError() {
    const box = $("returnError");

    if (box) {
      box.textContent = "";
      box.classList.remove("show");
      box.style.display = "none";
    }
  }

  // -----------------------------
  // Modal
  // -----------------------------

  function showPanel() {
    const modal = $("returnModal");

    if (!modal) {
      alert("Return Popup भेटिएन। sales-return.html जाँच गर्नुहोस्।");
      return;
    }

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    window.setTimeout(function () {
      if ($("returnSale")) $("returnSale").focus();
    }, 50);
  }

  function hidePanel() {
    const modal = $("returnModal");

    if (modal) {
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");
    }

    document.body.style.removeProperty("overflow");
  }

  // -----------------------------
  // Form handling
  // -----------------------------

  function resetForm() {
    const form = $("returnForm");

    if (form) form.reset();

    selectedSale = null;

    [
      "returnBillNumber",
      "returnCustomer",
      "returnProduct",
      "soldQty",
      "alreadyReturnedQty"
    ].forEach(function (id) {
      const field = $(id);
      if (field) field.value = "";
    });

    const remaining = $("remainingReturnQty");
    if (remaining) remaining.textContent = "";

    const amountPreview = $("returnAmountPreview");
    if (amountPreview) amountPreview.textContent = moneyText(0);

    const conditionPreview = $("returnConditionPreview");
    if (conditionPreview) conditionPreview.textContent = "GOOD";

    const qtyInput = $("returnQty");

    if (qtyInput) {
      qtyInput.value = "";
      qtyInput.removeAttribute("max");
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
      if (saleQty(sale) <= 0) return;

      const remaining = remainingQty(sale, returnsList);
      if (remaining <= 0) return;

      const option = document.createElement("option");

      option.value = saleId(sale);
      option.textContent =
        billNumber(sale) +
        " | " + productName(sale) +
        " | ग्राहक: " + customerName(sale) +
        " | बाँकी Return: " + remaining;

      select.appendChild(option);
    });

    const oldOptionExists = Array.from(select.options).some(function (option) {
      return option.value === oldValue;
    });

    if (oldValue && oldOptionExists) {
      select.value = oldValue;
    }
  }

  function updateSelectedSale() {
    clearError();

    const select = $("returnSale");
    const id = select ? select.value : "";

    selectedSale = null;

    const fields = [
      "returnBillNumber",
      "returnCustomer",
      "returnProduct",
      "soldQty",
      "alreadyReturnedQty"
    ];

    if (!id) {
      fields.forEach(function (fieldId) {
        if ($(fieldId)) $(fieldId).value = "";
      });

      if ($("remainingReturnQty")) {
        $("remainingReturnQty").textContent = "";
      }

      if ($("returnQty")) {
        $("returnQty").value = "";
        $("returnQty").removeAttribute("max");
      }

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
    const sold = saleQty(sale);
    const returned = returnedQty(sale, returnsList);
    const remaining = Math.max(0, sold - returned);

    if ($("returnBillNumber")) {
      $("returnBillNumber").value = billNumber(sale);
    }

    if ($("returnCustomer")) {
      $("returnCustomer").value = customerName(sale);
    }

    if ($("returnProduct")) {
      $("returnProduct").value = productName(sale);
    }

    if ($("soldQty")) $("soldQty").value = sold;

    if ($("alreadyReturnedQty")) {
      $("alreadyReturnedQty").value = returned;
    }

    if ($("remainingReturnQty")) {
      $("remainingReturnQty").textContent = remaining;
    }

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

    if (preview) {
      preview.textContent = moneyText(amount);
    }

    const condition = $("returnCondition");
    const conditionPreview = $("returnConditionPreview");

    if (condition && conditionPreview) {
      conditionPreview.textContent = condition.value;
    }
  }

  // -----------------------------
  // Summary cards
  // -----------------------------

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

    if ($("totalReturns")) {
      $("totalReturns").textContent = returnsList.length;
    }

    if ($("totalReturnAmount")) {
      $("totalReturnAmount").textContent = moneyText(totalAmount);
    }

    if ($("goodReturnCount")) {
      $("goodReturnCount").textContent = goodCount;
    }

    if ($("damagedReturnCount")) {
      $("damagedReturnCount").textContent = damagedCount;
    }
  }

  // -----------------------------
  // Return history
  // -----------------------------

  function renderHistory() {
    const tbody = $("returnHistoryBody");
    if (!tbody) return;

    const query = String(
      $("returnSearch") ? $("returnSearch").value : ""
    ).trim().toLowerCase();

    const filtered = getReturns().slice().reverse().filter(function (item) {
      const searchable = [
        item.id,
        item.billNumber,
        item.customerName,
        item.productName,
        item.condition,
        item.reason,
        item.date
      ].join(" ").toLowerCase();

      return searchable.includes(query);
    });

    if (!filtered.length) {
      tbody.innerHTML =
        '<tr><td colspan="9" class="return-empty">' +
        "Return रेकर्ड भेटिएन।" +
        "</td></tr>";
      return;
    }

    tbody.innerHTML = filtered.map(function (item) {
      const condition = String(item.condition || "").toUpperCase();

      const badgeClass = condition === "GOOD"
        ? "good"
        : condition === "DAMAGED"
          ? "damaged"
          : "";

      return (
        "<tr>" +
          "<td>" + escapeHTML(item.date || "") + "</td>" +
          "<td>" + escapeHTML(item.id || "") + "</td>" +
          "<td>" + escapeHTML(item.billNumber || item.saleId || "") + "</td>" +
          "<td>" + escapeHTML(item.customerName || "") + "</td>" +
          "<td>" + escapeHTML(item.productName || "") + "</td>" +
          "<td>" + escapeHTML(item.qty ?? item.quantity ?? 0) + "</td>" +
          '<td><span class="return-badge ' + badgeClass + '">' +
            escapeHTML(condition) +
          "</span></td>" +
          "<td>" + escapeHTML(moneyText(item.amount)) + "</td>" +
          "<td>" + escapeHTML(item.reason || "") + "</td>" +
        "</tr>"
      );
    }).join("");
  }

  // -----------------------------
  // Product matching
  // -----------------------------

  function findProductIndex(products, sale) {
    const wantedId = productIdFromSale(sale);

    if (wantedId !== null && wantedId !== "") {
      const byId = products.findIndex(function (product) {
        return sameId(product.id, wantedId);
      });

      if (byId >= 0) return byId;
    }

    const wantedBarcode = String(
      sale.barcode ??
      sale.productBarcode ??
      sale.itemBarcode ??
      ""
    ).trim();

    if (wantedBarcode) {
      const matches = [];

      products.forEach(function (product, index) {
        const barcode = String(product.barcode ?? "").trim();

        if (barcode && barcode === wantedBarcode) {
          matches.push(index);
        }
      });

      if (matches.length === 1) return matches[0];

      if (matches.length > 1) {
        throw new Error(
          "एउटै Barcode भएका धेरै सामान भेटिए। Inventory मा Barcode मिलाउनुहोस्।"
        );
      }
    }

    const wantedName = productName(sale).trim().toLowerCase();

    if (wantedName && wantedName !== "unknown product") {
      const matches = [];

      products.forEach(function (product, index) {
        const name = String(product.name ?? product.productName ?? "")
          .trim()
          .toLowerCase();

        if (name && name === wantedName) {
          matches.push(index);
        }
      });

      if (matches.length === 1) return matches[0];

      if (matches.length > 1) {
        throw new Error(
          "एउटै नामका धेरै सामान भेटिए। गलत सामानको स्टक नबढाउन Return रोकियो।"
        );
      }
    }

    return -1;
  }

  // -----------------------------
  // Safe storage rollback
  // -----------------------------

  function snapshotKeys(keys) {
    const snapshot = {};

    keys.forEach(function (key) {
      snapshot[key] = localStorage.getItem(key);
    });

    return snapshot;
  }

  function restoreSnapshot(snapshot) {
    Object.keys(snapshot).forEach(function (key) {
      const value = snapshot[key];

      if (value === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
      }
    });
  }

  // -----------------------------
  // Save sales return
  // -----------------------------

  function saveReturn(event) {
    event.preventDefault();

    if (saving) return;

    clearError();

    let snapshot = null;

    try {
      const selectedId = $("returnSale").value;

      if (!selectedId) {
        showError("कृपया बिक्रीको बिल छान्नुहोस्।");
        return;
      }

      // Save गर्दा हालको डेटा फेरि पढिन्छ।
      const sales = getSales();

      const currentSale = sales.find(function (sale) {
        return saleId(sale) === selectedId;
      });

      if (!currentSale) {
        showError("बिक्री रेकर्ड भेटिएन। डेटा परिवर्तन गरिएको छैन।");
        return;
      }

      const returnsList = getReturns();
      const qty = number($("returnQty").value);
      const available = remainingQty(currentSale, returnsList);

      const condition = String(
        $("returnCondition").value || ""
      ).toUpperCase();

      const reason = String(
        $("returnReason").value || ""
      ).trim();

      if (!Number.isFinite(qty) || qty <= 0) {
        showError("Return मात्रा शून्यभन्दा बढी राख्नुहोस्।");
        return;
      }

      if (qty > available) {
        showError(
          "Return मात्रा बाँकी मात्राभन्दा बढी भयो। बाँकी मात्रा: " +
          available
        );
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

      if (!productIdFromSale(currentSale)) {
        showError(
          "बिक्री रेकर्डमा Product ID छैन। गलत सामानको स्टक परिवर्तन नहोस् भनेर Return रोकियो।"
        );
        return;
      }

      const products = getProducts();
      const lots = getLots();

      const productIndex = findProductIndex(products, currentSale);

      if (productIndex < 0) {
        showError(
          "यो बिक्रीसँग मिल्ने सामान Inventory मा भेटिएन। डेटा परिवर्तन गरिएको छैन।"
        );
        return;
      }

      const product = Object.assign({}, products[productIndex]);

      const rate = saleRate(currentSale);
      const amount = qty * rate;
      const returnId = createId("RET");
      const timestamp = new Date().toISOString();

      const record = {
        id: returnId,
        date: today(),
        saleId: saleId(currentSale),
        billNumber: billNumber(currentSale),
        customerName: customerName(currentSale),
        productId: product.id,
        productName: productName(currentSale),
        barcode: product.barcode || currentSale.barcode || "",
        unit: currentSale.unit || product.unit || "",
        qty: qty,
        rate: rate,
        amount: amount,
        condition: condition,
        reason: reason,
        note: String($("returnNote").value || "").trim(),
        createdAt: timestamp
      };

      // स्टक/Return/Lot मा परिवर्तन गर्नुअघि सबै पुरानो डेटा सुरक्षित राखिन्छ।
      snapshot = snapshotKeys([
        PRODUCT_KEY,
        RETURN_KEY,
        LOT_KEY
      ]);

      saving = true;

      if (condition === "GOOD") {
        const currentStock = number(product.stock);

        // GOOD Return मात्र बिक्रीयोग्य स्टकमा थपिन्छ।
        product.stock = currentStock + qty;
        products[productIndex] = product;

        const costPerUnit = saleUnitCost(currentSale);

        // बिक्रीको लागत उपलब्ध भए त्यही लागत राखिन्छ।
        // लागत उपलब्ध नभए 0 राखिन्छ, अनुमानित लागत होइन।
        lots.push({
          id: "LOT-" + returnId,
          purchaseId: returnId,
          purchaseItemIndex: 0,
          date: today(),
          productId: product.id,
          productName: productName(currentSale),
          supplierName: "Sales Return",
          billNumber: billNumber(currentSale),
          receivedQty: qty,
          remainingQty: qty,
          effectiveCost: costPerUnit,
          source: "SALES_RETURN",
          returnId: returnId,
          saleId: saleId(currentSale),
          createdAt: timestamp
        });

        writeArray(PRODUCT_KEY, products);
        writeArray(LOT_KEY, lots);
      }

      // DAMAGED Return भए पनि Return History मा सुरक्षित हुन्छ,
      // तर बिक्रीयोग्य स्टक वा FIFO Lot मा थपिँदैन।
      returnsList.push(record);
      writeArray(RETURN_KEY, returnsList);

      resetForm();
      hidePanel();
      refreshPage();

      alert(
        "Sales Return सफलतापूर्वक सुरक्षित भयो।\n\n" +
        "Return नं.: " + returnId + "\n" +
        "बिल नं.: " + billNumber(currentSale) + "\n" +
        "सामान: " + productName(currentSale) + "\n" +
        "मात्रा: " + qty + "\n" +
        "Return रकम: " + moneyText(amount) + "\n\n" +
        (
          condition === "GOOD"
            ? "GOOD सामान स्टक र FIFO Lot मा थपियो।"
            : "DAMAGED सामान बिक्रीयोग्य स्टकमा थपिएको छैन।"
        )
      );
    } catch (error) {
      if (snapshot) {
        try {
          restoreSnapshot(snapshot);
        } catch (restoreError) {
          console.error("Return rollback error:", restoreError);

          showError(
            "Return सुरक्षित गर्दा त्रुटि आयो र पुरानो डेटा पुनःस्थापना गर्न पनि समस्या भयो। " +
            "थप परिवर्तन नगर्नुहोस्; LocalStorage डेटा जाँच गर्नुहोस्।"
          );

          return;
        }
      }

      console.error("Sales Return save error:", error);

      showError(
        "Return सुरक्षित गर्न सकिएन।\n" +
        "कारण: " + (error.message || "अज्ञात त्रुटि")
      );
    } finally {
      saving = false;
    }
  }

  // -----------------------------
  // Refresh page
  // -----------------------------

  function refreshPage() {
    fillSaleOptions();
    renderSummary();
    renderHistory();

    if ($("returnSale") && $("returnSale").value) {
      updateSelectedSale();
    }
  }

  // -----------------------------
  // Initialize
  // -----------------------------

  function init() {
    if (initialized) return;
    initialized = true;

    const requiredIds = [
      "clearReturnBtn",
      "cancelReturnBtn",
      "closeReturnModal",
      "returnModal",
      "returnForm",
      "returnSale",
      "returnQty",
      "returnCondition",
      "returnReason",
      "returnHistoryBody",
      "returnSearch"
    ];

    const missing = requiredIds.filter(function (id) {
      return !$(id);
    });

    if (missing.length) {
      console.error("Sales Return HTML मा आवश्यक ID भेटिएन:", missing);

      alert(
        "Sales Return पेजका आवश्यक तत्व भेटिएनन्:\n" +
        missing.join(", ") +
        "\n\nsales-return.html को ID जाँच गर्नुहोस्।"
      );

      return;
    }

    $("clearReturnBtn").addEventListener("click", function () {
      resetForm();

      try {
        fillSaleOptions();
        showPanel();
      } catch (error) {
        showError("बिक्रीको सूची लोड भएन: " + error.message);
      }
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
      if (
        event.key === "Escape" &&
        $("returnModal").classList.contains("show")
      ) {
        resetForm();
        hidePanel();
      }
    });

    $("returnSale").addEventListener("change", updateSelectedSale);
    $("returnQty").addEventListener("input", updatePreview);
    $("returnCondition").addEventListener("change", updatePreview);
    $("returnSearch").addEventListener("input", renderHistory);
    $("returnForm").addEventListener("submit", saveReturn);

    hidePanel();

    try {
      refreshPage();
    } catch (error) {
      console.error("Sales Return load error:", error);

      showError(
        "Return पेजको डेटा लोड भएन। विवरण: " + error.message
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
