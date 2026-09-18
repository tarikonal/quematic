(() => {
  "use strict";

  const MAX_SLOTS = 4;
  const MIN_NUM = 1;
  const MAX_NUM = 9999;
  const MAX_DIGITS = 4;
  const STORAGE_KEY = "quematic-v1-queue";
  const HIGHLIGHT_MS = 900;
  const IDLE_MS = 60_000;

  /** @type {number[]} */
  let queue = [];
  /** @type {string} */
  let buffer = "";
  let highlightTimer = 0;
  let idleTimer = 0;

  const slots = Array.from(document.querySelectorAll(".slot"));
  const screensaver = document.getElementById("screensaver");

  // —— Web Audio beeps ——
  /** @type {AudioContext | null} */
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  /**
   * @param {number} freq
   * @param {number} duration
   * @param {number} [volume]
   * @param {OscillatorType} [type]
   */
  function tone(freq, duration, volume = 0.18, type = "sine") {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  const beeps = {
    post() {
      tone(880, 0.09, 0.2, "square");
      setTimeout(() => tone(1175, 0.1, 0.16, "square"), 70);
    },
    undo() {
      tone(520, 0.12, 0.16, "triangle");
      setTimeout(() => tone(350, 0.14, 0.14, "triangle"), 90);
    },
    clear() {
      tone(400, 0.07, 0.12, "sine");
    },
    error() {
      tone(180, 0.18, 0.22, "sawtooth");
    },
  };

  // —— Persistence ——
  function loadQueue() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((n) => Number.isInteger(n) && n >= MIN_NUM && n <= MAX_NUM)
        .slice(-MAX_SLOTS);
    } catch {
      return [];
    }
  }

  function saveQueue() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch {
      /* quota / private mode — ignore */
    }
  }

  // —— Render ——
  function render(highlightNewest) {
    for (let i = 0; i < MAX_SLOTS; i++) {
      const slot = slots[i];
      const numEl = slot.querySelector(".num");
      const value = queue[i];
      slot.classList.remove("filled", "highlight");
      if (value == null) {
        numEl.textContent = "";
        slot.setAttribute("aria-hidden", "true");
      } else {
        numEl.textContent = String(value);
        slot.classList.add("filled");
        slot.removeAttribute("aria-hidden");
        if (highlightNewest && i === queue.length - 1) {
          slot.classList.add("highlight");
        }
      }
    }
  }

  function flashNewest() {
    clearTimeout(highlightTimer);
    render(true);
    highlightTimer = window.setTimeout(() => {
      slots.forEach((s) => s.classList.remove("highlight"));
    }, HIGHLIGHT_MS);
  }

  // —— Queue ops ——
  function postNumber(n) {
    if (queue.includes(n)) {
      beeps.error();
      return;
    }
    queue.push(n);
    if (queue.length > MAX_SLOTS) {
      queue.shift();
    }
    saveQueue();
    flashNewest();
    beeps.post();
  }

  function undoLast() {
    if (queue.length === 0) {
      beeps.error();
      return;
    }
    queue.pop();
    saveQueue();
    render(false);
    beeps.undo();
  }

  function clearBuffer() {
    if (buffer.length === 0) {
      beeps.error();
      return;
    }
    buffer = "";
    beeps.clear();
  }

  function pushDigit(d) {
    if (buffer.length >= MAX_DIGITS) {
      beeps.error();
      return;
    }
    buffer += d;
  }

  function confirmEntry() {
    if (buffer.length === 0) {
      beeps.error();
      return;
    }
    const n = parseInt(buffer, 10);
    buffer = "";
    if (!Number.isInteger(n) || n < MIN_NUM || n > MAX_NUM) {
      beeps.error();
      return;
    }
    postNumber(n);
  }

  // —— Idle screensaver ——
  function showScreensaver() {
    if (!screensaver) return;
    screensaver.hidden = false;
    screensaver.setAttribute("aria-hidden", "false");
    screensaver.classList.add("active");
  }

  function hideScreensaver() {
    if (!screensaver) return;
    screensaver.hidden = true;
    screensaver.setAttribute("aria-hidden", "true");
    screensaver.classList.remove("active");
  }

  function isScreensaverVisible() {
    return Boolean(screensaver && !screensaver.hidden);
  }

  function resetIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      showScreensaver();
    }, IDLE_MS);
  }

  // —— Keyboard / numpad ——
  /**
   * @param {KeyboardEvent} e
   */
  function onKeyDown(e) {
    // Unlock audio on first staff keystroke
    ensureAudio();

    const wasScreensaver = isScreensaverVisible();
    if (wasScreensaver) {
      hideScreensaver();
    }
    resetIdleTimer();

    // Dismiss screensaver only — do not also apply the key as input
    if (wasScreensaver) {
      e.preventDefault();
      return;
    }

    const key = e.key;

    // Enter / numpad Enter confirms the buffered order number
    if (key === "Enter" || e.code === "NumpadEnter") {
      e.preventDefault();
      confirmEntry();
      return;
    }

    if (key >= "0" && key <= "9") {
      e.preventDefault();
      pushDigit(key);
      return;
    }

    // Numpad digits via code (some layouts)
    if (e.code && e.code.startsWith("Numpad") && e.code.length === 7) {
      const digit = e.code.slice(-1);
      if (digit >= "0" && digit <= "9") {
        e.preventDefault();
        pushDigit(digit);
        return;
      }
    }

    // * clear incomplete buffer
    if (key === "*" || e.code === "NumpadMultiply") {
      e.preventDefault();
      clearBuffer();
      return;
    }

    // # undo last posted; fallback: numpad Minus when # missing
    if (key === "#" || key === "-" || e.code === "NumpadSubtract") {
      e.preventDefault();
      undoLast();
      return;
    }
  }

  // —— Boot ——
  queue = loadQueue();
  render(false);
  hideScreensaver();
  resetIdleTimer();
  window.addEventListener("keydown", onKeyDown);

  // Resume audio after browser gesture policies if needed
  window.addEventListener(
    "pointerdown",
    () => {
      ensureAudio();
    },
    { once: true }
  );
})();
