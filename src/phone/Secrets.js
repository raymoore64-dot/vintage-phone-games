/*
 * Secret unlocks found through SMS codes. Codes are typed on the menu:
 * press * then four digits. Stored in localStorage 'vpg.secrets'.
 *
 *   *7283  ("RAVE" on the keypad)  → unlocks the hidden LINICRO Proto
 *                                     "Clear" phone (Overclock perk)
 *   *2288  ("BATT")                → toggles Mains Power: the battery
 *                                     never drains (plug icon)
 */

export const STORAGE_KEY = 'vpg.secrets';

export const CODES = {
  '7283': { id: 'proto', toggle: false, on: 'Secret phone unlocked: PROTO Clear!', again: 'PROTO Clear already unlocked' },
  '2288': { id: 'mains', toggle: true, on: 'Mains power ON: battery never drains', off: 'Mains power OFF' }
};

let cache = null;
const listeners = new Set();

function read() {
  if (cache) return cache;
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    cache = d && typeof d === 'object' ? d : {};
  } catch {
    cache = {};
  }
  return cache;
}

function write() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache || {}));
  } catch {
    // ignore
  }
}

export function has(id) {
  return !!read()[id];
}

export function set(id, on = true) {
  read();
  if (on) cache[id] = true;
  else delete cache[id];
  write();
  listeners.forEach((fn) => fn(id, on));
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Try a 4-digit code. Returns { ok, id, message, newlyOn }.
 */
export function tryCode(digits) {
  const code = String(digits || '').replace(/[^0-9]/g, '');
  const entry = CODES[code];
  if (!entry) return { ok: false, id: null, message: 'Wrong code', newlyOn: false };
  if (entry.toggle) {
    const next = !has(entry.id);
    set(entry.id, next);
    return { ok: true, id: entry.id, message: next ? entry.on : entry.off, newlyOn: next };
  }
  if (has(entry.id)) return { ok: true, id: entry.id, message: entry.again, newlyOn: false };
  set(entry.id, true);
  return { ok: true, id: entry.id, message: entry.on, newlyOn: true };
}

export function all() {
  return { ...read() };
}

export default { STORAGE_KEY, CODES, has, set, onChange, tryCode, all };
