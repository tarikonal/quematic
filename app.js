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

  // —— Waving Turkish flag (canvas, offline) ——
  const flagCanvas = document.getElementById("flag-canvas");
  /** @type {HTMLCanvasElement | null} */
  let flagSource = null;
  /** @type {ImageData | null} */
  let flagSourceData = null;
  let flagAnimId = 0;
  let flagT0 = 0;

  function createFlagSource(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return c;

    ctx.fillStyle = "#E30A17";
    ctx.fillRect(0, 0, w, h);

    // Turkish Flag Law (G = height)
    const G = h;
    const cresCx = G / 2;
    const cresCy = G / 2;
    const rOuter = G / 4;
    const rInner = G / 5;
    const offset = G / 16;

    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(cresCx, cresCy, rOuter, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#E30A17";
    ctx.beginPath();
    ctx.arc(cresCx + offset, cresCy, rInner, 0, Math.PI * 2);
    ctx.fill();

    const starR = G / 8;
    const starCx = cresCx + offset + (rInner * 2) / 3 + starR * 0.9;
    const starCy = cresCy;
    const rot = (-18 * Math.PI) / 180;
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = rot + (i * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? starR : starR * 0.382;
      const x = starCx + Math.cos(ang) * r;
      const y = starCy + Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    return c;
  }

  function ensureFlagSource(w, h) {
    if (!flagSource || flagSource.width !== w || flagSource.height !== h) {
      flagSource = createFlagSource(w, h);
      const ctx = flagSource.getContext("2d", { willReadFrequently: true });
      flagSourceData = ctx ? ctx.getImageData(0, 0, w, h) : null;
    }
    return flagSource;
  }

  /**
   * Bilinear sample from source ImageData. Returns [r,g,b] or null if outside.
   * @param {ImageData} data
   * @param {number} w
   * @param {number} h
   * @param {number} x
   * @param {number} y
   */
  function sampleBilinear(data, w, h, x, y) {
    if (x < 0 || y < 0 || x > w - 1 || y > h - 1) return null;
    const x0 = x | 0;
    const y0 = y | 0;
    const x1 = x0 + 1 < w ? x0 + 1 : w - 1;
    const y1 = y0 + 1 < h ? y0 + 1 : h - 1;
    const fx = x - x0;
    const fy = y - y0;
    const buf = data.data;
    const i00 = (y0 * w + x0) * 4;
    const i10 = (y0 * w + x1) * 4;
    const i01 = (y1 * w + x0) * 4;
    const i11 = (y1 * w + x1) * 4;
    const r =
      buf[i00] * (1 - fx) * (1 - fy) +
      buf[i10] * fx * (1 - fy) +
      buf[i01] * (1 - fx) * fy +
      buf[i11] * fx * fy;
    const g =
      buf[i00 + 1] * (1 - fx) * (1 - fy) +
      buf[i10 + 1] * fx * (1 - fy) +
      buf[i01 + 1] * (1 - fx) * fy +
      buf[i11 + 1] * fx * fy;
    const b =
      buf[i00 + 2] * (1 - fx) * (1 - fy) +
      buf[i10 + 2] * fx * (1 - fy) +
      buf[i01 + 2] * (1 - fx) * fy +
      buf[i11 + 2] * fx * fy;
    return [r, g, b];
  }

  function drawWavingFlag(timeMs) {
    if (!flagCanvas) return;
    const ctx = flagCanvas.getContext("2d");
    if (!ctx) return;

    const outW = flagCanvas.width;
    const outH = flagCanvas.height;
    const pole = Math.max(10, Math.round(outW * 0.018));
    const marginY = Math.round(outH * 0.05);
    const clothW = outW - pole - 8;
    const clothH = outH - marginY * 2;

    ensureFlagSource(clothW, clothH);
    if (!flagSourceData) return;

    const t = timeMs * 0.001;
    const amp = clothH * 0.038;
    const wavelength = clothW * 0.38;
    const speed = 2.05;

    const yoff = new Float32Array(clothW);
    const xoff = new Float32Array(clothW);
    for (let x = 0; x < clothW; x++) {
      const u = x / Math.max(clothW - 1, 1);
      const edge = Math.pow(u, 0.72);
      const phase = (x / wavelength) * Math.PI * 2 - t * speed;
      yoff[x] =
        amp * edge * Math.sin(phase) +
        amp * 0.25 * edge * Math.sin(phase * 1.65 + 0.55);
      xoff[x] = 3.5 * edge * Math.sin(phase * 0.9 + 0.4);
    }

    const frame = ctx.createImageData(outW, outH);
    const out = frame.data;
    // dark stage background already transparent/black via clear
    for (let i = 0; i < out.length; i += 4) {
      out[i] = 10;
      out[i + 1] = 8;
      out[i + 2] = 10;
      out[i + 3] = 255;
    }

    for (let dx = 0; dx < clothW; dx++) {
      let slope = 0;
      if (dx > 0 && dx < clothW - 1) slope = yoff[dx + 1] - yoff[dx - 1];
      const shade = 1 - Math.max(-0.07, Math.min(0.07, slope * 0.012));

      for (let dy = 0; dy < outH; dy++) {
        const srcX = dx - xoff[dx];
        const srcY = dy - marginY - yoff[dx];
        const sample = sampleBilinear(flagSourceData, clothW, clothH, srcX, srcY);
        if (!sample) continue;
        const ox = pole + dx;
        const oi = (dy * outW + ox) * 4;
        out[oi] = Math.min(255, sample[0] * shade);
        out[oi + 1] = Math.min(255, sample[1] * shade);
        out[oi + 2] = Math.min(255, sample[2] * shade);
        out[oi + 3] = 255;
      }
    }

    ctx.putImageData(frame, 0, 0);

    // Metallic pole (vector overlay — crisp)
    const poleGrad = ctx.createLinearGradient(0, 0, pole, 0);
    poleGrad.addColorStop(0, "#5c636c");
    poleGrad.addColorStop(0.4, "#d4dae0");
    poleGrad.addColorStop(1, "#3e454e");
    ctx.fillStyle = poleGrad;
    ctx.fillRect(0, marginY * 0.35, pole, outH - marginY * 0.7);
    ctx.fillStyle = "#cfd5dc";
    ctx.beginPath();
    ctx.arc(pole / 2, marginY * 0.35, pole * 0.65, 0, Math.PI * 2);
    ctx.fill();
  }

  function tickFlag(now) {
    if (!flagT0) flagT0 = now;
    drawWavingFlag(now - flagT0);
    flagAnimId = window.requestAnimationFrame(tickFlag);
  }

  function startFlagWave() {
    stopFlagWave();
    flagT0 = 0;
    if (flagCanvas) {
      const stage = flagCanvas.parentElement;
      const rect = stage ? stage.getBoundingClientRect() : null;
      const cssW = rect && rect.width ? rect.width : 900;
      // Warp at moderate internal res, then CSS scales crisply enough for kiosk
      const targetW = Math.min(780, Math.max(520, Math.round(cssW * 0.85)));
      flagCanvas.width = targetW;
      flagCanvas.height = Math.round(targetW * (2 / 3));
      flagSource = null;
      flagSourceData = null;
    }
    flagAnimId = window.requestAnimationFrame(tickFlag);
  }

  function stopFlagWave() {
    if (flagAnimId) {
      window.cancelAnimationFrame(flagAnimId);
      flagAnimId = 0;
    }
  }

  // —— Idle screensaver ——
  function showScreensaver() {
    if (!screensaver) return;
    screensaver.hidden = false;
    screensaver.setAttribute("aria-hidden", "false");
    screensaver.classList.add("active");
    startFlagWave();
  }

  function hideScreensaver() {
    if (!screensaver) return;
    stopFlagWave();
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
