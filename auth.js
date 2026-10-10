
"use strict";

(function () {
  const MPIN_KEY = "gs_mpin_security";
  const SETTINGS_KEY = "gs_settings";

  let failedAttempts = 0;
  let lockedUntil = 0;
  let lastActivity = Date.now();
  let timer = null;
  let isLocked = false;

  function readJSON(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
    } catch {
      return fallback;
    }
  }

  function getConfig() {
    const config = readJSON(MPIN_KEY, { enabled: false });
    return config && typeof config === "object"
      ? config
      : { enabled: false };
  }

  function getIdleMinutes() {
    const settings = readJSON(SETTINGS_KEY, {});
    const minutes = Number(settings?.autoLockMinutes ?? 5);
    return Number.isFinite(minutes) && minutes >= 0 ? minutes : 5;
  }

  function validPin(pin) {
    return /^[0-9]{4,8}$/.test(pin);
  }

  async function hashPin(pin, salt) {
    if (!crypto?.subtle) {
      throw new Error("Secure Crypto उपलब्ध छैन। localhost वा HTTPS प्रयोग गर्नुहोस्।");
    }

    const bytes = new TextEncoder().encode(`${salt}:${pin}`);
    const hash = await crypto.subtle.digest("SHA-256", bytes);

    return Array.from(new Uint8Array(hash))
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async function verifyPin(pin) {
    const config = getConfig();

    if (!config.enabled || !config.hash || !config.salt) {
      return false;
    }

    const candidate = await hashPin(pin, config.salt);
    if (candidate.length !== config.hash.length) return false;

    let difference = 0;
    for (let i = 0; i < candidate.length; i++) {
      difference |= candidate.charCodeAt(i) ^ config.hash.charCodeAt(i);
    }

    return difference === 0;
  }

  function buildOverlay() {
    let overlay = document.getElementById("gs-auth-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "gs-auth-overlay";
    overlay.innerHTML = `
      <div class="gs-auth-card">
        <div class="gs-auth-icon">🔐</div>
        <h2>App Locked</h2>
        <p>एप खोल्न आफ्नो MPIN राख्नुहोस्।</p>
        <form id="gs-auth-form">
          <label for="gs-auth-pin">MPIN</label>
          <input id="gs-auth-pin" type="password"
            inputmode="numeric" autocomplete="current-password"
            minlength="4" maxlength="8" required
            placeholder="४–८ अंकको MPIN">
          <p id="gs-auth-error" role="status"></p>
          <button type="submit">Unlock</button>
        </form>
      </div>
    `;

    const style = document.createElement("style");
    style.textContent = `
      #gs-auth-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: #111827;
        color: #f9fafb;
      }
      #gs-auth-overlay.gs-visible { display: flex; }
      .gs-auth-card {
        width: min(100%, 380px);
        padding: 28px;
        border-radius: 18px;
        background: #fff;
        color: #111827;
        box-shadow: 0 20px 60px #0006;
        font-family: Arial, sans-serif;
      }
      .gs-auth-icon { font-size: 40px; text-align: center; }
      .gs-auth-card h2, .gs-auth-card p { text-align: center; }
      .gs-auth-card label { display: block; margin: 16px 0 6px; }
      .gs-auth-card input {
        box-sizing: border-box;
        width: 100%;
        padding: 12px;
        border: 1px solid #d1d5db;
        border-radius: 9px;
      }
      .gs-auth-card button {
        width: 100%;
        margin-top: 12px;
        padding: 12px;
        border: 0;
        border-radius: 9px;
        color: white;
        background: #166534;
        cursor: pointer;
      }
      #gs-auth-error { color: #dc2626; min-height: 1em; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(overlay);

    overlay.querySelector("#gs-auth-form").addEventListener("submit", async event => {
      event.preventDefault();

      const input = overlay.querySelector("#gs-auth-pin");
      const error = overlay.querySelector("#gs-auth-error");

      if (Date.now() < lockedUntil) {
        error.textContent = `केही समयपछि प्रयास गर्नुहोस्।`;
        return;
      }

      const pin = input.value.trim();
      if (!validPin(pin)) {
        error.textContent = "४–८ अंकको MPIN राख्नुहोस्।";
        return;
      }

      try {
        if (await verifyPin(pin)) {
          failedAttempts = 0;
          isLocked = false;
          lastActivity = Date.now();
          overlay.classList.remove("gs-visible");
          input.value = "";
          startTimer();
        } else {
          failedAttempts++;
          input.value = "";
          if (failedAttempts >= 5) {
            failedAttempts = 0;
            lockedUntil = Date.now() + 60000;
            error.textContent = "धेरै पटक गलत PIN भयो। १ मिनेटपछि प्रयास गर्नुहोस्।";
          } else {
            error.textContent = "गलत MPIN। फेरि प्रयास गर्नुहोस्।";
          }
          input.focus();
        }
      } catch (err) {
        error.textContent = err.message || "PIN जाँच गर्न सकिएन।";
      }
    });

    return overlay;
  }

  function lock() {
    if (!getConfig().enabled) return;

    isLocked = true;
    const overlay = buildOverlay();
    overlay.classList.add("gs-visible");
    overlay.querySelector("#gs-auth-pin").value = "";
    overlay.querySelector("#gs-auth-error").textContent = "";
    stopTimer();
    overlay.querySelector("#gs-auth-pin").focus();
  }

  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function startTimer() {
    stopTimer();
    if (!getConfig().enabled) return;

    timer = setInterval(() => {
      if (isLocked || document.hidden) return;

      const minutes = getIdleMinutes();
      if (minutes > 0 && Date.now() - lastActivity >= minutes * 60000) {
        lock();
      }
    }, 3000);
  }

  function recordActivity() {
    if (!isLocked) lastActivity = Date.now();
  }

  function initialize() {
    if (!document.body) return;

    if (getConfig().enabled) {
      lock();
      startTimer();
    }

    ["pointerdown", "keydown", "touchstart", "mousemove"].forEach(name => {
      document.addEventListener(name, recordActivity, { passive: true });
    });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && getConfig().enabled) {
        if (getIdleMinutes() > 0 &&
            Date.now() - lastActivity >= getIdleMinutes() * 60000) {
          lock();
        }
      }
    });

    window.addEventListener("storage", event => {
      if (event.key === MPIN_KEY && getConfig().enabled) {
        lock();
      }
    });
  }

  window.GSAuth = { lock, verifyPin, getConfig, startTimer };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
