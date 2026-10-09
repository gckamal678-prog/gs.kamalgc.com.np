(function () {
  "use strict";

  const PRODUCT_KEY = "gs_products";
  const SALE_KEY = "gs_sales";
  const RETURN_KEY = "gs_sales_returns";
  const LOT_KEY = "gs_stock_lots";

  let selectedSale = null;
  let saving = false;

  const $ = id => document.getElementById(id);
  const num = value => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  function readArray(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return [];
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) throw new Error("Invalid array");
      return data;
    } catch (error) {
      throw new Error(
        key + " को डेटा पढ्न सकिएन। डेटा सुरक्षित राख्न प्रक्रिया रोकियो।"
      );
    }
  }

  function writeArray(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function money(value) {
    return "Rs. " + num(value).toLocaleString("en-IN", {
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
    return String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[ch]);
  }

  function getSales() {
    return readArray(SALE_KEY)
      .filter(sale => sale && !sale.voided && !sale.isVoid)
      .sort((a, b) =>
        String(b.createdAt || b.date || "").localeCompare(
          String(a.createdAt || a.date || "")
        )
      );
  }

  function getReturns() {
    return readArray(RETURN_KEY);
  }

  function getSaleId(sale) {
    return String(sale.id || sale.saleId || "");
  }

  function getSoldQty(sale) {
    return num(sale.qty || sale.quantity || 0);
  }

  function getSaleName(sale) {
    return sale.productName || sale.name || "Unknown Product";
  }

  function getSaleTotal(sale) {
    return num(sale.total || sale.amount ||
      getSoldQty(sale) * num(sale.rate));
  }

  function getReturnedQty(sale, returns) {
    const id = getSaleId(sale);
    return returns
      .filter(item => String(item.saleId || "") === id)
      .reduce((sum, item) => sum + num(item.qty), 0);
  }

  function showError(message) {
    const el = $("returnError");
    if (!el) {
      alert(message);
      return;
    }
    el.textContent = message;
    el.classList.add("show");
  }

  function clearError() {
    const el = $("returnError");
    if (el) {
      el.textContent = "";
      el.classList.remove("show");
    }
  }

  function openReturnForm() {
    $("returnDetailsCard").classList.remove("return-form-hidden");
    clearError();
    $("returnSale").focus();
  }

  function closeReturnForm() {
    resetForm();
    $("returnDetailsCard").classList.add("return-form-hidden");
  }

  function fillSaleOptions() {
    const select = $("returnSale");
    const previousValue = select.value;
    const sales = getSales();
    const returns = getReturns();

    select.innerHTML =
      '<option value="">पहिले बिक्री भएको बिल छान्नुहोस्</option>';

    sales.forEach(sale => {
      const id = getSaleId(sale);
      const sold = getSoldQty(sale);
      const returned = getReturnedQty(sale, returns);
      const remaining = Math.max(0, sold - returned);

      if (!id || !sale.productId || remaining <= 0) return;

      const option = document.createElement("option");
      option.value = id;
      option.textContent =
        (sale.billNumber || id) + " | " +
        getSaleName(sale) + " | बिक्री: " + sold +
        " | बाँकी Return: " + remaining +
        " | " + money(getSaleTotal(sale));

      select.appendChild(option);
    });

    if (previousValue &&
        Array.from(select.options).some(o => o.value === previousValue)) {
      select.value = previousValue;
    }
  }

  function resetForm() {
    $("returnForm").reset();
    $("returnSale").value = "";
    selectedSale = null;

    [
      "returnBillNumber",
      "returnCustomer",
      "returnProduct",
      "soldQty",
      "alreadyReturnedQty"
    ].forEach(id => {
      $(id).value = "";
    });

    $("returnQty").removeAttribute("max");
    $("remainingReturnQty").textContent = "—";
    $("returnAmountPreview").textContent = money(0);
    clearError();
  }

  function updateSelectedSale() {
    clearError();

    const id = $("returnSale").value;

    if (!id) {
      selectedSale = null;
      $("returnBillNumber").value = "";
      $("returnCustomer").value = "";
      $("returnProduct").value = "";
      $("soldQty").value = "";
      $("alreadyReturnedQty").value = "";
      $("returnQty").removeAttribute("max");
      $("remainingReturnQty").textContent = "—";
      $("returnAmountPreview").textContent = money(0);
      return;
    }

    const sale = getSales().find(item => getSaleId(item) === id);

    if (!sale) {
      selectedSale = null;
      showError("चयन गरिएको बिक्री रेकर्ड भेटिएन।");
      return;
    }

    selectedSale = sale;

    const returned = getReturnedQty(sale, getReturns());
    const sold = getSoldQty(sale);
    const remaining = Math.max(0, sold - returned);

    $("returnBillNumber").value = sale.billNumber || getSaleId(sale);
    $("returnCustomer").value =
      sale.customerName || sale.customer || "Walk-in Customer";
    $("returnProduct").value = getSaleName(sale);
    $("soldQty").value = sold;
    $("alreadyReturnedQty").value = returned;
    $("remainingReturnQty").textContent = remaining;
    $("returnQty").max = String(remaining);

    updatePreview();
  }

  function updatePreview() {
    const qty = num($("returnQty").value);
    const rate = selectedSale ? num(selectedSale.rate) : 0;
    $("returnAmountPreview").textContent = money(qty * rate);
  }

  function renderSummary() {
    const returns = getReturns();

    $("totalReturns").textContent = returns.length;
    $("totalReturnAmount").textContent = money(
      returns.reduce((sum, item) => sum + num(item.amount), 0)
    );
    $("goodReturnCount").textContent = returns.filter(
      item => String(item.condition).toUpperCase() === "GOOD"
    ).length;
    $("damagedReturnCount").textContent = returns.filter(
      item => String(item.condition).toUpperCase() === "DAMAGED"
    ).length;
  }

  function renderHistory() {
    const body = $("returnHistoryBody");
    const query = $("returnSearch").value.trim().toLowerCase();

    const returns = getReturns().slice().sort((a, b) =>
      String(b.createdAt || b.date || "").localeCompare(
        String(a.createdAt || a.date || "")
      )
    );

    const filtered = returns.filter(item => {
      const text = [
        item.id, item.billNumber, item.customerName,
        item.productName, item.reason, item.condition
      ].join(" ").toLowerCase();

      return text.includes(query);
    });

    if (!filtered.length) {
      body.innerHTML =
        '<tr><td colspan="9" class="return-empty">अहिलेसम्म Return रेकर्ड छैन।</td></tr>';
      return;
    }

    body.innerHTML = filtered.map(item => {
      const condition = String(item.condition || "").toUpperCase();
      const badgeClass = condition === "GOOD" ? "good" : "damaged";

      return `
        <tr>
          <td>${escapeHTML(item.date || "")}</td>
          <td>${escapeHTML(item.id || "")}</td>
          <td>${escapeHTML(item.billNumber || "")}</td>
          <td>${escapeHTML(item.customerName || "Walk-in Customer")}</td>
          <td>${escapeHTML(item.productName || "")}</td>
          <td>${escapeHTML(item.qty || 0)} ${escapeHTML(item.unit || "")}</td>
          <td><span class="return-badge ${badgeClass}">${escapeHTML(condition || "UNKNOWN")}</span></td>
          <td>${money(item.amount)}</td>
          <td>${escapeHTML(item.reason || "")}</td>
        </tr>
      `;
    }).join("");
  }

  function refreshPage() {
    fillSaleOptions();
    renderSummary();
    renderHistory();
    updateSelectedSale();
  }

  /*
   * Sale मा सुरक्षित भएको FIFO लागतको आधारमा
   * Good Return का लागि नयाँ FIFO lot बनाइन्छ।
   * यसले पुराना lot हरूको इतिहास नबिगारी बिक्रीयोग्य
   * stock र lot quantity दुवैलाई समान मात्राले बढाउँछ।
   */
  function getReturnUnitCost(sale) {
    const soldQty = getSoldQty(sale);
    const allocations = Array.isArray(sale.fifoAllocations)
      ? sale.fifoAllocations
      : [];

    const allocationCost = allocations.reduce((sum, item) => {
      if (item.cost != null) return sum + num(item.cost);
      return sum + num(item.qty) * num(item.unitCost);
    }, 0);

    if (allocations.length && soldQty > 0) {
      return allocationCost / soldQty;
    }

    if (soldQty > 0 && sale.fifoCost != null) {
      return num(sale.fifoCost) / soldQty;
    }

    /*
     * पुराना sale record मा FIFO लागत नभए rate प्रयोग नगरी
     * लागत 0 राखिन्छ; बिक्री मूल्यलाई लागत मानेर नाफा
     * हिसाब बिगारिँदैन।
     */
    return 0;
  }

  function saveReturn(event) {
    event.preventDefault();
    if (saving) return;

    clearError();

    let oldProductsRaw = null;
    let oldReturnsRaw = null;
    let oldLotsRaw = null;
    let snapshotsTaken = false;

    try {
      if (!selectedSale) {
        showError("पहिले बिक्री बिल छान्नुहोस्।");
        return;
      }

      const qty = num($("returnQty").value);
      const reason = $("returnReason").value;
      const condition = $("returnCondition").value;

      if (!Number.isFinite(qty) || qty <= 0) {
        showError("फिर्ता मात्रा शून्यभन्दा बढी हुनुपर्छ।");
        return;
      }

      if (!reason) {
        showError("फिर्ताको कारण छान्नुहोस्।");
        return;
      }

      if (condition !== "GOOD" && condition !== "DAMAGED") {
        showError("सामानको अवस्था छान्नुहोस्।");
        return;
      }

      const currentSaleId = getSaleId(selectedSale);
      const currentSales = getSales();
      const currentSale = currentSales.find(
        item => getSaleId(item) === currentSaleId
      );

      if (!currentSale) {
        showError("यो बिक्री रेकर्ड उपलब्ध छैन।");
        return;
      }

      const products = readArray(PRODUCT_KEY);
      const returns = getReturns();
      const soldQty = getSoldQty(currentSale);
      const alreadyReturned = getReturnedQty(currentSale, returns);
      const remaining = soldQty - alreadyReturned;

      if (qty > remaining + 0.000001) {
        showError(
          "फिर्ता मात्रा बाँकी मात्राभन्दा बढी हुन मिल्दैन। बाँकी मात्रा: " +
          Math.max(0, remaining)
        );
        return;
      }

      if (qty > soldQty || soldQty <= 0) {
        showError("बिक्री भएको मात्रा सही छैन। कुनै डेटा परिवर्तन गरिएको छैन।");
        return;
      }

      const productId = currentSale.productId;
      const productIndex = products.findIndex(
        product => String(product.id) === String(productId)
      );

      if (productIndex < 0) {
        showError(
          "सम्बन्धित सामान Inventory मा भेटिएन। कुनै डेटा परिवर्तन गरिएको छैन।"
        );
        return;
      }

      const product = products[productIndex];
      const rate = num(currentSale.rate);
      const now = new Date().toISOString();

      const returnRecord = {
        id: "RET-" + Date.now() + "-" +
          Math.random().toString(36).slice(2, 7),
        date: today(),
        saleId: currentSaleId,
        billNumber: currentSale.billNumber || currentSaleId,
        customerName:
          currentSale.customerName || currentSale.customer || "Walk-in Customer",
        productId: currentSale.productId,
        productName: getSaleName(currentSale),
        unit: currentSale.unit || product.unit || "",
        qty: qty,
        rate: rate,
        amount: qty * rate,
        condition: condition,
        reason: reason,
        note: $("returnNote").value.trim(),
        createdAt: now
      };

      const oldProducts = localStorage.getItem(PRODUCT_KEY);
      const oldReturns = localStorage.getItem(RETURN_KEY);
      const oldLots = localStorage.getItem(LOT_KEY);

      oldProductsRaw = oldProducts;
      oldReturnsRaw = oldReturns;
      oldLotsRaw = oldLots;
      snapshotsTaken = true;

      const lots = readArray(LOT_KEY);

      if (condition === "GOOD") {
        const oldStock = num(product.stock);
        product.stock = oldStock + qty;

        const unitCost = getReturnUnitCost(currentSale);
        lots.push({
          id: "LOT-RET-" + returnRecord.id,
          purchaseId: returnRecord.id,
          purchaseItemIndex: 0,
          date: today(),
          productId: product.id,
          productName: product.name || getSaleName(currentSale),
          supplierName: "Sales Return",
          billNumber: returnRecord.billNumber,
          receivedQty: qty,
          remainingQty: qty,
          effectiveCost: unitCost,
          source: "SALES_RETURN",
          returnId: returnRecord.id,
          saleId: currentSaleId,
          createdAt: now
        });
      }

      saving = true;
      $("saveReturnBtn").disabled = true;

      /*
       * सबै सम्बन्धित डेटा सुरक्षित भएपछि मात्र सफलता देखाइन्छ।
       * कुनै write असफल भएमा पहिलाको raw data फर्काइन्छ।
       */
      try {
        if (condition === "GOOD") {
          writeArray(PRODUCT_KEY, products);
          writeArray(LOT_KEY, lots);
        }

        writeArray(RETURN_KEY, returns.concat(returnRecord));
      } catch (storageError) {
        throw new Error("RETURN_TRANSACTION_FAILED");
      }

      alert(
        "Sales Return सुरक्षित भयो।" +
        (condition === "GOOD"
          ? "\nProduct Stock र FIFO Lot मा " + qty + " थपियो।"
          : "\nDAMAGED सामान भएकाले बिक्रीयोग्य स्टक बढाइएको छैन।")
      );

      resetForm();
      refreshPage();
      closeReturnForm();

    } catch (error) {
      if (snapshotsTaken) {
        try {
          if (oldProductsRaw === null) localStorage.removeItem(PRODUCT_KEY);
          else localStorage.setItem(PRODUCT_KEY, oldProductsRaw);

          if (oldReturnsRaw === null) localStorage.removeItem(RETURN_KEY);
          else localStorage.setItem(RETURN_KEY, oldReturnsRaw);

          if (oldLotsRaw === null) localStorage.removeItem(LOT_KEY);
          else localStorage.setItem(LOT_KEY, oldLotsRaw);
        } catch (rollbackError) {
          showError(
            "सेभ गर्दा त्रुटि भयो र पुरानो डेटा स्वतः फर्काउन पनि समस्या भयो। " +
            "थप परिवर्तन नगर्नुहोस्; डेटा जाँच आवश्यक छ।"
          );
          return;
        }
      }

      console.error("Sales Return error:", error);

      showError(
        error.message === "RETURN_TRANSACTION_FAILED"
          ? "Return सुरक्षित गर्न सकिएन। पुरानो डेटा पुनःस्थापना गरिएको छ। ब्राउजर Storage जाँच्नुहोस्।"
          : (error.message || "Return सुरक्षित गर्दा समस्या भयो।")
      );

    } finally {
      saving = false;
      $("saveReturnBtn").disabled = false;
    }
  }

  function init() {
    const requiredIds = [
      "returnDetailsCard", "returnForm", "returnSale", "returnQty",
      "returnCondition", "returnReason", "returnHistoryBody",
      "returnSearch", "saveReturnBtn", "clearReturnBtn",
      "cancelReturnBtn", "returnError"
    ];

    const missing = requiredIds.filter(id => !$(id));

    if (missing.length) {
      alert(
        "Sales Return पेजका आवश्यक तत्व भेटिएनन्: " +
        missing.join(", ") +
        "\n sales-return.html को पूरा कोड राखिएको छ कि जाँच्नुहोस्।"
      );
      return;
    }

    $("clearReturnBtn").addEventListener("click", openReturnForm);
    $("cancelReturnBtn").addEventListener("click", closeReturnForm);
    $("returnSale").addEventListener("change", updateSelectedSale);
    $("returnQty").addEventListener("input", updatePreview);
    $("returnSearch").addEventListener("input", renderHistory);
    $("returnForm").addEventListener("submit", saveReturn);

    $("returnDetailsCard").classList.add("return-form-hidden");

    try {
      refreshPage();
    } catch (error) {
      showError(error.message || "डेटा लोड गर्न सकिएन।");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
