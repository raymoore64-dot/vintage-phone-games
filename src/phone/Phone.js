/*
 * The "living phone": battery, signal, clock and the HTML status bar that
 * sits above the LCD on every scene, plus the toast + buzz used for
 * incoming texts. State persists in localStorage 'vpg.phone'.
 *
 * Battery (0-100, 5 bars of 20):
 *   - drains while a game is actually being played: 1 bar per 3 minutes
 *   - recharges on menus (1 bar / 40 s) and on pause / game-over (half that)
 *   - recharges between sessions: 1 bar per 10 minutes away
 *   - at 1 bar: one "battery low" beep + toast
 *   - at 0: the screen dims, "Plug in!" shows, and it fast-charges back to
 *     1 bar in about 3 seconds. Play is never blocked.
 *   - secret "mains power" code: battery never drains.
 *
 * Signal (1-5 bars) wanders every few seconds. Texts only arrive with 2+
 * bars and never during active play (Sms.js queues them).
 *
 * Debug: window.__vpg.phone.{state, setTimeScale, setBattery, setSignal,
 *        setHour, activity}
 */

import { isFrozen } from '../ui/PauseOverlay.js';
import * as Lcd from './Lcd.js';
import * as Secrets from './Secrets.js';
import * as Sfx from '../audio/Sfx.js';

export const STORAGE_KEY = 'vpg.phone';
export const GAME_SCENES = new Set([
  'SnakeScene', 'BounceScene', 'ImpactScene', 'BricksScene', 'BlocksScene', 'SimonScene'
]);

const DRAIN_PER_SEC = 20 / 180;      // 1 bar per 3 minutes of play
const CHARGE_PER_SEC = 20 / 40;      // 1 bar per 40 s on menus
const IDLE_CHARGE_PER_SEC = 20 / 80; // paused / game over
const OFFLINE_PER_MIN = 2;           // 1 bar per 10 minutes away
const LOW_AT = 20;
const RESCUE_MS = 3000;

let game = null;
let state = { battery: 100, lastSeen: Date.now() };
let timeScale = 1;
let signal = 4;
let signalLocked = false;
let nextSignalAt = 0;
let hourOverride = null;
let activity = 'menu';
let lowWarned = false;
let rescue = null;            // { start, from } while fast-charging from empty
let lastSave = 0;
let lastRender = { batt: -1, sig: -1, clock: '', unread: -1, plug: null, charging: null };
let unreadSource = () => 0;
const tickHooks = [];
const receiveGates = [];
let toastTimer = 0;
const toastQueue = [];
let toastBusy = false;

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    const b = Number(d && d.battery);
    const seen = Number(d && d.lastSeen);
    state.battery = Number.isFinite(b) ? Math.min(100, Math.max(0, b)) : 100;
    if (Number.isFinite(seen) && seen > 0) {
      const mins = Math.max(0, (Date.now() - seen) / 60000);
      state.battery = Math.min(100, state.battery + mins * OFFLINE_PER_MIN);
    }
  } catch {
    // keep defaults
  }
}

function save(force = false) {
  const now = Date.now();
  if (!force && now - lastSave < 4000) return;
  lastSave = now;
  state.lastSeen = now;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ battery: Math.round(state.battery * 100) / 100, lastSeen: now }));
  } catch {
    // ignore
  }
}

export function batteryLevel() {
  return state.battery;
}

export function batteryBars() {
  if (state.battery <= 0) return 0;
  return Math.max(1, Math.min(5, Math.ceil(state.battery / 20)));
}

export function signalBars() {
  return signal;
}

export function getActivity() {
  return activity;
}

export function hour() {
  return hourOverride != null ? hourOverride : new Date().getHours();
}

function clockText() {
  const d = new Date();
  const h = hourOverride != null ? hourOverride : d.getHours();
  return `${String(h).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function isNight() {
  const h = hour();
  return h >= 23 || h < 5;
}

/** Texts arrive only off-gameplay and with at least 2 bars. */
export function canReceive() {
  if (activity === 'play' || signal < 2) return false;
  return receiveGates.every((fn) => { try { return fn() !== false; } catch { return true; } });
}

/** Extra conditions for texts arriving (power on, no call ringing...). */
export function addReceiveGate(fn) {
  if (typeof fn === 'function') receiveGates.push(fn);
}

export function setUnreadSource(fn) {
  unreadSource = typeof fn === 'function' ? fn : () => 0;
  render(true);
}

export function onTick(fn) {
  tickHooks.push(fn);
}

function detectActivity() {
  if (!game) return 'menu';
  const scenes = game.scene.getScenes(true);
  const s = scenes.find((sc) => GAME_SCENES.has(sc.scene.key));
  if (s) {
    if (s.alive === false || isFrozen(s)) return 'idle';
    return 'play';
  }
  return 'menu';
}

function stepSignal(nowMs) {
  if (signalLocked || nowMs < nextSignalAt) return;
  nextSignalAt = nowMs + 4000 + Math.random() * 5000;
  const r = Math.random();
  let d = r < 0.4 ? -1 : r < 0.8 ? 1 : 0;
  if (signal <= 2 && d < 0 && Math.random() < 0.6) d = 1;
  signal = Math.max(1, Math.min(5, signal + d));
}

function tick(_time, deltaMs) {
  const dt = Math.min(Math.max(0, deltaMs || 0), 250) / 1000 * timeScale;
  const now = performance.now();
  activity = detectActivity();
  stepSignal(now);

  if (rescue) {
    const p = Math.min(1, (now - rescue.start) / RESCUE_MS);
    state.battery = Math.max(state.battery, rescue.from + (LOW_AT - rescue.from) * p);
    if (p >= 1) {
      rescue = null;
      state.battery = Math.max(state.battery, LOW_AT);
      Lcd.setDim(false);
      toast('Charged! Back to it');
    }
  } else if (activity === 'play') {
    if (!Secrets.has('mains')) {
      const before = state.battery;
      state.battery = Math.max(0, state.battery - DRAIN_PER_SEC * dt);
      if (before > LOW_AT && state.battery <= LOW_AT && !lowWarned) {
        lowWarned = true;
        Sfx.play('batteryLow');
        toast('Battery low!');
      }
      if (state.battery <= 0) startRescue();
    }
  } else {
    const rate = activity === 'menu' ? CHARGE_PER_SEC : IDLE_CHARGE_PER_SEC;
    state.battery = Math.min(100, state.battery + rate * dt);
  }
  if (state.battery > LOW_AT + 5) lowWarned = false;

  tickHooks.forEach((fn) => {
    try { fn(now); } catch (err) { console.warn('phone tick hook failed', err); }
  });
  render();
  save();
}

function startRescue() {
  if (rescue) return;
  rescue = { start: performance.now(), from: 0 };
  state.battery = 0;
  Lcd.setDim(true);
  Sfx.play('batteryLow');
  toast('⚡ Plug in! Charging...', 2800, true);
}

// ---- Status bar -----------------------------------------------------------

function $(id) {
  return document.getElementById(id);
}

export function render(force = false) {
  const bars = batteryBars();
  const plug = Secrets.has('mains');
  const charging = !!rescue || (activity !== 'play' && state.battery < 100);
  if (force || bars !== lastRender.batt || plug !== lastRender.plug || charging !== lastRender.charging) {
    lastRender.batt = bars;
    lastRender.plug = plug;
    lastRender.charging = charging;
    const el = $('sb-batt');
    if (el) {
      el.querySelectorAll('.cell').forEach((c, i) => c.classList.toggle('off', i >= bars));
      el.classList.toggle('empty', bars === 0);
      el.classList.toggle('low', bars === 1);
      el.classList.toggle('charging', charging);
      el.classList.toggle('mains', plug);
    }
  }
  if (force || signal !== lastRender.sig) {
    lastRender.sig = signal;
    const el = $('sb-signal');
    if (el) el.querySelectorAll('.bar').forEach((b, i) => b.classList.toggle('off', i >= signal));
  }
  const ct = clockText();
  if (force || ct !== lastRender.clock) {
    lastRender.clock = ct;
    const el = $('sb-clock');
    if (el) el.textContent = ct;
  }
  const unread = Number(unreadSource()) || 0;
  if (force || unread !== lastRender.unread) {
    lastRender.unread = unread;
    const el = $('sb-mail');
    const n = $('sb-unread');
    if (el) el.classList.toggle('has', unread > 0);
    if (n) n.textContent = unread > 0 ? String(unread) : '';
  }
}

// ---- Toast + buzz ---------------------------------------------------------

export function toast(msg, ms = 2400, urgent = false) {
  if (urgent) {
    // Battery-empty etc: jump the queue and replace whatever is showing
    toastQueue.unshift({ msg, ms });
    clearTimeout(toastTimer);
    nextToast();
    return;
  }
  toastQueue.push({ msg, ms });
  if (!toastBusy) nextToast();
}

export function clearToasts() {
  toastQueue.length = 0;
  clearTimeout(toastTimer);
  toastBusy = false;
  const el = $('phone-toast');
  if (el) el.classList.remove('show');
}

function nextToast() {
  const el = $('phone-toast');
  const item = toastQueue.shift();
  if (!el || !item) {
    toastBusy = false;
    return;
  }
  toastBusy = true;
  el.textContent = item.msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
    toastTimer = setTimeout(nextToast, 220);
  }, item.ms);
}

export function buzz() {
  const el = document.querySelector('.phone');
  if (el) {
    el.classList.remove('buzz');
    void el.offsetWidth;
    el.classList.add('buzz');
    clearTimeout(el._buzzTimer);
    el._buzzTimer = setTimeout(() => el.classList.remove('buzz'), 520);
  }
  try {
    // Only after a real tap/keypress, or browsers log an intervention warning
    const ua = navigator.userActivation;
    if (navigator.vibrate && ua && ua.hasBeenActive) navigator.vibrate([90, 60, 90]);
  } catch {
    // not supported
  }
}

// ---- Init -----------------------------------------------------------------

export function initPhone(g) {
  game = g;
  load();
  save(true);
  if (game && game.events) game.events.on('step', tick);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });
  window.addEventListener('pagehide', () => save(true));
  // keep the clock right even if the game loop is idle
  setInterval(() => render(), 5000);
  render(true);

  window.__vpg = window.__vpg || {};
  window.__vpg.phone = {
    state: () => ({
      battery: Math.round(state.battery * 100) / 100,
      bars: batteryBars(),
      signal,
      activity,
      night: isNight(),
      hour: hour(),
      rescuing: !!rescue,
      mains: Secrets.has('mains'),
      timeScale
    }),
    setTimeScale: (n) => { timeScale = Math.max(0, Number(n) || 1); return timeScale; },
    setBattery: (n) => { state.battery = Math.min(100, Math.max(0, Number(n) || 0)); rescue = null; Lcd.setDim(false); render(true); save(true); return state.battery; },
    setSignal: (n, lock = true) => { signal = Math.max(1, Math.min(5, Number(n) || 1)); signalLocked = !!lock; render(true); return signal; },
    setHour: (h) => { hourOverride = h == null ? null : Number(h); render(true); return hour(); },
    toast,
    clearToasts,
    buzz
  };
}

/** Spend some battery (answering a call). Never below 1%; mains = free. */
export function drain(pct) {
  if (Secrets.has('mains') || rescue) return state.battery;
  state.battery = Math.max(1, state.battery - Math.max(0, Number(pct) || 0));
  render(true);
  return state.battery;
}

export function isRescuing() {
  return !!rescue;
}

export default {
  initPhone, batteryLevel, isRescuing, drain, addReceiveGate, batteryBars, signalBars, getActivity, hour, isNight,
  canReceive, setUnreadSource, onTick, render, toast, buzz, GAME_SCENES
};
