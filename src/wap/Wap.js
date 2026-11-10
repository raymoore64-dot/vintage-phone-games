/*
 * WAP downloads: the state behind the WAP screen and the extra games in
 * the main menu. localStorage 'vpg.wap' { downloaded: {id: ts}, played: {id: true}, kazTip }.
 * Debug: window.__vpg.wap.{list, register, download, reset, setSpeed}
 */

import CATALOG from './catalog.js';
import * as Progress from '../progress/Progress.js';
import * as Sms from '../phone/Sms.js';
import * as Eggs from '../phone/Eggs.js';

export const STORAGE_KEY = 'vpg.wap';

let game = null;
let st = null;
let speed = 1;
const extra = [];   // registered at runtime (tests / future)

function load() {
  if (st) return st;
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    st = d && typeof d === 'object' ? d : {};
  } catch {
    st = {};
  }
  if (!st.downloaded || typeof st.downloaded !== 'object') st.downloaded = {};
  if (!st.played || typeof st.played !== 'object') st.played = {};
  return st;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(load()));
  } catch {
    // ignore
  }
}

export function catalog() {
  return [...CATALOG, ...extra];
}

export function get(id) {
  return catalog().find((c) => c.id === id) || null;
}

function sceneExists(key) {
  try {
    return !!(game && game.scene && game.scene.keys && game.scene.keys[key]);
  } catch {
    return false;
  }
}

export function reqMet(c) {
  const r = c.req || {};
  if (r.type === 'points') return Progress.getTotal() >= r.value;
  if (r.type === 'dares') return Sms.daresDone() >= r.value;
  if (r.type === 'code') return Eggs.isFound(r.value);
  return true;
}

export function reqText(c) {
  const r = c.req || {};
  if (r.type === 'points') return `${r.value} pts (you: ${Progress.getTotal()})`;
  if (r.type === 'dares') return `Beat ${r.value} dares (done: ${Sms.daresDone()})`;
  if (r.type === 'code') return `Code: ${r.hint || 'secret word'}`;
  return 'Free';
}

export function status(c) {
  if (!sceneExists(c.scene)) return 'soon';
  if (load().downloaded[c.id]) return 'installed';
  return reqMet(c) ? 'ready' : 'locked';
}

export function list() {
  return catalog().map((c) => ({ ...c, status: status(c), met: reqMet(c), reqLabel: reqText(c) }));
}

export function isDownloaded(id) {
  return !!load().downloaded[id];
}

/** Mark downloaded and send the network text. */
export function completeDownload(id) {
  const c = get(id);
  if (!c) return false;
  load().downloaded[id] = Date.now();
  save();
  Sms.queueText('network', `LINICRO Net: Download complete! ${c.name} (${c.sizeKb}KB) is in ur Games menu. Cost: 0p. We're nice like that.`, { wap: id });
  return true;
}

/** Downloaded games for the menu, in catalogue order. */
export function menuGames() {
  return catalog()
    .filter((c) => status(c) === 'installed')
    .map((c) => ({ name: c.name, scene: c.scene, bestKey: c.bestKey, game: c.id, wap: true, isNew: !load().played[c.id] }));
}

export function markPlayed(id) {
  if (!load().played[id]) {
    load().played[id] = true;
    save();
  }
}

export function readyCount() {
  return list().filter((c) => c.status === 'ready').length;
}

export function downloadSpeed() {
  return speed;
}

/** First WAP visit: Kaz texts the secret word for Ring Rhythm. */
export function onVisit() {
  const s = load();
  if (s.kazTip) return;
  s.kazTip = true;
  save();
  Sms.queueText('kaz', 'saw u on WAP!! secret: on the menu press * * then type TONES (86637). unlocks a ringtone game ;-)', { code: 'TONES' });
}

export function initWap(g) {
  game = g;
  window.__vpg = window.__vpg || {};
  window.__vpg.wap = {
    list,
    register: (def) => { if (def && def.id && !get(def.id)) extra.push({ sizeKb: 24, req: { type: 'points', value: 0 }, desc: '', ...def }); return list(); },
    download: (id) => completeDownload(id),
    reset: () => { st = { downloaded: {}, played: {} }; save(); return list(); },
    setSpeed: (n) => { speed = Math.max(0.1, Number(n) || 1); return speed; },
    menuGames
  };
}

export default { initWap, catalog, list, get, status, reqMet, reqText, completeDownload, menuGames, markPlayed, readyCount, isDownloaded, onVisit, downloadSpeed };
