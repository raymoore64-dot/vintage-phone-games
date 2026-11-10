/*
 * Pocket pet: a tiny original creature (default name BLIP) that lives on
 * the phone. State in localStorage 'vpg.pet'.
 *
 * Stats 0-100: food (hunger, 100 = full), fun (happiness), energy.
 *   awake: food -5/h, fun -4/h, energy -3/h
 *   asleep (22:00-06:59, real clock): food -2/h, energy +15/h
 *   time away is capped at 12 h, so it never crashes while you're out.
 * It never dies. Low stats make it grumpy; food under 10 makes it sick.
 * It gets better once food >= 50 and fun >= 40.
 *
 * Food = points: every finished game feeds it round(points / 12),
 * between 3 and 35, plus +3 fun.
 * Interactions (Pet screen): OK pets it (+4 fun, 1.5 s cooldown);
 * ▲ starts "which paw?": pick ◀ or ▶ (right +10 fun, wrong +2; costs
 * energy, needs 10+). While asleep it just snores.
 * Stages by days played (distinct days with a game): egg (none yet),
 * baby (1), kid (3), adult (6).
 * Texts (via Sms, from the pet's name) when hungry or bored, at most one
 * every 6 h, never while asleep or still an egg.
 *
 * Debug: window.__vpg.pet.{state, set, advanceHours, feed, setDays, rename, reset}
 */

import * as Phone from '../phone/Phone.js';
import * as Progress from '../progress/Progress.js';
import * as Sms from '../phone/Sms.js';
import * as Sfx from '../audio/Sfx.js';

export const STORAGE_KEY = 'vpg.pet';
export const STAGES = ['Egg', 'Baby', 'Kid', 'Adult'];
const STAGE_DAYS = [0, 1, 3, 6];
const RATES = {
  awake: { food: -5, fun: -4, energy: -3 },
  asleep: { food: -2, fun: 0, energy: 15 }
};
const OFFLINE_CAP_H = 12;
const TEXT_GAP_MS = 6 * 3600 * 1000;
const PET_COOLDOWN = 1500;

let st = null;
let lastTick = 0;
let lastPet = 0;
let guess = null;
const listeners = new Set();

function fresh() {
  const now = Date.now();
  return { v: 1, name: 'BLIP', born: now, last: now, food: 70, fun: 70, energy: 80, days: 0, lastDay: '', sick: false, lastText: 0, meals: 0, pets: 0, wins: 0, eatUntil: 0, happyUntil: 0, lastMeal: null };
}

function load() {
  if (st) return st;
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    st = d && typeof d === 'object' ? { ...fresh(), ...d } : fresh();
  } catch {
    st = fresh();
  }
  return st;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(load()));
  } catch {
    // ignore
  }
}

function emit() {
  listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
}

export function onPetChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const clamp = (n) => Math.max(0, Math.min(100, n));

export function isAsleep() {
  const h = Phone.hour();
  return h >= 22 || h < 7;
}

export function stage() {
  const d = load().days;
  if (d >= STAGE_DAYS[3]) return 3;
  if (d >= STAGE_DAYS[2]) return 2;
  if (d >= STAGE_DAYS[1]) return 1;
  return 0;
}

export function stageName() {
  return STAGES[stage()];
}

export function nextStage() {
  const s = stage();
  if (s >= 3) return null;
  return { name: STAGES[s + 1], inDays: Math.max(1, STAGE_DAYS[s + 1] - load().days) };
}

export function mood() {
  const p = load();
  const now = Date.now();
  if (stage() === 0) return isAsleep() ? 'sleepy' : 'idle';
  if (isAsleep()) return 'sleepy';
  if (p.eatUntil > now) return 'eating';
  if (p.happyUntil > now) return 'happy';
  if (p.sick) return 'sick';
  if (p.food < 25 || p.fun < 25) return 'grumpy';
  if (p.energy < 20) return 'sleepy';
  if (p.food > 70 && p.fun > 70) return 'happy';
  return 'idle';
}

export function moodText() {
  const m = mood();
  const p = load();
  if (stage() === 0) return isAsleep() ? 'Egg is resting...' : 'An egg! Play a game to hatch it';
  if (isAsleep()) return 'Zzz... asleep till 7am';
  if (m === 'eating') return 'Nom nom nom!';
  if (m === 'sick') return 'Poorly... feed me points';
  if (m === 'grumpy') return p.food < 25 ? 'Grumpy: HUNGRY' : 'Grumpy: BORED';
  if (m === 'sleepy') return 'Sleepy...';
  if (m === 'happy') return 'Happy!';
  return 'Chilling';
}

// ---- Time -------------------------------------------------------------------

function decay(ms) {
  const p = load();
  if (stage() === 0) return;           // eggs don't get hungry
  const h = Math.min(OFFLINE_CAP_H, Math.max(0, ms / 3600000));
  if (!h) return;
  const r = isAsleep() ? RATES.asleep : RATES.awake;
  p.food = clamp(p.food + r.food * h);
  p.fun = clamp(p.fun + r.fun * h);
  p.energy = clamp(p.energy + r.energy * h);
  checkHealth();
}

function checkHealth() {
  const p = load();
  if (!p.sick && p.food < 10) {
    p.sick = true;
  } else if (p.sick && p.food >= 50 && p.fun >= 40) {
    p.sick = false;
    Phone.toast(`${p.name} feels better!`);
  }
}

function maybeText(now) {
  const p = load();
  if (stage() === 0 || isAsleep()) return;
  if (now - (p.lastText || 0) < TEXT_GAP_MS) return;
  let text = null;
  if (p.food < 30) text = `${p.name.toLowerCase()} here. tummy rumbling... play a game n feed me pts? :-(`;
  else if (p.fun < 30) text = `${p.name.toLowerCase()} is BORED. come pet me. or play paws. pls x`;
  if (!text) return;
  p.lastText = now;
  Sms.queueText('pet', text, { from: p.name, pet: true });
}

function tick() {
  const now = Date.now();
  if (now - lastTick < 5000) return;
  lastTick = now;
  const p = load();
  decay(now - (p.last || now));
  p.last = now;
  maybeText(now);
  save();
  emit();
}

// ---- Feeding (games) ----------------------------------------------------------

function today() {
  return Sms.today();
}

export function feed(points) {
  const p = load();
  const before = stage();
  const day = today();
  if (p.lastDay !== day) {
    p.lastDay = day;
    p.days += 1;
  }
  const food = Math.max(3, Math.min(35, Math.round((Number(points) || 0) / 12)));
  if (before > 0 || stage() > 0) {
    p.food = clamp(p.food + food);
    p.fun = clamp(p.fun + 3);
    p.energy = clamp(p.energy - 2);
    p.eatUntil = Date.now() + 3500;
  }
  p.meals += 1;
  p.lastMeal = { points: Number(points) || 0, food, at: Date.now() };
  checkHealth();
  const after = stage();
  if (after > before) evolve(after);
  save();
  emit();
  return { food, stage: after, evolved: after > before };
}

function evolve(s) {
  const p = load();
  const lines = [
    '',
    `*crack* hi!! im ${p.name.toLowerCase()}. i live in ur phone now. feed me points pls`,
    `${p.name.toLowerCase()} grew ears! im a Kid now. still hungry tho`,
    `${p.name.toLowerCase()} is all grown up. antenna and everything. ur the best x`
  ];
  Sms.queueText('pet', lines[s], { from: p.name, pet: true });
  Phone.toast(s === 1 ? `Your egg hatched: ${p.name}!` : `${p.name} evolved: ${STAGES[s]}!`);
  Sfx.play('petEvolve');
}

// ---- Interactions -------------------------------------------------------------

export function pet() {
  const p = load();
  const now = Date.now();
  if (stage() === 0) { Sfx.play('petBlip'); return { ok: false, msg: '*wobble*' }; }
  if (isAsleep()) { Sfx.play('petBlip'); return { ok: false, msg: 'Zzz... shh!' }; }
  if (now - lastPet < PET_COOLDOWN) return { ok: false, msg: '' };
  lastPet = now;
  p.fun = clamp(p.fun + 4);
  p.pets += 1;
  p.happyUntil = now + 1300;
  checkHealth();
  save();
  emit();
  Sfx.play('petHappy');
  return { ok: true, msg: 'Purr!' };
}

export function startGuess() {
  const p = load();
  if (stage() === 0) return { ok: false, msg: 'Eggs cant play yet' };
  if (isAsleep()) return { ok: false, msg: 'Zzz... too sleepy' };
  if (p.energy < 10) return { ok: false, msg: 'Too tired to play' };
  guess = { side: Math.random() < 0.5 ? 'left' : 'right' };
  Sfx.play('petBlip');
  return { ok: true, msg: 'Which paw? ◀ or ▶' };
}

export function guessing() {
  return !!guess;
}

export function chooseGuess(side) {
  if (!guess) return null;
  const p = load();
  const win = side === guess.side;
  const res = { win, side: guess.side };
  guess = null;
  p.energy = clamp(p.energy - (win ? 4 : 3));
  p.fun = clamp(p.fun + (win ? 10 : 2));
  if (win) { p.wins += 1; p.happyUntil = Date.now() + 1500; }
  checkHealth();
  save();
  emit();
  Sfx.play(win ? 'petWin' : 'petLose');
  return res;
}

export function cancelGuess() {
  guess = null;
}

export function rename(name) {
  const clean = String(name || '').toUpperCase().replace(/[^A-Z0-9 -]/g, '').trim().slice(0, 8);
  load().name = clean || 'BLIP';
  save();
  emit();
  return load().name;
}

export function name() {
  return load().name;
}

export function state() {
  const p = load();
  return { ...p, stage: stage(), stageName: stageName(), mood: mood(), asleep: isAsleep(), next: nextStage() };
}

export function initPet() {
  const p = load();
  const now = Date.now();
  decay(now - (p.last || now));   // offline catch-up (capped)
  p.last = now;
  save();
  Phone.onTick(tick);
  Progress.onRun((evt) => { if (evt && evt.kind === 'run') feed(evt.score); });

  window.__vpg = window.__vpg || {};
  window.__vpg.pet = {
    state,
    set: (patch) => { Object.assign(load(), patch || {}); save(); emit(); return state(); },
    advanceHours: (h) => { decay(h * 3600000); maybeText(Date.now()); save(); emit(); return state(); },
    feed,
    setDays: (n) => { load().days = Math.max(0, n | 0); save(); emit(); return state(); },
    rename,
    reset: () => { st = fresh(); save(); emit(); return state(); }
  };
}

export default { initPet, state, mood, moodText, stage, stageName, nextStage, feed, pet, startGuess, chooseGuess, guessing, cancelGuess, rename, name, isAsleep, onPetChange, STAGES };
