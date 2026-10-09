"use strict";

/* =========================================
   GENERAL STORE SETTINGS
   ========================================= */

const SETTINGS_KEY = "gs_settings";
const MPIN_KEY = "gs_mpin_security";
const FEEDBACK_KEY = "gs_feedback";
const LAST_BACKUP_KEY = "gs_last_backup";

const DATA_KEYS = [
  "gs_products",
  "gs_purchases",
  "gs_sales",
  "gs_customers",
  "gs_suppliers",
  "gs_finance",
  "gs_settings"
];

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
  appearance: {
    theme: "light",
    fontFamily: "Arial, sans-serif",
    fontSize: "15"
  },
  autoLockMinutes: "5"
};

let lockTimer = null;
let failedPinAttempts = 0;
let pinLockedUntil = 0;
let lastActivityAt = Date.now();
let pendingSensitiveAction = false;


/* =========================================
   BASIC HELPERS
   ========================================= */

function $(id) {
  return document.getElementById(id);
}

function safeParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function readJSON(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : safeParse(value, fallback);
  } catch (error) {
    console.error("Local data read failed:", key, error);
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getSettings() {
  const saved = readJSON(SETTINGS_KEY, {});

  if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
    return { ...DEFAULT_SETTINGS };
  }

  return {
    ...DEFAULT_SETTINGS,
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

function clearStatus(id) {
  const element = $(id);
  if (!element) return;

  element.textContent = "";
  element.className = "status";
}

function askConfirmation(message) {
  return window.confirm(message);
}

function downloadJSON(filename, data) {
  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // केही समयपछि URL हटाउने
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getLocalDateStamp() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


/* =========================================
   SETTINGS LOAD AND SAVE
   ========================================= */

function loadSettings() {
  const settings = getSettings();

  const fields = [
    "storeName",
    "ownerName",
    "storePhone",
    "storeEmail",
    "storeAddress",
    "taxType",
    "taxNumber",
    "invoiceFooter",
    "currency",
    "dateFormat",
    "invoicePrefix",
    "purchasePrefix",
    "defaultPayment"
  ];

  fields.forEach(id => {
    const element = $(id);
    if (element) {
      element.value = settings[id] ?? DEFAULT_SETTINGS[id] ?? "";
    }
  });

  if ($("theme")) {
    $("theme").value = settings.appearance.theme;
  }

  if ($("fontFamily")) {
    $("fontFamily").value = settings.appearance.fontFamily;
  }

  if ($("fontSize")) {
    $("fontSize").value = settings.appearance.fontSize;
  }

  if ($("autoLockMinutes")) {
    $("autoLockMinutes").value = settings.autoLockMinutes || "0";
  }

  applyAppearance(settings.appearance);
  updateMpinStatus();
  updateLastBackup();
  startAutoLockTimer();
}

function saveProfile(event) {
  event.preventDefault();

  const storeName = $("storeName").value.trim();
  const email = $("storeEmail").value.trim();

  if (!storeName) {
    showStatus("profileStatus", "पसलको नाम अनिवार्य छ।", "error");
    $("storeName").focus();
    return;
  }

  if (email && !$("storeEmail").checkValidity()) {
    showStatus("profileStatus", "कृपया सही इमेल राख्नुहोस्।", "error");
    $("storeEmail").focus();
    return;
  }

  const settings = getSettings();

  settings.storeName = storeName;
  settings.ownerName = $("ownerName").value.trim();
  settings.storePhone = $("storePhone").value.trim();
  settings.storeEmail = email;
  settings.storeAddress = $("storeAddress").value.trim();
  settings.taxType = $("taxType").value;
  settings.taxNumber = $("taxNumber").value.trim();
  settings.invoiceFooter = $("invoiceFooter").value.trim();

  try {
    writeJSON(SETTINGS_KEY, settings);
    showStatus("profileStatus", "Store Profile सफलतापूर्वक सुरक्षित भयो।");
  } catch (error) {
    console.error(error);
    showStatus("profileStatus", "Profile सुरक्षित हुन सकेन। Browser storage जाँच गर्नुहोस्।", "error");
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
    showStatus("systemStatus", "Settings सुरक्षित गर्न सकिएन।", "error");
  }
}


/* =========================================
   APPEARANCE: THEME, FONT AND FONT SIZE
   ========================================= */

function applyAppearance(appearance = {}) {
  const theme = appearance.theme === "dark" ? "dark" : "light";
  const fontFamily = appearance.fontFamily || "Arial, sans-serif";
  const allowedSizes = ["13", "15", "17", "19"];
  const fontSize = allowedSizes.includes(String(appearance.fontSize))
    ? String(appearance.fontSize)
    : "15";

  document.body.classList.toggle("dark-theme", theme === "dark");

  document.documentElement.style.setProperty(
    "--font-family",
    fontFamily
  );

  document.documentElement.style.setProperty(
    "--font-size",
    `${fontSize}px`
  );

  document.documentElement.style.colorScheme = theme;
}

function saveAppearance() {
  const settings = getSettings();

  settings.appearance = {
    theme: $("theme").value,
    fontFamily: $("fontFamily").value,
    fontSize: $("fontSize").value
  };

  try {
    writeJSON(SETTINGS_KEY, settings);
    applyAppearance(settings.appearance);
    showStatus("appearanceStatus", "Appearance सुरक्षित भयो र लागू गरियो।");
  } catch (error) {
    console.error(error);
    showStatus("appearanceStatus", "Appearance सुरक्षित गर्न सकिएन।", "error");
  }
}

function resetAppearance() {
  if (!askConfirmation("Theme र Font लाई Default मा फर्काउने?")) return;

  const settings = getSettings();
  settings.appearance = { ...DEFAULT_SETTINGS.appearance };

  try {
    writeJSON(SETTINGS_KEY, settings);
    loadSettings();
    showStatus("appearanceStatus", "Default Appearance लागू भयो।");
  } catch (error) {
    console.error(error);
    showStatus("appearanceStatus", "Appearance Reset गर्न सकिएन।", "error");
  }
}


/* =========================================
   MPIN: HASHING AND VERIFICATION
   ========================================= */

// MPIN लाई plain text का रूपमा सुरक्षित गरिँदैन.
// Web Crypto उपलब्ध नभए MPIN सेट गर्न दिइँदैन.
async function hashPin(pin, salt) {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error(
      "Secure Crypto उपलब्ध छैन। एपलाई localhost वा HTTPS मार्फत खोल्नुहोस्।"
    );
  }

  const encoder = new TextEncoder();
  const input = encoder.encode(`${salt}:${pin}`);
  const digest = await window.crypto.subtle.digest("SHA-256", input);

  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function generateSalt() {
  if (!window.crypto || !window.crypto.getRandomValues) {
    throw new Error("Secure random generator उपलब्ध छैन।");
  }

  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getMpinConfig() {
  const data = readJSON(MPIN_KEY, null);

  if (
    !data ||
    typeof data !== "object" ||
    typeof data.enabled !== "boolean"
  ) {
    return { enabled: false };
  }

  return data;
}

function validatePinFormat(pin) {
  return /^[0-9]{4,8}$/.test(pin);
}

async function verifyPin(pin) {
  const config = getMpinConfig();

  if (!config.enabled || !config.hash || !config.salt) {
    return false;
  }

  const inputHash = await hashPin(pin, config.salt);

  if (inputHash.length !== config.hash.length) return false;

  // Hash को string तुलना
  let mismatch = 0;
  for (let i = 0; i < inputHash.length; i++) {
    mismatch |= inputHash.charCodeAt(i) ^ config.hash.charCodeAt(i);
  }

  return mismatch === 0;
}

function updateMpinStatus() {
  const config = getMpinConfig();
  const status = $("mpinStatusText");

  if (status) {
    status.textContent = config.enabled
      ? "सक्रिय (Enabled)"
      : "बन्द (Disabled)";
    status.style.color = config.enabled ? "#16a34a" : "var(--muted)";
  }

  if ($("enableMpinBtn")) {
    $("enableMpinBtn").textContent = config.enabled
      ? "🔐 MPIN Enabled"
      : "🔐 Set / Enable MPIN";
  }

  if ($("changeMpinBtn")) {
    $("changeMpinBtn").disabled = !config.enabled;
  }

  if ($("disableMpinBtn")) {
    $("disableMpinBtn").disabled = !config.enabled;
  }
}

async function promptForPin(message = "आफ्नो हालको MPIN राख्नुहोस्।") {
  const pin = window.prompt(message);

  if (pin === null) return null;

  if (!validatePinFormat(pin)) {
    alert("MPIN ४ देखि ८ अंकको हुनुपर्छ।");
    return null;
  }

  return pin;
}

async function requireCurrentPin() {
  const config = getMpinConfig();

  if (!config.enabled) return true;

  if (Date.now() < pinLockedUntil) {
    const remaining = Math.ceil((pinLockedUntil - Date.now()) / 1000);
    alert(`धेरै पटक गलत PIN राखिएको छ। ${remaining} सेकेन्डपछि पुनः प्रयास गर्नुहोस्।`);
    return false;
  }

  const pin = await promptForPin();

  if (pin === null) return false;

  try {
    const valid = await verifyPin(pin);

    if (!valid) {
      failedPinAttempts++;

      if (failedPinAttempts >= 5) {
        pinLockedUntil = Date.now() + 60_000;
        failedPinAttempts = 0;
        alert("धेरै पटक गलत PIN भयो। १ मिनेटपछि पुनः प्रयास गर्नुहोस्।");
      } else {
        alert(`गलत MPIN। बाँकी प्रयास: ${5 - failedPinAttempts}`);
      }

      return false;
    }

    failedPinAttempts = 0;
    return true;
  } catch (error) {
    console.error(error);
    alert(error.message || "PIN जाँच गर्न सकिएन।");
    return false;
  }
}

async function setOrEnableMpin() {
  const config = getMpinConfig();

  if (config.enabled && !(await requireCurrentPin())) return;

  const pin = window.prompt("नयाँ MPIN राख्नुहोस् (४–८ अंक):");
  if (pin === null) return;

  if (!validatePinFormat(pin)) {
    alert("MPIN मा ४ देखि ८ वटा अंक मात्र राख्नुहोस्।");
    return;
  }

  const confirmPin = window.prompt("नयाँ MPIN पुनः राख्नुहोस्:");
  if (confirmPin === null) return;

  if (pin !== confirmPin) {
    alert("दुवै MPIN मिलेनन्।");
    return;
  }

  try {
    const salt = generateSalt();
    const hash = await hashPin(pin, salt);

    writeJSON(MPIN_KEY, {
      enabled: true,
      salt,
      hash,
      createdAt: new Date().toISOString(),
      version: 1
    });

    showStatus("securityStatus", "MPIN सफलतापूर्वक सक्रिय भयो।");
    updateMpinStatus();

    // सक्रिय गरेपछि हालको पेज पनि लक गर्ने
    lockApp();
  } catch (error) {
    console.error(error);
    showStatus("securityStatus", error.message || "MPIN सेट गर्न सकिएन।", "error");
  }
}

async function changeMpin() {
  if (!(await requireCurrentPin())) return;

  const pin = window.prompt("नयाँ MPIN राख्नुहोस् (४–८ अंक):");
  if (pin === null) return;

  if (!validatePinFormat(pin)) {
    alert("MPIN मा ४ देखि ८ वटा अंक मात्र राख्नुहोस्।");
    return;
  }

  const confirmPin = window.prompt("नयाँ MPIN पुनः राख्नुहोस्:");
  if (confirmPin === null) return;

  if (pin !== confirmPin) {
    alert("दुवै MPIN मिलेनन्।");
    return;
  }

  try {
    const salt = generateSalt();
    const hash = await hashPin(pin, salt);

    writeJSON(MPIN_KEY, {
      enabled: true,
      salt,
      hash,
      createdAt: new Date().toISOString(),
      version: 1
    });

    showStatus("securityStatus", "MPIN परिवर्तन भयो।");
    updateMpinStatus();
  } catch (error) {
    console.error(error);
    showStatus("securityStatus", error.message || "MPIN परिवर्तन हुन सकेन।", "error");
  }
}

async function disableMpin() {
  const config = getMpinConfig();

  if (!config.enabled) {
    showStatus("securityStatus", "MPIN पहिले नै बन्द छ।", "info");
    return;
  }

  if (!(await requireCurrentPin())) return;

  if (!askConfirmation("MPIN बन्द गर्ने? त्यसपछि PIN सुरक्षा हट्नेछ।")) return;

  localStorage.removeItem(MPIN_KEY);
  showStatus("securityStatus", "MPIN बन्द गरियो।", "info");
  updateMpinStatus();
}


/* =========================================
   APP LOCK AND AUTO LOCK
   ========================================= */

function lockApp() {
  const config = getMpinConfig();

  if (!config.enabled) {
    showStatus("securityStatus", "पहिले MPIN Enable गर्नुहोस्।", "info");
    return;
  }

  const overlay = $("mpinOverlay");
  if (!overlay) return;

  overlay.classList.remove("hidden");
  $("mpinInput").value = "";
  $("mpinError").textContent = "";
  $("mpinError").className = "status";
  $("mpinInput").focus();
}

function unlockApp() {
  $("mpinOverlay").classList.add("hidden");
  $("mpinInput").value = "";
  lastActivityAt = Date.now();
  startAutoLockTimer();
}

async function handleUnlock(event) {
  event.preventDefault();

  if (Date.now() < pinLockedUntil) {
    const remaining = Math.ceil((pinLockedUntil - Date.now()) / 1000);
    showStatus("mpinError", `केही समयपछि प्रयास गर्नुहोस् (${remaining}s)।`, "error");
    return;
  }

  const pin = $("mpinInput").value.trim();

  if (!validatePinFormat(pin)) {
    showStatus("mpinError", "४–८ अंकको MPIN राख्नुहोस्।", "error");
    return;
  }

  try {
    if (await verifyPin(pin)) {
      failedPinAttempts = 0;
      unlockApp();
    } else {
      failedPinAttempts++;

      if (failedPinAttempts >= 5) {
        failedPinAttempts = 0;
        pinLockedUntil = Date.now() + 60_000;
        showStatus("mpinError", "धेरै पटक गलत PIN भयो। १ मिनेट पर्खनुहोस्।", "error");
      } else {
        showStatus("mpinError", "गलत MPIN। फेरि प्रयास गर्नुहोस्।", "error");
      }

      $("mpinInput").value = "";
      $("mpinInput").focus();
    }
  } catch (error) {
    showStatus("mpinError", error.message || "PIN जाँच गर्न सकिएन।", "error");
  }
}

function startAutoLockTimer() {
  if (lockTimer) {
    clearInterval(lockTimer);
    lockTimer = null;
  }

  const settings = getSettings();
  const minutes = Number(settings.autoLockMinutes || 0);

  if (!Number.isFinite(minutes) || minutes <= 0) return;
  if (!getMpinConfig().enabled) return;

  lockTimer = setInterval(() => {
    const inactiveMs = Date.now() - lastActivityAt;

    if (inactiveMs >= minutes * 60 * 1000) {
      lockApp();
    }
  }, 5000);
}

function registerActivity() {
  if ($("mpinOverlay")?.classList.contains("hidden")) {
    lastActivityAt = Date.now();
  }
}

function saveAutoLock() {
  const settings = getSettings();
  settings.autoLockMinutes = $("autoLockMinutes").value;

  try {
    writeJSON(SETTINGS_KEY, settings);
    startAutoLockTimer();
    showStatus("securityStatus", "Auto Lock सेटिङ सुरक्षित भयो।");
  } catch (error) {
    console.error(error);
    showStatus("securityStatus", "Auto Lock सुरक्षित गर्न सकिएन।", "error");
  }
}


/* =========================================
   BACKUP EXPORT
   ========================================= */

function collectBackupData() {
  const data = {};

  DATA_KEYS.forEach(key => {
    const raw = localStorage.getItem(key);

    if (raw !== null) {
      data[key] = safeParse(raw, null);
    } else {
      data[key] = key === SETTINGS_KEY ? getSettings() : [];
    }
  });

  return {
    app: "General Store Management System",
    version: 1,
    exportedAt: new Date().toISOString(),
    data
  };
}

function exportBackup() {
  try {
    const backup = collectBackupData();
    const filename = `general-store-backup-${getLocalDateStamp()}.json`;

    downloadJSON(filename, backup);

    const now = new Date().toISOString();
    localStorage.setItem(LAST_BACKUP_KEY, now);
    updateLastBackup();

    showStatus("backupStatus", "Backup फाइल तयार गरियो। यसलाई सुरक्षित ठाउँमा राख्नुहोस्।");
  } catch (error) {
    console.error(error);
    showStatus("backupStatus", "Backup बनाउन सकिएन। Storage जाँच गर्नुहोस्।", "error");
  }
}


/* =========================================
   BACKUP VALIDATION AND RESTORE
   ========================================= */

function isPlainObject(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function validateBackup(backup) {
  if (!isPlainObject(backup)) {
    throw new Error("फाइलको JSON संरचना गलत छ।");
  }

  if (!isPlainObject(backup.data)) {
    throw new Error("Backup मा data section भेटिएन।");
  }

  const data = backup.data;
  const acceptedKeys = new Set(DATA_KEYS);

  for (const key of Object.keys(data)) {
    if (!acceptedKeys.has(key)) {
      throw new Error(`अज्ञात डेटा key भेटियो: ${key}`);
    }
  }

  for (const key of STORE_DATA_KEYS) {
    if (data[key] !== undefined && !Array.isArray(data[key]) && !isPlainObject(data[key])) {
      throw new Error(`${key} को डेटा संरचना मान्य छैन।`);
    }
  }

  if (data[SETTINGS_KEY] !== undefined && !isPlainObject(data[SETTINGS_KEY])) {
    throw new Error("Settings को संरचना मान्य छैन।");
  }

  if (Object.keys(data).length === 0) {
    throw new Error("Backup फाइलमा कुनै डेटा छैन।");
  }

  return true;
}

async function restoreBackup() {
  const file = $("restoreFile").files[0];

  if (!file) {
    showStatus("backupStatus", "पहिले Backup JSON फाइल छान्नुहोस्।", "error");
    return;
  }

  if (file.size > 20 * 1024 * 1024) {
    showStatus("backupStatus", "फाइल २० MB भन्दा ठूलो छ।", "error");
    return;
  }

  if (!(await requireCurrentPin())) return;

  let backup;

  try {
    const text = await file.text();
    backup = JSON.parse(text);
    validateBackup(backup);
  } catch (error) {
    console.error(error);
    showStatus("backupStatus", error.message || "Backup फाइल पढ्न सकिएन।", "error");
    return;
  }

  if (!askConfirmation(
    "चेतावनी: Restore गर्दा हालको Store Data प्रतिस्थापन हुनेछ।\n\n" +
    "पहिले हालको डेटा Export गर्नुभएको छ?\n\n" +
    "Restore जारी राख्ने?"
  )) {
    return;
  }

  // Restore अघि पुरानो डेटा memory मा राख्ने
  const snapshot = {};

  DATA_KEYS.forEach(key => {
    snapshot[key] = localStorage.getItem(key);
  });

  try {
    // Backup मा नभएका कारोबारका key खाली गरिन्छन्,
    // ताकि पुरानो र नयाँ डेटा मिसिन नपाओस्।
    STORE_DATA_KEYS.forEach(key => {
      if (backup.data[key] === undefined) {
        localStorage.setItem(key, JSON.stringify([]));
      } else {
        localStorage.setItem(key, JSON.stringify(backup.data[key]));
      }
    });

    // Backup मा settings छ भने मात्र restore गर्ने
    if (backup.data[SETTINGS_KEY] !== undefined) {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(backup.data[SETTINGS_KEY])
      );
    }

    showStatus("backupStatus", "Backup सफलतापूर्वक Restore भयो।");
    loadSettings();
    $("restoreFile").value = "";
  } catch (error) {
    console.error(error);

    // कुनै चरणमा त्रुटि आए पुरानो डेटा फर्काउने प्रयास
    try {
      DATA_KEYS.forEach(key => {
        if (snapshot[key] === null || snapshot[key] === undefined) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, snapshot[key]);
        }
      });
    } catch (rollbackError) {
      console.error("Rollback failed:", rollbackError);
    }

    showStatus(
      "backupStatus",
      "Restore असफल भयो। पुरानो डेटा फर्काउने प्रयास गरियो। Storage उपलब्धता जाँच गर्नुहोस्।",
      "error"
    );
  }
}


/* =========================================
   CLEAR STORE DATA SAFELY
   ========================================= */

async function clearAllData() {
  if (!(await requireCurrentPin())) return;

  const confirmed = askConfirmation(
    "⚠️ अन्तिम चेतावनी!\n\n" +
    "Products, Purchases, Sales, Customers, Suppliers र Finance डेटा हटाइनेछ।\n\n" +
    "Settings र MPIN भने सुरक्षित रहनेछन्।\n\n" +
    "पहिले Backup लिनुहोस्। डेटा मेटाउने?"
  );

  if (!confirmed) return;

  const snapshot = {};

  STORE_DATA_KEYS.forEach(key => {
    snapshot[key] = localStorage.getItem(key);
  });

  try {
    STORE_DATA_KEYS.forEach(key => {
      localStorage.setItem(key, JSON.stringify([]));
    });

    showStatus(
      "backupStatus",
      "Store Data हटाइयो। Settings र MPIN सुरक्षित छन्।"
    );
  } catch (error) {
    console.error(error);

    try {
      STORE_DATA_KEYS.forEach(key => {
        if (snapshot[key] === null) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, snapshot[key]);
        }
      });
    } catch (rollbackError) {
      console.error("Rollback failed:", rollbackError);
    }

    showStatus("backupStatus", "डेटा मेटाउने प्रक्रिया असफल भयो।", "error");
  }
}


/* =========================================
   FEEDBACK
   ========================================= */

function saveFeedback(event) {
  event.preventDefault();

  const type = $("feedbackType").value;
  const contact = $("feedbackContact").value.trim();
  const message = $("feedbackMessage").value.trim();

  if (!message) {
    showStatus("feedbackStatus", "Feedback विवरण लेख्नुहोस्।", "error");
    return;
  }

  const existing = readJSON(FEEDBACK_KEY, []);
  const feedbackList = Array.isArray(existing) ? existing : [];

  feedbackList.push({
    id: `FB-${Date.now()}`,
    type,
    contact,
    message,
    createdAt: new Date().toISOString()
  });

  try {
    writeJSON(FEEDBACK_KEY, feedbackList);
    $("feedbackForm").reset();

    showStatus(
      "feedbackStatus",
      "Feedback यस ब्राउजरमा सुरक्षित भयो। पठाउनका लागि Export Feedback प्रयोग गर्नुहोस्।"
    );
  } catch (error) {
    console.error(error);
    showStatus("feedbackStatus", "Feedback सुरक्षित गर्न सकिएन।", "error");
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
    {
      app: "General Store",
      exportedAt: new Date().toISOString(),
      feedback
    }
  );

  showStatus("feedbackStatus", "Feedback JSON फाइल Export गरियो।");
}


/* =========================================
   ABOUT AND STORAGE INFO
   ========================================= */

function showStorageInfo() {
  let totalBytes = 0;
  const lines = [];

  DATA_KEYS.forEach(key => {
    const value = localStorage.getItem(key);
    const bytes = value ? new Blob([value]).size : 0;

    totalBytes += bytes;
    lines.push(`${key}: ${value === null ? "डेटा छैन" : `${bytes.toLocaleString()} bytes`}`);
  });

  const kb = (totalBytes / 1024).toFixed(2);

  showStatus(
    "aboutStatus",
    `मुख्य Store Data को अनुमानित आकार: ${kb} KB\n${lines.join("\n")}`,
    "info"
  );
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
    : `अन्तिम Backup: ${date.toLocaleString()}`;
}


/* =========================================
   EVENT LISTENERS
   ========================================= */

function initializeSettingsPage() {
  $("profileForm")?.addEventListener("submit", saveProfile);
  $("systemForm")?.addEventListener("submit", saveSystemSettings);

  $("saveAppearanceBtn")?.addEventListener("click", saveAppearance);
  $("resetAppearanceBtn")?.addEventListener("click", resetAppearance);

  $("enableMpinBtn")?.addEventListener("click", setOrEnableMpin);
  $("changeMpinBtn")?.addEventListener("click", changeMpin);
  $("disableMpinBtn")?.addEventListener("click", disableMpin);
  $("lockNowBtn")?.addEventListener("click", lockApp);
  $("autoLockMinutes")?.addEventListener("change", saveAutoLock);

  $("mpinUnlockForm")?.addEventListener("submit", handleUnlock);

  $("exportBtn")?.addEventListener("click", exportBackup);
  $("restoreBtn")?.addEventListener("click", restoreBackup);
  $("clearDataBtn")?.addEventListener("click", clearAllData);

  $("feedbackForm")?.addEventListener("submit", saveFeedback);
  $("exportFeedbackBtn")?.addEventListener("click", exportFeedback);
  $("showStorageBtn")?.addEventListener("click", showStorageInfo);

  ["pointerdown", "keydown", "mousemove", "touchstart"].forEach(eventName => {
    document.addEventListener(eventName, registerActivity, { passive: true });
  });

  loadSettings();

  // MPIN सक्रिय छ भने Settings पेज खोल्दा लक गर्ने
  if (getMpinConfig().enabled) {
    lockApp();
  }
}

document.addEventListener("DOMContentLoaded", initializeSettingsPage);
