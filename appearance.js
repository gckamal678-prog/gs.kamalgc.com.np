/* =========================================================
   GENERAL STORE MANAGEMENT SYSTEM - APPEARANCE ENGINE
   Supports all pages including Inventory.html
   ========================================================= */

(function () {
  "use strict";

  const SETTINGS_KEY = "gs_settings";

  const DEFAULTS = {
    theme: "light",
    fontFamily: "Arial, sans-serif",
    fontSize: "15",
    accentColor: "#166534"
  };

  function getSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      return saved && typeof saved === "object" ? saved : {};
    } catch (error) {
      console.warn("Could not read appearance settings:", error);
      return {};
    }
  }

  function getAppearanceSettings() {
    const saved = getSettings();
    return {
      ...DEFAULTS,
      ...saved,
      ...(saved.appearance && typeof saved.appearance === "object"
        ? saved.appearance
        : {})
    };
  }

  function safeAccentColor(value) {
    const color = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULTS.accentColor;
  }

  function safeFontSize(value) {
    const size = String(value || DEFAULTS.fontSize);
    return ["13", "15", "17", "19"].includes(size) ? size : DEFAULTS.fontSize;
  }

  function safeFontFamily(value) {
    const allowedFonts = {
      "Arial": "Arial, sans-serif",
      "Roboto": "Roboto, Arial, sans-serif",
      "Inter": "Inter, Arial, sans-serif",
      "System": "system-ui, sans-serif",
      "Georgia": "Georgia, serif",
      "Verdana": "Verdana, sans-serif"
    };
    const font = String(value || "").trim();
    return allowedFonts[font] || (/^[a-zA-Z0-9 "'(),-]+$/.test(font) ? font : DEFAULTS.fontFamily);
  }

  function addGlobalAppearanceStyles() {
    if (document.getElementById("gs-global-appearance-style")) return;

    const style = document.createElement("style");
    style.id = "gs-global-appearance-style";

    style.textContent = `
      html {
        font-family: var(--font-family, Arial, sans-serif);
        font-size: var(--font-size, 15px);
      }
      body {
        font-family: var(--font-family, Arial, sans-serif) !important;
        font-size: var(--font-size, 15px);
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  function applyAppearance() {
    const appearance = getAppearanceSettings();
    const root = document.documentElement;

    const theme = String(appearance.theme).toLowerCase() === "dark" ? "dark" : "light";
    const accent = safeAccentColor(appearance.accentColor);
    const fontSize = safeFontSize(appearance.fontSize);
    const fontFamily = safeFontFamily(appearance.fontFamily);

    root.dataset.theme = theme;
    root.style.colorScheme = theme;

    // Set variables used across inventory.html and other pages
    root.style.setProperty("--font-family", fontFamily);
    root.style.setProperty("--font-size", fontSize + "px");
    root.style.setProperty("--accent-color", accent);

    if (theme === "dark") {
      root.style.setProperty("--body-bg", "#111827");
      root.style.setProperty("--card-bg", "#1f2937");
      root.style.setProperty("--text-color", "#f3f4f6");
      root.style.setProperty("--muted-color", "#9ca3af");
      root.style.setProperty("--border-color", "#374151");
      root.style.setProperty("--hover-bg", "#273449");
      root.style.setProperty("--table-header-bg", "#273449");
      root.style.setProperty("--input-bg", "#111827");
    } else {
      root.style.setProperty("--body-bg", "#f3f6fa");
      root.style.setProperty("--card-bg", "#ffffff");
      root.style.setProperty("--text-color", "#111827");
      root.style.setProperty("--muted-color", "#6b7280");
      root.style.setProperty("--border-color", "#e5e7eb");
      root.style.setProperty("--hover-bg", "#f8fafc");
      root.style.setProperty("--table-header-bg", "#f8fafc");
      root.style.setProperty("--input-bg", "#ffffff");
    }

    addGlobalAppearanceStyles();

    if (document.body) {
      document.body.classList.toggle("dark-theme", theme === "dark");
    }
  }

  window.GSAppearance = {
    apply: applyAppearance,
    getSettings: getSettings
  };

  applyAppearance();

  window.addEventListener("storage", function (event) {
    if (event.key === SETTINGS_KEY || event.key === null) {
      applyAppearance();
    }
  });
})();
