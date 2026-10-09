
(function () {
  "use strict";

  const PRODUCT_KEY = "gs_products";
  const SALE_KEY = "gs_sales";
  const RETURN_KEY = "gs_sales_returns";

  let selectedSale = null;
  let saving = false;

  const $ = (id) => document.getElementById(id);

  function readArray(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return [];
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) throw new Error(key + " को डेटा सूची होइन।");
      return data;
    } catch (error) {
      throw new Error(key + " को डेटा पढ्न सकिएन। डेटा नबदलिएको अवस्थामा राखिएको छ।");
    }
  }

  function writeArray(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function money(value) {
    return "Rs. " + Number(value || 0).toLocaleString("en-IN", {
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
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[ch];
    });
  }

  function getSales() {
    return readArray(SALE_KEY)
      .filter(sale => sale && !sale.voided)
      .sort((a, b) => String(b.createdAt || b.date || "").localeCompare(
        String(a.createdAt || a.date || "")
      ));
  }

  function getReturns() {
    return readArray(RETURN_KEY);
  }

  function getProducts() {
    return readArray(PRODUCT_KEY);
  }

  function getSaleId(sale) {
    return String(sale.id || sale.saleId || "");
  }

  function getSoldQty(sale) {
    return Number(sale.qty || sale.quantity || 0);
  }

  function getReturnedQty(sale, returns) {
    const id = getSaleId(sale);
    return returns
      .filter(item => String(item.saleId || "") === id)
      .reduce((sum, item) => sum + Number(item.qty || 0), 0);
  }

  function getSaleName(sale) {
    return sale.productName || sale.name || "Unknown Product";
  }

  function getSaleTotal(sale) {
    return Number(sale.total || sale.amount || (getSoldQty(sale) * Number(sale.rate || 0)));
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

  function fillSaleOptions() {
    const select = $("returnSale");
    const previousValue = select.value;
    const sales = getSales();
    const returns = getReturns();

    select.innerHTML = '<option value="">पहिले बिक्री भएको बिल छान्नुहोस्</option>';

    sales.forEach(sale => {
      const sold = getSoldQty(sale);
      const returned = getReturnedQty(sale, returns);
      const remaining = Math.max(0, sold - returned);

      if (!getSaleId(sale) || remaining <= 0) return;

      const option = document.createElement("option");
      option.value = getSaleId(sale);
      option.textContent =
        (sale.billNumber || getSaleId(sale)) + " | " +
        getSaleName(sale) + " | बिक्री: " + sold +
        " | बाँकी Return: " + remaining +
        " | " + money(getSaleTotal(sale));
      select.appendChild(option);
    });

    if (previousValue && Array.from(select.options).some(o => o.value === previousValue)) {
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

    $("remainingReturnQty").textContent = "—";
    $("returnAmountPreview").textContent = money(0);
    clearError();
    updateSelectedSale();
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
    $("returnCustomer").value = sale.customerName || sale.customer || "Walk-in Customer";
    $("returnProduct").value = getSaleName(sale);
    $("soldQty").value = sold;
    $("alreadyReturnedQty").value = returned;
    $("remainingReturnQty").textContent = remaining;
    $("returnQty").max = String(remaining);

    updatePreview();
  }

  function updatePreview() {
    const qty = Number($("returnQty").value || 0);
    const rate = selectedSale ? Number(selectedSale.rate || 0) : 0;
    $("returnAmountPreview").textContent = money(qty * rate);
  }

  function renderSummary() {
    const returns = getReturns();
    $("totalReturns").textContent = returns.length;
    $("totalReturnAmount").textContent = money(
      returns.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    );
    $("goodReturnCount").textContent =
      returns.filter(item => String(item.condition).toUpperCase() === "GOOD").length;
    $("damagedReturnCount").textContent =
      returns.filter(item => String(item.condition).toUpperCase() === "DAMAGED").length;
  }

  function renderHistory() {
    const body = $("returnHistoryBody");
    const query = $("returnSearch").value.trim().toLowerCase();

    const returns = getReturns().sort((a, b) =>
      String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || ""))
    );

    const filtered = returns.filter(item => {
      const text = [
        item.id, item.billNumber, item.customerName,
        item.productName, item.reason, item.condition
      ].join(" ").toLowerCase();
      return text.includes(query);
    });

    if (!filtered.length) {
      body.innerHTML = '<tr><td colspan="9" class="return-empty">अहिलेसम्म Return रेकर्ड छैन।</td></tr>';
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

  function saveReturn(event) {
    event.preventDefault();
    if (saving) return;
    clearError();

    try {
      if (!selectedSale) {
        showError("पहिले बिक्री बिल छान्नुहोस्।");
        return;
      }

      const qty = Number($("returnQty").value);
      const reason = $("returnReason").value;
      const condition = $("returnCondition").value;

      if (!Number.isFinite(qty) || qty <= 0) {
        showError("फिर्ता मात्रा शून्यभन्दा बढी हुनुपर्छ।");
        return;
      }

      const currentSales = getSales();
      const currentSale = currentSales.find(item => getSaleId(item) === getSaleId(selectedSale));

      if (!currentSale) {
        showError("यो बिक्री रेकर्ड उपलब्ध छैन।");
        return;
      }

      const products = getProducts();
      const returns = getReturns();
      const soldQty = getSoldQty(currentSale);
      const alreadyReturned = getReturnedQty(currentSale, returns);
      const remaining = soldQty - alreadyReturned;

      if (qty > remaining) {
        showError("फिर्ता मात्रा बाँकी मात्राभन्दा बढी हुन मिल्दैन। बाँकी मात्रा: " + remaining);
        return;
      }

      if (!reason) {
        showError("फिर्ताको कारण छान्नुहोस्।");
        return;
      }

      const productId = currentSale.productId;
      const productIndex = products.findIndex(product =>
        String(product.id) === String(productId)
      );

      if (productIndex < 0) {
        showError("सम्बन्धित सामान Inventory मा भेटिएन। कुनै डेटा परिवर्तन गरिएको छैन।");
        return;
      }

      if (condition !== "GOOD" && condition !== "DAMAGED") {
        showError("सामानको अवस्था छान्नुहोस्।");
        return;
      }

      const rate = Number(currentSale.rate || 0);
      const returnRecord = {
        id: "RET-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        date: today(),
        saleId: getSaleId(currentSale),
        billNumber: currentSale.billNumber || getSaleId(currentSale),
        customerName: currentSale.customerName || currentSale.customer || "Walk-in Customer",
        productId: currentSale.productId,
        productName: getSaleName(currentSale),
        unit: currentSale.unit || "",
        qty: qty,
        rate: rate,
        amount: qty * rate,
        condition: condition,
        reason: reason,
        note: $("returnNote").value.trim(),
        createdAt: new Date().toISOString()
      };

      const oldProductsRaw = localStorage.getItem(PRODUCT_KEY);
      const oldReturnsRaw = localStorage.getItem(RETURN_KEY);

      if (condition === "GOOD") {
        const oldStock = Number(products[productIndex].stock || 0);
        products[productIndex].stock = oldStock + qty;
      }

      saving = true;
      $("saveReturnBtn").disabled = true;

      try {
        writeArray(RETURN_KEY, returns.concat(returnRecord));
        if (condition === "GOOD") {
          writeArray(PRODUCT_KEY, products);
        }
      } catch (storageError) {
        if (oldReturnsRaw === null) localStorage.removeItem(RETURN_KEY);
        else localStorage.setItem(RETURN_KEY, oldReturnsRaw);

        if (oldProductsRaw === null) localStorage.removeItem(PRODUCT_KEY);
        else localStorage.setItem(PRODUCT_KEY, oldProductsRaw);

        throw new Error("Return सुरक्षित गर्न सकिएन। पुरानो डेटा पुनःस्थापना गरिएको छ। ब्राउजरको storage खाली छ कि छैन जाँच्नुहोस्।");
      }

      alert(
        "Sales Return सुरक्षित भयो।" +
        (condition === "GOOD"
          ? "\nसामान स्टकमा " + qty + " थपियो।"
          : "\nDAMAGED सामान भएकाले स्टक बढाइएको छैन।")
      );

      resetForm();
      refreshPage();
    } catch (error) {
      showError(error.message || "Return सुरक्षित गर्दा समस्या भयो।");
    } finally {
      saving = false;
      $("saveReturnBtn").disabled = false;
    }
  }

  function init() {
    const requiredIds = [
      "returnForm", "returnSale", "returnQty", "returnCondition",
      "returnReason", "returnHistoryBody", "returnSearch",
      "saveReturnBtn", "clearReturnBtn", "cancelReturnBtn"
    ];

    const missing = requiredIds.filter(id => !$(id));
    if (missing.length) {
      alert("Sales Return पेजका आवश्यक तत्व भेटिएनन्: " + missing.join(", ") +
        "\n sales-return.html को पूरा कोड सही रूपमा राखिएको छ कि जाँच्नुहोस्।");
      return;
    }

    $("returnSale").addEventListener("change", updateSelectedSale);
    $("returnQty").addEventListener("input", updatePreview);
    $("returnSearch").addEventListener("input", renderHistory);
    $("returnForm").addEventListener("submit", saveReturn);

    $("clearReturnBtn").addEventListener("click", function () {
      resetForm();
      $("returnSale").focus();
    });

    $("cancelReturnBtn").addEventListener("click", resetForm);

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
