
"use strict";

(() => {
  const SETTINGS_KEY = "gs_settings";
  const MPIN_KEY = "gs_mpin_security";
  const FEEDBACK_KEY = "gs_feedback";
  const LAST_BACKUP_KEY = "gs_last_backup";

  // Keep all existing business data keys.
  // Do not rename these keys: existing browser data depends on them.
  const STORE_DATA_KEYS = [
    "gs_products",
    "gs_purchases",
    "gs_sales",
    "gs_customers",
    "gs_suppliers",
    "gs_finance",
    "gs_stock_lots",
    "gs_sales_returns"
  ];

  const DEFAULT_SETTINGS = {
    storeName: "General Store",
    ownerName: "",
    operatorPhoto: "",
    storePhone: "",
    storeEmail: "",
    storeAddress: "",
    taxType: "NON_TAX",
    taxNumber: "",
    invoiceFooter: "हाम्रो पसलमा आउनुभएकोमा धन्यवाद!",
    currency: "NPR",
    dateFormat: "YYYY-MM-DD",
    invoicePrefix: "INV",
    purchasePrefix: "PUR",
    defaultPayment: "Cash",
    autoLockMinutes: "5",
    appearance: {
      theme: "light",
      accentColor: "#166534",
      fontFamily: "Arial, sans-serif",
      fontSize: "15"
    }
  };

  const $ = id => document.getElementById(id);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readJSON(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (error) {
      console.error("Could not read local data:", key, error);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function isPlainObject(value) {
    return value !== null &&
      typeof value === "object" &&
      !Array.isArray(value);
  }

  function getSettings() {
    const saved = readJSON(SETTINGS_KEY, {});

    if (!isPlainObject(saved)) {
      return clone(DEFAULT_SETTINGS);
    }

    return {
      ...clone(DEFAULT_SETTINGS),
      ...saved,
      appearance: {
        ...DEFAULT_SETTINGS.appearance,
        ...(isPlainObject(saved.appearance) ? saved.appearance : {})
      }
    };
  }

  function showStatus(id, message, type = "success") {
    const element = $(id);
    if (!element) return;

    element.textContent = String(message);
    element.className = "status " + type;
  }

  function confirmAction(message) {
    return window.confirm(message);
  }

  function applyAppearance(settings = getSettings()) {
    const appearance = settings.appearance || {};

    if (window.GSAppearance?.apply) {
      window.GSAppearance.apply();
      return;
    }

    const root = document.documentElement;
    const theme = appearance.theme === "dark" ? "dark" : "light";
    const accent = /^#[0-9a-f]{6}$/i.test(
      String(appearance.accentColor || "")
    ) ? appearance.accentColor : "#166534";

    const fontSize = ["13", "15", "17", "19"].includes(
      String(appearance.fontSize)
    ) ? String(appearance.fontSize) : "15";

    const fontFamily = String(
      appearance.fontFamily || "Arial, sans-serif"
    );

    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    root.style.setProperty("--font-family", fontFamily);
    root.style.setProperty("--font-size", fontSize + "px");
    root.style.setProperty("--accent-color", accent);
    root.style.setProperty("--primary", accent);

    document.body?.classList.toggle("dark-theme", theme === "dark");
  }

  function setValue(id, value) {
    const element = $(id);
    if (element && value !== undefined && value !== null) {
      element.value = String(value);
    }
  }

  function loadSettings() {
    const settings = getSettings();

    [
      "currency",
      "dateFormat",
      "invoicePrefix",
      "purchasePrefix",
      "defaultPayment",
      "autoLockMinutes"
    ].forEach(id => {
      setValue(id, settings[id] ?? DEFAULT_SETTINGS[id]);
    });

    setValue("theme", settings.appearance.theme);
    setValue("accentColor", settings.appearance.accentColor);
    setValue("fontFamily", settings.appearance.fontFamily);
    setValue("fontSize", settings.appearance.fontSize);

    // Optional fields support the current HTML and the upcoming replacement.
    [
      "storeName",
      "ownerName",
      "operatorPhoto",
      "storePhone",
      "storeEmail",
      "storeAddress",
      "taxType",
      "taxNumber",
      "invoiceFooter"
    ].forEach(id => setValue(id, settings[id]));

    applyAppearance(settings);
    updateMpinStatus();
    updateLastBackup();
  }

  function safePrefix(value, fallback) {
    const prefix = String(value || "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\p{L}\p{N}_-]/gu, "")
      .slice(0, 12);

    return prefix || fallback;
  }

  function saveSystemSettings(event) {
    event.preventDefault();

    const settings = getSettings();

    settings.currency = $("currency")?.value || "NPR";
    settings.dateFormat = $("dateFormat")?.value || "YYYY-MM-DD";
    settings.invoicePrefix = safePrefix(
      $("invoicePrefix")?.value,
      "INV"
    );
    settings.purchasePrefix = safePrefix(
      $("purchasePrefix")?.value,
      "PUR"
    );
    settings.defaultPayment = $("defaultPayment")?.value || "Cash";

    try {
      writeJSON(SETTINGS_KEY, settings);
      showStatus("systemStatus", "System Settings सुरक्षित भयो।");
    } catch (error) {
      console.error(error);
      showStatus(
        "systemStatus",
        "System Settings सुरक्षित गर्न सकिएन। Browser storage खाली छ कि छैन जाँच गर्नुहोस्।",
        "error"
      );
    }
  }

  function saveAppearance() {
    const settings = getSettings();

    settings.appearance = {
      theme: $("theme")?.value === "dark" ? "dark" : "light",
      accentColor: /^#[0-9a-f]{6}$/i.test(
        $("accentColor")?.value || ""
      ) ? $("accentColor").value : "#166534",
      fontFamily: $("fontFamily")?.value || "Arial, sans-serif",
      fontSize: ["13", "15", "17", "19"].includes(
        $("fontSize")?.value
      ) ? $("fontSize").value : "15"
    };

    try {
      writeJSON(SETTINGS_KEY, settings);
      applyAppearance(settings);
      showStatus(
        "appearanceStatus",
        "Appearance सुरक्षित भयो। अन्य पेजमा पनि saved settings लागू हुनेछ।"
      );
    } catch (error) {
      console.error(error);
      showStatus(
        "appearanceStatus",
        "Appearance सुरक्षित गर्न सकिएन।",
        "error"
      );
    }
  }

  function resetAppearance() {
    if (!confirmAction(
      "Theme, Accent Color र Font लाई Default मा फर्काउने?"
    )) return;

    const settings = getSettings();
    settings.appearance = clone(DEFAULT_SETTINGS.appearance);

    try {
      writeJSON(SETTINGS_KEY, settings);
      loadSettings();
      showStatus("appearanceStatus", "Default Appearance लागू भयो।");
    } catch (error) {
      console.error(error);
      showStatus(
        "appearanceStatus",
        "Appearance reset गर्न सकिएन।",
        "error"
      );
    }
  }

  function saveAutoLock() {
    const settings = getSettings();
    settings.autoLockMinutes = $("autoLockMinutes")?.value || "5";

    try {
      writeJSON(SETTINGS_KEY, settings);
      window.GSAuth?.startTimer?.();
      showStatus("securityStatus", "Auto Lock सेटिङ सुरक्षित भयो।");
    } catch (error) {
      console.error(error);
      showStatus(
        "securityStatus",
        "Auto Lock सुरक्षित गर्न सकिएन।",
        "error"
      );
    }
  }

  // ---------------- MPIN ----------------

  async function hashPin(pin, salt) {
    if (!window.crypto?.subtle) {
      throw new Error(
        "Secure Crypto उपलब्ध छैन। HTTPS वा localhost प्रयोग गर्नुहोस्।"
      );
    }

    const bytes = new TextEncoder().encode(`${salt}:${pin}`);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);

    return Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  function generateSalt() {
    if (!window.crypto?.getRandomValues) {
      throw new Error("Secure random generator उपलब्ध छैन।");
    }

    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);

    return Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  function validPin(pin) {
    return /^[0-9]{4,8}$/.test(String(pin || ""));
  }

  function getMpinConfig() {
    const config = readJSON(MPIN_KEY, { enabled: false });
    return isPlainObject(config) ? config : { enabled: false };
  }

  async function verifyPin(pin) {
    const config = getMpinConfig();

    if (!config.enabled || !config.hash || !config.salt) {
      return false;
    }

    const candidate = await hashPin(pin, config.salt);
    if (candidate.length !== config.hash.length) return false;

    let diff = 0;
    for (let i = 0; i < candidate.length; i++) {
      diff |= candidate.charCodeAt(i) ^ config.hash.charCodeAt(i);
    }

    return diff === 0;
  }

  async function askAndVerifyCurrentPin() {
    const config = getMpinConfig();
    if (!config.enabled) return true;

    const pin = window.prompt("आफ्नो हालको MPIN राख्नुहोस्:");
    if (pin === null) return false;

    if (!validPin(pin)) {
      window.alert("MPIN ४ देखि ८ अंकको हुनुपर्छ।");
      return false;
    }

    if (!(await verifyPin(pin))) {
      window.alert("हालको MPIN गलत छ।");
      return false;
    }

    return true;
  }

  async function askNewPin() {
    const pin = window.prompt("नयाँ MPIN राख्नुहोस् (४–८ अंक):");
    if (pin === null) return null;

    if (!validPin(pin)) {
      window.alert("MPIN मा ४ देखि ८ वटा अंक मात्र राख्नुहोस्।");
      return null;
    }

    const confirmation = window.prompt("नयाँ MPIN फेरि राख्नुहोस्:");
    if (confirmation === null) return null;

    if (pin !== confirmation) {
      window.alert("दुवै MPIN मिलेनन्।");
      return null;
    }

    return pin;
  }

  async function setOrEnableMpin() {
    try {
      const existing = getMpinConfig();

      if (existing.enabled && !(await askAndVerifyCurrentPin())) return;

      const pin = await askNewPin();
      if (pin === null) return;

      const salt = generateSalt();
      const hash = await hashPin(pin, salt);

      writeJSON(MPIN_KEY, {
        enabled: true,
        salt,
        hash,
        createdAt: new Date().toISOString(),
        version: 1
      });

      updateMpinStatus();
      showStatus("securityStatus", "MPIN सक्रिय भयो।");

      if (window.GSAuth?.lock) {
        window.GSAuth.lock();
      } else {
        showStatus(
          "securityStatus",
          "MPIN सुरक्षित भयो। सबै आवश्यक पेजमा auth.js लोड भएको छ कि जाँच गर्नुहोस्।",
          "info"
        );
      }
    } catch (error) {
      console.error(error);
      showStatus(
        "securityStatus",
        error.message || "MPIN सेट गर्न सकिएन।",
        "error"
      );
    }
  }

  async function changeMpin() {
    try {
      if (!getMpinConfig().enabled) {
        showStatus(
          "securityStatus",
          "पहिले MPIN सक्रिय गर्नुहोस्।",
          "info"
        );
        return;
      }

      if (!(await askAndVerifyCurrentPin())) return;

      const pin = await askNewPin();
      if (pin === null) return;

      const salt = generateSalt();
      const hash = await hashPin(pin, salt);

      writeJSON(MPIN_KEY, {
        enabled: true,
        salt,
        hash,
        createdAt: new Date().toISOString(),
        version: 1
      });

      updateMpinStatus();
      showStatus("securityStatus", "MPIN परिवर्तन भयो।");
    } catch (error) {
      console.error(error);
      showStatus(
        "securityStatus",
        error.message || "MPIN परिवर्तन हुन सकेन।",
        "error"
      );
    }
  }

  async function disableMpin() {
    try {
      if (!getMpinConfig().enabled) {
        showStatus("securityStatus", "MPIN पहिले नै बन्द छ।", "info");
        return;
      }

      if (!(await askAndVerifyCurrentPin())) return;

      if (!confirmAction(
        "MPIN बन्द गर्ने? त्यसपछि PIN सुरक्षा हट्नेछ।"
      )) return;

      localStorage.removeItem(MPIN_KEY);
      updateMpinStatus();
      showStatus("securityStatus", "MPIN बन्द गरियो।", "info");
    } catch (error) {
      console.error(error);
      showStatus(
        "securityStatus",
        error.message || "MPIN बन्द गर्न सकिएन।",
        "error"
      );
    }
  }

  function updateMpinStatus() {
    const enabled = !!getMpinConfig().enabled;

    const status = $("mpinStatusText");
    if (status) {
      status.textContent = enabled ? "सक्रिय (Enabled)" : "बन्द (Disabled)";
    }

    const enableButton = $("enableMpinBtn");
    if (enableButton) {
      enableButton.textContent = enabled
        ? "🔐 MPIN Enabled / Reset"
        : "🔐 Set / Enable MPIN";
    }

    if ($("changeMpinBtn")) $("changeMpinBtn").disabled = !enabled;
    if ($("disableMpinBtn")) $("disableMpinBtn").disabled = !enabled;
  }

  function lockNow() {
    if (!getMpinConfig().enabled) {
      showStatus(
        "securityStatus",
        "पहिले MPIN Enable गर्नुहोस्।",
        "info"
      );
      return;
    }

    if (window.GSAuth?.lock) {
      window.GSAuth.lock();
    } else {
      showStatus("securityStatus", "auth.js लोड भएको छैन।", "error");
    }
  }

  // ---------------- Backup / Restore ----------------

  function getLocalDateStamp() {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("-");
  }

  function downloadJSON(filename, data) {
    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: "application/json;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function getCounterKeys() {
    const keys = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      // Preserve existing daily invoice/purchase sequence keys.
      if (
        key.startsWith("gs_invoice_counter_") ||
        key.startsWith("gs_purchase_counter_") ||
        key.startsWith("gs_purchase_counter-") ||
        key.startsWith("gs_invoice_counter-")
      ) {
        keys.push(key);
      }
    }

    return keys;
  }

  function collectBackupData() {
    const data = {};

    STORE_DATA_KEYS.forEach(key => {
      const value = readJSON(key, []);
      data[key] = value;
    });

    // Preserve the complete settings object, including Store Profile.
    data[SETTINGS_KEY] = getSettings();

    // Keep bill numbering sequences so restoring does not reset counters.
    getCounterKeys().forEach(key => {
      data[key] = readJSON(key, null);
    });

    return {
      app: "General Store Management System",
      version: 3,
      exportedAt: new Date().toISOString(),
      data
    };
  }

  function exportBackup() {
    try {
      const backup = collectBackupData();

      downloadJSON(
        `general-store-backup-${getLocalDateStamp()}.json`,
        backup
      );

      localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
      updateLastBackup();
      showStatus("backupStatus", "Backup डाउनलोड भयो।");
    } catch (error) {
      console.error(error);
      showStatus(
        "backupStatus",
        "Backup बनाउन सकिएन। Browser storage वा download अनुमति जाँच गर्नुहोस्।",
        "error"
      );
    }
  }

  function validateStoreValue(key, value) {
    if (key === SETTINGS_KEY) return isPlainObject(value);
    if (key === "gs_sales_returns") return Array.isArray(value);
    return Array.isArray(value);
  }

  async function restoreBackup() {
    const fileInput = $("restoreFile");
    const file = fileInput?.files?.[0];

    if (!file) {
      showStatus(
        "backupStatus",
        "पहिले Backup JSON फाइल छान्नुहोस्।",
        "error"
      );
      return;
    }

    let backup;

    try {
      backup = JSON.parse(await file.text());

      if (!isPlainObject(backup) || !isPlainObject(backup.data)) {
        throw new Error("Backup JSON संरचना मान्य छैन।");
      }
    } catch (error) {
      showStatus(
        "backupStatus",
        error.message || "Backup पढ्न सकिएन।",
        "error"
      );
      return;
    }

    if (window.GSAuth?.getConfig?.().enabled) {
      const pin = window.prompt("Restore गर्न आफ्नो MPIN राख्नुहोस्:");
      if (pin === null) return;

      if (!validPin(pin) || !(await verifyPin(pin))) {
        showStatus(
          "backupStatus",
          "MPIN गलत छ। Restore रोकियो।",
          "error"
        );
        return;
      }
    }

    if (!confirmAction(
      "Restore गर्दा backup मा भएका Store Data प्रतिस्थापन हुनेछ। पहिले हालको डेटा backup गरेको निश्चित हुनुहोस्। जारी राख्ने?"
    )) return;

    const updates = {};
    const oldValues = {};

    try {
      // Validate all supplied data before writing anything.
      for (const key of STORE_DATA_KEYS) {
        if (!(key in backup.data)) {
          // Older backups may not include newly supported keys.
          // Keep existing data for absent keys instead of deleting it.
          continue;
        }

        const value = backup.data[key];

        if (!validateStoreValue(key, value)) {
          throw new Error(`Backup मा ${key} को data मान्य छैन।`);
        }

        updates[key] = JSON.stringify(value);
      }

      if (SETTINGS_KEY in backup.data) {
        if (!isPlainObject(backup.data[SETTINGS_KEY])) {
          throw new Error("Backup Settings data मान्य छैन।");
        }

        const incoming = backup.data[SETTINGS_KEY];
        const current = getSettings();

        updates[SETTINGS_KEY] = JSON.stringify({
          ...current,
          ...incoming,
          appearance: {
            ...current.appearance,
            ...(isPlainObject(incoming.appearance)
              ? incoming.appearance
              : {})
          }
        });
      }

      // Restore counter keys stored inside the backup data.
      Object.keys(backup.data).forEach(key => {
        if (
          key.startsWith("gs_invoice_counter_") ||
          key.startsWith("gs_purchase_counter_") ||
          key.startsWith("gs_purchase_counter-") ||
          key.startsWith("gs_invoice_counter-")
        ) {
          const value = backup.data[key];

          if (
            value === null ||
            ["string", "number", "boolean"].includes(typeof value)
          ) {
            updates[key] = JSON.stringify(value);
          }
        }
      });

      // Snapshot current values for rollback if a write fails.
      Object.keys(updates).forEach(key => {
        oldValues[key] = localStorage.getItem(key);
      });

      try {
        Object.entries(updates).forEach(([key, value]) => {
          localStorage.setItem(key, value);
        });
      } catch (writeError) {
        Object.entries(oldValues).forEach(([key, oldValue]) => {
          try {
            if (oldValue === null) {
              localStorage.removeItem(key);
            } else {
              localStorage.setItem(key, oldValue);
            }
          } catch (rollbackError) {
            console.error("Restore rollback failed:", key, rollbackError);
          }
        });

        throw writeError;
      }

      loadSettings();
      showStatus(
        "backupStatus",
        "Backup सफलतापूर्वक Restore भयो। पुरानो format का backup मा नभएका नयाँ keys सुरक्षित राखिएका छन्।"
      );

      if (fileInput) fileInput.value = "";
    } catch (error) {
      console.error(error);
      showStatus(
        "backupStatus",
        error.message || "Restore असफल भयो। कुनै परिवर्तन लागू हुन सकेन।",
        "error"
      );
    }
  }

  async function clearAllData() {
    if (
      getMpinConfig().enabled &&
      !(await askAndVerifyCurrentPin())
    ) {
      return;
    }

    if (!confirmAction(
      "चेतावनी: बिक्री, खरिद, स्टक लट, Sales Return, ग्राहक, सप्लायर र Finance डेटा खाली गरिनेछ। Settings र MPIN सुरक्षित रहनेछन्। अगाडि बढ्ने?"
    )) return;

    const oldValues = {};

    try {
      STORE_DATA_KEYS.forEach(key => {
        oldValues[key] = localStorage.getItem(key);
      });

      try {
        STORE_DATA_KEYS.forEach(key => {
          localStorage.setItem(key, "[]");
        });
      } catch (writeError) {
        Object.entries(oldValues).forEach(([key, oldValue]) => {
          try {
            if (oldValue === null) {
              localStorage.removeItem(key);
            } else {
              localStorage.setItem(key, oldValue);
            }
          } catch (rollbackError) {
            console.error("Clear rollback failed:", key, rollbackError);
          }
        });

        throw writeError;
      }

      showStatus(
        "backupStatus",
        "Store Data खाली गरियो। Settings, Store Profile, bill counters र MPIN सुरक्षित छन्।"
      );
    } catch (error) {
      console.error(error);
      showStatus(
        "backupStatus",
        "डेटा खाली गर्ने प्रक्रिया असफल भयो। Storage space जाँच गर्नुहोस्।",
        "error"
      );
    }
  }

  function updateLastBackup() {
    const value = localStorage.getItem(LAST_BACKUP_KEY);
    const element = $("lastBackupText");
    if (!element) return;

    if (!value) {
      element.textContent = "अन्तिम Backup: अहिलेसम्म रेकर्ड छैन।";
      return;
    }

    const date = new Date(value);
    element.textContent = Number.isNaN(date.getTime())
      ? "अन्तिम Backup: मिति पढ्न सकिएन।"
      : "अन्तिम Backup: " + date.toLocaleString();
  }

  function showStorageInfo() {
    let total = 0;
    const keys = [
      ...STORE_DATA_KEYS,
      SETTINGS_KEY,
      MPIN_KEY,
      FEEDBACK_KEY,
      LAST_BACKUP_KEY,
      ...getCounterKeys()
    ];

    const uniqueKeys = [...new Set(keys)];
    const lines = [];

    uniqueKeys.forEach(key => {
      const raw = localStorage.getItem(key);
      const bytes = raw ? new Blob([raw]).size : 0;
      total += bytes;

      lines.push(
        `${key}: ${
          raw === null
            ? "डेटा छैन"
            : bytes.toLocaleString() + " bytes"
        }`
      );
    });

    showStatus(
      "aboutStatus",
      `अनुमानित प्रयोग: ${(total / 1024).toFixed(2)} KB\n${lines.join("\n")}`,
      "info"
    );
  }

  // ---------------- Feedback ----------------

  function saveFeedback(event) {
    event.preventDefault();

    const type = $("feedbackType")?.value || "Other";
    const contact = $("feedbackContact")?.value.trim() || "";
    const message = $("feedbackMessage")?.value.trim() || "";

    if (!message) {
      showStatus(
        "feedbackStatus",
        "Feedback विवरण लेख्नुहोस्।",
        "error"
      );
      return;
    }

    const subject = encodeURIComponent(
      `[${type}] General Store Feedback & Bug Report`
    );

    const body = encodeURIComponent(
      `Feedback Type: ${type}\nContact: ${contact || "N/A"}\n\nMessage:\n${message}`
    );

    const mailtoLink =
      `mailto:support@kamalgc.com.np?subject=${subject}&body=${body}`;

    const saved = readJSON(FEEDBACK_KEY, []);
    const feedback = Array.isArray(saved) ? saved : [];

    feedback.push({
      id: "FB-" + Date.now(),
      type,
      contact,
      message,
      createdAt: new Date().toISOString()
    });

    try {
      writeJSON(FEEDBACK_KEY, feedback);
      $("feedbackForm")?.reset();

      showStatus(
        "feedbackStatus",
        "Feedback स्थानीय रूपमा सुरक्षित गरियो। इमेल पठाउन मेल एप खुल्नेछ।"
      );

      window.location.href = mailtoLink;
    } catch (error) {
      console.error(error);
      showStatus(
        "feedbackStatus",
        "Feedback सुरक्षित गर्न सकिएन।",
        "error"
      );
    }
  }

  function exportFeedback() {
    const feedback = readJSON(FEEDBACK_KEY, []);

    if (!Array.isArray(feedback) || feedback.length === 0) {
      showStatus(
        "feedbackStatus",
        "Export गर्न Feedback भेटिएन।",
        "info"
      );
      return;
    }

    try {
      downloadJSON(
        `general-store-feedback-${getLocalDateStamp()}.json`,
        {
          app: "General Store",
          exportedAt: new Date().toISOString(),
          feedback
        }
      );

      showStatus("feedbackStatus", "Feedback JSON फाइल Export गरियो।");
    } catch (error) {
      console.error(error);
      showStatus(
        "feedbackStatus",
        "Feedback Export गर्न सकिएन।",
        "error"
      );
    }
  }

  // ---------------- Initialization ----------------

  function initialize() {
    $("systemForm")?.addEventListener("submit", saveSystemSettings);

    $("saveAppearanceBtn")?.addEventListener("click", saveAppearance);
    $("resetAppearanceBtn")?.addEventListener("click", resetAppearance);

    $("enableMpinBtn")?.addEventListener("click", setOrEnableMpin);
    $("changeMpinBtn")?.addEventListener("click", changeMpin);
    $("disableMpinBtn")?.addEventListener("click", disableMpin);
    $("lockNowBtn")?.addEventListener("click", lockNow);
    $("autoLockMinutes")?.addEventListener("change", saveAutoLock);

    $("feedbackForm")?.addEventListener("submit", saveFeedback);
    $("exportFeedbackBtn")?.addEventListener("click", exportFeedback);

    $("exportBtn")?.addEventListener("click", exportBackup);
    $("restoreBtn")?.addEventListener("click", restoreBackup);
    $("clearDataBtn")?.addEventListener("click", clearAllData);
    $("showStorageBtn")?.addEventListener("click", showStorageInfo);

    loadSettings();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
