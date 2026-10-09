const PRODUCT_KEY = "gs_products";
const SALE_KEY = "gs_sales";
const LOT_KEY = "gs_stock_lots";

document.addEventListener("DOMContentLoaded", function () {
  const $ = (id) => document.getElementById(id);

  const els = {
    modal: $("saleModal"),
    form: $("saleForm"),
    newBtn: $("newSaleBtn"),
    closeBtn: $("closeSaleModal"),
    cancelBtn: $("cancelSaleBtn"),
    date: $("saleDate"),
    bill: $("billNumber"),
    product: $("saleProduct"),
    qty: $("saleQty"),
    rate: $("saleRate"),
    discount: $("saleDiscount"),
    customer: $("customerName"),
    payment: $("paymentMethod"),
    paid: $("paidAmount"),
    note: $("saleNote"),
    itemAmount: $("previewItemAmount"),
    discountPreview: $("previewDiscount"),
    totalPreview: $("previewTotal"),
    paidPreview: $("previewPaid"),
    balancePreview: $("previewBalance"),
    infoProduct: $("infoProduct"),
    infoUnit: $("infoUnit"),
    infoStock: $("infoStock"),
    infoQty: $("infoQty"),
    infoPayment: $("infoPayment"),
    stockInfo: $("stockInfo"),
    search: $("saleSearch"),
    history: $("salesHistoryBody"),
    totalSales: $("totalSales"),
    salesValue: $("salesValue"),
    salesPaidValue: $("salesPaidValue"),
    salesBalanceValue: $("salesBalanceValue")
  };

  function read(key, fallback = []) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value == null ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function products() {
    return read(PRODUCT_KEY);
  }

  function sales() {
    return read(SALE_KEY);
  }

  function lots() {
    return read(LOT_KEY);
  }

  function money(value) {
    return Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function num(value) {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
  }

  function safe(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function today() {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("-");
  }

  function generateBill() {
    return "SALE-" + Date.now().toString().slice(-8);
  }

  function getProduct(id) {
    return products().find(p => String(p.id) === String(id));
  }

  function openModal() {
    if (els.modal) {
      els.modal.hidden = false;
      els.modal.style.display = "";
      els.modal.classList.add("active", "show", "open");
    }

    if (els.date && !els.date.value) els.date.value = today();
    if (els.bill && !els.bill.value) els.bill.value = generateBill();

    loadProducts();
    calculate();

    setTimeout(() => {
      if (els.product) els.product.focus();
    }, 50);
  }

  function closeModal() {
    if (els.modal) {
      els.modal.classList.remove("active", "show", "open");
      els.modal.hidden = true;
      els.modal.style.display = "none";
    }
  }

  function loadProducts(selectedId = "") {
    if (!els.product) return;

    const list = products();
    const current = selectedId || els.product.value;

    els.product.innerHTML = '<option value="">Select Product</option>';

    list.filter(p => p.active !== false && p.status !== "INACTIVE")
      .forEach(p => {
        const option = document.createElement("option");
        option.value = p.id;
        option.textContent =
          `${p.name || "Unnamed Product"} — Stock: ${num(p.stock)} ${p.unit || ""}`;
        els.product.appendChild(option);
      });

    if (current) els.product.value = current;
    updateProductInfo();
  }

  function updateProductInfo() {
    const product = getProduct(els.product?.value);

    if (els.infoProduct) els.infoProduct.textContent = product?.name || "-";
    if (els.infoUnit) els.infoUnit.textContent = product?.unit || "-";
    if (els.infoStock) {
      els.infoStock.textContent = product ? num(product.stock) : "-";
    }
    if (els.infoQty) els.infoQty.textContent = els.qty?.value || "0";
    if (els.infoPayment) {
      els.infoPayment.textContent = els.payment?.value || "-";
    }

    if (els.rate && product && !els.rate.value) {
      els.rate.value = num(product.salePrice || product.sellingPrice || 0);
    }

    calculate();
  }

  function calculate() {
    const qty = num(els.qty?.value);
    const rate = num(els.rate?.value);
    const discount = num(els.discount?.value);
    const paid = num(els.paid?.value);

    const itemAmount = qty * rate;
    const safeDiscount = Math.min(Math.max(discount, 0), itemAmount);
    const total = Math.max(0, itemAmount - safeDiscount);
    const balance = Math.max(0, total - paid);

    if (els.itemAmount) els.itemAmount.textContent = money(itemAmount);
    if (els.discountPreview) els.discountPreview.textContent = money(safeDiscount);
    if (els.totalPreview) els.totalPreview.textContent = money(total);
    if (els.paidPreview) els.paidPreview.textContent = money(paid);
    if (els.balancePreview) els.balancePreview.textContent = money(balance);
    if (els.infoQty) els.infoQty.textContent = qty || "0";

    return { qty, rate, discount: safeDiscount, itemAmount, total, paid, balance };
  }

  function renderSummary() {
    const all = sales().filter(s => !s.voided && !s.isVoid);
    const totalValue = all.reduce((sum, s) => sum + num(s.total), 0);
    const paidValue = all.reduce((sum, s) => sum + num(s.paidAmount), 0);
    const balanceValue = all.reduce((sum, s) => sum + num(s.balance), 0);

    if (els.totalSales) els.totalSales.textContent = all.length;
    if (els.salesValue) els.salesValue.textContent = money(totalValue);
    if (els.salesPaidValue) els.salesPaidValue.textContent = money(paidValue);
    if (els.salesBalanceValue) els.salesBalanceValue.textContent = money(balanceValue);
  }

  function renderHistory() {
    if (!els.history) return;

    const query = (els.search?.value || "").toLowerCase().trim();

    const list = sales()
      .filter(s => !s.voided && !s.isVoid)
      .filter(s => [
        s.billNumber, s.customerName, s.productName,
        s.date, s.paymentMethod
      ].some(value => String(value || "").toLowerCase().includes(query)))
      .sort((a, b) =>
        String(b.createdAt || b.date || "").localeCompare(
          String(a.createdAt || a.date || "")
        )
      );

    if (!list.length) {
      els.history.innerHTML =
        '<tr><td colspan="9" style="text-align:center;padding:20px;">No sales records found.</td></tr>';
      renderSummary();
      return;
    }

    els.history.innerHTML = list.map(s => `
      <tr>
        <td>${safe(s.date || "-")}</td>
        <td>${safe(s.billNumber || "-")}</td>
        <td>${safe(s.customerName || "Walk-in Customer")}</td>
        <td>${safe(s.productName || "-")}</td>
        <td>${money(s.qty)}</td>
        <td>${money(s.total)}</td>
        <td>${money(s.paidAmount)}</td>
        <td>${money(s.balance)}</td>
        <td>
          <button type="button" class="view-sale-btn"
            data-sale-id="${safe(s.id)}">View Bill</button>
        </td>
      </tr>
    `).join("");

    renderSummary();
  }

  function allocateFIFO(productId, qty) {
    const allLots = lots();

    const productLots = allLots
      .filter(l =>
        String(l.productId) === String(productId) &&
        num(l.remainingQty) > 0
      )
      .sort((a, b) => {
        const dateCompare = String(a.date || "").localeCompare(String(b.date || ""));
        if (dateCompare !== 0) return dateCompare;
        return String(a.createdAt || a.id || "").localeCompare(
          String(b.createdAt || b.id || "")
        );
      });

    const lotQty = productLots.reduce((sum, l) => sum + num(l.remainingQty), 0);
    const product = getProduct(productId);

    if (!product) {
      throw new Error("Product भेटिएन।");
    }

    if (Math.abs(lotQty - num(product.stock)) > 0.000001) {
      throw new Error(
        `FIFO Stock नमिलेको छ। Product Stock: ${num(product.stock)}, ` +
        `Lot Stock: ${lotQty}। बिक्री सुरक्षित राख्न रोकिएको छ।`
      );
    }

    if (lotQty + 0.000001 < qty) {
      throw new Error("FIFO Lot मा पर्याप्त स्टक छैन।");
    }

    let remaining = qty;
    let cost = 0;
    const allocations = [];

    for (const lot of productLots) {
      if (remaining <= 0.000001) break;

      const available = num(lot.remainingQty);
      const used = Math.min(available, remaining);

      if (used <= 0) continue;

      const unitCost = num(lot.effectiveCost);
      cost += used * unitCost;

      allocations.push({
        lotId: lot.id,
        qty: used,
        unitCost,
        cost: used * unitCost
      });

      remaining -= used;
    }

    if (remaining > 0.000001) {
      throw new Error("FIFO Lot बाट आवश्यक मात्रा छुट्याउन सकिएन।");
    }

    return { allocations, cost };
  }

  function viewSaleBill(id) {
    const sale = sales().find(s => String(s.id) === String(id));
    if (!sale) return alert("Sale record भेटिएन।");

    const receipt = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Sale Bill ${safe(sale.billNumber)}</title>
        <style>
          body{font-family:Arial,sans-serif;padding:24px;color:#222}
          h2{text-align:center;margin-bottom:4px}
          .center{text-align:center}
          table{width:100%;border-collapse:collapse;margin-top:20px}
          th,td{border:1px solid #ccc;padding:8px;text-align:left}
          .right{text-align:right}
          @media print{button{display:none}}
        </style>
      </head>
      <body>
        <h2>GENERAL STORE</h2>
        <div class="center">Sales Receipt</div>
        <hr>
        <p>Bill: ${safe(sale.billNumber)}</p>
        <p>Date: ${safe(sale.date)}</p>
        <p>Customer: ${safe(sale.customerName || "Walk-in Customer")}</p>
        <table>
          <thead><tr><th>Product</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>
            <tr>
              <td>${safe(sale.productName)}</td>
              <td>${money(sale.qty)} ${safe(sale.unit || "")}</td>
              <td>${money(sale.rate)}</td>
              <td>${money(sale.itemAmount)}</td>
            </tr>
          </tbody>
        </table>
        <p class="right">Discount: ${money(sale.discount)}</p>
        <h3 class="right">Total: ${money(sale.total)}</h3>
        <p class="right">Paid: ${money(sale.paidAmount)}</p>
        <p class="right">Balance: ${money(sale.balance)}</p>
        <p>Payment: ${safe(sale.paymentMethod || "-")}</p>
        <p>Note: ${safe(sale.note || "-")}</p>
        <p class="center">Thank you for shopping!</p>
        <div class="center"><button onclick="window.print()">Print Bill</button></div>
      </body>
      </html>
    `;

    const win = window.open("", "_blank");
    if (!win) return alert("Receipt खोल्न browser popup अनुमति दिनुहोस्।");
    win.document.write(receipt);
    win.document.close();
  }

  window.viewSaleBill = viewSaleBill;

  function saveSale(event) {
    event.preventDefault();

    const productId = els.product?.value;
    const product = getProduct(productId);

    if (!product) return alert("कृपया Product छान्नुहोस्।");

    const calc = calculate();

    if (!els.date?.value) return alert("Sale Date राख्नुहोस्।");
    if (calc.qty <= 0) return alert("Quantity शून्यभन्दा बढी हुनुपर्छ।");
    if (calc.rate <= 0) return alert("Sale Rate शून्यभन्दा बढी हुनुपर्छ।");
    if (calc.discount > calc.itemAmount) return alert("Discount रकम मिलाउनुहोस्।");
    if (calc.paid < 0 || calc.paid > calc.total) {
      return alert("Paid Amount मिलाउनुहोस्।");
    }
    if (calc.qty > num(product.stock)) {
      return alert(`पर्याप्त स्टक छैन। उपलब्ध: ${num(product.stock)}`);
    }

    let fifo;
    try {
      fifo = allocateFIFO(productId, calc.qty);
    } catch (error) {
      return alert(error.message);
    }

    const currentProducts = products();
    const productIndex = currentProducts.findIndex(
      p => String(p.id) === String(productId)
    );
    if (productIndex < 0) return alert("Product record भेटिएन।");

    const currentLots = lots();

    for (const allocation of fifo.allocations) {
      const lotIndex = currentLots.findIndex(
        l => String(l.id) === String(allocation.lotId)
      );
      if (lotIndex < 0) return alert("FIFO Lot परिवर्तन भएको छ। फेरि प्रयास गर्नुहोस्।");
      if (num(currentLots[lotIndex].remainingQty) + 0.000001 < allocation.qty) {
        return alert("FIFO Lot मा स्टक परिवर्तन भएको छ। फेरि प्रयास गर्नुहोस्।");
      }
    }

    for (const allocation of fifo.allocations) {
      const lot = currentLots.find(l => String(l.id) === String(allocation.lotId));
      lot.remainingQty = Math.max(0, num(lot.remainingQty) - allocation.qty);
    }

    const sale = {
      id: "SALE-" + Date.now() + "-" + Math.floor(Math.random() * 10000),
      date: els.date.value,
      billNumber: (els.bill?.value || "").trim() || generateBill(),
      customerName: (els.customer?.value || "").trim(),
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
      paymentMethod: els.payment?.value || "CASH",
      note: (els.note?.value || "").trim(),
      fifoAllocations: fifo.allocations,
      fifoCost: fifo.cost,
      profit: calc.total - fifo.cost,
      createdAt: new Date().toISOString()
    };

    const allSales = sales();
    allSales.push(sale);
    currentProducts[productIndex].stock =
      Math.max(0, num(currentProducts[productIndex].stock) - calc.qty);
    currentProducts[productIndex].salePrice = calc.rate;

    try {
      write(LOT_KEY, currentLots);
      write(PRODUCT_KEY, currentProducts);
      write(SALE_KEY, allSales);
    } catch (error) {
      alert("रेकर्ड सुरक्षित गर्न समस्या भयो। Storage उपलब्धता जाँच्नुहोस्।");
      return;
    }

    alert("Sale सफलतापूर्वक सुरक्षित भयो।");
    els.form.reset();

    if (els.date) els.date.value = today();
    if (els.bill) els.bill.value = generateBill();

    loadProducts();
    calculate();
    renderHistory();
    closeModal();
  }

  if (els.newBtn) {
    els.newBtn.addEventListener("click", openModal);
  }

  if (els.closeBtn) els.closeBtn.addEventListener("click", closeModal);
  if (els.cancelBtn) els.cancelBtn.addEventListener("click", closeModal);

  if (els.modal) {
    els.modal.addEventListener("click", function (event) {
      if (event.target === els.modal) closeModal();
    });
  }

  if (els.form) els.form.addEventListener("submit", saveSale);

  [els.product, els.qty, els.rate, els.discount, els.paid, els.payment]
    .filter(Boolean)
    .forEach(el => {
      el.addEventListener("input", updateProductInfo);
      el.addEventListener("change", updateProductInfo);
    });

  if (els.search) els.search.addEventListener("input", renderHistory);

  if (els.history) {
    els.history.addEventListener("click", function (event) {
      const button = event.target.closest("[data-sale-id]");
      if (button) viewSaleBill(button.dataset.saleId);
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeModal();
  });

  // पुरानो sidebar toggle भएमा त्यसलाई पनि चल्न दिन्छ।
  const sidebarToggle = $("menuToggle") || $("sidebarToggle");
  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", function () {
      document.body.classList.toggle("sidebar-open");
    });
  }

  if (els.date) els.date.value = today();
  if (els.bill) els.bill.value = generateBill();

  loadProducts();
  renderHistory();
  calculate();
  closeModal();
});
