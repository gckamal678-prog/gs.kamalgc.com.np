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

  function refreshProfilePreview(settings = getSettings()) {
    $("profilePreviewName").textContent = settings.storeName || "General Store";
    $("profilePreviewOwner").textContent = settings.ownerName || "सञ्चालकको नाम";

    const image = $("avatarPreview");
    const fallback = $("avatarFallback");

    if (settings.operatorPhoto) {
      image.src = settings.operatorPhoto;
      image.hidden = false;
      fallback.hidden = true;
    } else {
      image.removeAttribute("src");
      image.hidden = true;
      fallback.hidden = false;
    }
  }

  function loadSettings() {
    const settings = getSettings();

    [
      "storeName", "ownerName", "storePhone", "storeEmail",
      "storeAddress", "taxType", "taxNumber", "invoiceFooter",
      "currency", "dateFormat", "invoicePrefix", "purchasePrefix",
      "defaultPayment", "autoLockMinutes"
    ].forEach(id => {
      if ($(id)) {
        const value = settings[id] ?? DEFAULT_SETTINGS[id] ?? "";
        $(id).value = String(value);
      }
    });

    $("theme").value = settings.appearance.theme;
    $("accentColor").value = /^#[0-9a-f]{6}$/i.test(settings.appearance.accentColor)
      ? settings.appearance.accentColor
      : "#166534";
    $("fontFamily").value = settings.appearance.fontFamily;
    $("fontSize").value = String(settings.appearance.fontSize);

    applyAppearance(settings);
    refreshProfilePreview(settings);
    updateMpinStatus();
    updateLastBackup();
  }

  async function hashPin(pin, salt) {
    if (!window.crypto?.subtle) {
      throw new Error("Secure Crypto उपलब्ध छैन। localhost वा HTTPS प्रयोग गर्नुहोस्।");
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
    if (!config.enabled || !config.hash || !config.salt) return false;

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
        alert("MPIN सुरक्षित भयो। सबै पेजमा auth.js جوड्नुहोस्।");
      }
    } catch (error) {
      console.error(error);
      showStatus("securityStatus", error.message || "MPIN सेट गर्न सकिएन।", "error");
    }
  }

  async function changeMpin() {
    try {
      if (!getMpinConfig().enabled) {
        showStatus("securityStatus", "पहिले MPIN सक्रिय गर्नुहोस्।", "info");
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
      showStatus("securityStatus", error.message || "MPIN परिवर्तन हुन सकेन।", "error");
    }
  }

  async function disableMpin() {
    try {
      if (!getMpinConfig().enabled) {
        showStatus("securityStatus", "MPIN पहिले नै बन्द छ।", "info");
        return;
      }

      if (!(await askAndVerifyCurrentPin())) return;
      if (!confirmAction("MPIN बन्द गर्ने? त्यसपछि PIN सुरक्षा हट्नेछ।")) return;

      localStorage.removeItem(MPIN_KEY);
      updateMpinStatus();
      showStatus("securityStatus", "MPIN बन्द गरियो।", "info");
    } catch (error) {
      console.error(error);
      showStatus("securityStatus", error.message || "MPIN बन्द गर्न सकिएन।", "error");
    }
  }

  function updateMpinStatus() {
    const enabled = !!getMpinConfig().enabled;
    $("mpinStatusText").textContent = enabled
      ? "सक्रिय (Enabled)"
      : "बन्द (Disabled)";

    $("enableMpinBtn").textContent = enabled
      ? "🔐 MPIN Enabled / Reset"
      : "🔐 Set / Enable MPIN";
    $("changeMpinBtn").disabled = !enabled;
    $("disableMpinBtn").disabled = !enabled;
  }

  function saveProfile(event) {
    event.preventDefault();

    const settings = getSettings();
    const storeName = $("storeName").value.trim();
    const email = $("storeEmail").value.trim();

    if (!storeName) {
      showStatus("profileStatus", "पसलको नाम अनिवार्य छ।", "error");
      $("storeName").focus();
      return;
    }

    if (email && !$("storeEmail").checkValidity()) {
      showStatus("profileStatus", "सही इमेल राख्नुहोस्।", "error");
      return;
    }

    Object.assign(settings, {
      storeName,
      ownerName: $("ownerName").value.trim(),
      storePhone: $("storePhone").value.trim(),
      storeEmail: email,
      storeAddress: $("storeAddress").value.trim(),
      taxType: $("taxType").value,
      taxNumber: $("taxNumber").value.trim(),
      invoiceFooter: $("invoiceFooter").value.trim()
    });

    try {
      writeJSON(SETTINGS_KEY, settings);
      refreshProfilePreview(settings);
      showStatus("profileStatus", "Store Profile सुरक्षित भयो।");
    } catch (error) {
      console.error(error);
      showStatus("profileStatus", "Profile सुरक्षित गर्न सकिएन।", "error");
    }
  }

  async function readAvatarFile(file) {
    if (!file) return "";

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      throw new Error("PNG, JPG वा WEBP फोटो मात्र छान्नुहोस्।");
    }
    if (file.size > 1024 * 1024) {
      throw new Error("फोटो १ MB भन्दा सानो हुनुपर्छ।");
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("फोटो पढ्न सकिएन।"));
      reader.readAsDataURL(file);
    });
  }

  async function saveAvatarFile() {
    const file = $("operatorPhoto").files[0];
    if (!file) return;

    try {
      const dataUrl = await readAvatarFile(file);
      const settings = getSettings();
      settings.operatorPhoto = dataUrl;
      writeJSON(SETTINGS_KEY, settings);
      refreshProfilePreview(settings);
      showStatus("profileStatus", "Profile photo सुरक्षित भयो।");
    } catch (error) {
      showStatus("profileStatus", error.message || "फोटो सुरक्षित गर्न सकिएन।", "error");
    }
  }

  function removeAvatar() {
    const settings = getSettings();
    settings.operatorPhoto = "";
    try {
      writeJSON(SETTINGS_KEY, settings);
      $("operatorPhoto").value = "";
      refreshProfilePreview(settings);
      showStatus("profileStatus", "Profile photo हटाइयो।");
    } catch (error) {
      showStatus("profileStatus", "फोटो हटाउन सकिएन।", "error");
    }
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
      showStatus("systemStatus", "System Settings सुरक्षित गर्न सकिएन।", "error");
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
      showStatus("appearanceStatus", "Appearance सुरक्षित भयो र यो पेजमा लागू गरियो।");
    } catch (error) {
      console.error(error);
      showStatus("appearanceStatus", "Appearance सुरक्षित गर्न सकिएन।", "error");
    }
  }

  function resetAppearance() {
    if (!confirmAction("Theme, Accent Color र Font लाई Default मा फर्काउने?")) return;

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
      showStatus("appearanceStatus", "Appearance reset गर्न सकिएन।", "error");
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
      showStatus("securityStatus", "Auto Lock सुरक्षित गर्न सकिएन।", "error");
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
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  async function restoreBackup() {
    const file = $("restoreFile").files[0];
    if (!file) {
      showStatus("backupStatus", "पहिले Backup JSON फाइल छान्नुहोस्।", "error");
      return;
    }

    let backup;
    try {
      backup = JSON.parse(await file.text());
      if (!isPlainObject(backup) || !isPlainObject(backup.data)) {
        throw new Error("Backup JSON संरचना मान्य छैन।");
      }
    } catch (error) {
      showStatus("backupStatus", error.message || "Backup पढ्न सकिएन।", "error");
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

    if (!confirmAction("Restore गर्दा हालको Store Data प्रतिस्थापन हुनेछ। जारी राख्ने?")) return;

    try {
      STORE_DATA_KEYS.forEach(key => {
        const value = backup.data[key] ?? [];
        localStorage.setItem(key, JSON.stringify(value));
      });

      if (backup.data[SETTINGS_KEY] !== undefined) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(backup.data[SETTINGS_KEY]));
      }

      loadSettings();
      showStatus("backupStatus", "Backup सफलतापूर्वक Restore भयो।");
      $("restoreFile").value = "";
    } catch (error) {
      console.error(error);
      showStatus("backupStatus", "Restore असफल भयो।", "error");
    }
  }

  async function clearAllData() {
    if (getMpinConfig().enabled && !(await askAndVerifyCurrentPin())) return;

    if (!confirmAction("चेतावनी: सबै स्टोर डेटा मेटाइनेछ। Settings र MPIN सुरक्षित रहनेछन्। जारी राख्ने?")) return;

    try {
      STORE_DATA_KEYS.forEach(key => localStorage.setItem(key, "[]"));
      showStatus("backupStatus", "Store Data हटाइयो। Settings र MPIN सुरक्षित छन्।");
    } catch (error) {
      showStatus("backupStatus", "डेटा हटाउने प्रक्रिया असफल भयो।", "error");
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

    // यहाँ support@kamalgc.com.np मा मेल जाने व्यवस्था मिलाइएको छ (mailto link)
    const subject = encodeURIComponent(`[${type}] General Store Feedback & Bug Report`);
    const body = encodeURIComponent(`Feedback Type: ${type}\nContact: ${contact || 'N/A'}\n\nMessage:\n${message}`);
    
    const mailtoLink = `mailto:support@kamalgc.com.np?subject=${subject}&body=${body}`;
    
    // स्थानीय रूपमा पनि सुरक्षित गर्ने
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
      
      // मेल क्लाइन्ट खोल्ने
      window.location.href = mailtoLink;
      showStatus("feedbackStatus", "Feedback सुरक्षित गरियो र support@kamalgc.com.np मा पठाउन मेल क्लाइन्ट खोलिंदैछ।");
    } catch (error) {
      showStatus("feedbackStatus", "Feedback पठाउन सकिएन।", "error");
    }
  }

  function exportFeedback() {
    const feedback = readJSON(FEEDBACK_KEY, []);
    if (!Array.isArray(feedback) || feedback.length === 0) {
      showStatus("feedbackStatus", "Export गर्न Feedback भेटिएन।", "info");
      return;
    }

    downloadJSON(
      `general-store-feedback-${getLocalDateStamp()}.json`,
      { app: "General Store", exportedAt: new Date().toISOString(), feedback }
    );
    showStatus("feedbackStatus", "Feedback JSON फाइल Export गरियो।");
  }

  function updateLastBackup() {
    const value = localStorage.getItem(LAST_BACKUP_KEY);
    if (!value) {
      $("lastBackupText").textContent = "अन्तिम Backup: अहिलेसम्म रेकर्ड छैन।";
      return;
    }
    const date = new Date(value);
    $("lastBackupText").textContent = Number.isNaN(date.getTime())
      ? "अन्तिम Backup: मिति पढ्न सकिएन।"
      : "अन्तिम Backup: " + date.toLocaleString();
  }

  function showStorageInfo() {
    let total = 0;
    const lines = [];

    [...STORE_DATA_KEYS, SETTINGS_KEY, MPIN_KEY, FEEDBACK_KEY].forEach(key => {
      const raw = localStorage.getItem(key);
      const bytes = raw ? new Blob([raw]).size : 0;
      total += bytes;
      lines.push(`${key}: ${raw === null ? "डेटा छैन" : bytes.toLocaleString() + " bytes"}`);
    });

    showStatus("aboutStatus", `अनुमानित प्रयोग: ${(total / 1024).toFixed(2)} KB\n${lines.join("\n")}`, "info");
  }

  function initialize() {
    $("profileForm").addEventListener("submit", saveProfile);
    $("systemForm").addEventListener("submit", saveSystemSettings);

    $("saveAppearanceBtn").addEventListener("click", saveAppearance);
    $("resetAppearanceBtn").addEventListener("click", resetAppearance);

    $("enableMpinBtn").addEventListener("click", setOrEnableMpin);
    $("changeMpinBtn").addEventListener("click", changeMpin);
    $("disableMpinBtn").addEventListener("click", disableMpin);
    $("lockNowBtn").addEventListener("click", lockNow);
    $("autoLockMinutes").addEventListener("change", saveAutoLock);

    $("operatorPhoto").addEventListener("change", saveAvatarFile);
    $("removeAvatarBtn").addEventListener("click", removeAvatar);

    $("feedbackForm").addEventListener("submit", saveFeedback);
    $("exportFeedbackBtn").addEventListener("click", exportFeedback);

    $("exportBtn").addEventListener("click", exportBackup);
    $("restoreBtn").addEventListener("click", restoreBackup);
    $("clearDataBtn").addEventListener("click", clearAllData);
    $("showStorageBtn").addEventListener("click", showStorageInfo);

    loadSettings();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
