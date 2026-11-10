/*
 * SMS inbox. Messages from an invented cast react to how you play.
 * Persisted in localStorage 'vpg.sms'. Content lives in messages.js.
 *
 * Triggers
 *   - first launch: welcome texts (network, Mum, Dex)
 *   - every new day: a daily dare (game + target). Beat it in that game
 *     today for bonus points (they count toward phone unlocks) + a reply
 *   - lifetime point milestones (250, 1000, 2500, 5000, 10000, 20000)
 *   - new personal bests (max one text per game per day)
 *   - phones unlocked (points, dare bonus, or secret code)
 *   - starting a game late at night (23:00-04:59), once per night
 *   - secret codes: *7283 arrives at 1000 pts or after your first dare;
 *     *2288 arrives at 2500 pts or after a late-night session
 *
 * Delivery: texts wait in a queue and arrive only when you are not
 * actively playing (menus, pause, game over) and the signal has 2+ bars.
 * Arrival = phone buzz + SMS beep + toast + envelope in the status bar.
 */

import M, { CAST, GAME_INFO } from './messages.js';
import * as Phone from './Phone.js';
import * as Wap from '../wap/Wap.js';
import * as Secrets from './Secrets.js';
import * as Progress from '../progress/Progress.js';
import SKINS from '../skins/skins.js';
import * as Sfx from '../audio/Sfx.js';

export const STORAGE_KEY = 'vpg.sms';
const MAX_INBOX = 40;
const DELIVER_GAP = 1600;

let st = fresh();
let todayOverride = null;
let lastDeliver = -Infinity;
const listeners = new Set();
let initialized = false;

function fresh() {
  return { v: 1, seq: 0, inbox: [], pending: [], fired: {}, dare: null, daresDone: 0, bestDay: {} };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object') return;
    st = { ...fresh(), ...d };
    if (!Array.isArray(st.inbox)) st.inbox = [];
    if (!Array.isArray(st.pending)) st.pending = [];
    if (!st.fired || typeof st.fired !== 'object') st.fired = {};
    if (!st.bestDay || typeof st.bestDay !== 'object') st.bestDay = {};
  } catch {
    st = fresh();
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
  } catch {
    // ignore
  }
}

function emit() {
  listeners.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
  Phone.render();
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function today() {
  if (todayOverride) return todayOverride;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function fill(text, vars = {}) {
  return String(text).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
}

function make(fromKey, text, extra = {}) {
  const who = CAST[fromKey] || CAST.unknown;
  st.seq += 1;
  return { id: st.seq, fromKey, from: who.name, number: who.number, text, t: 0, read: false, ...extra };
}

function queue(msg) {
  st.pending.push(msg);
  save();
  return msg;
}

function fireOnce(key, fn) {
  if (st.fired[key]) return false;
  st.fired[key] = true;
  fn();
  save();
  return true;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// ---- Daily dare -----------------------------------------------------------

function ensureDay() {
  const day = today();
  if (st.dare && st.dare.day === day) return;
  if (st.dare && !st.dare.done && st.dare.day < day) {
    fireOnce(`expired:${st.dare.day}`, () => queue(make(M.DARE_EXPIRED.from, M.DARE_EXPIRED.text)));
  }
  // WAP-game dares only once that game is downloaded
  const pool = M.DARES.map((d, i) => i).filter((i) => !M.DARES[i].wap || Wap.isDownloaded(M.DARES[i].game));
  let pi = hash(day) % pool.length;
  if (st.dare && st.dare.idx === pool[pi] && pool.length > 1) pi = (pi + 1) % pool.length;
  const idx = pool[pi];
  const d = M.DARES[idx];
  st.dare = { day, idx, game: d.game, target: d.target, bonus: d.bonus, from: d.from, done: false, best: 0 };
  const vars = { game: GAME_INFO[d.game].name, target: d.target, bonus: d.bonus };
  queue(make(d.from, fill(d.text, vars), { dare: { game: d.game, target: d.target, bonus: d.bonus, day } }));
}

export function getDare() {
  return st.dare ? { ...st.dare, gameName: GAME_INFO[st.dare.game]?.name, scene: GAME_INFO[st.dare.game]?.scene, today: st.dare.day === today() } : null;
}

/** Status of the dare attached to a message: 'open' | 'done' | 'expired'. */
export function dareStatus(msg) {
  if (!msg || !msg.dare) return null;
  if (st.dare && st.dare.day === msg.dare.day) {
    if (st.dare.done) return 'done';
    return msg.dare.day === today() ? 'open' : 'expired';
  }
  return 'expired';
}

// ---- Triggers -------------------------------------------------------------

function checkCodes() {
  const total = Progress.getTotal();
  if (total >= 1000 || st.daresDone >= 1) {
    fireOnce('code:proto', () => queue(make(M.CODE_MESSAGES.proto.from, M.CODE_MESSAGES.proto.text, { code: M.CODE_MESSAGES.proto.code })));
  }
  if (total >= 2500 || st.fired.nightEver) {
    fireOnce('code:mains', () => queue(make(M.CODE_MESSAGES.mains.from, M.CODE_MESSAGES.mains.text, { code: M.CODE_MESSAGES.mains.code })));
  }
}

function unlockText(skin) {
  const u = M.UNLOCKS[skin.id] || M.UNLOCKS.default;
  return make(u.from, fill(u.text, { phone: `${skin.brand} ${skin.name}` }));
}

function onRunEvent(evt) {
  if (!evt) return;
  const day = today();
  if (evt.kind === 'run') {
    const info = GAME_INFO[evt.gameId];
    // Dare
    const d = st.dare;
    if (d && !d.done && d.day === day && evt.gameId === d.game) {
      d.best = Math.max(d.best || 0, evt.score);
      if (evt.score >= d.target) {
        d.done = true;
        st.daresDone += 1;
        const src = M.DARES[d.idx] || M.DARES[0];
        queue(make(d.from, fill(src.win, { score: evt.score, bonus: d.bonus, game: info?.name })));
        save();
        Progress.addBonus(d.bonus, 'dare');
      }
    }
    // Personal best
    if (evt.newBest && evt.score > 0 && info && st.bestDay[evt.gameId] !== day) {
      st.bestDay[evt.gameId] = day;
      const b = pick(M.BESTS);
      queue(make(b.from, fill(b.text, { game: info.name, score: evt.score })));
    }
  }
  // Milestones
  M.MILESTONES.forEach((m) => {
    if (evt.previousTotal < m.at && evt.total >= m.at) {
      fireOnce(`ms:${m.at}`, () => queue(make(m.from, fill(m.text, { total: evt.total }))));
    }
  });
  // Unlocks
  (evt.newlyUnlocked || []).forEach((skin) => {
    fireOnce(`unlock:${skin.id}`, () => queue(unlockText(skin)));
  });
  checkCodes();
  save();
  emit();
}

/** Called by games at the start of a run. */
export function onRunStart(gameId) {
  if (!Phone.isNight()) return;
  const day = today();
  fireOnce(`night:${day}`, () => {
    st.fired.nightEver = true;
    const n = pick(M.NIGHT);
    const h = String(Phone.hour()).padStart(2, '0');
    const mm = String(new Date().getMinutes()).padStart(2, '0');
    queue(make(n.from, fill(n.text, { time: `${h}:${mm}`, game: GAME_INFO[gameId]?.name || 'Snake' })));
  });
  checkCodes();
}

/** Called when the menu opens. */
export function onMenu() {
  ensureDay();
  checkCodes();
  emit();
}

/**
 * Queue a text from someone in the cast (calls, eggs). It arrives like any
 * other text: only off-gameplay, with 2+ bars.
 */
export function queueText(fromKey, text, extra = {}) {
  const m = queue(make(fromKey, text, extra));
  emit();
  return m;
}

// ---- Delivery -------------------------------------------------------------

function deliver(msg) {
  const m = { ...msg, t: Date.now(), read: false };
  st.inbox.unshift(m);
  if (st.inbox.length > MAX_INBOX) st.inbox.length = MAX_INBOX;
  save();
  Phone.buzz();
  Sfx.play('smsAlert');
  const preview = m.text.length > 26 ? `${m.text.slice(0, 25)}…` : m.text;
  Phone.toast(`✉ ${m.from}: ${preview}`, 2600);
  emit();
  return m;
}

function pump(now) {
  if (!st.pending.length) return;
  if (!Phone.canReceive()) return;
  if (now - lastDeliver < DELIVER_GAP) return;
  lastDeliver = now;
  deliver(st.pending.shift());
}

// ---- Reading ---------------------------------------------------------------

export function daresDone() {
  return Number(st.daresDone) || 0;
}

export function list() {
  return st.inbox.slice();
}

export function get(id) {
  return st.inbox.find((m) => m.id === id) || null;
}

export function unreadCount() {
  return st.inbox.reduce((n, m) => n + (m.read ? 0 : 1), 0);
}

export function pendingCount() {
  return st.pending.length;
}

export function markRead(id) {
  const m = get(id);
  if (m && !m.read) {
    m.read = true;
    save();
    emit();
  }
}

export function formatTime(t) {
  if (!t) return '';
  const d = new Date(t);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay ? `${hh}:${mm}` : `${days[d.getDay()]} ${hh}:${mm}`;
}

// ---- Init ------------------------------------------------------------------

export function initSms() {
  if (initialized) return;
  initialized = true;
  load();
  fireOnce('welcome', () => {
    M.WELCOME.forEach((w) => queue(make(w.from, w.text)));
  });
  ensureDay();
  checkCodes();
  Phone.setUnreadSource(unreadCount);
  Phone.onTick(pump);
  Progress.onRun(onRunEvent);
  Secrets.onChange((id, on) => {
    if (id === 'proto' && on) {
      const skin = SKINS.find((s) => s.id === 'proto-clear');
      if (skin) fireOnce('unlock:proto-clear', () => queue(unlockText(skin)));
    }
  });

  window.__vpg = window.__vpg || {};
  window.__vpg.sms = {
    state: () => JSON.parse(JSON.stringify(st)),
    list,
    unread: unreadCount,
    pending: pendingCount,
    dare: getDare,
    today,
    setToday: (d) => { todayOverride = d || null; ensureDay(); checkCodes(); emit(); return today(); },
    flush: () => {
      let n = 0;
      while (st.pending.length) { deliver(st.pending.shift()); n++; }
      lastDeliver = performance.now();
      return n;
    },
    setDare: (game, target) => {
      if (!st.dare) ensureDay();
      const idx = M.DARES.findIndex((d) => d.game === game);
      if (idx >= 0) {
        st.dare.idx = idx;
        st.dare.from = M.DARES[idx].from;
        st.dare.bonus = M.DARES[idx].bonus;
      }
      st.dare.game = game;
      st.dare.target = Number(target);
      st.dare.done = false;
      save();
      return getDare();
    }
  };
}

export default {
  initSms, onChange, onMenu, onRunStart, queueText, daresDone, list, get, unreadCount, pendingCount,
  markRead, getDare, dareStatus, formatTime, today
};
