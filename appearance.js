"use strict";

(function () {
  const SETTINGS_KEY = "gs_settings";

  const DEFAULTS = {
    theme: "light",
    fontFamily: "Arial, sans-serif",
    fontSize: "15",
    accentColor: "#166534"
  };

  function getSettings() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(SETTINGS_KEY) || "{}"
      );

      return saved && typeof saved === "object" ? saved : {};
    } catch (error) {
      console.warn("Could not read appearance settings:", error);
      return {};
    }
  }

  function getAppearanceSettings() {
    const saved = getSettings();

    // Supports both root-level and nested appearance settings.
    return {
      ...DEFAULTS,
      ...saved,
      ...(saved.appearance &&
      typeof saved.appearance === "object"
        ? saved.appearance
        : {})
    };
  }

  function safeAccentColor(value) {
    const color = String(value || "").trim();

    return /^#[0-9a-f]{6}$/i.test(color)
      ? color
      : DEFAULTS.accentColor;
  }

  function safeFontSize(value) {
    const size = String(value || DEFAULTS.fontSize);

    return ["13", "15", "17", "19"].includes(size)
      ? size
      : DEFAULTS.fontSize;
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

    if (allowedFonts[font]) {
      return allowedFonts[font];
    }

    // Preserve an already-stored CSS font-family value.
    const safePattern =
      /^[a-zA-Z0-9 "'(),-]+$/;

    return safePattern.test(font)
      ? font
      : DEFAULTS.fontFamily;
  }

  function addGlobalAppearanceStyles() {
    if (document.getElementById("gs-global-appearance-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "gs-global-appearance-style";

    style.textContent = `
      :root {
        --font-family: Arial, sans-serif;
        --font-size: 15px;
        --accent-color: #166534;
        --primary: #166534;
        --primary-dark: #14532d;
        --body-bg: #f3f6fa;
        --card-bg: #ffffff;
        --text-color: #111827;
        --muted-color: #6b7280;
        --border-color: #e5e7eb;
        --input-bg: #ffffff;
        --table-header-bg: #f8fafc;
        --hover-bg: #f1f5f9;
      }

      html {
        font-family: var(--font-family);
        font-size: var(--font-size);
      }

      body {
        font-family: var(--font-family) !important;
        font-size: var(--font-size);
        background-color: var(--body-bg);
        color: var(--text-color);
        transition:
          background-color 0.2s ease,
          color 0.2s ease;
      }

      button,
      input,
      select,
      textarea {
        font-family: var(--font-family);
      }

      input,
      select,
      textarea {
        color: var(--text-color);
        border-color: var(--border-color);
      }

      button {
        cursor: pointer;
      }

      :where(
        .sale-btn,
        .return-btn,
        .purchase-btn,
        .inventory-btn,
        .customer-btn,
        .supplier-btn,
        .finance-btn,
        .btn-primary,
        button.primary
      ) {
        border-radius: 9px;
      }

      :where(
        .sale-stat,
        .return-stat,
        .purchase-stat,
        .inventory-stat,
        .customer-stat,
        .supplier-stat,
        .finance-stat,
        .sale-panel,
        .return-panel,
        .purchase-panel,
        .inventory-panel,
        .customer-panel,
        .supplier-panel,
        .finance-panel,
        .card
      ) {
        border-color: var(--border-color);
      }

      :where(
        .sale-btn.primary,
        .return-btn.primary,
        .purchase-btn.primary,
        .inventory-btn.primary,
        .customer-btn.primary,
        .supplier-btn-primary,
        .finance-btn.primary,
        .btn-primary,
        button.primary
      ) {
        background-color: var(--accent-color);
        border-color: var(--accent-color);
        color: #ffffff;
      }

      :where(
        .sale-btn.primary,
        .return-btn.primary,
        .purchase-btn.primary,
        .inventory-btn.primary,
        .customer-btn.primary,
        .supplier-btn-primary,
        .finance-btn.primary,
        .btn-primary,
        button.primary
      ):hover {
        filter: brightness(0.94);
      }

      :where(
        .sale-table,
        .return-table,
        .purchase-table,
        .inventory-table,
        .customer-table,
        .supplier-table,
        .finance-table
      ) th {
        border-color: var(--border-color);
      }

      html[data-theme="dark"] {
        color-scheme: dark;
        --body-bg: #111827;
        --card-bg: #1f2937;
        --text-color: #f3f4f6;
        --muted-color: #9ca3af;
        --border-color: #374151;
        --input-bg: #111827;
        --table-header-bg: #273449;
        --hover-bg: #273449;
      }

      html[data-theme="dark"] body {
        background-color: var(--body-bg) !important;
        color: var(--text-color);
      }

      html[data-theme="dark"] :where(
        .sale-stat,
        .return-stat,
        .purchase-stat,
        .inventory-stat,
        .customer-stat,
        .supplier-stat,
        .finance-stat,
        .sale-panel,
        .return-panel,
        .purchase-panel,
        .inventory-panel,
        .customer-panel,
        .supplier-panel,
        .finance-panel,
        .card
      ) {
        background-color: var(--card-bg);
        color: var(--text-color);
        border-color: var(--border-color);
      }

      html[data-theme="dark"] :where(
        input,
        select,
        textarea
      ) {
        background-color: var(--input-bg);
        color: var(--text-color);
        border-color: var(--border-color);
      }

      html[data-theme="dark"] :where(
        table th,
        table td
      ) {
        border-color: var(--border-color);
      }

      html[data-theme="dark"] :where(
        table th
      ) {
        background-color: var(--table-header-bg);
        color: var(--text-color);
      }

      html[data-theme="dark"] :where(
        p,
        label,
        h1,
        h2,
        h3,
        h4,
        th,
        td
      ) {
        border-color: var(--border-color);
      }

      html[data-theme="dark"] :where(
        button,
        .sale-btn,
        .return-btn,
        .purchase-btn,
        .inventory-btn,
        .customer-btn,
        .supplier-btn,
        .finance-btn
      ) {
        border-color: var(--border-color);
      }

      @media (max-width: 760px) {
        :where(
          .sale-wrap,
          .return-wrap,
          .purchase-wrap,
          .inventory-wrap,
          .customer-wrap,
          .supplier-page,
          .finance-wrap
        ) {
          max-width: 100%;
          box-sizing: border-box;
        }

        :where(
          .sale-stats,
          .return-stats,
          .purchase-stats,
          .inventory-stats,
          .customer-stats,
          .supplier-stats,
          .finance-stats
        ) {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        :where(
          .sale-grid,
          .return-grid,
          .purchase-grid,
          .inventory-grid,
          .customer-grid,
          .supplier-grid,
          .finance-grid
        ) {
          min-width: 0;
        }

        :where(input, select, textarea) {
          max-width: 100%;
          box-sizing: border-box;
        }
      }

      @media (max-width: 420px) {
        :where(
          .sale-stats,
          .return-stats,
          .purchase-stats,
          .inventory-stats,
          .customer-stats,
          .supplier-stats,
          .finance-stats
        ) {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  function applyAppearance() {
    const appearance = getAppearanceSettings();
    const root = document.documentElement;

    const theme =
      String(appearance.theme).toLowerCase() === "dark"
        ? "dark"
        : "light";

    const accent = safeAccentColor(appearance.accentColor);
    const fontSize = safeFontSize(appearance.fontSize);
    const fontFamily = safeFontFamily(appearance.fontFamily);

    root.dataset.theme = theme;
    root.style.colorScheme = theme;

    root.style.setProperty("--font-family", fontFamily);
    root.style.setProperty("--font-size", fontSize + "px");
    root.style.setProperty("--accent-color", accent);
    root.style.setProperty("--primary", accent);
    root.style.setProperty("--primary-dark", accent);

    root.style.setProperty(
      "--body-bg",
      theme === "dark" ? "#111827" : "#f3f6fa"
    );

    root.style.setProperty(
      "--card-bg",
      theme === "dark" ? "#1f2937" : "#ffffff"
    );

    root.style.setProperty(
      "--text-color",
      theme === "dark" ? "#f3f4f6" : "#111827"
    );

    root.style.setProperty(
      "--muted-color",
      theme === "dark" ? "#9ca3af" : "#6b7280"
    );

    root.style.setProperty(
      "--border-color",
      theme === "dark" ? "#374151" : "#e5e7eb"
    );

    root.style.setProperty(
      "--input-bg",
      theme === "dark" ? "#111827" : "#ffffff"
    );

    root.style.setProperty(
      "--table-header-bg",
      theme === "dark" ? "#273449" : "#f8fafc"
    );

    root.style.setProperty(
      "--hover-bg",
      theme === "dark" ? "#273449" : "#f1f5f9"
    );

    addGlobalAppearanceStyles();

    function updateBodyTheme() {
      if (document.body) {
        document.body.classList.toggle(
          "dark-theme",
          theme === "dark"
        );
      }
    }

    updateBodyTheme();

    if (!document.body) {
      document.addEventListener(
        "DOMContentLoaded",
        updateBodyTheme,
        { once: true }
      );
    }
  }

  // Keep the public API used by settings.js.
  window.GSAppearance = {
    apply: applyAppearance,
    getSettings: getSettings
  };

  // Apply saved settings as soon as this file loads.
  applyAppearance();

  // Re-apply when another page/tab changes the saved settings.
  window.addEventListener("storage", function (event) {
    if (
      event.key === SETTINGS_KEY ||
      event.key === null
    ) {
      applyAppearance();
    }
  });
})();
