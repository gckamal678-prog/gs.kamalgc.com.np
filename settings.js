
"use strict";

(() => {
  const SETTINGS_KEY = "gs_settings";
  const MPIN_KEY = "gs_mpin_security";
  const FEEDBACK_KEY = "gs_feedback";
  const LAST_BACKUP_KEY = "gs_last_backup";

  const STORE_DATA_KEYS = [
    "gs_products",
    "gs_purchases",
    "gs_sales",
    "gs_customers",
    "gs_suppliers",
    "gs_finance"
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

  function readJSON(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      console.error("Could not read", key, error);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getSettings() {
    const saved = readJSON(SETTINGS_KEY, {});

    if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
      return structuredClone(DEFAULT_SETTINGS);
    }

    return {
      ...structuredClone(DEFAULT_SETTINGS),
      ...saved,
      appearance: {
        ...DEFAULT_SETTINGS.appearance,
        ...(saved.appearance || {})
      }
    };
  }

  function showStatus(id, message, type = "success") {
    const element = $(id);
    if (!element) return;
    element.textContent = message;
    element.className = "status " + type;
  }

  function confirmAction(message) {
    return window.confirm(message);
  }

  function applyAppearance(settings = getSettings()) {
    if (window.GSAppearance?.apply) {
      window.GSAppearance.apply();
      return;
    }

    const appearance = settings.appearance || {};

    document.documentElement.style.setProperty(
      "--font-family",
      appearance.fontFamily || "Arial, sans-serif"
    );

    document.documentElement.style.setProperty(
      "--font-size",
      (appearance.fontSize || "15") + "px"
    );

    document.documentElement.style.setProperty(
      "--accent-color",
      appearance.accentColor || "#166534"
    );

    document.body.classList.toggle(
      "dark-theme",
      appearance.theme === "dark"
    );
  }

  /* Load system and appearance settings only.
     Store Profile is managed in store-profile.html. */

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
      const element = $(id);
      if (element) {
        element.value = String(settings[id] ?? DEFAULT_SETTINGS[id] ?? "");
      }
    });

    const theme = $("theme");
    if (theme) theme.value = settings.appearance.theme || "light";

    const accentColor = $("accentColor");
    if (accentColor) {
      accentColor.value = /^#[0-9a-f]{6}$/i.test(
        settings.appearance.accentColor
      )
        ? settings.appearance.accentColor
        : "#166534";
    }

    const fontFamily = $("fontFamily");
    if (fontFamily) {
      fontFamily.value =
        settings.appearance.fontFamily || "Arial, sans-serif";
    }

    const fontSize = $("fontSize");
    if (fontSize) {
      fontSize.value = String(settings.appearance.fontSize || "15");
    }

    applyAppearance(settings);
    updateMpinStatus();
    updateLastBackup();
  }

  async function hashPin(pin, salt) {
    if (!window.crypto?.subtle) {
      throw new Error(
        "Secure Crypto उपलब्ध छैन। localhost वा HTTPS प्रयोग गर्नुहोस्।"
      );
    }

    const data = new TextEncoder().encode(`${salt}:${pin}`);
    const digest = await window.crypto.subtle.digest("SHA-256", data);

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
    return /^[0-9]{4,8}$/.test(pin);
  }

  function getMpinConfig() {
    const config = readJSON(MPIN_KEY, { enabled: false });

    return config && typeof config === "object"
      ? config
      : { enabled: false };
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

    const pin = prompt("आफ्नो हालको MPIN राख्नुहोस्:");
    if (pin === null) return false;

    if (!validPin(pin)) {
      alert("MPIN ४ देखि ८ अंकको हुनुपर्छ।");
      return false;
    }

    if (!(await verifyPin(pin))) {
      alert("हालको MPIN गलत छ।");
      return false;
    }

    return true;
  }

  async function askNewPin() {
    const pin = prompt("नयाँ MPIN राख्नुहोस् (४–८ अंक):");
    if (pin === null) return null;

    if (!validPin(pin)) {
      alert("MPIN मा ४ देखि ८ वटा अंक मात्र राख्नुहोस्।");
      return null;
    }

    const confirmation = prompt("नयाँ MPIN फेरि राख्नुहोस्:");
    if (confirmation === null) return null;

    if (pin !== confirmation) {
      alert("दुवै MPIN मिलेनन्।");
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
      showStatus("securityStatus", "MPIN सक्रिय भयो। एप लक हुँदैछ।");

      if (window.GSAuth?.lock) {
        window.GSAuth.lock();
      } else {
        alert("MPIN सुरक्षित भयो। सबै पेजमा auth.js जोड्नुहोस्।");
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

      if (!confirmAction("MPIN बन्द गर्ने? त्यसपछि PIN सुरक्षा हट्नेछ।")) {
        return;
      }

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

    const changeButton = $("changeMpinBtn");
    if (changeButton) changeButton.disabled = !enabled;

    const disableButton = $("disableMpinBtn");
    if (disableButton) disableButton.disabled = !enabled;
  }

  function saveSystemSettings(event) {
    event.preventDefault();

    const settings = getSettings();

    settings.currency = $("currency").value;
    settings.dateFormat = $("dateFormat").value;
    settings.invoicePrefix = $("invoicePrefix").value.trim() || "INV";
    settings.purchasePrefix = $("purchasePrefix").value.trim() || "PUR";
    settings.defaultPayment = $("defaultPayment").value;

    try {
      writeJSON(SETTINGS_KEY, settings);
      showStatus("systemStatus", "System Settings सुरक्षित भयो।");
    } catch (error) {
      console.error(error);
      showStatus(
        "systemStatus",
        "System Settings सुरक्षित गर्न सकिएन।",
        "error"
      );
    }
  }

  function saveAppearance() {
    const settings = getSettings();

    settings.appearance = {
      theme: $("theme").value,
      accentColor: $("accentColor").value,
      fontFamily: $("fontFamily").value,
      fontSize: $("fontSize").value
    };

    try {
      writeJSON(SETTINGS_KEY, settings);
      applyAppearance(settings);
      showStatus(
        "appearanceStatus",
        "Appearance सुरक्षित भयो र यो पेजमा लागू गरियो।"
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
    settings.appearance = { ...DEFAULT_SETTINGS.appearance };

    try {
      writeJSON(SETTINGS_KEY, settings);

      $("theme").value = settings.appearance.theme;
      $("accentColor").value = settings.appearance.accentColor;
      $("fontFamily").value = settings.appearance.fontFamily;
      $("fontSize").value = settings.appearance.fontSize;

      applyAppearance(settings);
      showStatus("appearanceStatus", "Default Appearance लागू भयो।");
    } catch (error) {
      showStatus(
        "appearanceStatus",
        "Appearance reset गर्न सकिएन।",
        "error"
      );
    }
  }

  function saveAutoLock() {
    const settings = getSettings();
    settings.autoLockMinutes = $("autoLockMinutes").value;

    try {
      writeJSON(SETTINGS_KEY, settings);
      window.GSAuth?.startTimer?.();
      showStatus("securityStatus", "Auto Lock सेटिङ सुरक्षित भयो।");
    } catch (error) {
      showStatus(
        "securityStatus",
        "Auto Lock सुरक्षित गर्न सकिएन।",
        "error"
      );
    }
  }

  function lockNow() {
    if (!getMpinConfig().enabled) {
      showStatus("securityStatus", "पहिले MPIN Enable गर्नुहोस्।", "info");
      return;
    }

    if (window.GSAuth?.lock) {
      window.GSAuth.lock();
    } else {
      showStatus("securityStatus", "auth.js लोड भएको छैन।", "error");
    }
  }

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

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function collectBackupData() {
    const data = {};

    for (const key of STORE_DATA_KEYS) {
      data[key] = readJSON(key, []);
    }

    // Preserve the full settings object, including Store Profile.
    data[SETTINGS_KEY] = getSettings();

    return {
      app: "General Store Management System",
      version: 2,
      exportedAt: new Date().toISOString(),
      data
    };
  }

  function exportBackup() {
    try {
      downloadJSON(
        `general-store-backup-${getLocalDateStamp()}.json`,
        collectBackupData()
      );

      localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
      updateLastBackup();
      showStatus("backupStatus", "Backup डाउनलोड भयो।");
    } catch (error) {
      console.error(error);
      showStatus("backupStatus", "Backup बनाउन सकिएन।", "error");
    }
  }

  function isPlainObject(value) {
    return value !== null &&
      typeof value === "object" &&
      !Array.isArray(value);
  }

  async function restoreBackup() {
    const file = $("restoreFile").files[0];

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
      const pin = prompt("Restore गर्न आफ्नो MPIN राख्नुहोस्:");
      if (pin === null) return;

      if (!validPin(pin) || !(await verifyPin(pin))) {
        showStatus("backupStatus", "MPIN गलत छ। Restore रोकियो।", "error");
        return;
      }
    }

    if (!confirmAction(
      "Restore गर्दा हालको Store Data प्रतिस्थापन हुनेछ। जारी राख्ने?"
    )) return;

    try {
      const updates = {};

      for (const key of STORE_DATA_KEYS) {
        const value = backup.data[key] ?? [];

        if (!Array.isArray(value)) {
          throw new Error(`Backup मा ${key} को data मान्य छैन।`);
        }

        updates[key] = JSON.stringify(value);
      }

      if (backup.data[SETTINGS_KEY] !== undefined) {
        if (!isPlainObject(backup.data[SETTINGS_KEY])) {
          throw new Error("Backup Settings data मान्य छैन।");
        }

        updates[SETTINGS_KEY] = JSON.stringify({
          ...getSettings(),
          ...backup.data[SETTINGS_KEY],
          appearance: {
            ...getSettings().appearance,
            ...(backup.data[SETTINGS_KEY].appearance || {})
          }
        });
      }

      Object.entries(updates).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });

      loadSettings();
      showStatus("backupStatus", "Backup सफलतापूर्वक Restore भयो।");
      $("restoreFile").value = "";
    } catch (error) {
      console.error(error);
      showStatus(
        "backupStatus",
        error.message || "Restore असफल भयो।",
        "error"
      );
    }
  }

  async function clearAllData() {
    if (getMpinConfig().enabled && !(await askAndVerifyCurrentPin())) {
      return;
    }

    if (!confirmAction(
      "चेतावनी: सबै स्टोर डेटा मेटाइनेछ। Settings र MPIN सुरक्षित रहनेछन्। जारी राख्ने?"
    )) return;

    try {
      STORE_DATA_KEYS.forEach(key => localStorage.setItem(key, "[]"));

      showStatus(
        "backupStatus",
        "Store Data हटाइयो। Settings र MPIN सुरक्षित छन्।"
      );
    } catch (error) {
      showStatus(
        "backupStatus",
        "डेटा हटाउने प्रक्रिया असफल भयो।",
        "error"
      );
    }
  }

  function saveFeedback(event) {
    event.preventDefault();

    const type = $("feedbackType").value;
    const contact = $("feedbackContact").value.trim();
    const message = $("feedbackMessage").value.trim();

    if (!message) {
      showStatus("feedbackStatus", "Feedback विवरण लेख्नुहोस्।", "error");
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

    const list = readJSON(FEEDBACK_KEY, []);
    const feedback = Array.isArray(list) ? list : [];

    feedback.push({
      id: "FB-" + Date.now(),
      type,
      contact,
      message,
      createdAt: new Date().toISOString()
    });

    try {
      writeJSON(FEEDBACK_KEY, feedback);
      $("feedbackForm").reset();

      showStatus(
        "feedbackStatus",
        "Feedback स्थानीय रूपमा सुरक्षित गरियो। इमेल पठाउन मेल एप खुल्नेछ।"
      );

      window.location.href = mailtoLink;
    } catch (error) {
      console.error(error);
      showStatus("feedbackStatus", "Feedback सुरक्षित गर्न सकिएन।", "error");
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

    downloadJSON(
      `general-store-feedback-${getLocalDateStamp()}.json`,
      {
        app: "General Store",
        exportedAt: new Date().toISOString(),
        feedback
      }
    );

    showStatus("feedbackStatus", "Feedback JSON फाइल Export गरियो।");
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
    const lines = [];

    [...STORE_DATA_KEYS, SETTINGS_KEY, MPIN_KEY, FEEDBACK_KEY]
      .forEach(key => {
        const raw = localStorage.getItem(key);
        const bytes = raw ? new Blob([raw]).size : 0;

        total += bytes;

        lines.push(
          `${key}: ${raw === null
            ? "डेटा छैन"
            : bytes.toLocaleString() + " bytes"}`
        );
      });

    showStatus(
      "aboutStatus",
      `अनुमानित प्रयोग: ${(total / 1024).toFixed(2)} KB\n${lines.join("\n")}`,
      "info"
    );
  }

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
