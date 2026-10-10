
/* =========================================================
   GENERAL STORE MANAGEMENT SYSTEM
   Dashboard - localStorage edition
   Existing storage keys preserved for future API integration
   ========================================================= */

(() => {
  "use strict";

  const KEYS = {
    sales: "gs_sales",
    products: "gs_products",
    lots: "gs_stock_lots",
    purchases: "gs_purchases",
    finance: "gs_finance",
    customers: "gs_customers",
    suppliers: "gs_suppliers",
    returns: "gs_sales_returns"
  };

  const $ = id => document.getElementById(id);

  const number = value => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  function read(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (error) {
      console.error("Dashboard storage error:", key, error);
      return [];
    }
  }

  function money(value) {
    return number(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function text(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function localDate(date = new Date()) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function dateOf(record) {
    return String(record?.date || record?.createdAt || "").slice(0, 10);
  }

  function todayRecords(records) {
    const today = localDate();
    return records.filter(record => dateOf(record) === today);
  }

  function validSales() {
    return read(KEYS.sales).filter(s => !s.voided && !s.isVoid);
  }

  function validPurchases() {
    return read(KEYS.purchases).filter(p => !p.voided && !p.isVoid);
  }

  function activeProducts() {
    return read(KEYS.products).filter(p =>
      p.active !== false && p.status !== "INACTIVE"
    );
  }

  function getProfit(sale) {
    if (sale.profit !== undefined && sale.profit !== null) {
      return number(sale.profit);
    }

    if (sale.fifoCost !== undefined && sale.fifoCost !== null) {
      return number(sale.total) - number(sale.fifoCost);
    }

    return 0;
  }

  /* MOBILE SIDEBAR */

  const sidebar = $("sidebar");
  const overlay = $("overlay");
  const menuBtn = $("menuBtn");

  function closeSidebar() {
    sidebar?.classList.remove("open");
    overlay?.classList.remove("show");
  }

  menuBtn?.addEventListener("click", () => {
    sidebar?.classList.toggle("open");
    overlay?.classList.toggle("show");
  });

  overlay?.addEventListener("click", closeSidebar);

  document.querySelectorAll(".menu-item").forEach(link => {
    link.addEventListener("click", closeSidebar);
  });

  /* DATE */

  function renderDate() {
    const el = $("todayDate");
    if (!el) return;

    el.textContent = new Date().toLocaleDateString("ne-NP", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  /* SALES CHART */

  function renderChart() {
    const area = $("salesChart");
    if (!area) return;

    const days = Math.max(1, Math.min(30, number($("salesPeriod")?.value) || 7));
    const sales = validSales();
    const now = new Date();
    const items = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = localDate(d);
      const amount = sales
        .filter(s => dateOf(s) === key)
        .reduce((sum, s) => sum + number(s.total), 0);

      items.push({
        key,
        label: d.toLocaleDateString("en", { day: "numeric", month: "short" }),
        amount
      });
    }

    const max = Math.max(...items.map(x => x.amount), 1);

    area.innerHTML = `
      <div style="display:flex;align-items:flex-end;gap:8px;height:190px;padding:12px 4px 4px;">
        ${items.map(item => {
          const height = item.amount > 0
            ? Math.max(5, item.amount / max * 135)
            : 3;

          return `
            <div title="${escapeHTML(item.key)}: Rs. ${money(item.amount)}"
                 style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:7px;">
              <span style="font-size:10px;overflow-wrap:anywhere;text-align:center;color:var(--dash-muted,#64748b)">
                ${item.amount ? escapeHTML(money(item.amount)) : ""}
              </span>
              <div style="width:min(100%,30px);height:${height}px;background:var(--primary,#2563eb);border-radius:5px 5px 0 0;"></div>
              <span style="font-size:10px;color:var(--dash-muted,#64748b);white-space:nowrap">${escapeHTML(item.label)}</span>
            </div>`;
        }).join("")}
      </div>
      <div style="text-align:center;font-size:12px;color:var(--dash-muted,#64748b);margin-top:8px">
        कुल बिक्री: Rs. ${money(items.reduce((sum, x) => sum + x.amount, 0))}
      </div>
    `;
  }

  /* FAST MOVING PRODUCTS */

  function renderFastMoving() {
    const area = $("fastMovingArea");
    if (!area) return;

    const totals = new Map();

    validSales().forEach(sale => {
      const id = String(sale.productId || sale.productName || "unknown");
      const previous = totals.get(id) || {
        name: sale.productName || "Unknown product",
        qty: 0,
        amount: 0
      };

      previous.qty += number(sale.qty);
      previous.amount += number(sale.total);
      totals.set(id, previous);
    });

    const rows = [...totals.values()]
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    if (!rows.length) {
      area.innerHTML = '<p style="padding:16px">अहिलेसम्म बिक्री रेकर्ड छैन।</p>';
      return;
    }

    area.innerHTML = `
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left;padding:10px">Product</th>
          <th style="text-align:right;padding:10px">Qty Sold</th>
          <th style="text-align:right;padding:10px">Sales</th>
        </tr></thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td style="padding:10px">${escapeHTML(row.name)}</td>
              <td style="padding:10px;text-align:right">${money(row.qty)}</td>
              <td style="padding:10px;text-align:right">Rs. ${money(row.amount)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>`;
  }

  /* RECENT ACTIVITY */

  function renderRecentActivity() {
    const area = $("recentActivityArea");
    if (!area) return;

    const entries = [
      ...validSales().map(s => ({
        date: dateOf(s),
        createdAt: s.createdAt || s.date,
        type: "Sale",
        name: s.productName || s.customerName || s.billNumber || "बिक्री",
        amount: number(s.total),
        status: number(s.balance) > 0 ? "बाँकी" : "भुक्तानी"
      })),
      ...validPurchases().map(p => ({
        date: dateOf(p),
        createdAt: p.createdAt || p.date,
        type: "Purchase",
        name: p.supplierName || p.supplier || p.billNumber || "खरिद",
        amount: number(p.total),
        status: number(p.balance) > 0 ? "तिर्न बाँकी" : "भुक्तानी"
      })),
      ...read(KEYS.finance).map(f => ({
        date: dateOf(f),
        createdAt: f.createdAt || f.date,
        type: f.type || "Finance",
        name: f.category || f.description || f.note || "Finance",
        amount: number(f.amount),
        status: "रेकर्ड"
      }))
    ].sort((a, b) =>
      String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date))
    ).slice(0, 8);

    if (!entries.length) {
      area.innerHTML = '<p style="padding:16px">अहिलेसम्म कारोबारको रेकर्ड छैन।</p>';
      return;
    }

    area.innerHTML = `
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left;padding:10px">Date</th>
          <th style="text-align:left;padding:10px">Type / Details</th>
          <th style="text-align:right;padding:10px">Amount</th>
        </tr></thead>
        <tbody>
          ${entries.map(item => `
            <tr>
              <td style="padding:10px;white-space:nowrap">${escapeHTML(item.date || "-")}</td>
              <td style="padding:10px">
                <strong>${escapeHTML(item.type)}</strong>
                <div>${escapeHTML(item.name)}</div>
                <small>${escapeHTML(item.status)}</small>
              </td>
              <td style="padding:10px;text-align:right;white-space:nowrap">Rs. ${money(item.amount)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>`;
  }

  /* MAIN DASHBOARD TOTALS */

  function renderDashboard() {
    const sales = validSales();
    const purchases = validPurchases();
    const products = activeProducts();
    const lots = read(KEYS.lots);
    const finance = read(KEYS.finance);
    const customers = read(KEYS.customers);
    const suppliers = read(KEYS.suppliers);
    const returns = read(KEYS.returns);

    const todaySales = todayRecords(sales);
    const todayFinance = todayRecords(finance);

    const todayGross = todaySales.reduce((sum, s) => sum + number(s.total), 0);
    const grossProfit = todaySales.reduce((sum, s) => sum + getProfit(s), 0);

    const todayExpenses = todayFinance
      .filter(f => {
        const type = String(f.type || "").toUpperCase();
        const category = String(f.category || "").toUpperCase();
        return type === "EXPENSE" ||
          category === "EXPENSE" ||
          category === "SHOP_EXPENSE";
      })
      .reduce((sum, f) => sum + number(f.amount), 0);

    text("todaySales", money(todayGross));
    text("grossProfit", money(grossProfit));
    text("expenses", money(todayExpenses));
    text("netProfit", money(grossProfit - todayExpenses));
    text("salesChange", `${todaySales.length} bills`);

    const receivable = sales.reduce((sum, s) => sum + Math.max(0, number(s.balance)), 0);
    text("customerReceivable", money(receivable));

    const payable = suppliers.reduce((sum, s) => {
      if (s.currentBalance !== undefined && s.currentBalance !== null) {
        return sum + Math.max(0, number(s.currentBalance));
      }
      const opening = s.balanceType === "ADVANCE"
        ? -Math.abs(number(s.openingBalance))
        : Math.abs(number(s.openingBalance));
      return sum + Math.max(0,
        opening + number(s.purchaseTotal) - number(s.paymentTotal) - number(s.returnTotal)
      );
    }, 0);

    text("supplierPayable", money(payable));

    let stockValue = 0;
    if (lots.length) {
      stockValue = lots.reduce((sum, lot) =>
        sum + Math.max(0, number(lot.remainingQty)) * number(lot.effectiveCost), 0);
    } else {
      stockValue = products.reduce((sum, p) =>
        sum + Math.max(0, number(p.stock)) * number(p.purchasePrice), 0);
    }
    text("stockValue", money(stockValue));

    // Finance balance: calculate only when entries have recognizable types.
    let balance = 0;
    finance.forEach(f => {
      const type = String(f.type || "").toUpperCase();
      const amount = number(f.amount);
      if (["INCOME", "RECEIPT", "CUSTOMER_PAYMENT", "SALE_RECEIPT"].includes(type)) {
        balance += amount;
      } else if (["EXPENSE", "PAYMENT", "PURCHASE_PAYMENT", "SUPPLIER_PAYMENT"].includes(type)) {
        balance -= amount;
      }
    });
    text("availableBalance", money(balance));

    const lowStock = products.filter(p =>
      number(p.stock) <= number(p.minStock)
    );
    text("lowStockCount", `${lowStock.length} products`);

    const expiryLimit = new Date();
    expiryLimit.setDate(expiryLimit.getDate() + 30);
    const today = localDate();

    const expiringLots = lots.filter(lot => {
      const expiry = String(lot.expiryDate || lot.expiry || "").slice(0, 10);
      return expiry &&
        expiry >= today &&
        expiry <= localDate(expiryLimit) &&
        number(lot.remainingQty) > 0;
    });

    const expiringProducts = products.filter(p => {
      const expiry = String(p.expiryDate || p.expiry || "").slice(0, 10);
      return expiry && expiry >= today && expiry <= localDate(expiryLimit);
    });

    text("expiryCount", `${new Set([
      ...expiringLots.map(l => String(l.productId)),
      ...expiringProducts.map(p => String(p.id))
    ]).size} products`);

    const dueCustomers = new Set(
      sales.filter(s => number(s.balance) > 0)
        .map(s => String(s.customerId || s.customerName || "walk-in"))
    );
    text("creditDueCount", `${dueCustomers.size} customers`);

    text("supplierDueCount",
      `${suppliers.filter(s => number(s.currentBalance) > 0 ||
        (s.currentBalance == null && number(s.openingBalance) > 0)).length} suppliers`
    );

    renderChart();
    renderFastMoving();
    renderRecentActivity();
  }

  /* SEARCH */

  function setupSearch() {
    const input = $("searchInput");
    if (!input) return;

    input.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;

      const query = input.value.trim().toLowerCase();
      if (!query) return;

      const sales = validSales();
      const products = read(KEYS.products);
      const customers = read(KEYS.customers);
      const suppliers = read(KEYS.suppliers);

      const product = products.find(p =>
        String(p.name || "").toLowerCase().includes(query) ||
        String(p.id || "").toLowerCase().includes(query)
      );

      const sale = sales.find(s =>
        [s.billNumber, s.customerName, s.productName, s.date]
          .some(value => String(value || "").toLowerCase().includes(query))
      );

      const customer = customers.find(c =>
        [c.name, c.phone].some(value => String(value || "").toLowerCase().includes(query))
      );

      const supplier = suppliers.find(s =>
        [s.name, s.phone].some(value => String(value || "").toLowerCase().includes(query))
      );

      if (product) {
        alert(`Product: ${product.name}\nStock: ${number(product.stock)} ${product.unit || ""}`);
      } else if (sale) {
        alert(`Bill: ${sale.billNumber || "-"}\nDate: ${sale.date || "-"}\nProduct: ${sale.productName || "-"}\nTotal: Rs. ${money(sale.total)}\nPaid: Rs. ${money(sale.paidAmount)}\nBalance: Rs. ${money(sale.balance)}`);
      } else if (customer) {
        alert(`Customer: ${customer.name}\nPhone: ${customer.phone || "-"}`);
      } else if (supplier) {
        alert(`Supplier: ${supplier.name}\nPhone: ${supplier.phone || "-"}`);
      } else {
        alert("मिल्दो Product, Bill, Customer वा Supplier भेटिएन।");
      }
    });
  }

  /* THEME BUTTON: use existing appearance settings */

  $("themeBtn")?.addEventListener("click", () => {
    const root = document.documentElement;
    const current = root.getAttribute("data-theme") ||
      localStorage.getItem("gs_theme") || "light";
    const next = current === "dark" ? "light" : "dark";

    root.setAttribute("data-theme", next);

    try {
      const saved = JSON.parse(localStorage.getItem("gs_settings") || "{}");
      saved.appearance = saved.appearance || {};
      saved.appearance.theme = next;
      localStorage.setItem("gs_settings", JSON.stringify(saved));
    } catch (error) {
      console.warn("Theme preference was not saved:", error);
    }

    const btn = $("themeBtn");
    if (btn) btn.textContent = next === "dark" ? "☀️" : "🌙";
  });

  /* LOCK BUTTON - visual lock only, not security protection */

  $("lockBtn")?.addEventListener("click", () => {
    alert("सुरक्षित MPIN lock सुविधा छुट्टै authentication बनाएपछि मात्र उपलब्ध हुनेछ।");
  });

  /* REFRESH WHEN DATA CHANGES IN ANOTHER TAB */

  window.addEventListener("storage", event => {
    if (!event.key || Object.values(KEYS).includes(event.key)) {
      renderDashboard();
    }
  });

  $("salesPeriod")?.addEventListener("change", renderChart);

  function init() {
    renderDate();
    setupSearch();
    renderDashboard();

    const theme = document.documentElement.getAttribute("data-theme") || "light";
    const btn = $("themeBtn");
    if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Allow manual refresh after another module saves data.
  window.refreshDashboard = renderDashboard;

  console.log("Dashboard connected to existing localStorage keys.");
})();
