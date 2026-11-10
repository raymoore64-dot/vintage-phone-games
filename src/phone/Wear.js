/*
 * Wear & tear. Every phone remembers how long it has been played and
 * slowly picks up cosmetic damage, drawn on the HTML bezel / LCD glass as
 * thin, semi-transparent overlays (pointer-events: none, kept out of the
 * play area so they never hide gameplay):
 *
 *   Mint            under 8 min of play   — factory fresh
 *   Used            8 min+                — scuffs on the shell edges
 *   Battered        20 min+               — + a long scratch, worn shiny keys
 *   Battle-scarred  45 min+               — + cracked glass corner, a stuck pixel
 *
 * Only real play time counts (not menus, pause, calls or power-off).
 * Repair in the phone picker (press * twice) restores Mint; or keep the
 * scars. Stored in localStorage 'vpg.wear' { [skinId]: { secs, repairs } }.
 *
 * Debug: window.__vpg.wear.{state, setMinutes(min, skinId?), repair(skinId?)}
 */

import { getSkin, skinEvents } from '../skins/SkinManager.js';
import * as Phone from './Phone.js';
import * as Power from './Power.js';

export const STORAGE_KEY = 'vpg.wear';

export const LEVELS = [
  { id: 'mint', name: 'Mint', at: 0, marks: [] },
  { id: 'used', name: 'Used', at: 8 * 60, marks: ['scuffs'] },
  { id: 'battered', name: 'Battered', at: 20 * 60, marks: ['scuffs', 'scratch', 'keys'] },
  { id: 'scarred', name: 'Battle-scarred', at: 45 * 60, marks: ['scuffs', 'scratch', 'keys', 'crack', 'pixel'] }
];

let data = null;
let lastNow = 0;
let lastSave = 0;
let shellEl = null;
let lcdEl = null;
let appliedKey = '';

function load() {
  if (data) return data;
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    data = d && typeof d === 'object' ? d : {};
  } catch {
    data = {};
  }
  return data;
}

function save() {
  lastSave = performance.now();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(load()));
  } catch {
    // ignore
  }
}

function entry(id) {
  const d = load();
  if (!d[id] || typeof d[id] !== 'object') d[id] = { secs: 0, repairs: 0 };
  d[id].secs = Math.max(0, Number(d[id].secs) || 0);
  return d[id];
}

export function playSeconds(id = getSkin().id) {
  return entry(id).secs;
}

export function levelFor(secs) {
  let lv = LEVELS[0];
  LEVELS.forEach((l) => { if (secs >= l.at) lv = l; });
  return lv;
}

export function condition(id = getSkin().id) {
  const secs = playSeconds(id);
  const lv = levelFor(secs);
  const i = LEVELS.indexOf(lv);
  const next = LEVELS[i + 1] || null;
  return { ...lv, secs, repairs: entry(id).repairs || 0, next: next ? { name: next.name, in: Math.max(0, next.at - secs) } : null };
}

export function formatPlaytime(secs) {
  const m = Math.floor(secs / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
}

export function repair(id = getSkin().id) {
  const e = entry(id);
  e.secs = 0;
  e.repairs = (e.repairs || 0) + 1;
  save();
  apply(true);
  return condition(id);
}

/** Marks for a phone (used by the share card). */
export function marksFor(id = getSkin().id) {
  const lv = levelFor(playSeconds(id));
  return { level: lv, marks: lv.marks.slice(), hash: hash(id) };
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---- Drawing ------------------------------------------------------------------

const SCUFF = '<svg viewBox="0 0 10 14"><path d="M2 2 L5 5 M3 6 L7 8 M1 9 L4 12 M6 3 L8 4" /></svg>';
const SCRATCH = '<svg viewBox="0 0 100 20" preserveAspectRatio="none"><path d="M0 4 C30 7 60 12 100 18" /><path class="thin" d="M8 6 C34 9 58 13 82 16" /></svg>';
const CRACK = '<svg viewBox="0 0 40 40"><path d="M0 40 L9 29 L14 31 L21 20 L27 21 L40 4" /><path d="M9 29 L5 22 M14 31 L18 40 M21 20 L17 12 M27 21 L33 30 M21 20 L30 14" /><path class="thin" d="M5 22 L0 19 M17 12 L19 4 M33 30 L40 33" /></svg>';

export function apply(force = false) {
  if (!shellEl || !lcdEl) return;
  const skin = getSkin();
  const lv = levelFor(playSeconds(skin.id));
  const key = `${skin.id}:${lv.id}`;
  if (!force && key === appliedKey) return;
  appliedKey = key;
  const marks = new Set(lv.marks);
  const h = hash(skin.id);
  const phoneEl = document.querySelector('.phone');
  if (phoneEl) {
    phoneEl.classList.toggle('wear-keys', marks.has('keys'));
    phoneEl.dataset.wear = lv.id;
  }

  let shell = '';
  if (marks.has('scuffs')) {
    const spots = [
      [2 + (h % 3), 34 + (h % 9)], [93 - ((h >> 3) % 3), 58 + ((h >> 5) % 10)],
      [6 + ((h >> 7) % 5), 93 - ((h >> 9) % 3)], [88 - ((h >> 11) % 6), 3 + ((h >> 13) % 3)]
    ];
    shell += spots.map(([x, y], i) => `<span class="w-scuff" style="left:${x}%;top:${y}%;transform:rotate(${(h >> i) % 50 - 25}deg)">${SCUFF}</span>`).join('');
  }
  if (marks.has('scratch')) {
    shell += `<span class="w-scratch" style="top:${2 + (h % 3)}%">${SCRATCH}</span>`;
  }
  shellEl.innerHTML = shell;

  let lcd = '';
  if (marks.has('crack')) lcd += `<span class="w-crack">${CRACK}</span>`;
  if (marks.has('pixel')) {
    const x = 58 + (h % 30);
    const y = 38 + ((h >> 4) % 34);
    lcd += `<span class="w-pixel" style="left:${x}%;top:${y}%"></span>`;
  }
  lcdEl.innerHTML = lcd;
}

function tick(now) {
  const dt = lastNow ? Math.min(250, Math.max(0, now - lastNow)) / 1000 : 0;
  lastNow = now;
  if (!dt || Phone.getActivity() !== 'play' || !Power.isOn()) return;
  const id = getSkin().id;
  const e = entry(id);
  const before = levelFor(e.secs);
  e.secs += dt;
  const after = levelFor(e.secs);
  if (after !== before) {
    save();
    apply();
    Phone.toast(`Phone condition: ${after.name}`);
  } else if (now - lastSave > 5000) {
    save();
  }
}

export function initWear() {
  const phoneEl = document.querySelector('.phone');
  const screen = document.querySelector('.screen');
  if (phoneEl && !shellEl) {
    shellEl = document.createElement('div');
    shellEl.className = 'wear-shell';
    shellEl.setAttribute('aria-hidden', 'true');
    phoneEl.insertBefore(shellEl, phoneEl.firstChild);
  }
  if (screen && !lcdEl) {
    lcdEl = document.createElement('div');
    lcdEl.className = 'wear-lcd';
    lcdEl.setAttribute('aria-hidden', 'true');
    screen.appendChild(lcdEl);
  }
  apply(true);
  Phone.onTick(tick);
  skinEvents.on('change', () => apply());
  window.addEventListener('pagehide', save);

  window.__vpg = window.__vpg || {};
  window.__vpg.wear = {
    state: (id) => condition(id || getSkin().id),
    all: () => JSON.parse(JSON.stringify(load())),
    setMinutes: (min, id) => {
      const e = entry(id || getSkin().id);
      e.secs = Math.max(0, Number(min) || 0) * 60;
      save();
      apply(true);
      return condition(id || getSkin().id);
    },
    repair: (id) => repair(id || getSkin().id),
    levels: LEVELS
  };
}

export default { initWear, marksFor, condition, repair, playSeconds, levelFor, formatPlaytime, LEVELS, apply };
