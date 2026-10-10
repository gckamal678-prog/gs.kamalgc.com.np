
"use strict";

(() => {
  const MPIN_KEY = "gs_mpin_security";
  const SETTINGS_KEY = "gs_settings";
  const SESSION_KEY = "gs_auth_unlocked";
  const LAST_ACTIVITY_KEY = "gs_auth_last_activity";

  let timer = null;
  let failedAttempts = 0;
  let lockedUntil = 0;
  let overlay;
  let input;
  let errorBox;
  let unlockButton;

  const $ = id => document.getElementById(id);

  function readJSON(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function getConfig() {
    const config = readJSON(MPIN_KEY, null);
    return config && config.enabled === true &&
      typeof config.hash === "string" &&
      typeof config.salt === "string"
      ? config
      : null;
  }

  function getTimeoutMinutes() {
    const settings = readJSON(SETTINGS_KEY, {});
    const minutes = Number(settings?.autoLockMinutes ?? 5);
    return Number.isFinite(minutes) && minutes >= 0 ? minutes : 5;
  }

  async function hashPin(pin, salt) {
    if (!crypto?.subtle) {
      throw new Error("Secure Crypto उपलब्ध छैन। localhost वा HTTPS प्रयोग गर्नुहोस्।");
    }

    const bytes = new TextEncoder().encode(`${salt}:${pin}`);
    const digest = await crypto.subtle.digest("SHA-256", bytes);

    return Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async function verifyPin(pin) {
    const config = getConfig();
    if (!config) return false;

    const hash = await hashPin(pin, config.salt);
    if (hash.length !== config.hash.length) return false;

    let mismatch = 0;
    for (let i = 0; i < hash.length; i++) {
      mismatch |= hash.charCodeAt(i) ^ config.hash.charCodeAt(i);
    }

    return mismatch === 0;
  }

  function buildGate() {
    if ($("gsAuthOverlay")) {
      overlay = $("gsAuthOverlay");
      input = $("gsAuthPin");
      errorBox = $("gsAuthError");
      unlockButton = $("gsAuthUnlock");
      return;
    }

    const style = document.createElement("style");
    style.textContent = `
      #gsAuthOverlay {
        position: fixed; inset: 0; z-index: 2147483000;
        display: flex; align-items: center; justify-content: center;
        padding: 20px; background: #f3f6f4; color: #1f2937;
        font-family: Arial, sans-serif;
      }
      #gsAuthOverlay * { box-sizing: border-box; }
      #gsAuthOverlay .gs-auth-card {
        width: 100%; max-width: 390px; padding: 28px;
        border: 1px solid #dbe3dd; border-radius: 18px;
        background: white; box-shadow: 0 15px 50px #00000018;
      }
      #gsAuthOverlay h2 { margin: 0 0 8px; }
      #gsAuthOverlay p { color: #64748b; line-height: 1.6; }
      #gsAuthOverlay input {
        display: block; width: 100%; padding: 13px;
        margin: 14px 0; border: 1px solid #cbd5e1;
        border-radius: 9px; font-size: 22px;
        text-align: center; letter-spacing: 7px;
      }
      #gsAuthOverlay button {
        width: 100%; padding: 12px; border: 0;
        border-radius: 9px; background: #166534;
        color: white; font-weight: 700; cursor: pointer;
      }
      #gsAuthOverlay button:disabled { opacity: .6; }
      #gsAuthError { color: #b91c1c; min-height: 22px; margin: 8px 0; }
      #gsAuthOverlay .gs-auth-note { font-size: 12px; }
      body.gs-auth-locked > *:not(#gsAuthOverlay) {
        visibility: hidden !important;
      }
      body.gs-auth-locked { overflow: hidden !important; }
      body.dark-theme #gsAuthOverlay { background: #111827; color: #f3f4f6; }
      body.dark-theme #gsAuthOverlay .gs-auth-card {
        background: #1f2937; border-color: #475569;
      }
      body.dark-theme #gsAuthOverlay input {
        background: #111827; color: #f3f4f6; border-color: #475569;
      }
    `;
    document.head.appendChild(style);

    overlay = document.createElement("div");
    overlay.id = "gsAuthOverlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
      <div class="gs-auth-card">
        <div style="font-size:38px;margin-bottom:12px">🔐</div>
        <h2 id="gsAuthTitle">General Store</h2>
        <p id="gsAuthDescription">एप खोल्न आफ्नो MPIN राख्नुहोस्।</p>
        <form id="gsAuthForm">
          <label for="gsAuthPin">MPIN (४–८ अंक)</label>
          <input id="gsAuthPin" type="password" inputmode="numeric"
            pattern="[0-9]{4,8}" maxlength="8" autocomplete="current-password" required>
          <div id="gsAuthError" role="alert" aria-live="polite"></div>
          <button id="gsAuthUnlock" type="submit">Unlock App</button>
        </form>
        <p class="gs-auth-note">
          MPIN बिर्सनुभयो भने यस ब्राउजरमा सुरक्षित गरिएको डेटा जोगाएर
          PIN पुनःप्राप्त गर्न छुट्टै recovery सुविधा आवश्यक पर्छ।
        </p>
      </div>
    `;
    document.body.appendChild(overlay);

    input = $("gsAuthPin");
    errorBox = $("gsAuthError");
    unlockButton = $("gsAuthUnlock");

    $("gsAuthForm").addEventListener("submit", handleUnlock);
  }

  function showGate(message = "") {
    document.body.classList.add("gs-auth-locked");
    overlay.style.display = "flex";
    input.value = "";
    errorBox.textContent = message;
    input.focus();
  }

  function hideGate() {
    overlay.style.display = "none";
    document.body.classList.remove("gs-auth-locked");
    input.value = "";
    errorBox.textContent = "";
  }

  function isSessionValid() {
    return sessionStorage.getItem(SESSION_KEY) === "yes";
  }

  function setSession() {
    sessionStorage.setItem(SESSION_KEY, "yes");
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  async function handleUnlock(event) {
    event.preventDefault();

    if (Date.now() < lockedUntil) {
      errorBox.textContent =
        `धेरै पटक गलत MPIN भयो। ${Math.ceil((lockedUntil - Date.now()) / 1000)} सेकेन्डपछि प्रयास गर्नुहोस्।`;
      return;
    }

    const pin = input.value.trim();

    if (!/^[0-9]{4,8}$/.test(pin)) {
      errorBox.textContent = "MPIN ४ देखि ८ अंकको हुनुपर्छ।";
      return;
    }

    const config = getConfig();

    if (!config) {
      errorBox.textContent = "MPIN सेट गरिएको छैन। Settings मा MPIN सेट गर्नुहोस्।";
      return;
    }

    unlockButton.disabled = true;

    try {
      if (await verifyPin(pin)) {
        failedAttempts = 0;
        setSession();
        hideGate();
        startTimer();
      } else {
        failedAttempts++;

        if (failedAttempts >= 5) {
          failedAttempts = 0;
          lockedUntil = Date.now() + 60000;
          errorBox.textContent = "५ पटक गलत भयो। १ मिनेटपछि प्रयास गर्नुहोस्।";
        } else {
          errorBox.textContent = "गलत MPIN। फेरि प्रयास गर्नुहोस्।";
        }

        input.value = "";
        input.focus();
      }
    } catch (error) {
      errorBox.textContent = error.message || "MPIN जाँच गर्न सकिएन।";
    } finally {
      unlockButton.disabled = false;
    }
  }

  function lock() {
    if (!getConfig()) return;

    clearSession();
    stopTimer();
    showGate();
  }

  function startTimer() {
    stopTimer();

    const minutes = getTimeoutMinutes();
    if (minutes <= 0 || !isSessionValid()) return;

    timer = setInterval(() => {
      if (!isSessionValid()) {
        stopTimer();
        return;
      }

      const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || Date.now());

      if (Date.now() - last >= minutes * 60000) {
        lock();
      }
    }, 3000);
  }

  function stopTimer() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function recordActivity() {
    if (!isSessionValid()) return;
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  }

  function init() {
    buildGate();

    document.addEventListener("pointerdown", recordActivity, { passive: true });
    document.addEventListener("keydown", recordActivity);
    document.addEventListener("touchstart", recordActivity, { passive: true });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && isSessionValid()) {
        const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || Date.now());
        const minutes = getTimeoutMinutes();

        if (minutes > 0 && Date.now() - last >= minutes * 60000) {
          lock();
        }
      }
    });

    if (!getConfig()) {
      clearSession();
      showGate("पहिले Settings मा गएर MPIN सेट गर्नुहोस्।");
      return;
    }

    if (isSessionValid()) {
      hideGate();
      startTimer();
    } else {
      showGate();
    }
  }

  window.GSAuth = {
    lock,
    isUnlocked: isSessionValid,
    resetTimer: startTimer
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
