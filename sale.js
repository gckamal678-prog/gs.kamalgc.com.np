
/* =========================================================
   GS GENERAL STORE MANAGEMENT SYSTEM
   SALE MODULE — MULTI PRODUCT BILL + FIFO + INVOICE
   ========================================================= */

(() => {
  "use strict";

  const PRODUCT_KEY = "gs_products";
  const SALE_KEY = "gs_sales";
  const LOT_KEY = "gs_stock_lots";
  const SETTINGS_KEY = "gs_settings";

  const $ = id => document.getElementById(id);

  let billItems = [];
  let paidManuallyEdited = false;
  let updatingPaid = false;

  const num = value => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  function read(key, fallback = []) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const value = JSON.parse(raw);
      return value == null ? fallback : value;
    } catch (error) {
      console.error("Storage read error:", key, error);
      throw new Error(key + " को Data पढ्न सकिएन।");
    }
  }

  function readArray(key) {
    const value = read(key, []);
    if (!Array.isArray(value)) {
      throw new Error(key + " को Data संरचना मिलेन।");
    }
    return value;
  }

  function settings() {
    const value = read(SETTINGS_KEY, {});
    return value && typeof value === "object" && !Array.isArray(value)
      ? value : {};
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function money(value) {
    const currency = String(settings().currency || "NPR").toUpperCase();
    const symbols = {
      NPR: "Rs.", RS: "Rs.", INR: "₹", USD: "$", GBP: "£", EUR: "€"
    };
    return (symbols[currency] || currency) + " " +
      num(value).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#39;"
    })[ch]);
  }

  function today() {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("-");
  }

  function newId(prefix) {
    return prefix + "-" + Date.now() + "-" +
      Math.floor(Math.random() * 1000000);
  }

  function toast(message, type = "success") {
    let box = $("saleToast");

    if (!box) {
      box = document.createElement("div");
      box.id = "saleToast";
      Object.assign(box.style, {
        position: "fixed",
        left: "50%",
        bottom: "20px",
        transform: "translateX(-50%)",
        zIndex: "10010",
        maxWidth: "calc(100% - 30px)",
        padding: "12px 16px",
        borderRadius: "10px",
        color: "#fff",
        boxShadow: "0 5px 20px #0003",
        fontSize: "14px"
      });
      document.body.appendChild(box);
    }

    box.style.background = type === "error" ? "#b91c1c" :
      type === "info" ? "#1d4ed8" : "#166534";
    box.textContent = message;
    box.style.display = "block";

    clearTimeout(box._timer);
    box._timer = setTimeout(() => {
      box.style.display = "none";
    }, 4000);
  }

  /* ---------------- Invoice Number ---------------- */

  function billNumberDetails(dateValue = $("saleDate")?.value || today()) {
    const prefix = String(settings().invoicePrefix || "INV")
      .trim().replace(/\s+/g, "-") || "INV";

    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(dateValue))
      ? new Date(dateValue + "T00:00:00")
      : new Date();

    const datePart = [
      String(date.getDate()).padStart(2, "0"),
      String(date.getMonth() + 1).padStart(2, "0"),
      date.getFullYear()
    ].join("");

    const counterKey = "gs_invoice_counter_" + datePart;
    const counter = (Number(localStorage.getItem(counterKey)) || 0) + 1;

    return {
      billNumber: prefix + "-" + datePart +
        String(counter).padStart(2, "0"),
      counterKey,
      counter
    };
  }

  function newBillNumber(dateValue) {
    return billNumberDetails(dateValue).billNumber;
  }

  /* ---------------- Modal ---------------- */

  const modal = $("saleModal");
  const form = $("saleForm");

  function openSaleModal() {
    if (!modal) return;

    modal.hidden = false;
    modal.style.display = "block";
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");

    if ($("saleDate") && !$("saleDate").value) {
      $("saleDate").value = today();
    }

    if ($("billNumber")) {
      $("billNumber").readOnly = true;
      $("billNumber").value = newBillNumber($("saleDate")?.value);
    }

    loadProducts();
    calculateSale({ autoFillPaid: true });
  }

  function closeSaleModal() {
    if (!modal) return;
    modal.classList.remove("show");
    modal.style.display = "none";
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }

  $("newSaleBtn")?.addEventListener("click", openSaleModal);
  $("closeSaleModal")?.addEventListener("click", closeSaleModal);
  $("cancelSaleBtn")?.addEventListener("click", closeSaleModal);

  modal?.addEventListener("click", event => {
    if (event.target === modal) closeSaleModal();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeSaleModal();
  });

  /* ---------------- Products ---------------- */

  function getProducts() {
    return readArray(PRODUCT_KEY);
  }

  function isActive(product) {
    return product &&
      product.active !== false &&
      product.status !== "INACTIVE";
  }

  function selectedProduct() {
    const id = $("saleProduct")?.value;
    if (!id) return null;
    return getProducts().find(p => String(p.id) === String(id)) || null;
  }

  function loadProducts() {
    const select = $("saleProduct");
    if (!select) return;

    const previous = select.value;
    const products = getProducts();

    select.innerHTML = '<option value="">Product छान्नुहोस्</option>';

    products.filter(isActive).forEach(product => {
      const option = document.createElement("option");
      option.value = product.id;
      option.textContent =
        (product.name || "Product") + " — Stock: " +
        num(product.stock) + " " + (product.unit || "") +
        (product.barcode ? " — " + product.barcode : "");
      select.appendChild(option);
    });

    if (previous && products.some(p =>
      isActive(p) && String(p.id) === String(previous)
    )) {
      select.value = previous;
    }

    updateProductInfo();
  }

  function updateProductInfo() {
    const product = selectedProduct();

    if ($("infoProduct")) $("infoProduct").textContent = product?.name || "-";
    if ($("infoUnit")) $("infoUnit").textContent = product?.unit || "-";
    if ($("infoStock")) $("infoStock").textContent = product ? num(product.stock) : "0";

    if ($("stockInfo")) {
      $("stockInfo").textContent = product
        ? "Available stock: " + num(product.stock) + " " + (product.unit || "")
        : "Available stock: -";
    }

    if (product && $("saleRate") && !$("saleRate").value) {
      $("saleRate").value = num(product.salePrice || product.sellingPrice);
    }

    calculateSale();
  }

  /* ---------------- Multi-item Bill ---------------- */

  function renderBillItems() {
    const tbody = $("billItemsBody");
    if (!tbody) {
      calculateSale();
      return;
    }

    if (!billItems.length) {
      tbody.innerHTML = `
        <tr><td colspan="6" class="sale-empty">सामान थप्नुहोस्।</td></tr>
      `;
    } else {
      tbody.innerHTML = billItems.map((item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${esc(item.name)}</td>
          <td>${num(item.qty)} ${esc(item.unit || "")}</td>
          <td>${money(item.rate)}</td>
          <td>${money(num(item.qty) * num(item.rate))}</td>
          <td>
            <button type="button" class="sale-btn danger"
              data-remove-bill-item="${index}">हटाउनुहोस्</button>
          </td>
        </tr>
      `).join("");
    }

    const subtotal = billItems.reduce(
      (sum, item) => sum + num(item.qty) * num(item.rate), 0
    );

    if ($("billSubtotal")) {
      $("billSubtotal").textContent = money(subtotal);
    }

    calculateSale();
  }

  function addCurrentItemToBill() {
    const product = selectedProduct();
    const qty = num($("saleQty")?.value);
    const rate = num($("saleRate")?.value);

    if (!product) {
      toast("पहिले सामान छान्नुहोस्।", "error");
      return;
    }

    if (qty <= 0 || rate <= 0) {
      toast("मात्रा र बिक्री दर शून्यभन्दा बढी राख्नुहोस्।", "error");
      return;
    }

    const alreadyAdded = billItems
      .filter(item => String(item.productId) === String(product.id))
      .reduce((sum, item) => sum + num(item.qty), 0);

    if (alreadyAdded + qty > num(product.stock)) {
      toast("उपलब्ध स्टकभन्दा बढी मात्रा राख्न मिल्दैन। उपलब्ध: " +
        num(product.stock), "error");
      return;
    }

    billItems.push({
      productId: product.id,
      name: product.name || "Product",
      barcode: String(product.barcode || ""),
      unit: product.unit || "",
      qty,
      rate
    });

    renderBillItems();

    $("saleProduct").value = "";
    $("saleQty").value = "";
    $("saleRate").value = "";

    updateProductInfo();
    toast("सामान बिलमा थपियो।");
  }

  $("addSaleItemBtn")?.addEventListener("click", addCurrentItemToBill);

  $("billItemsBody")?.addEventListener("click", event => {
    const button = event.target.closest("[data-remove-bill-item]");
    if (!button) return;

    const index = Number(button.dataset.removeBillItem);
    if (!Number.isInteger(index) || index < 0 || index >= billItems.length) return;

    billItems.splice(index, 1);
    renderBillItems();
    toast("सामान हटाइयो।", "info");
  });

  /* ---------------- Totals and Payments ---------------- */

  function calculateSale(options = {}) {
    const subtotal = billItems.reduce(
      (sum, item) => sum + num(item.qty) * num(item.rate), 0
    );

    const discountEntered = Math.max(0, num($("saleDiscount")?.value));
    const discount = Math.min(discountEntered, subtotal);
    const total = Math.max(0, subtotal - discount);
    const method = String($("paymentMethod")?.value || "CASH").toUpperCase();

    const paidInput = $("paidAmount");
    const shouldAutoFill = options.autoFillPaid === true ||
      (!paidManuallyEdited && ["CASH", "BANK", "QR"].includes(method));

    if (paidInput && shouldAutoFill) {
      updatingPaid = true;
      paidInput.value = (method === "CREDIT" ? 0 : total).toFixed(2);
      updatingPaid = false;
    }

    const paid = Math.max(0, num(paidInput?.value));
    const balance = Math.max(0, total - paid);

    if ($("previewTotal")) $("previewTotal").textContent = money(total);
    if ($("previewPaid")) $("previewPaid").textContent = money(paid);
    if ($("previewBalance")) $("previewBalance").textContent = money(balance);
    if ($("previewDiscount")) $("previewDiscount").textContent = money(discount);
    if ($("previewItemAmount")) $("previewItemAmount").textContent = money(subtotal);
    if ($("billSubtotal")) $("billSubtotal").textContent = money(subtotal);

    return { qty: billItems.reduce((sum, item) => sum + num(item.qty), 0),
      itemAmount: subtotal, discount, total, paid, balance };
  }

  [
    "saleQty", "saleRate", "saleDiscount"
  ].forEach(id => {
    $(id)?.addEventListener("input", () => calculateSale());
  });

  $("saleProduct")?.addEventListener("change", () => {
    if ($("saleRate")) $("saleRate").value = "";
    updateProductInfo();
  });

  $("paidAmount")?.addEventListener("input", () => {
    if (!updatingPaid) paidManuallyEdited = true;
    calculateSale();
  });

  $("paymentMethod")?.addEventListener("change", () => {
    paidManuallyEdited = false;
    calculateSale({ autoFillPaid: true });
  });

  /* ---------------- FIFO Allocation ---------------- */

  function allocateFIFO(lots, productId, quantity, productStock) {
    const productLots = lots
      .filter(lot =>
        String(lot.productId) === String(productId) &&
        num(lot.remainingQty) > 0
      )
      .sort((a, b) =>
        String(a.date || a.purchaseDate || "").localeCompare(
          String(b.date || b.purchaseDate || "")
        )
      );

    const lotTotal = productLots.reduce(
      (sum, lot) => sum + num(lot.remainingQty), 0
    );

    if (Math.abs(lotTotal - num(productStock)) > 0.000001) {
      throw new Error(
        "FIFO Stock नमिलेको छ। Product Stock: " +
        num(productStock) + ", Lot Stock: " + lotTotal +
        "। बिक्री सुरक्षित गरिएको छैन।"
      );
    }

    let remaining = quantity;
    let fifoCost = 0;
    const allocations = [];

    for (const lot of productLots) {
      if (remaining <= 0.000001) break;

      const used = Math.min(num(lot.remainingQty), remaining);
      if (used <= 0) continue;

      const unitCost = num(lot.effectiveCost ?? lot.unitCost ?? lot.costPrice);

      allocations.push({
        lotId: lot.id,
        productId,
        qty: used,
        unitCost,
        cost: used * unitCost
      });

      fifoCost += used * unitCost;
      remaining -= used;
    }

    if (remaining > 0.000001) {
      throw new Error("FIFO Lot मा पर्याप्त स्टक छैन। बिक्री सुरक्षित गरिएको छैन।");
    }

    const updatedLots = lots.map(lot => ({ ...lot }));

    for (const allocation of allocations) {
      const lot = updatedLots.find(
        item => String(item.id) === String(allocation.lotId)
      );

      if (!lot || num(lot.remainingQty) < allocation.qty) {
        throw new Error("FIFO Lot परिवर्तन भएको छ। फेरि प्रयास गर्नुहोस्।");
      }

      lot.remainingQty = Math.max(
        0, num(lot.remainingQty) - allocation.qty
      );
    }

    return { allocations, fifoCost, updatedLots };
  }

  function saveSaleTransaction(updatedLots, updatedProducts, updatedSales, counterUpdate) {
    const keys = [LOT_KEY, PRODUCT_KEY, SALE_KEY];
    if (counterUpdate?.key) keys.push(counterUpdate.key);

    const oldValues = {};
    keys.forEach(key => oldValues[key] = localStorage.getItem(key));

    try {
      write(LOT_KEY, updatedLots);
      write(PRODUCT_KEY, updatedProducts);
      write(SALE_KEY, updatedSales);

      if (counterUpdate?.key) {
        localStorage.setItem(counterUpdate.key, String(counterUpdate.value));
      }
    } catch (error) {
      keys.forEach(key => {
        try {
          if (oldValues[key] === null) localStorage.removeItem(key);
          else localStorage.setItem(key, oldValues[key]);
        } catch (rollbackError) {
          console.error("Rollback error:", rollbackError);
        }
      });
      throw new Error("Sale सुरक्षित गर्न सकिएन। Storage/Data जाँच गर्नुहोस्।");
    }
  }

  /* ---------------- Save Multi-product Sale ---------------- */

  form?.addEventListener("submit", event => {
    event.preventDefault();

    try {
      if (!$("saleDate")?.value) {
        toast("Sale Date राख्नुहोस्।", "error");
        return;
      }

      if (!billItems.length) {
        toast("पहिले Bill Items मा कम्तीमा एउटा सामान थप्नुहोस्।", "error");
        return;
      }

      const calc = calculateSale();

      if (num($("saleDiscount")?.value) > calc.itemAmount) {
        toast("Discount सामानको जम्मा रकमभन्दा बढी हुन मिल्दैन।", "error");
        return;
      }

      if (calc.paid < 0 || calc.paid > calc.total) {
        toast("Paid Amount Total भन्दा बढी हुन मिल्दैन।", "error");
        return;
      }

      const products = getProducts();
      const updatedProducts = products.map(p => ({ ...p }));
      let updatedLots = readArray(LOT_KEY).map(lot => ({ ...lot }));
      const groups = new Map();

      billItems.forEach(item => {
        const key = String(item.productId);
        if (!groups.has(key)) groups.set(key, { qty: 0, items: [] });
        groups.get(key).qty += num(item.qty);
        groups.get(key).items.push(item);
      });

      let totalFifoCost = 0;
      const fifoByProduct = new Map();

      for (const [productId, group] of groups) {
        const index = updatedProducts.findIndex(
          p => String(p.id) === productId
        );

        if (index < 0) throw new Error("बिलमा भएको Product record भेटिएन।");

        const product = updatedProducts[index];

        if (!isActive(product)) {
          throw new Error((product.name || "Product") + " Active छैन।");
        }

        if (group.qty > num(product.stock)) {
          throw new Error(
            (product.name || "Product") + " को Stock पर्याप्त छैन। उपलब्ध: " +
            num(product.stock)
          );
        }

        const fifo = allocateFIFO(
          updatedLots, product.id, group.qty, product.stock
        );

        updatedLots = fifo.updatedLots;
        fifoByProduct.set(productId, fifo);
        totalFifoCost += fifo.fifoCost;

        product.stock = Math.max(0, num(product.stock) - group.qty);
        product.salePrice = num(group.items[group.items.length - 1].rate);
      }

      const billInfo = billNumberDetails($("saleDate").value);
      const billNumber = billInfo.billNumber;
      if ($("billNumber")) $("billNumber").value = billNumber;

      const rows = billItems.map(item => {
        const amount = num(item.qty) * num(item.rate);
        const discountShare = calc.itemAmount > 0
          ? calc.discount * amount / calc.itemAmount : 0;

        return {
          productId: item.productId,
          productName: item.name,
          barcode: item.barcode || "",
          unit: item.unit || "",
          qty: num(item.qty),
          rate: num(item.rate),
          itemAmount: amount,
          discount: discountShare,
          total: amount - discountShare
        };
      });

      const allAllocations = [];
      for (const [productId, fifo] of fifoByProduct) {
        fifo.allocations.forEach(allocation => {
          allAllocations.push({ ...allocation, productId });
        });
      }

      const sale = {
        id: newId("SALE"),
        date: $("saleDate").value,
        billNumber,
        customerName: $("customerName")?.value.trim() || "",
        items: rows,
        productId: rows[0].productId,
        productName: rows.map(item => item.productName).join(", "),
        barcode: rows.map(item => item.barcode).filter(Boolean).join(", "),
        unit: rows.length === 1 ? rows[0].unit : "",
        qty: rows.reduce((sum, item) => sum + item.qty, 0),
        rate: rows.length === 1 ? rows[0].rate : 0,
        itemAmount: calc.itemAmount,
        discount: calc.discount,
        total: calc.total,
        paidAmount: calc.paid,
        balance: calc.balance,
        paymentMethod: $("paymentMethod")?.value || "CASH",
        note: $("saleNote")?.value.trim() || "",
        fifoAllocations: allAllocations,
        fifoCost: totalFifoCost,
        profit: calc.total - totalFifoCost,
        createdAt: new Date().toISOString()
      };

      const sales = readArray(SALE_KEY);
      sales.push(sale);

      saveSaleTransaction(
        updatedLots,
        updatedProducts,
        sales,
        { key: billInfo.counterKey, value: billInfo.counter }
      );

      toast("Sale सफलतापूर्वक सुरक्षित भयो।");

      billItems = [];
      paidManuallyEdited = false;
      form.reset();

      if ($("saleDate")) $("saleDate").value = today();
      if ($("billNumber")) $("billNumber").value = newBillNumber($("saleDate").value);
      if ($("saleDiscount")) $("saleDiscount").value = "0";
      if ($("paidAmount")) $("paidAmount").value = "0";

      loadProducts();
      renderBillItems();
      calculateSale({ autoFillPaid: true });
      renderSales();
      closeSaleModal();
    } catch (error) {
      console.error("Sale save error:", error);
      toast(error.message || "Sale सुरक्षित गर्न सकिएन।", "error");
    }
  });

  /* ---------------- Sales History ---------------- */

  function getSaleItems(sale) {
    if (Array.isArray(sale.items) && sale.items.length) return sale.items;

    // पुराना single-product records का लागि compatibility
    return [{
      productId: sale.productId,
      productName: sale.productName || "Product",
      barcode: sale.barcode || "",
      unit: sale.unit || "",
      qty: num(sale.qty),
      rate: num(sale.rate),
      itemAmount: num(sale.itemAmount)
    }];
  }

  function renderSales() {
    const tbody = $("salesHistoryBody");
    if (!tbody) return;

    let sales;
    try {
      sales = readArray(SALE_KEY);
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="10">Sales Data पढ्न सकिएन।</td></tr>`;
      return;
    }

    const query = String($("saleSearch")?.value || "").trim().toLowerCase();

    const filtered = sales.filter(sale => {
      const items = getSaleItems(sale);
      const searchable = [
        sale.billNumber, sale.customerName, sale.productName,
        sale.barcode, ...items.map(item =>
          [item.productName, item.barcode].join(" ")
        )
      ].join(" ").toLowerCase();

      return searchable.includes(query);
    }).slice().reverse();

    const totalSales = sales.reduce((sum, s) => sum + num(s.total), 0);
    const totalPaid = sales.reduce((sum, s) => sum + num(s.paidAmount), 0);
    const totalBalance = sales.reduce((sum, s) => sum + num(s.balance), 0);

    if ($("totalSales")) $("totalSales").textContent = String(sales.length);
    if ($("salesValue")) $("salesValue").textContent = money(totalSales);
    if ($("salesPaidValue")) $("salesPaidValue").textContent = money(totalPaid);
    if ($("salesBalanceValue")) $("salesBalanceValue").textContent = money(totalBalance);

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="10" class="sale-empty">बिक्री विवरण भेटिएन।</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(sale => {
      const items = getSaleItems(sale);
      const productText = items.map(item =>
        esc(item.productName || "Product") + " × " + num(item.qty)
      ).join("<br>");

      return `
        <tr>
          <td>${esc(sale.date || "-")}</td>
          <td>${esc(sale.billNumber || "-")}</td>
          <td>${esc(sale.customerName || "Cash Customer")}</td>
          <td>${productText}</td>
          <td>${num(sale.qty)}</td>
          <td>${money(sale.total)}</td>
          <td>${money(sale.paidAmount)}</td>
          <td>${money(sale.balance)}</td>
          <td>${esc(sale.paymentMethod || "-")}</td>
          <td>
            <button type="button" class="sale-btn"
              data-print-sale="${esc(sale.id)}">Invoice / Print</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  $("saleSearch")?.addEventListener("input", renderSales);

  $("salesHistoryBody")?.addEventListener("click", event => {
    const button = event.target.closest("[data-print-sale]");
    if (!button) return;

    const sale = readArray(SALE_KEY).find(
      item => String(item.id) === String(button.dataset.printSale)
    );

    if (!sale) {
      toast("Sale record भेटिएन।", "error");
      return;
    }

    printInvoice(sale);
  });


/* ---------- INVOICE / PRINT / SAVE PDF - FULL REPLACEMENT ---------- */

function printInvoice(sale) {
  const win = window.open("", "_blank");

  if (!win) {
    toast("Invoice खोल्न Browser popup अनुमति दिनुहोस्।", "error");
    return;
  }

  const store = settings() || {};
  const items = getSaleItems(sale) || [];
  const safe = value => esc(String(value ?? ""));

  const read = (...keys) => {
    for (const key of keys) {
      const value = store[key];
      if (value !== undefined && value !== null &&
          String(value).trim() !== "") {
        return String(value).trim();
      }
    }
    return "";
  };

  const profile = {
    name: read("storeName", "businessName", "name", "shopName")
      || "General Store",
    owner: read("ownerName", "proprietorName", "owner", "operatorName"),
    address: read("storeAddress", "address", "businessAddress", "shopAddress"),
    phone: read("storePhone", "phone", "mobile", "contactNumber"),
    email: read("storeEmail", "email", "businessEmail"),
    taxType: read("taxType") || "VAT",
    taxNumber: read("taxNumber", "panNumber", "vatNumber", "pan", "vat", "taxId"),
    photo: read("operatorPhoto", "ownerPhoto", "ownerPhotoUrl", "userPhoto", "photoUrl"),
    footer: read("invoiceFooter", "receiptFooter", "footerText")
      || "हाम्रो पसलमा आउनुभएकोमा धन्यवाद!"
  };

  const photo = profile.photo
    ? `<img class="profile-photo" src="${safe(profile.photo)}"
         alt="Owner photo" onerror="this.style.display='none'">`
    : `<div class="photo-placeholder">👤</div>`;

  const rows = items.map((item, index) => `
    <tr>
      <td class="sn">${index + 1}</td>
      <td>${safe(item.productName || "Product")}</td>
      <td>${safe(item.barcode || "-")}</td>
      <td class="right">${num(item.qty)} ${safe(item.unit || "")}</td>
      <td class="right">${money(item.rate)}</td>
      <td class="right">${money(
        item.itemAmount ?? num(item.qty) * num(item.rate)
      )}</td>
    </tr>
  `).join("");

  const subtotal = sale.itemAmount ??
    items.reduce((sum, item) =>
      sum + num(item.itemAmount ?? num(item.qty) * num(item.rate)), 0);

  const discount = num(sale.discount);
  const total = sale.total ?? subtotal - discount;
  const paid = num(sale.paidAmount);
  const balance = sale.balance ?? Math.max(0, num(total) - paid);

  win.document.open();

  win.document.write(`<!doctype html>
<html lang="ne">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${safe(sale.billNumber || "")}</title>

<style>
  @page {
    size: A4 portrait;
    margin: 10mm;
  }

  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    font-family: Arial, "Noto Sans Devanagari", sans-serif;
    font-size: 10px;
    color: #222;
    background: white;
  }

  .invoice {
    width: 100%;
    margin: 0;
    padding: 27mm 0 15mm;
  }

  .page-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 24mm;
    background: white;
    border-bottom: 1.5px solid #17683a;
  }

  .brand-row {
    height: 23mm;
    display: grid;
    grid-template-columns: 19mm minmax(0, 1fr) minmax(0, 1fr);
    gap: 3mm;
    align-items: center;
  }

  .photo-box {
    width: 18mm;
    height: 18mm;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .profile-photo, .photo-placeholder {
    width: 18mm;
    height: 18mm;
    border-radius: 50%;
    object-fit: cover;
  }

  .photo-placeholder {
    display: flex;
    justify-content: center;
    align-items: center;
    background: #f0f0f0;
    font-size: 22px;
  }

  .brand-info {
    min-width: 0;
    font-size: 9px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .brand-name {
    color: #17683a;
    font-size: 13px;
    font-weight: bold;
  }

  .owner-name {
    font-size: 11px;
    font-weight: bold;
  }

  .invoice-meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px 12px;
    padding-bottom: 7px;
    margin-bottom: 8px;
    border-bottom: 1px solid #ccc;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .invoice-title {
    margin: 8px 0;
    text-align: center;
    font-size: 14px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 8px;
  }

  col.sn-col { width: 7%; }
  col.product-col { width: 27%; }
  col.barcode-col { width: 19%; }
  col.qty-col { width: 14%; }
  col.rate-col { width: 15%; }
  col.amount-col { width: 18%; }

  thead {
    display: table-header-group;
  }

  th, td {
    padding: 5px 3px;
    border: 1px solid #ccc;
    text-align: left;
    vertical-align: top;
    overflow-wrap: anywhere;
  }

  th {
    color: white;
    background: #17683a;
  }

  tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .sn {
    text-align: center;
  }

  .right {
    text-align: right;
  }

  .totals-wrap {
    display: flex;
    justify-content: flex-end;
    margin-top: 5mm;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .totals {
    width: 75mm;
    max-width: 100%;
  }

  .total-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 5px 3px;
    border-bottom: 1px solid #ddd;
  }

  .grand {
    color: #17683a;
    font-size: 12px;
    font-weight: bold;
    border-top: 1.5px solid #17683a;
  }

  .thank-you {
    text-align: center;
    color: #17683a;
    font-weight: bold;
    margin-top: 8mm;
  }

  .page-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 12mm;
    padding-top: 3mm;
    border-top: 1px solid #999;
    background: white;
    text-align: center;
    font-size: 9px;
    line-height: 1.5;
  }

  .footer-contact {
    display: flex;
    justify-content: center;
    gap: 8mm;
    flex-wrap: wrap;
    overflow-wrap: anywhere;
  }

  .actions {
    margin: 15px auto;
    text-align: center;
  }

  .actions button {
    padding: 9px 16px;
    margin: 4px;
    border: 0;
    border-radius: 4px;
    background: #17683a;
    color: white;
  }

  .actions .close-btn {
    background: #555;
  }

  @media screen {
    body {
      padding: 12px;
      background: #eee;
    }

    .invoice {
      width: 100%;
      max-width: 190mm;
      min-height: 240mm;
      margin: auto;
      padding: 12px;
      background: white;
    }

    .page-header, .page-footer {
      position: static;
      height: auto;
    }

    .page-header {
      margin-bottom: 12px;
    }

    .page-footer {
      margin-top: 18px;
      padding-bottom: 8px;
    }
  }

  @media print {
    .actions {
      display: none !important;
    }

    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: auto;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
      background: white !important;
    }

    .invoice {
      width: 100%;
      max-width: none;
      min-height: 0 !important;
      margin: 0;
      padding: 27mm 0 15mm;
      overflow: visible !important;
    }

    .page-header {
      position: fixed;
      top: 0;
    }

    .page-footer {
      position: fixed;
      bottom: 0;
    }

    table {
      page-break-inside: auto;
    }

    .totals-wrap, .thank-you {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  }
</style>
</head>

<body>
<main class="invoice">

  <header class="page-header">
    <div class="brand-row">
      <div class="photo-box">${photo}</div>

      <div class="brand-info">
        <div class="brand-name">${safe(profile.name)}</div>
        <div>${safe(profile.taxType)}: ${safe(profile.taxNumber || "-")}</div>
      </div>

      <div class="brand-info">
        <div class="owner-name">${safe(profile.owner || "-")}</div>
        <div>${safe(profile.address || "-")}</div>
      </div>
    </div>
  </header>

  <section class="invoice-meta">
    <div><b>Bill No.:</b> ${safe(sale.billNumber || "-")}</div>
    <div><b>Date:</b> ${safe(sale.date || "-")}</div>
    <div><b>Customer:</b> ${safe(sale.customerName || "Cash Customer")}</div>
    <div><b>Payment:</b> ${safe(sale.paymentMethod || "-")}</div>
  </section>

  <h2 class="invoice-title">SALES INVOICE</h2>

  <table>
    <colgroup>
      <col class="sn-col">
      <col class="product-col">
      <col class="barcode-col">
      <col class="qty-col">
      <col class="rate-col">
      <col class="amount-col">
    </colgroup>

    <thead>
      <tr>
        <th>S.N.</th>
        <th>Product</th>
        <th>Barcode</th>
        <th class="right">Qty</th>
        <th class="right">Rate</th>
        <th class="right">Amount</th>
      </tr>
    </thead>

    <tbody>
      ${rows || '<tr><td colspan="6">No items</td></tr>'}
    </tbody>
  </table>

  <section class="totals-wrap">
    <div class="totals">
      <div class="total-row">
        <span>Subtotal</span>
        <strong>${money(subtotal)}</strong>
      </div>
      <div class="total-row">
        <span>Discount</span>
        <strong>${money(discount)}</strong>
      </div>
      <div class="total-row grand">
        <span>Total</span>
        <strong>${money(total)}</strong>
      </div>
      <div class="total-row">
        <span>Paid Amount</span>
        <strong>${money(paid)}</strong>
      </div>
      <div class="total-row">
        <span>Balance</span>
        <strong>${money(balance)}</strong>
      </div>
    </div>
  </section>

  <div class="thank-you">${safe(profile.footer)}</div>

  <footer class="page-footer">
    <div class="footer-contact">
      <span>फोन: ${safe(profile.phone || "-")}</span>
      <span>इमेल: ${safe(profile.email || "-")}</span>
    </div>
  </footer>

</main>

<div class="actions">
  <button onclick="window.print()">Print / Save PDF</button>
  <button class="close-btn" onclick="window.close()">Close</button>
</div>

</body>
</html>`);

  win.document.close();
}


  /* ---------------- Reset / Initialize ---------------- */

  form?.addEventListener("reset", () => {
    billItems = [];
    paidManuallyEdited = false;

    setTimeout(() => {
      if ($("saleDate")) $("saleDate").value = today();
      if ($("billNumber")) $("billNumber").value = newBillNumber($("saleDate").value);
      if ($("saleDiscount")) $("saleDiscount").value = "0";
      if ($("paidAmount")) $("paidAmount").value = "0";

      loadProducts();
      renderBillItems();
      calculateSale({ autoFillPaid: true });
    }, 0);
  });

  function initialize() {
    if ($("saleDate")) $("saleDate").value = today();

    if ($("billNumber")) {
      $("billNumber").readOnly = true;
      $("billNumber").value = newBillNumber($("saleDate")?.value);
    }

    if ($("saleDiscount") && $("saleDiscount").value === "") {
      $("saleDiscount").value = "0";
    }

    if ($("paidAmount") && $("paidAmount").value === "") {
      $("paidAmount").value = "0";
    }

    loadProducts();
    renderBillItems();
    renderSales();
    calculateSale({ autoFillPaid: true });
    closeSaleModal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
