/* =========================================================
   GENERAL STORE MANAGEMENT SYSTEM - APPEARANCE ENGINE
   Updated to support index.html (Dashboard) variables & classes
   ========================================================= */

(function () {
  "use strict";

  const SETTINGS_KEY = "gs_settings";

  const DEFAULTS = {
    theme: "light",
    fontFamily: "Arial, sans-serif",
    fontSize: "15",
    accentColor: "#ec00ed"
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
    return allowedFonts[font] || ( /^[a-zA-Z0-9 "'(),-]+$/.test(font) ? font : DEFAULTS.fontFamily );
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

      /* Dashboard Accent & Theme Bridge */
      :root {
        --gs-pink: var(--accent-color, #ec00ed);
      }

      html[data-theme="dark"] {
        color-scheme: dark;
        --gs-bg: #111827;
        --gs-panel: #1f2937;
        --gs-input: #111827;
        --gs-border: #374151;
        --gs-text: #f3f4f6;
        --gs-muted: #9ca3af;
      }

      html[data-theme="light"] {
        color-scheme: light;
        --gs-bg: #f3f4f6;
        --gs-panel: #ffffff;
        --gs-input: #f9fafb;
        --gs-border: #e5e7eb;
        --gs-text: #111827;
        --gs-muted: #6b7280;
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

    root.style.setProperty("--font-family", fontFamily);
    root.style.setProperty("--font-size", fontSize + "px");
    root.style.setProperty("--accent-color", accent);
    root.style.setProperty("--gs-pink", accent);

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
