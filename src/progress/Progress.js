/*
 * Cross-game progress. Every game reports its final score at game over
 * with addScore(gameId, score). Totals live in localStorage under
 * 'vpg.progress' and unlock the later phone skins.
 */

import SKINS from '../skins/skins.js';

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
  const n = Number(skin.unlockAt);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function isUnlocked(skinOrId) {
  return getTotal() >= unlockAtOf(skinOrId);
}

/**
 * Add a run's score to the lifetime total. Returns the new total, the
 * previous total, and any skins that just crossed their unlock threshold
 * so a game-over screen can announce them.
 */
export function addScore(gameId, score) {
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

  return { total: prev.total, previousTotal, newlyUnlocked, added: pts };
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
  formatUnlockLine
};
