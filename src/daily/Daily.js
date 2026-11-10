/*
 * Daily Challenge.
 *
 * Every local calendar day maps (deterministically, no server) to:
 *   n         day number = days since EPOCH + 1  ("Daily #n")
 *   game      one of the 6 built-in games (everyone has them)
 *   mod       a modifier (speed / score / lives / glitch storm)
 *   seed      the seed every gameplay RNG uses during the run
 *
 * One official attempt per day: starting it uses the attempt (quitting
 * early scores 0). Later runs the same day are practice: same seed and
 * modifier, never recorded. Streak = consecutive days with an official
 * attempt. History keeps every day for the calendar view.
 *
 * Storage: localStorage 'vpg.daily'.
 */

import { hash32, makeRng } from './rng.js';

export const STORAGE_KEY = 'vpg.daily';
export const EPOCH = '2026-11-01';          // Daily #1
export const CORE = ['snake', 'bounce', 'impact', 'bricks', 'blocks', 'simon'];
export const NAMES = { snake: 'Snake', bounce: 'Bounce', impact: 'Space Impact', bricks: 'Bricks', blocks: 'Blocks', simon: 'Simon' };
export const SCENES = { snake: 'SnakeScene', bounce: 'BounceScene', impact: 'ImpactScene', bricks: 'BricksScene', blocks: 'BlocksScene', simon: 'SimonScene' };
/** "Par" per game: 5 filled blocks in the share text. */
export const PAR = { snake: 400, bounce: 500, impact: 800, bricks: 600, blocks: 900, simon: 200 };

export const MODIFIERS = [
  { id: 'standard', name: 'Standard', desc: 'Plain rules. Same seed for everyone.' },
  { id: 'fast', name: 'Fast Forward', desc: 'Everything runs 20% faster.', speed: 1.2 },
  { id: 'chill', name: 'Chill Mode', desc: '15% slower, but x0.8 score.', speed: 0.85, score: 0.8 },
  { id: 'oneshot', name: 'One Shot', desc: 'One life. No mistakes.', lives: 1, only: ['impact', 'bricks'] },
  { id: 'glitch', name: 'Glitch Storm', desc: 'Glitches every 12-20s give x2 score.', glitch: true },
  { id: 'double', name: 'Double Trouble', desc: 'x1.5 score, but 10% faster.', speed: 1.1, score: 1.5 }
];

const listeners = new Set();
let todayOverride = null;
let st = null;

function fresh() {
  return { v: 1, history: {}, streak: 0, bestStreak: 0, last: null, practice: 0 };
}

function load() {
  if (st) return st;
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    st = raw && raw.v === 1 && raw.history ? { ...fresh(), ...raw } : fresh();
  } catch {
    st = fresh();
  }
  return st;
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(st)); } catch { /* ignore */ }
}

function emit(evt) {
  listeners.forEach((fn) => { try { fn(evt); } catch (e) { console.warn('daily listener failed', e); } });
}

export function onDaily(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---- dates ------------------------------------------------------------------

export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function today() {
  return todayOverride || dateKey();
}

export function setToday(key) {
  todayOverride = key || null;
  return today();
}

function utcOf(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(key, n) {
  const t = new Date(utcOf(key) + n * 86400000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

export function dayNumber(key = today()) {
  return Math.round((utcOf(key) - utcOf(EPOCH)) / 86400000) + 1;
}

// ---- the challenge ------------------------------------------------------------

export function modifiersFor(game) {
  return MODIFIERS.filter((m) => !m.only || m.only.includes(game));
}

/** The challenge for a date. Pure function of the date string. */
export function challengeFor(key = today()) {
  const seed0 = hash32(`vpg-daily|${key}`);
  const r = makeRng(seed0);
  const game = CORE[Math.floor(r.next() * CORE.length)];
  const mods = modifiersFor(game);
  const mod = mods[Math.floor(r.next() * mods.length)];
  const seed = Math.floor(r.next() * 4294967296) >>> 0;
  return { date: key, n: dayNumber(key), game, gameName: NAMES[game], scene: SCENES[game], mod: { ...mod }, seed };
}

export function entry(key = today()) {
  return load().history[key] || null;
}

export function attempted(key = today()) {
  return !!entry(key);
}

/** Streak as of today: alive if the last official day is today or yesterday. */
export function currentStreak() {
  const s = load();
  if (!s.last) return 0;
  const t = today();
  return s.last === t || s.last === addDays(t, -1) ? s.streak : 0;
}

export function bestStreak() { return load().bestStreak || 0; }

export function doneCount() {
  return Object.values(load().history).filter((h) => h.status === 'done').length;
}

/**
 * Context to start the game scene with: scene.start(c.scene, { daily: ctx }).
 * The first call of the day consumes the attempt (official); later calls
 * are practice.
 */
export function startRun(key = today()) {
  const c = challengeFor(key);
  const s = load();
  const official = !s.history[key];
  if (official) {
    s.history[key] = { n: c.n, game: c.game, mod: c.mod.id, score: 0, status: 'started', at: Date.now() };
    const prev = addDays(key, -1);
    s.streak = s.last === prev ? (s.streak || 0) + 1 : (s.last === key ? s.streak : 1);
    s.last = key;
    s.bestStreak = Math.max(s.bestStreak || 0, s.streak);
  } else {
    s.practice = (s.practice || 0) + 1;
  }
  save();
  const ctx = { date: key, n: c.n, game: c.game, mod: c.mod, seed: c.seed, practice: !official };
  emit({ kind: 'start', ...ctx });
  return { ...c, ctx };
}

/** Called once at game over of a daily run. Practice runs are not stored. */
export function finishRun(ctx, score) {
  const pts = Math.max(0, Math.floor(Number(score) || 0));
  if (!ctx) return null;
  if (ctx.practice) {
    const res = { ...ctx, score: pts, practice: true, official: entry(ctx.date) };
    emit({ kind: 'practice', ...res });
    return res;
  }
  const s = load();
  const h = s.history[ctx.date] || { n: ctx.n, game: ctx.game, mod: ctx.mod.id, at: Date.now() };
  if (h.status === 'done') return { ...ctx, score: h.score, practice: false, already: true };
  h.score = pts;
  h.status = 'done';
  h.blocks = blocksFor(ctx.game, pts);
  h.doneAt = Date.now();
  s.history[ctx.date] = h;
  save();
  const res = { ...ctx, score: pts, practice: false, streak: s.streak, blocks: h.blocks };
  emit({ kind: 'done', ...res });
  return res;
}

// ---- share ---------------------------------------------------------------------

export function blocksFor(game, score) {
  const par = PAR[game] || 500;
  const k = Math.max(0, Math.min(5, Math.floor((score / par) * 5 + 1e-9)));
  return score > 0 ? Math.max(1, k) : 0;
}

export function blockBar(n) {
  return '▓'.repeat(n) + '░'.repeat(5 - n);
}

/** Wordle-style text, e.g. "Vintage Phone Games Daily #12 📱 Snake 412 ▓▓▓░░ streak 5" */
export function shareText(key = today()) {
  const c = challengeFor(key);
  const h = entry(key);
  const score = h ? h.score : 0;
  const streak = h ? (load().last === key ? load().streak : streakOn(key)) : 0;
  const line1 = `Vintage Phone Games Daily #${c.n} 📱 ${c.gameName} ${score} ${blockBar(blocksFor(c.game, score))} streak ${streak}`;
  return `${line1}\n${c.mod.name} · can you beat it?`;
}

function streakOn(key) {
  // streak length ending on `key`, from history
  let n = 0;
  let d = key;
  const hist = load().history;
  while (hist[d]) { n += 1; d = addDays(d, -1); }
  return n;
}

// ---- calendar ----------------------------------------------------------------------

/** Month grid for the calendar: weeks of { date, day, n, played, score, blocks, today, future }. */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;          // Monday first
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  const t = today();
  for (let d = 1; d <= days; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const h = entry(key);
    cells.push({
      date: key, day: d, n: dayNumber(key), played: !!h, score: h ? h.score : 0,
      blocks: h ? (h.blocks ?? blocksFor(h.game, h.score)) : 0, today: key === t, future: key > t,
      beforeLaunch: key < EPOCH
    });
  }
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function history() {
  return JSON.parse(JSON.stringify(load().history));
}

export function state() {
  const s = load();
  return { streak: currentStreak(), rawStreak: s.streak, bestStreak: s.bestStreak, last: s.last, practice: s.practice, days: Object.keys(s.history).length, done: doneCount() };
}

export function reset() {
  st = fresh();
  save();
}

export function publishDaily() {
  window.__vpg = window.__vpg || {};
  window.__vpg.daily = {
    today, setToday, dayNumber, challengeFor, entry, attempted, startRun, finishRun,
    shareText, blocksFor, monthGrid, history, state, reset, EPOCH,
    rng: (seed, n = 8) => { const r = makeRng(seed); return Array.from({ length: n }, () => r.next()); },
    reload: () => { st = null; return state(); }
  };
}

export default { today, setToday, dayNumber, challengeFor, entry, attempted, startRun, finishRun, shareText, monthGrid, history, state, currentStreak, bestStreak, doneCount, onDaily, publishDaily, CORE, MODIFIERS, PAR, EPOCH };
