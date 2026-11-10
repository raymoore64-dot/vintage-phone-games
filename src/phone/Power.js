/*
 * Power key, boot-up and shutdown.
 *
 *   Hold the red C key (keyboard: hold Esc or End) for ~1.2 s:
 *     on  -> shutdown animation + jingle, screen goes black, music and
 *            effects stop, a running game is frozen (pause clock held).
 *     off -> per-brand boot animation + jingle, then the joke
 *            "No SIM / Emergency games only" + fake "Enter PIN" screen,
 *            then the phone reboots to the menu.
 *
 *   App launch: once per browser session the LCD waits on a standby
 *   screen ("Press any key"); the first key / tap unlocks audio and runs
 *   the boot sequence. OK skips each step. Later launches in the same
 *   session go straight to the menu.
 *
 *   PIN screen: the very first boot always shows it (any 4 digits or OK).
 *   Later boots flash "Emergency games only" for a moment (OK skips).
 *
 * State: localStorage 'vpg.power' { pinSeen, boots }, sessionStorage
 * 'vpg.booted'. Add ?noboot to the URL to skip the launch boot.
 *
 * Debug: window.__vpg.power.{state, off, on, skip, skipBoot, reset}
 */

import { getInputBus, setInputCapture } from '../input/PhoneInput.js';
import { getSkin } from '../skins/SkinManager.js';
import { logoSvg, brandKey, tagline } from './brandLogos.js';
import * as Sfx from '../audio/Sfx.js';
import * as Music from '../audio/Music.js';
import { setSilenced } from '../audio/beep.js';
import { GAME_SCENES } from './Phone.js';
import * as Phone from './Phone.js';

const STORE = 'vpg.power';
const SESSION = 'vpg.booted';
const BOOT_MS = 2300;
const NOSIM_MS = 1500;
const SHUTDOWN_MS = 1300;

let game = null;
let el = null;
let mode = 'on';           // standby | boot | nosim | pin | on | shutdown | off
let release = null;
let timers = [];
let pin = '';
let firstPin = false;
let rebootToMenu = false;
let boots = 0;
let offs = 0;
const listeners = new Set();

function readStore() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE) || '{}');
    return d && typeof d === 'object' ? d : {};
  } catch {
    return {};
  }
}

function writeStore(patch) {
  try {
    localStorage.setItem(STORE, JSON.stringify({ ...readStore(), ...patch }));
  } catch {
    // ignore
  }
}

function clearTimers() {
  timers.forEach((t) => clearTimeout(t));
  timers = [];
}

function later(ms, fn) {
  timers.push(setTimeout(fn, ms));
}

function emit() {
  listeners.forEach((fn) => {
    try { fn(mode); } catch { /* ignore */ }
  });
}

export function onPowerChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isOn() {
  return mode === 'on';
}

export function powerMode() {
  return mode;
}

function paint() {
  const pal = getSkin().palette;
  el.style.setProperty('--pbg', pal.bg);
  el.style.setProperty('--pfg', pal.fg);
  el.style.setProperty('--pacc', pal.accent);
  el.style.setProperty('--pwarn', pal.warn);
  el.style.setProperty('--ptext', pal.text);
  el.style.setProperty('--pdim', pal.dim);
  el.style.setProperty('--ppanel', pal.panel);
}

function show(cls, html) {
  paint();
  el.className = `power-screen show ${cls}`;
  el.innerHTML = html;
}

function hide() {
  el.className = 'power-screen';
  el.innerHTML = '';
}

function capture() {
  if (!release) release = setInputCapture(onInput);
}

function uncapture() {
  if (release) release();
  release = null;
}

function activeGame() {
  if (!game) return null;
  return game.scene.getScenes(true).find((s) => GAME_SCENES.has(s.scene.key)) || null;
}

// ---- Screens ----------------------------------------------------------------

function standby() {
  mode = 'standby';
  capture();
  Music.pause('power');
  const skin = getSkin();
  show(`standby b-${brandKey(skin)}`, `
    <div class="pw-logo faint">${logoSvg(skin)}</div>
    <div class="pw-brand faint">${skin.brand}</div>
    <div class="pw-press">Press any key</div>`);
  emit();
}

function boot() {
  clearTimers();
  mode = 'boot';
  capture();
  Music.pause('power');
  setSilenced(false);
  boots += 1;
  const skin = getSkin();
  const key = brandKey(skin);
  show(`boot b-${key}`, `
    <div class="pw-logo">${logoSvg(skin)}</div>
    <div class="pw-brand">${skin.brand}</div>
    <div class="pw-tag">${tagline(skin)}</div>
    <div class="pw-skip">OK skip</div>`);
  setTimeout(() => Sfx.play(`boot_${key}`), 60);
  later(BOOT_MS, () => noSim());
  emit();
}

function noSim() {
  clearTimers();
  mode = 'nosim';
  firstPin = !readStore().pinSeen;
  show('nosim', `
    <div class="pw-card">
      <div class="pw-icon">▯✕</div>
      <div class="pw-title">No SIM card</div>
      <div class="pw-sub">Emergency games only</div>
    </div>
    <div class="pw-skip">OK skip</div>`);
  later(firstPin ? NOSIM_MS : 1100, () => (firstPin ? pinScreen() : done()));
  emit();
}

function pinScreen() {
  clearTimers();
  mode = 'pin';
  pin = '';
  renderPin();
  emit();
}

function renderPin(msg) {
  const slots = [0, 1, 2, 3].map((i) => `<span class="${i < pin.length ? 'on' : ''}">${i < pin.length ? '*' : '_'}</span>`).join('');
  show('pin', `
    <div class="pw-card">
      <div class="pw-title">Enter PIN</div>
      <div class="pw-pin">${slots}</div>
      <div class="pw-sub">${msg || 'any 4 digits'}</div>
    </div>
    <div class="pw-skip">OK skip · C delete</div>`);
}

function done() {
  clearTimers();
  writeStore({ pinSeen: true, boots: (Number(readStore().boots) || 0) + 1 });
  try { sessionStorage.setItem(SESSION, '1'); } catch { /* ignore */ }
  hide();
  uncapture();
  mode = 'on';
  setSilenced(false);
  Music.resume('power');
  if (rebootToMenu && game) {
    // A real phone reboots to its home screen
    rebootToMenu = false;
    const s = game.scene.getScenes(true)[0];
    if (s) s.scene.start('MenuScene');
  }
  Phone.render(true);
  emit();
}

function skipStep() {
  if (mode === 'boot') noSim();
  else if (mode === 'nosim') (firstPin ? pinScreen() : done());
  else if (mode === 'pin') done();
}

// ---- Off / on ---------------------------------------------------------------

export function powerOff() {
  if (mode !== 'on') return false;
  clearTimers();
  mode = 'shutdown';
  offs += 1;
  capture();
  Phone.clearToasts();
  const g = activeGame();
  if (g && g.__pauseCtl && g.alive !== false) g.__pauseCtl.hold('power');
  emit();                       // Calls hang up here
  Music.pause('power');
  Sfx.play('powerOff');
  const skin = getSkin();
  show(`shutdown b-${brandKey(skin)}`, `
    <div class="pw-logo">${logoSvg(skin)}</div>
    <div class="pw-brand">Goodbye!</div>`);
  later(SHUTDOWN_MS, () => {
    mode = 'off';
    setSilenced(true);
    show('off', '<div class="pw-offhint"><span class="t">Hold C to switch on</span><span class="d">Hold Esc / End to switch on</span></div>');
    emit();
  });
  return true;
}

export function powerOn() {
  if (mode !== 'off') return false;
  rebootToMenu = true;
  Sfx.unlockAudio();
  boot();
  return true;
}

function onHold() {
  if (mode === 'on') powerOff();
  else if (mode === 'off') powerOn();
  else if (mode === 'standby') { Sfx.unlockAudio(); boot(); }
}

function onInput(action, digit) {
  if (mode === 'standby') {
    Sfx.unlockAudio();
    boot();
    return;
  }
  if (mode === 'boot' || mode === 'nosim') {
    if (action === 'ok' || action === 'softLeft') skipStep();
    return;
  }
  if (mode === 'pin') {
    if (action === 'digit' && /^[0-9]$/.test(digit)) {
      if (pin.length >= 4) return;
      pin += digit;
      Sfx.play('pinKey');
      renderPin();
      if (pin.length === 4) {
        Sfx.play('pinOk');
        clearTimers();
        later(80, () => renderPin('PIN OK. Welcome!'));
        later(700, () => done());
      }
      return;
    }
    if (action === 'back' || action === 'softRight') {
      pin = pin.slice(0, -1);
      renderPin();
      return;
    }
    if ((action === 'ok' || action === 'softLeft') && pin.length < 4) done();
  }
  // shutdown / off: everything is swallowed; holding C is handled by the bus
}

export function initPower(g) {
  game = g;
  const screen = document.querySelector('.screen');
  if (!screen) return;
  el = document.createElement('div');
  el.className = 'power-screen';
  el.id = 'power-screen';
  el.setAttribute('aria-live', 'polite');
  screen.appendChild(el);
  el.addEventListener('pointerdown', (e) => {
    if (mode === 'on') return;
    e.preventDefault();
    if (mode === 'standby') { Sfx.unlockAudio(); boot(); }
    else if (mode === 'boot' || mode === 'nosim') skipStep();
  });

  getInputBus().on('powerHold', onHold);
  Phone.addReceiveGate(() => mode === 'on');

  let skipLaunch = false;
  try {
    skipLaunch = sessionStorage.getItem(SESSION) === '1' || /[?&]noboot\b/.test(location.search);
  } catch {
    skipLaunch = true;
  }
  if (!skipLaunch) standby();

  window.__vpg = window.__vpg || {};
  window.__vpg.power = {
    state: () => ({ mode, pin, boots, offs, firstPin, pinSeen: !!readStore().pinSeen, silenced: mode === 'off' }),
    off: powerOff,
    on: powerOn,
    hold: onHold,
    skip: skipStep,
    skipBoot: () => { if (mode !== 'on' && mode !== 'off' && mode !== 'shutdown') done(); return mode; },
    standby,
    reset: () => { try { localStorage.removeItem(STORE); sessionStorage.removeItem(SESSION); } catch { /* ignore */ } }
  };
}

export default { initPower, isOn, powerMode, powerOff, powerOn, onPowerChange };
