
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
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      return saved && typeof saved === "object" ? saved : {};
    } catch {
      return {};
    }
  }

  function applyAppearance() {
    const settings = getSettings();
    const appearance = {
      ...DEFAULTS,
      ...(settings.appearance || {})
    };

    const theme = appearance.theme === "dark" ? "dark" : "light";
    const size = ["13", "15", "17", "19"].includes(String(appearance.fontSize))
      ? String(appearance.fontSize)
      : DEFAULTS.fontSize;

    const root = document.documentElement;

    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    root.style.setProperty("--font-family", appearance.fontFamily || DEFAULTS.fontFamily);
    root.style.setProperty("--font-size", size + "px");
    root.style.setProperty("--accent-color", appearance.accentColor || DEFAULTS.accentColor);

    document.body?.classList.toggle("dark-theme", theme === "dark");

    if (!document.getElementById("gs-global-appearance-style")) {
      const style = document.createElement("style");
      style.id = "gs-global-appearance-style";
      style.textContent = `
        html, body {
          font-family: var(--font-family, Arial, sans-serif);
          font-size: var(--font-size, 15px);
        }

        body {
          transition: background-color .2s, color .2s;
        }

        button, .btn-primary, .primary-btn {
          accent-color: var(--accent-color, #166534);
        }

        input, select, textarea {
          font-family: inherit;
          font-size: inherit;
        }

        body.dark-theme {
          background-color: #111827;
          color: #f3f4f6;
        }

        body.dark-theme .card,
        body.dark-theme .tile,
        body.dark-theme .settings-nav {
          background-color: #1f2937;
          color: #f3f4f6;
          border-color: #374151;
        }

        body.dark-theme input,
        body.dark-theme select,
        body.dark-theme textarea {
          background-color: #111827;
          color: #f9fafb;
          border-color: #4b5563;
        }

        body.dark-theme p,
        body.dark-theme label,
        body.dark-theme h1,
        body.dark-theme h2,
        body.dark-theme h3 {
          color: inherit;
        }
      `;
      document.head.appendChild(style);
    }
  }

  window.GSAppearance = {
    apply: applyAppearance,
    getSettings
  };

  applyAppearance();

  window.addEventListener("storage", function (event) {
    if (event.key === SETTINGS_KEY || event.key === null) {
      applyAppearance();
    }
  });
})();
