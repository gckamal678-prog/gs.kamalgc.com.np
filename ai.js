
"use strict";

(() => {
  const $ = (id) => document.getElementById(id);

  const form = $("questionForm");
  const input = $("questionInput");
  const messages = $("messages");
  const chatArea = $("chatArea");
  const sendBtn = $("sendBtn");
  const statusText = $("statusText");
  const welcome = $("welcome");
  const newChatBtn = $("newChatBtn");

  const CHAT_KEY = "gs_ai_chat_history";

  const STORAGE_KEYS = {
    products: "gs_products",
    customers: "gs_customers",
    suppliers: "gs_suppliers",
    sales: "gs_sales",
    purchases: "gs_purchases",
    finance: "gs_finance",
    settings: "gs_settings"
  };

  // -------------------------------
  // Local storage helpers
  // -------------------------------

  function readStorage(key, fallback = []) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;

      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch (error) {
      console.warn("Storage पढ्न सकिएन:", key, error);
      return fallback;
    }
  }

  function toArray(value) {
    if (Array.isArray(value)) return value;

    if (value && typeof value === "object") {
      if (Array.isArray(value.data)) return value.data;
      if (Array.isArray(value.items)) return value.items;
      if (Array.isArray(value.records)) return value.records;
    }

    return [];
  }

  function getData() {
    return {
      products: toArray(readStorage(STORAGE_KEYS.products)),
      customers: toArray(readStorage(STORAGE_KEYS.customers)),
      suppliers: toArray(readStorage(STORAGE_KEYS.suppliers)),
      sales: toArray(readStorage(STORAGE_KEYS.sales)),
      purchases: toArray(readStorage(STORAGE_KEYS.purchases)),
      finance: readStorage(STORAGE_KEYS.finance, []),
      settings: readStorage(STORAGE_KEYS.settings, {})
    };
  }

  function firstValue(obj, keys, fallback = undefined) {
    if (!obj || typeof obj !== "object") return fallback;

    for (const key of keys) {
      const value = obj[key];

      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        return value;
      }
    }

    return fallback;
  }

  function numberValue(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === "string") {
      const cleaned = value.replace(/,/g, "").replace(/[^\d.-]/g, "");
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  function productName(product) {
    return String(firstValue(
      product,
      ["name", "productName", "itemName", "title", "नाम", "सामान"],
      "नाम नभएको सामान"
    ));
  }

  function productStock(product) {
    return numberValue(firstValue(
      product,
      ["stock", "quantity", "qty", "currentStock", "availableStock", "मौज्दात", "परिमाण"],
      0
    ));
  }

  function productMinStock(product) {
    return numberValue(firstValue(
      product,
      ["minStock", "minimumStock", "lowStock", "reorderLevel", "alertStock"],
      5
    ));
  }

  function money(value) {
    const amount = numberValue(value);

    return "रु. " + new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 2
    }).format(amount);
  }

  function sumBy(records, keys) {
    return records.reduce((sum, record) => {
      return sum + numberValue(firstValue(record, keys, 0));
    }, 0);
  }

  function saleTotal(sale) {
    const direct = firstValue(sale, [
      "total", "grandTotal", "totalAmount", "amount",
      "netTotal", "billTotal", "कुल", "जम्मा"
    ]);

    if (direct !== undefined) return numberValue(direct);

    const items = Array.isArray(sale.items) ? sale.items : [];
    return items.reduce((sum, item) => {
      const quantity = numberValue(firstValue(
        item, ["quantity", "qty", "count", "परिमाण"], 1
      ));

      const price = numberValue(firstValue(
        item, ["price", "sellingPrice", "rate", "unitPrice", "दर"], 0
      ));

      const total = firstValue(item, ["total", "amount", "lineTotal"]);
      return sum + (
        total !== undefined
          ? numberValue(total)
          : quantity * price
      );
    }, 0);
  }

  function recordDate(record) {
    return firstValue(record, [
      "date", "createdAt", "created_at", "saleDate",
      "purchaseDate", "transactionDate", "timestamp", "मिति"
    ], "");
  }

  function isToday(record) {
    const raw = recordDate(record);
    if (!raw) return false;

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return false;

    const now = new Date();

    return date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
  }

  function customerName(customer) {
    return String(firstValue(
      customer,
      ["name", "customerName", "fullName", "नाम"],
      "नाम नभएको ग्राहक"
    ));
  }

  function customerDue(customer) {
    return numberValue(firstValue(customer, [
      "due", "dueAmount", "balanceDue", "remaining",
      "credit", "outstanding", "बाकी", "उधारो"
    ], 0));
  }

  function supplierName(supplier) {
    return String(firstValue(
      supplier,
      ["name", "supplierName", "companyName", "नाम"],
      "नाम नभएको सप्लायर"
    ));
  }

  // -------------------------------
  // Store analysis
  // -------------------------------

  function getLowStock(products) {
    return products.filter((product) => {
      const stock = productStock(product);
      const min = productMinStock(product);
      return stock <= min;
    });
  }

  function getDueCustomers(customers) {
    return customers.filter((customer) => customerDue(customer) > 0);
  }

  function getSummary(data) {
    const todaySales = data.sales.filter(isToday);
    const todayPurchases = data.purchases.filter(isToday);

    const todaySalesTotal = todaySales.reduce(
      (sum, sale) => sum + saleTotal(sale), 0
    );

    const todayPurchasesTotal = todayPurchases.reduce(
      (sum, purchase) => sum + saleTotal(purchase), 0
    );

    const lowStock = getLowStock(data.products);
    const dueCustomers = getDueCustomers(data.customers);
    const totalDue = dueCustomers.reduce(
      (sum, customer) => sum + customerDue(customer), 0
    );

    return {
      productCount: data.products.length,
      customerCount: data.customers.length,
      supplierCount: data.suppliers.length,
      salesCount: data.sales.length,
      todaySalesCount: todaySales.length,
      todaySalesTotal,
      todayPurchasesTotal,
      lowStock,
      dueCustomers,
      totalDue
    };
  }

  function reportText(data) {
    const s = getSummary(data);

    return [
      "तपाईंको पसलको उपलब्ध डाटाको छोटो रिपोर्ट:",
      "",
      "📦 जम्मा सामान: " + s.productCount,
      "👥 जम्मा ग्राहक: " + s.customerCount,
      "🏭 जम्मा सप्लायर: " + s.supplierCount,
      "🧾 जम्मा बिक्री रेकर्ड: " + s.salesCount,
      "",
      "💰 आजको बिक्री: " + money(s.todaySalesTotal),
      "📈 आजका बिक्री बिल: " + s.todaySalesCount,
      "🛒 आजको खरिद: " + money(s.todayPurchasesTotal),
      "⚠️ कम स्टक भएका सामान: " + s.lowStock.length,
      "📒 उधारो बाँकी भएका ग्राहक: " + s.dueCustomers.length,
      "💳 ग्राहकबाट उठाउन बाँकी: " + money(s.totalDue),
      "",
      "नोट: यो रिपोर्ट localStorage मा भेटिएको डाटामा आधारित छ।"
    ].join("\n");
  }

  function lowStockText(data) {
    const items = getLowStock(data.products);

    if (!items.length) {
      return data.products.length
        ? "राम्रो खबर! निर्धारित सीमाअनुसार कम स्टक भएको सामान भेटिएन।\n\nसामानको न्यूनतम स्टक सीमा सही सेट गरिएको छ कि छैन पनि जाँच्नुहोस्।"
        : "अहिले सामानको सूची खाली छ वा डाटा भेटिएन। पहिले सामान थप्नुहोस्।";
    }

    const lines = items.map((product, index) => {
      return (index + 1) + ". " + productName(product) +
        " — मौज्दात: " + productStock(product) +
        " (न्यूनतम सीमा: " + productMinStock(product) + ")";
    });

    return "⚠️ कम स्टक भएका सामान:\n\n" +
      lines.join("\n") +
      "\n\nयी सामानको मौज्दात जाँच गरी आवश्यक परे खरिद गर्नुहोस्।";
  }

  function dueText(data) {
    const customers = getDueCustomers(data.customers);

    if (!customers.length) {
      return data.customers.length
        ? "ग्राहकको डाटामा बाँकी उधारो रकम भेटिएन।"
        : "ग्राहकको सूची खाली छ वा डाटा भेटिएन।";
    }

    const sorted = [...customers].sort(
      (a, b) => customerDue(b) - customerDue(a)
    );

    const lines = sorted.map((customer, index) => {
      return (index + 1) + ". " + customerName(customer) +
        " — " + money(customerDue(customer));
    });

    const total = sorted.reduce(
      (sum, customer) => sum + customerDue(customer), 0
    );

    return "📒 उधारो बाँकी भएका ग्राहक:\n\n" +
      lines.join("\n") +
      "\n\nजम्मा उठाउन बाँकी: " + money(total);
  }

  function salesText(data, question) {
    const q = question.toLowerCase();
    const todayRequested =
      q.includes("आज") ||
      q.includes("today") ||
      q.includes("आजको");

    const sales = todayRequested
      ? data.sales.filter(isToday)
      : data.sales;

    if (!sales.length) {
      return todayRequested
        ? "आजको मितिमा बिक्री रेकर्ड भेटिएन। बिक्रीको मिति रेकर्डमा सही छ कि छैन जाँच्नुहोस्।"
        : "बिक्रीको रेकर्ड भेटिएन।";
    }

    const total = sales.reduce(
      (sum, sale) => sum + saleTotal(sale), 0
    );

    const paid = sumBy(sales, [
      "paid", "paidAmount", "amountPaid", "received", "जम्मा भुक्तानी"
    ]);

    const due = sumBy(sales, [
      "due", "dueAmount", "remaining", "balance", "बाकी"
    ]);

    const lines = [
      todayRequested ? "आजको बिक्री विवरण:" : "सबै बिक्रीको उपलब्ध विवरण:",
      "",
      "🧾 बिक्री बिल: " + sales.length,
      "💰 बिक्रीको जम्मा रकम: " + money(total)
    ];

    if (sales.some(s => firstValue(s, [
      "paid", "paidAmount", "amountPaid", "received", "जम्मा भुक्तानी"
    ]) !== undefined)) {
      lines.push("✅ भुक्तानी भएको रकम: " + money(paid));
    }

    if (sales.some(s => firstValue(s, [
      "due", "dueAmount", "remaining", "balance", "बाकी"
    ]) !== undefined)) {
      lines.push("📒 बिक्रीमा बाँकी रकम: " + money(due));
    }

    lines.push("", "नोट: रकम तपाईंको बिक्री रेकर्डमा उपलब्ध फिल्डअनुसार गणना गरिएको हो।");

    return lines.join("\n");
  }

  function productSalesText(data, question) {
    const q = question.toLowerCase();
    const totals = new Map();

    data.sales.forEach((sale) => {
      const items = Array.isArray(sale.items) ? sale.items : [];

      items.forEach((item) => {
        const name = String(firstValue(
          item,
          ["name", "productName", "itemName", "title"],
          "नाम नभएको सामान"
        ));

        const quantity = numberValue(firstValue(
          item, ["quantity", "qty", "count"], 0
        ));

        const amount = firstValue(item, ["total", "amount", "lineTotal"]);
        const price = numberValue(firstValue(
          item, ["price", "sellingPrice", "rate", "unitPrice"], 0
        ));

        const previous = totals.get(name) || { quantity: 0, amount: 0 };

        previous.quantity += quantity;
        previous.amount += amount !== undefined
          ? numberValue(amount)
          : quantity * price;

        totals.set(name, previous);
      });
    });

    if (!totals.size) {
      return "बिक्रीका सामानको विस्तृत सूची भेटिएन। तपाईंको बिक्री रेकर्डमा प्रत्येक बिलको items सूची हुनुपर्छ।";
    }

    const sorted = [...totals.entries()].sort((a, b) => {
      if (q.includes("बढी") || q.includes("धेरै") || q.includes("best")) {
        return b[1].quantity - a[1].quantity;
      }
      return b[1].amount - a[1].amount;
    });

    return "बिक्री भएका सामानको उपलब्ध विवरण:\n\n" +
      sorted.slice(0, 10).map(([name, info], index) =>
        (index + 1) + ". " + name +
        "\n   परिमाण: " + info.quantity +
        " · रकम: " + money(info.amount)
      ).join("\n\n");
  }

  function expenseText(data) {
    const finance = toArray(data.finance);

    if (!finance.length) {
      return "खर्चको छुट्टै रेकर्ड भेटिएन। तपाईंको finance डाटा फरक संरचनामा छ भने त्यसअनुसार कोड मिलाउनुपर्ने हुन सक्छ।";
    }

    const expenses = finance.filter((entry) => {
      const type = String(firstValue(
        entry, ["type", "category", "transactionType", "kind"], ""
      )).toLowerCase();

      return type.includes("expense") ||
        type.includes("खर्च") ||
        type.includes("व्यय");
    });

    if (!expenses.length) {
      return "finance रेकर्ड भेटियो, तर खर्च भनेर चिनिने रेकर्ड फेला परेन।";
    }

    const total = sumBy(expenses, [
      "amount", "total", "value", "रकम"
    ]);

    return "खर्चको उपलब्ध विवरण:\n\n" +
      "🧾 खर्चका रेकर्ड: " + expenses.length +
      "\n💸 जम्मा खर्च: " + money(total);
  }

  // -------------------------------
  // Question understanding
  // -------------------------------

  function answerQuestion(question) {
    const data = getData();
    const q = question.toLowerCase().replace(/\s+/g, " ").trim();

    if (!q) {
      return "कृपया आफ्नो प्रश्न लेख्नुहोस्।";
    }

    if (
      q.includes("स्टक") ||
      q.includes("मौज्दात") ||
      q.includes("कम सामान") ||
      q.includes("सामान कम") ||
      q.includes("stock") ||
      q.includes("reorder")
    ) {
      return lowStockText(data);
    }

    if (
      q.includes("उधारो") ||
      q.includes("बाँकी") ||
      q.includes("बाकी") ||
      q.includes("due") ||
      q.includes("कसको पैसा") ||
      q.includes("उठाउन")
    ) {
      return dueText(data);
    }

    if (
      q.includes("बिक्री") ||
      q.includes("सेल") ||
      q.includes("sales") ||
      q.includes("बेचेको")
    ) {
      if (
        q.includes("सामान") ||
        q.includes("प्रोडक्ट") ||
        q.includes("product") ||
        q.includes("धेरै बिक") ||
        q.includes("बढी बिक")
      ) {
        return productSalesText(data, q);
      }

      return salesText(data, q);
    }

    if (
      q.includes("खर्च") ||
      q.includes("expense") ||
      q.includes("व्यय")
    ) {
      return expenseText(data);
    }

    if (
      q.includes("रिपोर्ट") ||
      q.includes("report") ||
      q.includes("सारांश") ||
      q.includes("summary") ||
      q.includes("पसल कस्तो") ||
      q.includes("सबै विवरण")
    ) {
      return reportText(data);
    }

    if (
      q.includes("ग्राहक") ||
      q.includes("customer")
    ) {
      return "ग्राहकको जम्मा रेकर्ड: " + data.customers.length +
        "\n\nउधारो भएका ग्राहक हेर्न “कसकसको उधारो बाँकी छ?” भनेर सोध्नुहोस्।";
    }

    if (
      q.includes("सप्लायर") ||
      q.includes("supplier") ||
      q.includes("आपूर्तिकर्ता")
    ) {
      if (!data.suppliers.length) {
        return "सप्लायरको सूची खाली छ वा डाटा भेटिएन।";
      }

      return "सप्लायरको सूचीमा जम्मा " + data.suppliers.length +
        " रेकर्ड छन्:\n\n" +
        data.suppliers.slice(0, 20).map((supplier, index) =>
          (index + 1) + ". " + supplierName(supplier)
        ).join("\n");
    }

    if (
      q.includes("सामान") ||
      q.includes("प्रोडक्ट") ||
      q.includes("product") ||
      q.includes("inventory")
    ) {
      if (!data.products.length) {
        return "सामानको सूची खाली छ वा डाटा भेटिएन।";
      }

      return "तपाईंको पसलमा " + data.products.length +
        " प्रकारका सामानको रेकर्ड छ:\n\n" +
        data.products.slice(0, 20).map((product, index) =>
          (index + 1) + ". " + productName(product) +
          " — मौज्दात: " + productStock(product)
        ).join("\n") +
        (data.products.length > 20 ? "\n\nअन्य सामान पनि सूचीमा छन्।" : "");
    }

    if (
      q.includes("नाफा") ||
      q.includes("profit") ||
      q.includes("कमाइ")
    ) {
      return "नाफा सही रूपमा निकाल्न प्रत्येक बिक्रीको रकमसँगै सामानको खरिद लागत, छुट, फिर्ता र खर्चको विवरण चाहिन्छ।\n\nहालको बिक्री रकमलाई नै नाफा भन्न मिल्दैन। तपाईंको बिक्री र खरिद डाटाको संरचना मिलाएपछि वास्तविक नाफा निकाल्न सकिन्छ।";
    }

    if (
      q.includes("नमस्कार") ||
      q.includes("hello") ||
      q.includes("नमस्ते") ||
      q.includes("hi")
    ) {
      return "नमस्कार! 👋\n\nतपाईंको पसलको काममा म सहयोग गर्न तयार छु। स्टक, बिक्री, उधारो, खर्च वा पसलको रिपोर्टबारे सोध्नुहोस्।";
    }

    return "तपाईंको प्रश्न बुझ्ने प्रयास गरेँ, तर यस प्रश्नका लागि अहिले छुट्टै विश्लेषण उपलब्ध छैन।\n\nयीमध्ये कुनै प्रश्न सोधेर हेर्नुहोस्:\n\n• अहिले कुन सामानको स्टक कम छ?\n• आजको बिक्री कति भयो?\n• कसकसको उधारो बाँकी छ?\n• मेरो पसलको छोटो रिपोर्ट दिनुहोस्।\n• कुन सामान धेरै बिक्री भयो?\n\nनोट: यो संस्करणले पसलको स्थानीय डाटा र पहिल्यै बनाइएका नियमअनुसार उत्तर दिन्छ।";
  }

  // -------------------------------
  // Chat display
  // -------------------------------

  function scrollToBottom() {
    requestAnimationFrame(() => {
      chatArea.scrollTop = chatArea.scrollHeight;
    });
  }

  function showWelcome(show) {
    if (welcome) welcome.style.display = show ? "" : "none";
  }

  function addMessage(role, text, save = true) {
    showWelcome(false);

    const wrapper = document.createElement("div");
    wrapper.className = "message " + role;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = role === "user" ? "👤" : "✦";

    const body = document.createElement("div");
    body.className = "message-body";

    const name = document.createElement("div");
    name.className = "message-name";
    name.textContent = role === "user" ? "तपाईं" : "AI Assistant";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = text;

    body.appendChild(name);
    body.appendChild(bubble);

    if (role === "assistant") {
      const tools = document.createElement("div");
      tools.className = "message-tools";

      const copyBtn = document.createElement("button");
      copyBtn.className = "small-btn";
      copyBtn.type = "button";
      copyBtn.textContent = "⧉ उत्तर कपी गर्नुहोस्";

      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(text);
          copyBtn.textContent = "✓ कपी भयो";
        } catch (error) {
          const temp = document.createElement("textarea");
          temp.value = text;
          document.body.appendChild(temp);
          temp.select();

          try {
            document.execCommand("copy");
            copyBtn.textContent = "✓ कपी भयो";
          } catch (_) {
            copyBtn.textContent = "कपी गर्न सकिएन";
          }

          temp.remove();
        }
      });

      tools.appendChild(copyBtn);
      body.appendChild(tools);
    }

    wrapper.appendChild(avatar);
    wrapper.appendChild(body);
    messages.appendChild(wrapper);

    if (save) saveHistory();
    scrollToBottom();
  }

  function showTyping() {
    const wrapper = document.createElement("div");
    wrapper.className = "message assistant";
    wrapper.id = "typingMessage";

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = "✦";

    const body = document.createElement("div");
    body.className = "message-body";

    const name = document.createElement("div");
    name.className = "message-name";
    name.textContent = "AI Assistant";

    const dots = document.createElement("div");
    dots.className = "typing";
    dots.innerHTML = "<span></span><span></span><span></span>";

    body.appendChild(name);
    body.appendChild(dots);
    wrapper.appendChild(avatar);
    wrapper.appendChild(body);
    messages.appendChild(wrapper);

    statusText.classList.add("show");
    scrollToBottom();
  }

  function removeTyping() {
    const typing = $("typingMessage");
    if (typing) typing.remove();

    statusText.classList.remove("show");
  }

  function saveHistory() {
    try {
      const history = [];

      messages.querySelectorAll(".message").forEach((message) => {
        if (message.id === "typingMessage") return;

        const role = message.classList.contains("user")
          ? "user"
          : "assistant";

        const bubble = message.querySelector(".bubble");
        if (bubble) {
          history.push({
            role,
            text: bubble.textContent || ""
          });
        }
      });

      localStorage.setItem(CHAT_KEY, JSON.stringify(history));
    } catch (error) {
      console.warn("च्याट सुरक्षित गर्न सकिएन:", error);
    }
  }

  function loadHistory() {
    const history = readStorage(CHAT_KEY, []);

    if (!Array.isArray(history) || history.length === 0) {
      showWelcome(true);
      return;
    }

    showWelcome(false);

    history.forEach((message) => {
      if (
        message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.text === "string"
      ) {
        addMessage(message.role, message.text, false);
      }
    });

    scrollToBottom();
  }

  // -------------------------------
  // Send questions
  // -------------------------------

  let isSending = false;

  function resizeInput() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 160) + "px";
  }

  function sendQuestion(question) {
    const text = String(question || "").trim();

    if (!text || isSending) return;

    isSending = true;
    sendBtn.disabled = true;

    addMessage("user", text);
    input.value = "";
    resizeInput();

    showTyping();

    // स्थानीय डाटाको विश्लेषणका लागि छोटो प्रतीक्षा
    window.setTimeout(() => {
      try {
        const answer = answerQuestion(text);
        removeTyping();
        addMessage("assistant", answer);
      } catch (error) {
        console.error("AI उत्तर त्रुटि:", error);
        removeTyping();

        addMessage(
          "assistant",
          "उत्तर तयार गर्दा समस्या आयो। कृपया डाटाको संरचना जाँच गरी फेरि प्रयास गर्नुहोस्।"
        );
      } finally {
        isSending = false;
        sendBtn.disabled = false;
        input.focus();
      }
    }, 250);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendQuestion(input.value);
  });

  input.addEventListener("input", resizeInput);

  input.addEventListener("keydown", (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.isComposing
    ) {
      event.preventDefault();
      sendQuestion(input.value);
    }
  });

  document.querySelectorAll("[data-question]").forEach((button) => {
    button.addEventListener("click", () => {
      sendQuestion(button.getAttribute("data-question"));
    });
  });

  newChatBtn.addEventListener("click", () => {
    const hasMessages = messages.querySelector(".message");

    if (
      hasMessages &&
      !window.confirm("यो च्याट मेटाएर नयाँ च्याट सुरु गर्ने?")
    ) {
      return;
    }

    messages.querySelectorAll(".message").forEach((message) => message.remove());

    try {
      localStorage.removeItem(CHAT_KEY);
    } catch (error) {
      console.warn("पुरानो च्याट मेटाउन सकिएन:", error);
    }

    showWelcome(true);
    input.value = "";
    resizeInput();
    input.focus();
  });

  // अर्को ट्याबमा पसलको डाटा परिवर्तन भएमा नयाँ प्रश्नमा अद्यावधिक डाटा पढिन्छ।
  window.addEventListener("storage", () => {
    // answerQuestion() ले प्रत्येक प्रश्नमा ताजा डाटा पढ्छ।
  });

  loadHistory();
  input.focus();
})();
