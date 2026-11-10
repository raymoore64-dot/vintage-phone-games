/*
 * Cross-game progress. Every game reports its final score at game over
 * with addScore(gameId, score). Totals live in localStorage under
 * 'vpg.progress' and unlock the later phone skins.
 */

import SKINS from '../skins/skins.js';
import * as Secrets from '../phone/Secrets.js';

// Run / bonus listeners (the SMS inbox reacts to these). Called on the
// next tick so a game-over screen finishes drawing first.
const runListeners = new Set();

export function onRun(fn) {
  runListeners.add(fn);
  return () => runListeners.delete(fn);
}

function emitRun(evt) {
  setTimeout(() => {
    runListeners.forEach((fn) => {
      try { fn(evt); } catch (err) { console.warn('run listener failed', err); }
    });
  }, 0);
}

export const STORAGE_KEY = 'vpg.progress';

function empty() {
  return { total: 0, games: {} };
}

export function getProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw);
    const total = Number(data?.total);
    if (!Number.isFinite(total) || total < 0) return empty();
    return { total: Math.floor(total), games: data.games && typeof data.games === 'object' ? data.games : {} };
  } catch {
    return empty();
  }
}

function write(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // private mode / blocked storage
  }
}

export function getTotal() {
  return getProgress().total;
}

export function unlockAtOf(skinOrId) {
  const skin = typeof skinOrId === 'string'
    ? SKINS.find((s) => s.id === skinOrId)
    : skinOrId;
  if (!skin) return Infinity;
  if (skin.secret) return Infinity;
  const n = Number(skin.unlockAt);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function isUnlocked(skinOrId) {
  const skin = typeof skinOrId === 'string'
    ? SKINS.find((s) => s.id === skinOrId)
    : skinOrId;
  if (skin && skin.secret) return Secrets.has(skin.secret);
  return getTotal() >= unlockAtOf(skinOrId);
}

/**
 * Add a run's score to the lifetime total. Returns the new total, the
 * previous total, and any skins that just crossed their unlock threshold
 * so a game-over screen can announce them.
 */
export function addScore(gameId, score, meta = {}) {
  const pts = Math.max(0, Math.floor(Number(score) || 0));
  const prev = getProgress();
  const previousTotal = prev.total;
  prev.total = previousTotal + pts;
  const id = String(gameId || 'unknown');
  const g = prev.games[id] && typeof prev.games[id] === 'object'
    ? prev.games[id]
    : { plays: 0, scored: 0 };
  g.plays = (Number(g.plays) || 0) + 1;
  g.scored = (Number(g.scored) || 0) + pts;
  prev.games[id] = g;
  write(prev);

  const newlyUnlocked = SKINS.filter((s) => {
    const at = unlockAtOf(s);
    return at > previousTotal && at <= prev.total;
  });

  const result = { total: prev.total, previousTotal, newlyUnlocked, added: pts };
  emitRun({ kind: 'run', gameId: id, score: pts, newBest: !!(meta && meta.newBest), ...result });
  return result;
}

/**
 * Bonus points (dares). Counts toward unlocks like normal points.
 */
export function addBonus(points, reason = 'bonus') {
  const pts = Math.max(0, Math.floor(Number(points) || 0));
  const prev = getProgress();
  const previousTotal = prev.total;
  prev.total = previousTotal + pts;
  const g = prev.games._bonus && typeof prev.games._bonus === 'object' ? prev.games._bonus : { plays: 0, scored: 0 };
  g.plays = (Number(g.plays) || 0) + 1;
  g.scored = (Number(g.scored) || 0) + pts;
  prev.games._bonus = g;
  write(prev);
  const newlyUnlocked = SKINS.filter((s) => {
    const at = unlockAtOf(s);
    return at > previousTotal && at <= prev.total;
  });
  const result = { total: prev.total, previousTotal, newlyUnlocked, added: pts };
  emitRun({ kind: 'bonus', reason, ...result });
  return result;
}

/** One-line announcement, or '' if nothing new unlocked. */
export function formatUnlockLine(result) {
  const list = result?.newlyUnlocked || [];
  if (!list.length) return '';
  if (list.length === 1) return `New phone unlocked: ${list[0].name}!`;
  return `New phones unlocked: ${list.map((s) => s.name).join(', ')}!`;
}

export default {
  STORAGE_KEY,
  getProgress,
  getTotal,
  unlockAtOf,
  isUnlocked,
  addScore,
  addBonus,
  onRun,
  formatUnlockLine
};
