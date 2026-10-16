"use strict";

(function () {
  const SETTINGS_KEY = "gs_settings";
  const STYLE_ID = "gs-global-appearance-style";

  const DEFAULTS = {
    theme: "light",
    fontFamily: "Arial, sans-serif",
    fontSize: "15",
    accentColor: "#166534"
  };

  const FONT_MAP = {
    Arial: "Arial, sans-serif",
    Roboto: "Roboto, Arial, sans-serif",
    Inter: "Inter, Arial, sans-serif",
    System: "system-ui, sans-serif",
    Georgia: "Georgia, serif",
    Verdana: "Verdana, sans-serif"
  };

  const THEMES = {
    light: {
      body: "#f3f6fa",
      card: "#ffffff",
      text: "#111827",
      muted: "#6b7280",
      border: "#e5e7eb",
      input: "#ffffff",
      table: "#f8fafc",
      hover: "#f1f5f9"
    },
    dark: {
      body: "#111827",
      card: "#1f2937",
      text: "#f3f4f6",
      muted: "#9ca3af",
      border: "#374151",
      input: "#111827",
      table: "#273449",
      hover: "#273449"
    }
  };

  function readSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const saved = raw ? JSON.parse(raw) : {};

      return saved &&
        typeof saved === "object" &&
        !Array.isArray(saved)
        ? saved
        : {};
    } catch (error) {
      console.warn(
        "[GSAppearance] Settings पढ्न सकिएन:",
        error
      );
      return {};
    }
  }

  function getSettings() {
    return readSettings();
  }

  function getAppearanceSettings() {
    const saved = readSettings();

    const nested =
      saved.appearance &&
      typeof saved.appearance === "object" &&
      !Array.isArray(saved.appearance)
        ? saved.appearance
        : {};

    return {
      ...DEFAULTS,
      ...saved,
      ...nested
    };
  }

  function normalizeTheme(value) {
    return String(value || "")
      .trim()
      .toLowerCase() === "dark"
      ? "dark"
      : "light";
  }

  function normalizeAccent(value) {
    const color = String(value || "").trim();

    return /^#[0-9a-f]{6}$/i.test(color)
      ? color
      : DEFAULTS.accentColor;
  }

  function normalizeFontSize(value) {
    const size = String(value ?? DEFAULTS.fontSize)
      .trim()
      .replace(/px$/i, "");

    return ["13", "15", "17", "19"].includes(size)
      ? size
      : DEFAULTS.fontSize;
  }

  function normalizeFontFamily(value) {
    const font = String(
      value || DEFAULTS.fontFamily
    ).trim();

    if (FONT_MAP[font]) {
      return FONT_MAP[font];
    }

    const allowedPattern =
      /^[a-zA-Z0-9 "'(),_-]+$/;

    return allowedPattern.test(font)
      ? font
      : DEFAULTS.fontFamily;
  }

  function setVariable(root, name, value) {
    root.style.setProperty(name, value);
  }

  function addGlobalAppearanceStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;

    style.textContent = `
      :root {
        color-scheme: light;

        --font-family: Arial, sans-serif;
        --font-size: 15px;

        --accent-color: #166534;
        --primary: #166534;
        --primary-dark: #14532d;
        --link-color: #166534;
        --focus-color: #166534;

        --body-bg: #f3f6fa;
        --card-bg: #ffffff;
        --panel-bg: #ffffff;
        --text-color: #111827;
        --muted-color: #6b7280;
        --border-color: #e5e7eb;
        --input-bg: #ffffff;
        --table-header-bg: #f8fafc;
        --hover-bg: #f1f5f9;

        --gs-bg: var(--body-bg);
        --gs-panel: var(--card-bg);
        --gs-input: var(--input-bg);
        --gs-border: var(--border-color);
      }

      html {
        font-family: var(--font-family);
        font-size: var(--font-size);
        background: var(--body-bg);
        color: var(--text-color);
      }

      body {
        margin: 0;
        font-family: var(--font-family) !important;
        font-size: var(--font-size);
        background-color: var(--body-bg);
        color: var(--text-color);
        transition:
          background-color .2s ease,
          color .2s ease;
      }

      *,
      *::before,
      *::after {
        box-sizing: border-box;
      }

      button,
      input,
      select,
      textarea,
      option {
        font-family: var(--font-family);
      }

      input,
      select,
      textarea {
        font-size: inherit;
        color: var(--text-color);
        border-color: var(--border-color);
      }

      input::placeholder,
      textarea::placeholder {
        color: var(--muted-color);
        opacity: 1;
      }

      button {
        cursor: pointer;
      }

      a {
        color: var(--link-color);
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
        .card,
        .panel,
        .stat-card,
        .dashboard-card,
        .settings-card,
        .modal-content,
        .dialog-content
      ) {
        border-color: var(--border-color);
      }

      :where(
        .sale-btn.primary,
        .return-btn.primary,
        .purchase-btn.primary,
        .inventory-btn.primary,
        .customer-btn.primary,
        .supplier-btn.primary,
        .supplier-btn-primary,
        .finance-btn.primary,
        .btn-primary,
        button.primary,
        .primary-btn,
        .save-btn,
        .submit-btn
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
        .supplier-btn.primary,
        .supplier-btn-primary,
        .finance-btn.primary,
        .btn-primary,
        button.primary,
        .primary-btn,
        .save-btn,
        .submit-btn
      ):hover {
        filter: brightness(.94);
      }

      :where(
        input,
        select,
        textarea,
        button
      ):focus-visible {
        outline-color: var(--focus-color);
      }

      :where(
        .sale-table,
        .return-table,
        .purchase-table,
        .inventory-table,
        .customer-table,
        .supplier-table,
        .finance-table,
        table
      ) th,
      :where(
        .sale-table,
        .return-table,
        .purchase-table,
        .inventory-table,
        .customer-table,
        .supplier-table,
        .finance-table,
        table
      ) td {
        border-color: var(--border-color);
      }

      :where(
        .sale-table,
        .return-table,
        .purchase-table,
        .inventory-table,
        .customer-table,
        .supplier-table,
        .finance-table,
        table
      ) th {
        background-color: var(--table-header-bg);
        color: var(--text-color);
      }

      html[data-theme="dark"] {
        color-scheme: dark;
      }

      html[data-theme="dark"] body {
        background-color: var(--body-bg);
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
        .card,
        .panel,
        .stat-card,
        .dashboard-card,
        .settings-card,
        .modal-content,
        .dialog-content
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

      html[data-theme="dark"] table th {
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
        h5,
        h6,
        th,
        td,
        small,
        legend
      ) {
        color: inherit;
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

      html[data-theme="dark"] :where(
        a
      ) {
        color: var(--link-color);
      }

      html[data-theme="dark"] :where(
        .muted,
        .text-muted,
        .secondary-text,
        .help-text
      ) {
        color: var(--muted-color);
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
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
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

    (document.head || document.documentElement)
      .appendChild(style);
  }

  function applyAppearance() {
    if (!document.documentElement) {
      return;
    }

    const appearance = getAppearanceSettings();
    const root = document.documentElement;

    const theme = normalizeTheme(appearance.theme);
    const accent = normalizeAccent(
      appearance.accentColor
    );
    const fontSize = normalizeFontSize(
      appearance.fontSize
    );
    const fontFamily = normalizeFontFamily(
      appearance.fontFamily
    );

    const colors = THEMES[theme];

    root.dataset.theme = theme;
    root.style.colorScheme = theme;

    setVariable(root, "--font-family", fontFamily);
    setVariable(root, "--font-size", fontSize + "px");

    setVariable(root, "--accent-color", accent);
    setVariable(root, "--primary", accent);
    setVariable(root, "--primary-dark", accent);
    setVariable(root, "--link-color", accent);
    setVariable(root, "--focus-color", accent);

    setVariable(root, "--body-bg", colors.body);
    setVariable(root, "--card-bg", colors.card);
    setVariable(root, "--panel-bg", colors.card);
    setVariable(root, "--text-color", colors.text);
    setVariable(root, "--muted-color", colors.muted);
    setVariable(root, "--border-color", colors.border);
    setVariable(root, "--input-bg", colors.input);
    setVariable(root, "--table-header-bg", colors.table);
    setVariable(root, "--hover-bg", colors.hover);

    // Shared appearance variables for ALL pages.
    setVariable(root, "--gs-bg", colors.body);
    setVariable(root, "--gs-panel", colors.card);
    setVariable(root, "--gs-input", colors.input);
    setVariable(root, "--gs-border", colors.border);
    setVariable(root, "--gs-text", colors.text);
    setVariable(root, "--gs-muted", colors.muted);
    setVariable(root, "--gs-pink", accent);

    // Reports page compatibility.
    setVariable(root, "--r-bg", colors.body);
    setVariable(root, "--r-card", colors.card);
    setVariable(root, "--r-text", colors.text);
    setVariable(root, "--r-muted", colors.muted);
    setVariable(root, "--r-border", colors.border);
    setVariable(root, "--r-accent", accent);

    // Settings page compatibility.
    setVariable(root, "--bg", colors.body);
    setVariable(root, "--surface", colors.card);
    setVariable(root, "--text", colors.text);
    setVariable(root, "--muted", colors.muted);
    setVariable(root, "--border", colors.border);
    setVariable(root, "--green", accent);

    addGlobalAppearanceStyles();

    function updateBodyTheme() {
      if (!document.body) {
        return;
      }

      document.body.classList.toggle(
        "dark-theme",
        theme === "dark"
      );

      document.body.classList.toggle(
        "light-theme",
        theme === "light"
      );
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

  // Public API: preserve compatibility with settings.js.
  window.GSAppearance = {
    apply: applyAppearance,
    getSettings: getSettings,
    getAppearanceSettings: getAppearanceSettings
  };

  // Apply saved settings immediately.
  applyAppearance();

  // Reapply after settings change in another tab.
  window.addEventListener("storage", function (event) {
    if (
      event.key === SETTINGS_KEY ||
      event.key === null
    ) {
      applyAppearance();
    }
  });

  // Allow other same-page code to request a refresh.
  document.addEventListener(
    "gs:appearance-change",
    applyAppearance
  );
})();
