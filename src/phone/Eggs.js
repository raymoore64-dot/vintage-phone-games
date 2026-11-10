/*
 * T9 code book: Easter eggs typed as words on the menu keypad.
 *
 * How to type one: on the menu press * twice (the secret-code box opens
 * on the first *, the second * switches it to WORD mode). Then spell the
 * word with one press per letter, like T9 predictive text:
 *   2 abc  3 def  4 ghi  5 jkl  6 mno  7 pqrs  8 tuv  9 wxyz
 * A word fires the moment it matches; OK checks, C deletes a digit
 * (C on an empty word closes the box).
 *
 *   SNAKE   76253    Gold snake in Snake (toggle, stays on)
 *   DISCO   34726    next run: disco LCD (colours cycle)
 *   FLIP    3547     next run: upside-down screen
 *   PIXEL   74935    next run: fat 3x3 pixels
 *   CREDITS 2733487  roll the credits
 *   LOL     565      someone texts you back...
 *
 * The 4-digit *-codes (*7283, *2288) still work and are listed in the
 * code book too. Found eggs persist in localStorage 'vpg.eggs'.
 */

import * as Lcd from './Lcd.js';
import * as Secrets from './Secrets.js';
import * as Sms from './Sms.js';
import { EGG_TEXTS } from './messages.js';

export const STORAGE_KEY = 'vpg.eggs';

const T9 = { a: 2, b: 2, c: 2, d: 3, e: 3, f: 3, g: 4, h: 4, i: 4, j: 5, k: 5, l: 5, m: 6, n: 6, o: 6, p: 7, q: 7, r: 7, s: 7, t: 8, u: 8, v: 8, w: 9, x: 9, y: 9, z: 9 };

export function t9(word) {
  return String(word).toLowerCase().split('').map((ch) => T9[ch] || '').join('');
}

export const EGGS = [
  { id: 'gold', word: 'SNAKE', name: 'Gold snake', desc: 'Snake turns solid gold (toggle)', kind: 'toggle' },
  { id: 'disco', word: 'DISCO', name: 'Disco LCD', desc: 'Next run: the screen parties', kind: 'run' },
  { id: 'flip', word: 'FLIP', name: 'Upside down', desc: 'Next run is upside down', kind: 'run' },
  { id: 'pixel', word: 'PIXEL', name: 'Fat pixels', desc: 'Next run in chunky low-res', kind: 'run' },
  { id: 'credits', word: 'CREDITS', name: 'Credits', desc: 'Roll the credits', kind: 'now' },
  { id: 'lol', word: 'LOL', name: 'LOL', desc: 'Someone texts you back...', kind: 'now' }
].map((e) => ({ ...e, digits: t9(e.word) }));

// The existing *-codes, shown in the code book as well
export const STAR_CODES = [
  { id: 'star:7283', word: '*7283', digits: '*7283', name: 'PROTO Clear', desc: 'Secret prototype phone', secret: 'proto' },
  { id: 'star:2288', word: '*2288', digits: '*2288', name: 'Mains power', desc: 'Battery never drains (toggle)', secret: 'mains' }
];

export const MAX_DIGITS = Math.max(...EGGS.map((e) => e.digits.length));

let st = null;

function load() {
  if (st) return st;
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    st = d && typeof d === 'object' ? d : {};
  } catch {
    st = {};
  }
  if (!st.found || typeof st.found !== 'object') st.found = {};
  if (!st.armed || typeof st.armed !== 'object') st.armed = {};
  st.gold = !!st.gold;
  return st;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(load()));
  } catch {
    // ignore
  }
}

export function isFound(id) {
  const s = load();
  if (s.found[id]) return true;
  const star = STAR_CODES.find((c) => c.id === id);
  return !!(star && Secrets.has(star.secret));
}

export function markFound(id) {
  const s = load();
  const fresh = !isFound(id);
  if (!s.found[id]) s.found[id] = Date.now();
  save();
  return fresh;
}

export function entries() {
  return [...EGGS, ...STAR_CODES].map((e) => ({
    ...e,
    found: isFound(e.id),
    on: e.id === 'gold' ? load().gold : e.kind === 'run' ? !!load().armed[e.id] : (e.secret === 'mains' ? Secrets.has('mains') : false)
  }));
}

export function foundCount() {
  return entries().filter((e) => e.found).length;
}

export function totalCount() {
  return EGGS.length + STAR_CODES.length;
}

export function isGold() {
  return load().gold;
}

export function armed() {
  return { ...load().armed };
}

/** Exact match for a digit string, or null. */
export function match(digits) {
  return EGGS.find((e) => e.digits === digits) || null;
}

/** True if some egg starts with these digits (keep typing). */
export function isPrefix(digits) {
  return EGGS.some((e) => e.digits.startsWith(digits));
}

/**
 * Fire an egg. Returns { id, fresh, message, scene? } — scene is a scene
 * key the menu should open (credits).
 */
export function trigger(id) {
  const egg = EGGS.find((e) => e.id === id);
  if (!egg) return null;
  const s = load();
  const fresh = markFound(id);
  let message = '';
  let scene = null;
  if (id === 'gold') {
    s.gold = !s.gold;
    message = s.gold ? 'GOLD SNAKE: ON' : 'Gold snake: off';
  } else if (egg.kind === 'run') {
    s.armed[id] = true;
    message = { disco: 'Next run: DISCO!', flip: 'Next run: UPSIDE DOWN', pixel: 'Next run: FAT PIXELS' }[id];
  } else if (id === 'credits') {
    scene = 'CreditsScene';
    message = 'Rolling credits...';
  } else if (id === 'lol') {
    Sms.queueText('unknown', EGG_TEXTS.lol, { egg: 'lol' });
    Sms.queueText('dex', EGG_TEXTS.lolFollow, { egg: 'lol' });
    message = 'LOL sent... someone heard';
  }
  save();
  return { id, fresh, message, scene, found: foundCount(), total: totalCount() };
}

/** Called once per game run (from attachPerks). Uses up armed eggs. */
export function applyRun(scene) {
  const s = load();
  const used = [];
  ['disco', 'flip', 'pixel'].forEach((id) => {
    if (s.armed[id]) {
      used.push(id);
      delete s.armed[id];
    }
  });
  save();
  Lcd.setDisco(used.includes('disco'));
  Lcd.setFlip(used.includes('flip'));
  Lcd.setFat(used.includes('pixel'));
  scene.__eggs = used;
  scene.events.once('shutdown', () => {
    Lcd.setDisco(false);
    Lcd.setFlip(false);
    Lcd.setFat(false);
  });
  return used;
}

export function publishEggs() {
  window.__vpg = window.__vpg || {};
  window.__vpg.eggs = {
    list: () => entries(),
    found: foundCount,
    total: totalCount,
    trigger,
    match: (d) => (match(String(d)) || {}).id || null,
    armed,
    gold: isGold,
    reset: () => { st = { found: {}, armed: {}, gold: false }; save(); }
  };
}

export default { EGGS, STAR_CODES, t9, entries, foundCount, totalCount, isGold, armed, match, isPrefix, trigger, applyRun, markFound, isFound, publishEggs, MAX_DIGITS };
