import Phaser from 'phaser';

/*
 * One input bus for the whole phone.
 * The on-screen buttons and the physical keyboard both feed it, and every
 * scene listens to the same actions:
 *   up, down, left, right, ok, softLeft, softRight, back, pause,
 *   digit (with '0'-'9', '*'; '#' is pause, not a digit)
 * Like old Nokias, keypad 2/4/6/8 also act as up/left/right/down and 5 acts as OK.
 *
 * Pause: keyboard P, and the keypad '#' key, emit a 'pause' event. Space
 * stays OK. Star (*) stays a digit (Space Impact uses it for Echo Burst).
 *
 * isHeld(action) is true while a key or on-screen button is down, so games
 * can steer continuously or auto-repeat fire without changing the press-once
 * events the rest of the app already uses.
 *
 * When a scene has a pause controller attached (attachPause), bound handlers
 * are gated: while the game is frozen, movement and digits are swallowed,
 * OK / left soft / P / # resume, and C / Esc / right soft return to the menu.
 *
 * Power key: holding the red C key (or keyboard Esc / End) for HOLD_MS
 * emits 'powerHold' once per hold. A normal tap still emits 'back'.
 *
 * Input capture: setInputCapture(fn) routes every press to fn(action,
 * digit) instead of the scenes (used by the power-off screen, the boot
 * PIN screen and incoming calls). 'powerHold' is never captured.
 */

const bus = new Phaser.Events.EventEmitter();

const DIGIT_ALIASES = { 2: 'up', 4: 'left', 6: 'right', 8: 'down', 5: 'ok' };

const KEYBOARD = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  Enter: 'ok', ' ': 'ok',
  q: 'softLeft', Q: 'softLeft',
  e: 'softRight', E: 'softRight',
  Escape: 'back', Backspace: 'back', End: 'back',
  p: 'pause', P: 'pause'
};

// Holding these keys down shouldn't fire them over and over
const NO_REPEAT = new Set(['ok', 'softLeft', 'softRight', 'back', 'pause']);

const digitId = (d) => (d === '*' ? 'star' : d === '#' ? 'hash' : `d${d}`);

let initialized = false;
let capture = null;

// ---- Red key hold = power ---------------------------------------------------
export const HOLD_MS = 1200;
const powerHolds = new Set();   // sources currently holding the red key
let powerTimer = 0;
let powerFired = false;

function powerDown(src) {
  powerHolds.add(src);
  if (powerTimer || powerFired) return;
  powerTimer = setTimeout(() => {
    powerTimer = 0;
    if (!powerHolds.size) return;
    powerFired = true;
    bus.emit('powerHold');
  }, HOLD_MS);
}

function powerUp(src) {
  powerHolds.delete(src);
  if (powerHolds.size) return;
  clearTimeout(powerTimer);
  powerTimer = 0;
  powerFired = false;
}

function powerReset() {
  powerHolds.clear();
  clearTimeout(powerTimer);
  powerTimer = 0;
  powerFired = false;
}

/** Route all presses to fn(action, digit) (null to release). Returns a release fn. */
export function setInputCapture(fn) {
  capture = typeof fn === 'function' ? fn : null;
  const mine = capture;
  return () => { if (capture === mine) capture = null; };
}

export function hasInputCapture() {
  return !!capture;
}
let softCache = { left: null, right: null };

// Keyboard ref-counts (ArrowUp and W can both mean "up") plus pointer holds.
const keyCounts = new Map();
const keyHeldDigits = new Set();
const pointerHolds = new Map();
const held = new Set();

function rebuildHeld() {
  held.clear();
  keyCounts.forEach((n, action) => { if (n > 0) held.add(action); });
  keyHeldDigits.forEach((d) => {
    const alias = DIGIT_ALIASES[d];
    if (alias) held.add(alias);
  });
  pointerHolds.forEach((h) => {
    if (h.action === 'digit') {
      const alias = DIGIT_ALIASES[h.digit];
      if (alias) held.add(alias);
    } else {
      held.add(h.action);
    }
  });
}

export function isHeld(action) {
  return held.has(action);
}

export function getInputBus() {
  return bus;
}

// Light up the on-screen button that matches a press (keyboard included)
function flash(id) {
  const el = document.querySelector(`[data-key="${id}"]`);
  if (!el) return;
  el.classList.add('pressed');
  clearTimeout(el._flashTimer);
  el._flashTimer = setTimeout(() => el.classList.remove('pressed'), 130);
}

export function press(action, digit) {
  if (capture) {
    flash(action === 'digit' ? digitId(digit) : action);
    try { capture(action, digit); } catch (err) { console.warn('input capture failed', err); }
    return;
  }
  if (action === 'digit') {
    // '#' is the pause key on the keypad; it is not forwarded as a digit.
    if (digit === '#') {
      flash(digitId(digit));
      bus.emit('pause');
      return;
    }
    flash(digitId(digit));
    bus.emit('digit', digit);
    const alias = DIGIT_ALIASES[digit];
    if (alias) bus.emit(alias);
    return;
  }
  flash(action);
  bus.emit(action);
}

function releasePointer(pointerId) {
  if (!pointerHolds.has(pointerId)) return;
  pointerHolds.delete(pointerId);
  rebuildHeld();
}

export function initPhoneInput() {
  if (initialized) return;
  initialized = true;

  window.__vpg = window.__vpg || {};
  window.__vpg.getInputBus = getInputBus;
  window.__vpg.press = press;

  document.querySelectorAll('[data-key]').forEach((el) => {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch { /* older browsers */ }
      const d = el.dataset.digit;
      if (d !== undefined) {
        pointerHolds.set(e.pointerId, { action: 'digit', digit: d });
        rebuildHeld();
        press('digit', d);
      } else {
        pointerHolds.set(e.pointerId, { action: el.dataset.key });
        rebuildHeld();
        if (el.dataset.key === 'back') powerDown(`p${e.pointerId}`);
        press(el.dataset.key);
      }
    });
    const up = (e) => {
      if (el.dataset.key === 'back') powerUp(`p${e.pointerId}`);
      releasePointer(e.pointerId);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[0-9*#]$/.test(e.key)) {
      if (!e.repeat) {
        keyHeldDigits.add(e.key);
        rebuildHeld();
        press('digit', e.key);
      }
    } else if (KEYBOARD[e.key]) {
      const action = KEYBOARD[e.key];
      if (!e.repeat) {
        keyCounts.set(action, (keyCounts.get(action) || 0) + 1);
        rebuildHeld();
        if (e.key === 'Escape' || e.key === 'End') powerDown(`k${e.key}`);
      }
      if (!(e.repeat && NO_REPEAT.has(action))) press(action);
    } else {
      return;
    }
    e.preventDefault();
  });

  window.addEventListener('keyup', (e) => {
    if (/^[0-9*#]$/.test(e.key)) {
      keyHeldDigits.delete(e.key);
      rebuildHeld();
    } else if (KEYBOARD[e.key]) {
      const action = KEYBOARD[e.key];
      if (e.key === 'Escape' || e.key === 'End') powerUp(`k${e.key}`);
      const n = (keyCounts.get(action) || 1) - 1;
      if (n <= 0) keyCounts.delete(action);
      else keyCounts.set(action, n);
      rebuildHeld();
    }
  });

  window.addEventListener('blur', () => {
    keyCounts.clear();
    keyHeldDigits.clear();
    pointerHolds.clear();
    rebuildHeld();
    powerReset();
  });
}

// Set the labels shown above the two soft keys
export function setSoftKeys(left = '', right = '') {
  if (softCache.left !== left) {
    const el = document.getElementById('soft-left');
    if (el) el.textContent = left;
    softCache.left = left;
  }
  if (softCache.right !== right) {
    const el = document.getElementById('soft-right');
    if (el) el.textContent = right;
    softCache.right = right;
  }
}

export function getSoftKeys() {
  return { left: softCache.left || '', right: softCache.right || '' };
}

/*
 * Listen to phone actions from a scene. Handlers are removed automatically
 * when the scene shuts down (scene.start / scene.restart), so nothing leaks.
 *   bindPhoneInput(this, { up: () => ..., ok: () => ..., digit: (d) => ... });
 *
 * If attachPause() has been (or will be) called on the scene, these
 * handlers are gated while the game is frozen so a single binding does
 * both gameplay and pause-overlay input.
 */
export function bindPhoneInput(scene, handlers) {
  const entries = Object.entries(handlers).map(([evt, fn]) => {
    const wrapped = (...args) => {
      const ctl = scene.__pauseCtl;
      if (ctl && ctl.isFrozen()) {
        if (evt === 'ok' || evt === 'softLeft' || evt === 'pause') {
          ctl.resume();
          return;
        }
        if (evt === 'back' || evt === 'softRight') {
          ctl.toMenu();
          return;
        }
        return;
      }
      fn(...args);
    };
    return [evt, wrapped];
  });
  entries.forEach(([evt, fn]) => bus.on(evt, fn, scene));
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    entries.forEach(([evt, fn]) => bus.off(evt, fn, scene));
  });
}
