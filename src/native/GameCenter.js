/*
 * Game Center wrapper. Native (iOS app): the local plugin in
 * plugins/capacitor-game-center (JS name "GameCenter"). Web: every call is a
 * quiet no-op that resolves; the Leaderboards menu shows local bests.
 *
 *   initGameCenter()         sign in once at boot (native), wire listeners
 *   submitScore(key, score)  key = game id | 'daily' | 'total'
 *   showLeaderboard(key?)    open the Game Center UI (native only)
 *   unlock(key)              report an achievement (once)
 *   checkAchievements()      evaluate all achievements against local state
 *
 * Scores go up at every game over (Game Center keeps the best), lifetime
 * points go to lb.total, and the official Daily result goes to lb.daily.
 * Earned achievements are remembered locally (vpg.gc) so they are only
 * reported once, and re-reported after sign-in in case an earlier report
 * happened while signed out.
 */

import { isNative, hasPlugin } from './Native.js';
import { LEADERBOARDS, ACHIEVEMENTS, lbId, GAME_IDS } from './gcIds.js';
import * as Progress from '../progress/Progress.js';
import * as Eggs from '../phone/Eggs.js';
import * as Pet from '../pet/Pet.js';
import * as Wap from '../wap/Wap.js';
import { daresDone } from '../phone/Sms.js';
import * as Daily from '../daily/Daily.js';

const KEY = 'vpg.gc';
const log = [];
let authed = false;
let plugin = null;
let inited = false;

function note(kind, detail) {
  log.push({ kind, ...detail, at: Date.now() });
  if (log.length > 120) log.shift();
}

function loadState() {
  try { return { earned: {}, ...(JSON.parse(localStorage.getItem(KEY) || '{}')) }; } catch { return { earned: {} }; }
}
function saveState(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }

export function available() { return hasPlugin('GameCenter'); }

async function gc() {
  if (!available()) return null;
  if (!plugin) plugin = (await import('@studiolinicro/capacitor-game-center')).GameCenter;
  return plugin;
}

export async function authenticate() {
  const p = await gc();
  if (!p) { note('auth', { native: false }); return { authenticated: false, available: false }; }
  try {
    const res = await p.authenticate();
    authed = !!res.authenticated;
    note('auth', { native: true, authenticated: authed });
    if (authed) reportEarned();
    return res;
  } catch (err) {
    note('error', { what: 'auth', err: String(err) });
    return { authenticated: false, available: true };
  }
}

export function isAuthenticated() { return authed; }

export async function submitScore(key, score) {
  const id = lbId(key);
  const value = Math.max(0, Math.floor(Number(score) || 0));
  note('score', { key, id, score: value, native: available() });
  if (!id) return { submitted: false, reason: 'unknown-leaderboard' };
  const p = await gc();
  if (!p) return { submitted: false, reason: 'web' };
  try { return await p.submitScore({ leaderboardId: id, score: value }); } catch (err) {
    note('error', { what: 'score', err: String(err) });
    return { submitted: false };
  }
}

export async function showLeaderboard(key) {
  const p = await gc();
  note('show', { key: key || null, native: !!p });
  if (!p) return { shown: false, reason: 'web' };
  if (!authed) await authenticate();
  try { return await p.showLeaderboard(key ? { leaderboardId: lbId(key) } : {}); } catch (err) {
    note('error', { what: 'show', err: String(err) });
    return { shown: false };
  }
}

export async function unlock(key) {
  const a = ACHIEVEMENTS.find((x) => x.key === key);
  if (!a) return { unlocked: false, reason: 'unknown-achievement' };
  const s = loadState();
  const first = !s.earned[key];
  if (first) { s.earned[key] = Date.now(); saveState(s); }
  note('achievement', { key, id: a.id, first, native: available() });
  const p = await gc();
  if (!p) return { unlocked: false, earned: true, reason: 'web' };
  try { return await p.unlockAchievement({ achievementId: a.id, percent: 100 }); } catch (err) {
    note('error', { what: 'achievement', err: String(err) });
    return { unlocked: false };
  }
}

function reportEarned() {
  const s = loadState();
  Object.keys(s.earned).forEach((k) => {
    const a = ACHIEVEMENTS.find((x) => x.key === k);
    if (a) gc().then((p) => p && p.unlockAchievement({ achievementId: a.id, percent: 100 })).catch(() => {});
  });
}

/** Everything the achievement checks look at. */
export function snapshot() {
  const prog = Progress.getProgress();
  const played = GAME_IDS.filter((g) => prog.games[g] && prog.games[g].plays > 0);
  let wapDownloaded = 0;
  try { wapDownloaded = Wap.list().filter((c) => c.status === 'installed').length; } catch { /* not ready */ }
  let petStage = 0;
  try { petStage = Pet.stage(); } catch { /* ignore */ }
  let dares = 0;
  try { dares = daresDone(); } catch { /* ignore */ }
  return {
    total: prog.total,
    plays: GAME_IDS.reduce((n, g) => n + ((prog.games[g] && prog.games[g].plays) || 0), 0),
    gamesPlayed: played.length,
    proto: Progress.isUnlocked('proto-clear'),
    codesFound: Eggs.foundCount(),
    codesTotal: Eggs.totalCount(),
    petStage,
    dares,
    wapDownloaded,
    dailyDone: Daily.doneCount(),
    bestStreak: Daily.bestStreak()
  };
}

export function earned() { return { ...loadState().earned }; }

/** Evaluate every achievement; report the newly earned ones. */
export function checkAchievements() {
  const snap = snapshot();
  const s = loadState();
  const fresh = [];
  ACHIEVEMENTS.forEach((a) => {
    if (s.earned[a.key]) return;
    let ok = false;
    try { ok = !!a.check(snap); } catch { ok = false; }
    if (ok) fresh.push(a.key);
  });
  fresh.forEach((k) => { unlock(k); });
  return fresh;
}

export function initGameCenter() {
  if (inited) return;
  inited = true;
  Progress.onRun((evt) => {
    if (!evt) return;
    if (evt.kind === 'run' && LEADERBOARDS[evt.gameId] && evt.score > 0) submitScore(evt.gameId, evt.score);
    if (evt.total > 0) submitScore('total', evt.total);
    checkAchievements();
  });
  Daily.onDaily((evt) => {
    if (evt.kind === 'done') submitScore('daily', evt.score);
    checkAchievements();
  });
  try { Pet.onPetChange(() => { if (Pet.stage() >= 3) checkAchievements(); }); } catch { /* ignore */ }
  if (isNative()) setTimeout(() => authenticate(), 1500);
  setTimeout(() => checkAchievements(), 2000);
  publish();
}

function publish() {
  window.__vpg = window.__vpg || {};
  window.__vpg.gc = {
    available, authenticate, isAuthenticated, submitScore, showLeaderboard, unlock,
    checkAchievements, snapshot, earned, log: () => log.slice(), clearLog: () => { log.length = 0; },
    ids: () => ({ leaderboards: LEADERBOARDS, achievements: ACHIEVEMENTS.map(({ check, ...a }) => a) })
  };
}

export default { initGameCenter, authenticate, isAuthenticated, submitScore, showLeaderboard, unlock, checkAchievements, snapshot, earned, available };
