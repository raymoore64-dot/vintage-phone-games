/*
 * Fake incoming calls that interrupt a game.
 *
 * When: each run rolls once (about 1 in 4; guaranteed after 5 runs with no
 * call). If it hits, the phone rings 20-45 s into the run, at most once
 * per run. Never in Simon while the pattern is playing, never while
 * paused / frozen, never on the game-over screen, never with the battery
 * flat or less than 2 bars of signal (it waits and tries again).
 *
 * Ringing: the game is held on the pausable clock (no pause panel), a
 * full-screen call UI shows the caller, the whole phone shakes, it
 * vibrates (where supported) and plays the caller's ringtone (WebAudio,
 * respects Sound: Off).
 *   OK / green / left soft  answer  -> 2-4 line transcript, then a small
 *                                     reward (+points or x2 for 6 s).
 *                                     Costs 2% battery unless on mains.
 *   C / red / right soft    decline -> back at once; a guilt-trip text
 *                                     arrives later (after the run ends).
 *   no answer for 8 s       missed  -> a missed-call text arrives later.
 * Then the usual 3-2-1 countdown and play resumes.
 *
 * Setting: Calls On/Off in Settings (menu 8), stored in 'vpg.calls'.
 * Debug: window.__vpg.calls.{state, ringNow, forceNext, soon, setEnabled,
 *        answer, decline, setRingMs}
 */

import Phaser from 'phaser';
import { setInputCapture, setSoftKeys } from '../input/PhoneInput.js';
import { gameNow, isFrozen } from '../ui/PauseOverlay.js';
import { getSkin } from '../skins/SkinManager.js';
import { addBonus, grantDouble } from '../skins/perks.js';
import { CAST, CALLS, CALLER_POOL } from './messages.js';
import * as Sms from './Sms.js';
import * as Phone from './Phone.js';
import * as Power from './Power.js';
import * as Sfx from '../audio/Sfx.js';

const STORE = 'vpg.calls';
const CHANCE = 0.25;
const PITY_RUNS = 5;
const EARLIEST = 20000;
const LATEST = 45000;
const RING_MS = 8000;
const RING_EVERY = 1900;
const LINE_MS = 1100;
const BATTERY_COST = 2;

let pref = null;
let forceNext = false;
let ringMs = RING_MS;
let call = null;              // the live call, if any
let lastRun = null;
let lastEnded = null;
const deferred = [];          // guilt / missed texts, sent when the run ends

function deferText(key, text, extra) {
  deferred.push({ key, text, extra });
}

function flushDeferred() {
  while (deferred.length) {
    const d = deferred.shift();
    Sms.queueText(d.key, d.text, d.extra);
  }
}
const stats = { rung: 0, answered: 0, declined: 0, missed: 0 };

function read() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE) || '{}');
    return d && typeof d === 'object' ? d : {};
  } catch {
    return {};
  }
}

function write(patch) {
  try {
    localStorage.setItem(STORE, JSON.stringify({ ...read(), ...patch }));
  } catch {
    // ignore
  }
}

export function callsEnabled() {
  if (pref == null) pref = read().on !== false;
  return pref;
}

export function setCallsEnabled(on) {
  pref = !!on;
  write({ on: pref });
  return pref;
}

export function toggleCalls() {
  return setCallsEnabled(!callsEnabled());
}

export function callsLabel() {
  return callsEnabled() ? 'Calls: On' : 'Calls: Off';
}

export function isRinging() {
  return !!call;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// ---- Per-run scheduling -----------------------------------------------------

/** Called once per run from attachPerks(). */
export function attachCalls(scene, gameId) {
  // `delay` becomes an absolute `at` on the first update: in create() the
  // scene clock can still hold a stale value from before the restart.
  const run = { scene, gameId, at: Infinity, delay: null, rolled: false, done: false };
  lastRun = run;
  if (callsEnabled()) {
    const since = Number(read().since) || 0;
    const hit = forceNext || since + 1 >= PITY_RUNS || Math.random() < CHANCE;
    run.rolled = hit;
    if (hit) {
      run.delay = forceNext ? EARLIEST : Phaser.Math.Between(EARLIEST, LATEST);
      write({ since: 0 });
    } else {
      write({ since: since + 1 });
    }
    forceNext = false;
  }

  const onUpdate = () => {
    if (deferred.length && scene.alive === false) flushDeferred();
    if (run.done) return;
    if (scene.alive === false || isFrozen(scene)) return;
    const t = gameNow(scene);
    if (run.delay != null) {
      run.at = t + run.delay;
      run.delay = null;
    }
    if (!Number.isFinite(run.at)) return;
    if (t < run.at) return;
    if (!canRingNow(scene)) {
      run.at = t + 3000;
      return;
    }
    run.done = true;
    ring(scene);
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
    if (call && call.scene === scene) teardown({ release: false });
    flushDeferred();
    if (lastRun === run) lastRun = null;
  });
  scene.__calls = run;
  return run;
}

function canRingNow(scene) {
  if (!callsEnabled() || !Power.isOn() || call) return false;
  if (Phone.isRescuing() || Phone.batteryLevel() < 2) return false;
  if (Phone.signalBars() < 2) return false;
  if (scene.scene.key === 'SimonScene' && scene.phase !== 'input') return false;
  return !!scene.__pauseCtl;
}

// ---- The call ---------------------------------------------------------------

function container() {
  return document.getElementById('game-container');
}

function ring(scene, who) {
  const ctl = scene.__pauseCtl;
  if (!ctl || !ctl.hold('call')) return false;
  const key = who && CALLS[who] ? who : pick(CALLER_POOL);
  const data = CALLS[key];
  const cast = CAST[key] || CAST.unknown;
  stats.rung += 1;

  const el = document.createElement('div');
  el.className = 'call-screen ringing';
  const pal = getSkin().palette;
  Object.entries({ '--cbg': pal.bg, '--cfg': pal.fg, '--cacc': pal.accent, '--cwarn': pal.warn, '--ctext': pal.text, '--cdim': pal.dim, '--cpanel': pal.panel, '--cdanger': pal.danger })
    .forEach(([k, v]) => el.style.setProperty(k, v));
  el.innerHTML = `
    <div class="cs-top">Incoming call</div>
    <div class="cs-avatar"><span>${cast.name.replace(/^The /, '').charAt(0)}</span></div>
    <div class="cs-name">${cast.name}</div>
    <div class="cs-num">${cast.number}</div>
    <div class="cs-waves"><i></i><i></i><i></i></div>
    <div class="cs-body"></div>
    <div class="cs-btns">
      <button class="cs-ans" type="button">✆ Answer</button>
      <button class="cs-dec" type="button">✕ Decline</button>
    </div>`;
  const host = container();
  if (host) host.appendChild(el);
  el.querySelector('.cs-ans').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); answer(); });
  el.querySelector('.cs-dec').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); onRedButton(); });
  el.addEventListener('pointerdown', (e) => e.stopPropagation());

  const phoneEl = document.querySelector('.phone');
  if (phoneEl) phoneEl.classList.add('ringing');

  call = {
    scene, key, data, cast, el, phase: 'ringing',
    release: setInputCapture(onInput),
    timers: [],
    startedAt: performance.now(),
    soft: null
  };
  setSoftKeys('Answer', 'Decline');
  const tone = () => {
    if (!call || call.phase !== 'ringing') return;
    Sfx.play(data.ring);
    vibrate([400, 200, 400]);
  };
  tone();
  call.timers.push(setInterval(tone, RING_EVERY));
  call.timers.push(setTimeout(() => missed(), ringMs));
  publish();
  return true;
}

function vibrate(pattern) {
  try {
    const ua = navigator.userActivation;
    if (navigator.vibrate && ua && ua.hasBeenActive) navigator.vibrate(pattern);
  } catch {
    // not supported
  }
}

function stopRinging() {
  if (!call) return;
  call.timers.forEach((t) => { clearInterval(t); clearTimeout(t); });
  call.timers = [];
  const phoneEl = document.querySelector('.phone');
  if (phoneEl) phoneEl.classList.remove('ringing');
  if (call.el) call.el.classList.remove('ringing');
  vibrate(0);
}

function onInput(action) {
  if (!call) return;
  if (call.phase === 'ringing') {
    if (action === 'ok' || action === 'softLeft') answer();
    else if (action === 'back' || action === 'softRight') decline();
    return;
  }
  if (call.phase === 'talking' && call.allShown) {
    if (action === 'ok' || action === 'softLeft' || action === 'back' || action === 'softRight') hangUp();
  }
}

function onRedButton() {
  if (!call) return;
  if (call.phase === 'ringing') decline();
  else if (call.phase === 'talking' && call.allShown) hangUp();
}

export function answer() {
  if (!call || call.phase !== 'ringing') return false;
  stopRinging();
  stats.answered += 1;
  call.phase = 'talking';
  call.allShown = false;
  call.answer = pick(call.data.answers);
  call.talkStart = performance.now();
  Sfx.play('callAnswer');
  Phone.drain(BATTERY_COST);
  const el = call.el;
  el.classList.add('talking');
  el.querySelector('.cs-top').textContent = 'Connected 00:00';
  el.querySelector('.cs-btns').innerHTML = '<button class="cs-dec" type="button">✕ Hang up</button>';
  el.querySelector('.cs-btns .cs-dec').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); onRedButton(); });
  setSoftKeys('', 'Hang up');
  const body = el.querySelector('.cs-body');
  const lines = call.answer.lines;
  lines.forEach((line, i) => {
    call.timers.push(setTimeout(() => {
      if (!call) return;
      const p = document.createElement('p');
      p.className = line.startsWith('YOU:') ? 'me' : 'them';
      p.textContent = line;
      body.appendChild(p);
      Sfx.play('pinKey');
      if (i === lines.length - 1) call.allShown = true;
    }, 350 + i * LINE_MS));
  });
  const clock = () => {
    if (!call || call.phase !== 'talking') return;
    const s = Math.floor((performance.now() - call.talkStart) / 1000);
    el.querySelector('.cs-top').textContent = `Connected 00:${String(s).padStart(2, '0')}`;
  };
  call.timers.push(setInterval(clock, 250));
  call.timers.push(setTimeout(() => hangUp(), 350 + lines.length * LINE_MS + 1600));
  publish();
  return true;
}

function hangUp() {
  if (!call || call.phase !== 'talking') return;
  const scene = call.scene;
  const reward = call.answer.reward || {};
  const label = call.answer.label || 'CALL';
  const secs = Math.max(1, Math.round((performance.now() - call.talkStart) / 1000));
  endScreen(`Call ended 00:${String(secs).padStart(2, '0')}`, () => {
    if (!scene || !scene.sys || !scene.sys.isActive()) return;
    if (reward.points) addBonus(scene, reward.points, label);
    else if (reward.double) grantDouble(scene, reward.double, label);
  });
}

export function decline() {
  if (!call || call.phase !== 'ringing') return false;
  stats.declined += 1;
  const { key, data } = call;
  deferText(key, data.guilt, { guilt: true });
  endScreen('Call declined', null, 350);
  return true;
}

function missed() {
  if (!call || call.phase !== 'ringing') return;
  stats.missed += 1;
  const { key, data, cast } = call;
  deferText(key, data.missed, { missed: true });
  endScreen(`1 missed call\n${cast.name}`, null, 1100, 'callMissed');
}

function endScreen(text, after, ms = 700, sound = 'callEnd') {
  if (!call) return;
  stopRinging();
  call.phase = 'ended';
  Sfx.play(sound);
  const el = call.el;
  el.classList.add('ended');
  el.innerHTML = `<div class="cs-end">${text.replace(/\n/g, '<br>')}</div>`;
  publish();
  call.timers.push(setTimeout(() => {
    const c = call;
    teardown({ release: true });
    if (after) {
      try { after(); } catch (err) { console.warn('call reward failed', err); }
    }
    lastEnded = { key: c.key, reward: c.answer ? c.answer.reward : null };
    publish();
  }, ms));
}

function teardown({ release }) {
  if (!call) return;
  const c = call;
  stopRinging();
  c.timers.forEach((t) => { clearInterval(t); clearTimeout(t); });
  if (c.release) c.release();
  if (c.el && c.el.parentNode) c.el.parentNode.removeChild(c.el);
  call = null;
  if (release && c.scene && c.scene.__pauseCtl && Power.isOn()) {
    c.scene.__pauseCtl.releaseHold();
  }
}

function publish() {
  window.__vpg = window.__vpg || {};
  window.__vpg.callState = call ? { key: call.key, phase: call.phase } : null;
}

export function initCalls() {
  Phone.addReceiveGate(() => !call);
  // Powering off mid-call hangs up silently (the game stays held for the reboot)
  Power.onPowerChange((mode) => {
    if (mode === 'shutdown' && call) teardown({ release: false });
  });
  window.__vpg = window.__vpg || {};
  window.__vpg.calls = {
    state: () => ({
      enabled: callsEnabled(),
      ringing: !!call,
      phase: call ? call.phase : null,
      caller: call ? call.key : null,
      lines: call && call.el ? [...call.el.querySelectorAll('.cs-body p')].map((p) => p.textContent) : [],
      run: lastRun ? {
        gameId: lastRun.gameId, rolled: lastRun.rolled, done: lastRun.done, at: lastRun.at,
        inMs: lastRun.delay != null ? lastRun.delay : (Number.isFinite(lastRun.at) && lastRun.scene.__pauseCtl ? Math.round(lastRun.at - gameNow(lastRun.scene)) : null)
      } : null,
      since: Number(read().since) || 0,
      lastEnded,
      deferred: deferred.map((d) => `${d.key}:${d.text}`),
      stats: { ...stats }
    }),
    ringNow: (who) => {
      const s = lastRun && lastRun.scene;
      if (!s || !s.sys || !s.sys.isActive() || call) return false;
      if (lastRun) lastRun.done = true;
      return ring(s, who);
    },
    forceNext: () => { forceNext = true; return true; },
    // schedule this run's call ms from now (normal gating still applies)
    soon: (ms = 0) => {
      if (!lastRun || !lastRun.scene) return false;
      lastRun.rolled = true;
      lastRun.done = false;
      lastRun.delay = null;
      lastRun.at = gameNow(lastRun.scene) + ms;
      return true;
    },
    setEnabled: setCallsEnabled,
    answer,
    decline,
    setRingMs: (ms) => { ringMs = Math.max(500, Number(ms) || RING_MS); return ringMs; }
  };
}

export default { initCalls, attachCalls, callsEnabled, setCallsEnabled, toggleCalls, callsLabel, isRinging, answer, decline };
