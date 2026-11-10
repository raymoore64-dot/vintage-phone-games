/*
 * Tiny WebAudio helper for Simon (and anything else that wants a beep).
 *
 * Safe no-throw: missing AudioContext, autoplay blocks, or a mid-beep
 * error are all swallowed. The context is created and resumed only after
 * unlockAudio() runs, which must be called from a user gesture
 * (key / pointer / on-screen button).
 */

let ctx = null;
let unlocked = false;

function getCtx() {
  if (ctx) return ctx;
  if (!unlocked) return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Call from a click / key press so the browser will allow sound. */
export function unlockAudio() {
  try {
    unlocked = true;
    const c = getCtx();
    if (c && c.state === 'suspended') {
      const p = c.resume();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  } catch {
    // ignore
  }
}

/**
 * Play a short tone. No-ops until unlockAudio() has been called, and
 * never throws.
 *
 * @param {number} freq      Hz
 * @param {number} duration  seconds
 * @param {string} type      oscillator type
 * @param {number} gain      peak gain (keep small)
 */
export function beep(freq = 440, duration = 0.16, type = 'square', gain = 0.08) {
  try {
    const c = getCtx();
    if (!c) return;
    if (c.state === 'suspended') {
      const p = c.resume();
      if (p && typeof p.catch === 'function') p.catch(() => {});
      return;
    }
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const now = c.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
    osc.onended = () => {
      try { osc.disconnect(); g.disconnect(); } catch { /* already gone */ }
    };
  } catch {
    // ignore
  }
}

export function isAudioReady() {
  return unlocked && !!ctx && ctx.state === 'running';
}

export default { beep, unlockAudio, isAudioReady };
