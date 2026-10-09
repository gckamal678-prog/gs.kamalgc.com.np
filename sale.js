const PRODUCT_KEY = "gs_products";
const SALE_KEY = "gs_sales";
const LOT_KEY = "gs_stock_lots";

document.addEventListener("DOMContentLoaded", function () {
  const $ = id => document.getElementById(id);

  const modal = $("saleModal");
  const form = $("saleForm");
  const newBtn = $("newSaleBtn");

  function read(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (error) {
      console.error("Storage read error:", key, error);
      return [];
    }
  }

  function save(key, value) {
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

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);
  }

  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function newBillNumber() {
    return "SALE-" + Date.now();
  }

  // Modal: CSS को .show class प्रयोग गर्ने
  function openSaleModal() {
    if (!modal) {
      alert("Sale Modal भेटिएन। sale.html मा id='saleModal' जाँच्नुहोस्।");
      return;
    }

    modal.hidden = false;
    modal.style.display = "block";
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");

    if (!$("saleDate").value) $("saleDate").value = today();
    if (!$("billNumber").value) $("billNumber").value = newBillNumber();

    loadProducts();
    calculateSale();
  }

  function closeSaleModal() {
    if (!modal) return;

    modal.classList.remove("show");
    modal.style.display = "none";
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }

  if (newBtn) {
    newBtn.addEventListener("click", openSaleModal);
  } else {
    console.error("New Sale button भेटिएन: id='newSaleBtn'");
  }

  if ($("closeSaleModal")) {
    $("closeSaleModal").addEventListener("click", closeSaleModal);
  }

  if ($("cancelSaleBtn")) {
    $("cancelSaleBtn").addEventListener("click", closeSaleModal);
  }

  if (modal) {
    modal.addEventListener("click", function (event) {
      if (event.target === modal) closeSaleModal();
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeSaleModal();
  });

  // Product सूची
  function loadProducts() {
    const select = $("saleProduct");
    if (!select) return;

    const previous = select.value;
    const list = read(PRODUCT_KEY);

    select.innerHTML = '<option value="">Product छान्नुहोस्</option>';

    list.filter(p => p.active !== false && p.status !== "INACTIVE")
      .forEach(p => {
        const option = document.createElement("option");
        option.value = p.id;
        option.textContent =
          `${p.name || "Product"} — Stock: ${num(p.stock)} ${p.unit || ""}`;
        select.appendChild(option);
      });

    if (previous) select.value = previous;
    updateProductInfo();
  }

  function selectedProduct() {
    const id = $("saleProduct")?.value;
    return read(PRODUCT_KEY).find(p => String(p.id) === String(id));
  }

  function updateProductInfo() {
    const product = selectedProduct();

    if ($("infoProduct")) $("infoProduct").textContent = product?.name || "-";
    if ($("infoUnit")) $("infoUnit").textContent = product?.unit || "-";
    if ($("infoStock")) $("infoStock").textContent = product ? num(product.stock) : "0";
    if ($("stockInfo")) {
      $("stockInfo").textContent = product
        ? `Available stock: ${num(product.stock)} ${product.unit || ""}`
        : "Available stock: -";
    }

    if (product && $("saleRate") && !$("saleRate").value) {
      $("saleRate").value = num(product.salePrice || product.sellingPrice);
    }

    calculateSale();
  }

  function calculateSale() {
    const qty = num($("saleQty")?.value);
    const rate = num($("saleRate")?.value);
    const discountInput = num($("saleDiscount")?.value);
    const paid = num($("paidAmount")?.value);

    const itemAmount = qty * rate;
    const discount = Math.min(Math.max(0, discountInput), itemAmount);
    const total = Math.max(0, itemAmount - discount);
    const balance = Math.max(0, total - paid);

    if ($("previewItemAmount")) $("previewItemAmount").textContent = money(itemAmount);
    if ($("previewDiscount")) $("previewDiscount").textContent = money(discount);
    if ($("previewTotal")) $("previewTotal").textContent = money(total);
    if ($("previewPaid")) $("previewPaid").textContent = money(paid);
    if ($("previewBalance")) $("previewBalance").textContent = money(balance);
    if ($("infoQty")) $("infoQty").textContent = qty;
    if ($("infoPayment")) $("infoPayment").textContent = $("paymentMethod")?.value || "CASH";

    return { qty, rate, discount, itemAmount, total, paid, balance };
  }

  [
    "saleProduct", "saleQty", "saleRate", "saleDiscount",
    "paidAmount", "paymentMethod"
  ].forEach(id => {
    const el = $(id);
    if (el) {
      el.addEventListener("input", function () {
        if (id === "saleProduct") {
          $("saleRate").value = "";
          updateProductInfo();
        } else {
          calculateSale();
        }
      });
      el.addEventListener("change", function () {
        if (id === "saleProduct") updateProductInfo();
        else calculateSale();
      });
    }
  });

  // Sales History र summary
  function renderSales() {
    const tbody = $("salesHistoryBody");
    const allSales = read(SALE_KEY)
      .filter(s => !s.voided && !s.isVoid)
      .sort((a, b) =>
        String(b.createdAt || b.date || "").localeCompare(
          String(a.createdAt || a.date || "")
        )
      );

    const query = ($("saleSearch")?.value || "").toLowerCase().trim();

    const shown = allSales.filter(s =>
      [
        s.date, s.billNumber, s.customerName,
        s.productName, s.paymentMethod
      ].some(v => String(v || "").toLowerCase().includes(query))
    );

    if (tbody) {
      tbody.innerHTML = shown.length ? shown.map(s => `
        <tr>
          <td>${esc(s.date || "-")}</td>
          <td>${esc(s.billNumber || "-")}</td>
          <td>${esc(s.customerName || "Walk-in Customer")}</td>
          <td>${esc(s.productName || "-")}</td>
          <td>${num(s.qty)}</td>
          <td>${money(s.total)}</td>
          <td>${money(s.paidAmount)}</td>
          <td>${money(s.balance)}</td>
          <td>${esc(s.paymentMethod || "-")}</td>
          <td><button type="button" data-view-sale="${esc(s.id)}">View Bill</button></td>
        </tr>
      `).join("") :
      '<tr><td colspan="10" class="sale-empty">Sales विवरण छैन।</td></tr>';
    }

    if ($("totalSales")) $("totalSales").textContent = allSales.length;
    if ($("salesValue")) {
      $("salesValue").textContent = money(allSales.reduce((t, s) => t + num(s.total), 0));
    }
    if ($("salesPaidValue")) {
      $("salesPaidValue").textContent = money(allSales.reduce((t, s) => t + num(s.paidAmount), 0));
    }
    if ($("salesBalanceValue")) {
      $("salesBalanceValue").textContent = money(allSales.reduce((t, s) => t + num(s.balance), 0));
    }
  }

  if ($("saleSearch")) $("saleSearch").addEventListener("input", renderSales);

  if ($("salesHistoryBody")) {
    $("salesHistoryBody").addEventListener("click", function (event) {
      const button = event.target.closest("[data-view-sale]");
      if (!button) return;

      const sale = read(SALE_KEY).find(s => String(s.id) === button.dataset.viewSale);
      if (!sale) return alert("Sale record भेटिएन।");

      const win = window.open("", "_blank");
      if (!win) return alert("Bill खोल्न popup अनुमति दिनुहोस्।");

      win.document.write(`
        <!doctype html>
        <html><head><meta charset="utf-8"><title>Sale Bill</title>
        <style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse}
        td,th{border:1px solid #ccc;padding:8px;text-align:left}.right{text-align:right}
        @media print{button{display:none}}</style></head><body>
        <h2>GENERAL STORE</h2><h3>Sales Receipt</h3>
        <p>Bill: ${esc(sale.billNumber)}</p><p>Date: ${esc(sale.date)}</p>
        <p>Customer: ${esc(sale.customerName || "Walk-in Customer")}</p>
        <table><tr><th>Product</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
        <tr><td>${esc(sale.productName)}</td><td>${num(sale.qty)} ${esc(sale.unit || "")}</td>
        <td>${money(sale.rate)}</td><td>${money(sale.itemAmount)}</td></tr></table>
        <p class="right">Discount: ${money(sale.discount)}</p>
        <h3 class="right">Total: ${money(sale.total)}</h3>
        <p class="right">Paid: ${money(sale.paidAmount)}</p>
        <p class="right">Balance: ${money(sale.balance)}</p>
        <p>Payment: ${esc(sale.paymentMethod || "-")}</p>
        <button onclick="window.print()">Print</button></body></html>
      `);
      win.document.close();
    });
  }

  // Sale Save
  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();

      const product = selectedProduct();
      if (!product) return alert("कृपया Product छान्नुहोस्।");

      const calc = calculateSale();

      if (!$("saleDate").value) return alert("Sale Date राख्नुहोस्।");
      if (calc.qty <= 0) return alert("Quantity शून्यभन्दा बढी हुनुपर्छ।");
      if (calc.rate <= 0) return alert("Sale Rate शून्यभन्दा बढी हुनुपर्छ।");
      if (calc.discount > calc.itemAmount) return alert("Discount मिलाउनुहोस्।");
      if (calc.paid < 0 || calc.paid > calc.total) {
        return alert("Paid Amount मिलाउनुहोस्।");
      }
      if (calc.qty > num(product.stock)) {
        return alert(`पर्याप्त स्टक छैन। उपलब्ध: ${num(product.stock)}`);
      }

      const allProducts = read(PRODUCT_KEY);
      const productIndex = allProducts.findIndex(p => String(p.id) === String(product.id));
      if (productIndex < 0) return alert("Product record भेटिएन।");

      const allLots = read(LOT_KEY);
      const productLots = allLots
        .filter(l => String(l.productId) === String(product.id) && num(l.remainingQty) > 0)
        .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

      const lotTotal = productLots.reduce((sum, l) => sum + num(l.remainingQty), 0);

      // FIFO lot र Product stock नमिले सुरक्षित रूपमा रोक्ने
      if (Math.abs(lotTotal - num(product.stock)) > 0.000001) {
        return alert(
          `FIFO Stock नमिलेको छ। Product Stock: ${num(product.stock)}, ` +
          `Lot Stock: ${lotTotal}।\n\nअहिले बिक्री सुरक्षित गरिएको छैन।`
        );
      }

      let remaining = calc.qty;
      let fifoCost = 0;
      const allocations = [];

      for (const lot of productLots) {
        if (remaining <= 0.000001) break;

        const used = Math.min(num(lot.remainingQty), remaining);
        if (used <= 0) continue;

        const unitCost = num(lot.effectiveCost);
        allocations.push({
          lotId: lot.id,
          qty: used,
          unitCost,
          cost: used * unitCost
        });

        fifoCost += used * unitCost;
        remaining -= used;
      }

      if (remaining > 0.000001) {
        return alert("FIFO Lot मा पर्याप्त स्टक छैन। बिक्री सुरक्षित गरिएको छैन।");
      }

      // Save गर्नु अघि Lot मात्रा घटाउने
      allocations.forEach(a => {
        const lot = allLots.find(l => String(l.id) === String(a.lotId));
        if (!lot || num(lot.remainingQty) < a.qty) {
          throw new Error("FIFO Lot परिवर्तन भएको छ। फेरि प्रयास गर्नुहोस्।");
        }
        lot.remainingQty = Math.max(0, num(lot.remainingQty) - a.qty);
      });

      const sale = {
        id: "SALE-" + Date.now() + "-" + Math.floor(Math.random() * 10000),
        date: $("saleDate").value,
        billNumber: $("billNumber").value.trim() || newBillNumber(),
        customerName: $("customerName").value.trim(),
        productId: product.id,
        productName: product.name || "",
        unit: product.unit || "",
        qty: calc.qty,
        rate: calc.rate,
        discount: calc.discount,
        itemAmount: calc.itemAmount,
        total: calc.total,
        paidAmount: calc.paid,
        balance: calc.balance,
        paymentMethod: $("paymentMethod").value || "CASH",
        note: $("saleNote").value.trim(),
        fifoAllocations: allocations,
        fifoCost,
        profit: calc.total - fifoCost,
        createdAt: new Date().toISOString()
      };

      allProducts[productIndex].stock =
        Math.max(0, num(allProducts[productIndex].stock) - calc.qty);
      allProducts[productIndex].salePrice = calc.rate;

      const allSales = read(SALE_KEY);
      allSales.push(sale);

      try {
        save(LOT_KEY, allLots);
        save(PRODUCT_KEY, allProducts);
        save(SALE_KEY, allSales);
      } catch (error) {
        console.error(error);
        return alert("Storage मा Save गर्न समस्या भयो।");
      }

      alert("Sale सफलतापूर्वक सुरक्षित भयो।");
      form.reset();
      $("saleDate").value = today();
      $("billNumber").value = newBillNumber();
      loadProducts();
      calculateSale();
      renderSales();
      closeSaleModal();
    });
  }

  // Clear थिच्दा preview फेरि मिलाउने
  if (form) {
    form.addEventListener("reset", function () {
      setTimeout(function () {
        if ($("saleDate")) $("saleDate").value = today();
        if ($("billNumber")) $("billNumber").value = newBillNumber();
        loadProducts();
        calculateSale();
      }, 0);
    });
  }

  // प्रारम्भिक अवस्था
  if ($("saleDate")) $("saleDate").value = today();
  if ($("billNumber")) $("billNumber").value = newBillNumber();

  loadProducts();
  renderSales();
  calculateSale();
  closeSaleModal();
});
