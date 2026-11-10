/*
 * One haptics module for the whole game. Events, not motor commands:
 *
 *   key        on-screen keypad press           impact LIGHT
 *   sms        incoming text buzz               notification WARNING + 2 taps
 *   ring       fake call ring (repeats)         heavy-medium-heavy burst
 *   fish(p)    Buzz Fishing proximity 0..1      LIGHT / MEDIUM / HEAVY by p
 *   bite       fish bite                        impact HEAVY x2
 *   crash      hit / crash / life lost          impact HEAVY
 *   combo      combo milestone                  impact MEDIUM
 *   gameOver   end of a run                     notification WARNING
 *   newBest    new best / daily done            notification SUCCESS
 *   powerOn    boot                             notification SUCCESS
 *   powerOff   shutdown                         impact HEAVY + MEDIUM
 *   vibrate(p) raw pattern (ms or [on, off, on...])
 *
 * Native (iOS app): @capacitor/haptics. Web: navigator.vibrate after the
 * first user gesture (Android browsers; desktop/iOS Safari ignore it).
 * Settings > Haptics On/Off (vpg.haptics) silences everything.
 */

import { isNative, hasPlugin } from './Native.js';

const KEY = 'vpg.haptics';
let enabled = (() => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } })();
const log = [];
let plugin = null;

function note(ev, how) {
  log.push({ ev, how, at: Date.now() });
  if (log.length > 80) log.shift();
}

export function hapticsEnabled() { return enabled; }

export function setHaptics(on) {
  enabled = !!on;
  try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch { /* ignore */ }
  if (!enabled) webVibrate(0, true);
  return enabled;
}

export function toggleHaptics() { return setHaptics(!enabled); }

async function nativeHaptics() {
  if (!hasPlugin('Haptics')) return null;
  if (!plugin) plugin = await import('@capacitor/haptics');
  return plugin;
}

function webVibrate(pattern, force = false) {
  try {
    const ua = navigator.userActivation;
    if (navigator.vibrate && (force || !ua || ua.hasBeenActive)) return !!navigator.vibrate(pattern);
  } catch { /* not supported */ }
  return false;
}

function native(fn) {
  nativeHaptics().then((h) => { if (h) return fn(h); return null; }).catch(() => {});
}

const impact = (style) => native((h) => h.Haptics.impact({ style: h.ImpactStyle[style] }));
const notify = (type) => native((h) => h.Haptics.notification({ type: h.NotificationType[type] }));
const later = (ms, fn) => setTimeout(fn, ms);

// web fallback patterns (ms)
const WEB = {
  key: 8, sms: [90, 60, 90], ring: [400, 200, 400], bite: [60, 40, 60],
  crash: 120, combo: 30, gameOver: [80, 60, 160], newBest: [40, 40, 40, 40, 120],
  powerOn: [30, 50, 120], powerOff: [160, 60, 60]
};

const NATIVE = {
  key: () => impact('Light'),
  sms: () => { notify('Warning'); later(180, () => impact('Medium')); },
  ring: () => { impact('Heavy'); later(160, () => impact('Medium')); later(320, () => impact('Heavy')); },
  bite: () => { impact('Heavy'); later(110, () => impact('Heavy')); },
  crash: () => impact('Heavy'),
  combo: () => impact('Medium'),
  gameOver: () => notify('Warning'),
  newBest: () => notify('Success'),
  powerOn: () => notify('Success'),
  powerOff: () => { impact('Heavy'); later(200, () => impact('Medium')); }
};

/** Fire a named haptic event. Returns how it was delivered. */
export function haptic(ev, arg) {
  if (!enabled) { note(ev, 'off'); return 'off'; }
  if (ev === 'fish') return fish(arg);
  if (isNative()) {
    (NATIVE[ev] || NATIVE.key)();
    note(ev, 'native');
    return 'native';
  }
  const ok = webVibrate(WEB[ev] ?? 20);
  note(ev, ok ? 'web' : 'none');
  return ok ? 'web' : 'none';
}

/** Buzz Fishing proximity pulse, p = 0 (far) .. 1 (on top of the fish). */
export function fish(p = 0) {
  const k = Math.max(0, Math.min(1, Number(p) || 0));
  if (!enabled) { note('fish', 'off'); return 'off'; }
  if (isNative()) {
    impact(k > 0.66 ? 'Heavy' : k > 0.33 ? 'Medium' : 'Light');
    note('fish', 'native');
    return 'native';
  }
  const ok = webVibrate(Math.round(10 + 55 * k));
  note('fish', ok ? 'web' : 'none');
  return ok ? 'web' : 'none';
}

/** Raw pattern. On native, each 'on' segment becomes an impact. */
export function vibrate(pattern) {
  if (!enabled) { note('vibrate', 'off'); return false; }
  if (isNative()) {
    const segs = Array.isArray(pattern) ? pattern : [pattern];
    let t = 0;
    segs.forEach((ms, i) => {
      if (i % 2 === 0 && ms > 0) {
        const style = ms >= 120 ? 'Heavy' : ms >= 40 ? 'Medium' : 'Light';
        later(t, () => impact(style));
      }
      t += Math.max(0, Number(ms) || 0);
    });
    note('vibrate', 'native');
    return true;
  }
  const ok = webVibrate(pattern);
  note('vibrate', ok ? 'web' : 'none');
  return ok;
}

/** Stop any web vibration (e.g. a declined call). */
export function stop() { webVibrate(0, true); }

export function publishHaptics() {
  window.__vpg = window.__vpg || {};
  window.__vpg.haptics = {
    enabled: hapticsEnabled, set: setHaptics, toggle: toggleHaptics,
    fire: haptic, fish, vibrate, log: () => log.slice(), clear: () => { log.length = 0; }
  };
}

export default { haptic, fish, vibrate, stop, hapticsEnabled, setHaptics, toggleHaptics, publishHaptics };
