/*
 * Tiny WebAudio engine for Linicro.
 *
 * Safe no-throw: missing AudioContext, autoplay blocks, or a mid-beep
 * error are all swallowed. The context is created and resumed only after
 * unlockAudio() runs, which must be called from a user gesture
 * (key / pointer / click / touchend — the last is required on iOS
 * Safari and WKWebView).
 *
 * Mute is persisted in localStorage 'vpg.sound' as 'on' or 'off'.
 * Playback is gated while a game is paused (except allowlisted UI
 * ticks) and while the tab is hidden. Frequent effects can be
 * throttled, and a voice cap stops beeps stacking into noise.
 *
 * Graph:
 *   SFX voices  -> sfxGain -> sfxComp -> mix -> limiter -> lowpass -> dest
 *   Music bus   -> musicGain ----------> mix
 *
 * SFX peaks sit around 0.10–0.15 into a master of 0.65, then a
 * compressor/limiter stops stacked voices from clipping. Music has
 * its own quieter bus (0.065) so it never competes with effects.
 */

const MUTE_KEY = 'vpg.sound';
const MAX_VOICES = 5;
const SFX_MASTER = 0.65;
const MUSIC_MASTER = 0.065;
const LOWPASS_HZ = 1600;
const PEAK_CAP = 0.25;

let ctx = null;
let unlocked = false;
let muted = false;
let sfxGain = null;
let musicGain = null;
let sfxComp = null;
let mix = null;
let limiter = null;
let filter = null;
let voiceCount = 0;
let monoOsc = null;
let monoGain = null;
let listenersBound = false;
const lastPlayed = new Map();
const muteListeners = new Set();
const unlockListeners = new Set();
let muteToggleFn = null;
let musicActiveFn = null;
let silenced = false;

/** Phone powered off: every effect is blocked without touching the mute pref. */
export function setSilenced(on) {
  silenced = !!on;
}

export function isSilenced() {
  return silenced;
}

/** Let Sfx replace the M-key action (e.g. to play a confirmation click). */
export function setMuteToggleHandler(fn) {
  muteToggleFn = typeof fn === 'function' ? fn : null;
}

/** Let Music tell the engine when the context should stay hot. */
export function setMusicActiveFn(fn) {
  musicActiveFn = typeof fn === 'function' ? fn : null;
}

function musicWantsContext() {
  try {
    return !!(musicActiveFn && musicActiveFn());
  } catch {
    return false;
  }
}

function readMute() {
  try {
    return localStorage.getItem(MUTE_KEY) === 'off';
  } catch {
    return false;
  }
}

function writeMute(isOff) {
  try {
    localStorage.setItem(MUTE_KEY, isOff ? 'off' : 'on');
  } catch {
    // private mode / blocked storage
  }
}

muted = readMute();

function buildGraph(c) {
  sfxGain = c.createGain();
  sfxGain.gain.value = SFX_MASTER;

  sfxComp = c.createDynamicsCompressor();
  sfxComp.threshold.value = -10;
  sfxComp.knee.value = 8;
  sfxComp.ratio.value = 8;
  sfxComp.attack.value = 0.004;
  sfxComp.release.value = 0.15;

  musicGain = c.createGain();
  musicGain.gain.value = MUSIC_MASTER;

  mix = c.createGain();
  mix.gain.value = 1;

  limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -1.5;
  limiter.knee.value = 0.5;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.05;

  filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = LOWPASS_HZ;
  filter.Q.value = 0.5;

  sfxGain.connect(sfxComp);
  sfxComp.connect(mix);
  musicGain.connect(mix);
  mix.connect(limiter);
  limiter.connect(filter);
  filter.connect(c.destination);
}

function getCtx() {
  if (ctx) return ctx;
  if (!unlocked) return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    buildGraph(ctx);
    try {
      ctx.addEventListener('statechange', () => {
        if (ctx && ctx.state === 'running') notifyUnlock();
      });
    } catch { /* ignore */ }
  } catch {
    ctx = null;
    sfxGain = null;
    musicGain = null;
    sfxComp = null;
    mix = null;
    limiter = null;
    filter = null;
  }
  return ctx;
}

function dest() {
  return sfxGain || (ctx && ctx.destination);
}

function swallow(p) {
  if (p && typeof p.catch === 'function') p.catch(() => {});
}

function resumeCtx() {
  const c = getCtx();
  if (!c) return null;
  if (c.state === 'suspended') swallow(c.resume());
  return c;
}

/** Resume the context if anything (SFX or music) still wants it. */
export function resumeIfAllowed() {
  try {
    if (!unlocked || !ctx) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    if (muted && !musicWantsContext()) return;
    if (ctx.state === 'suspended') swallow(ctx.resume());
  } catch {
    // ignore
  }
}

function notifyUnlock() {
  unlockListeners.forEach((fn) => {
    try { fn(); } catch { /* listener errors shouldn't break audio */ }
  });
}

/** Call from a click / key / touch so the browser will allow sound. */
export function unlockAudio() {
  try {
    unlocked = true;
    const c = getCtx();
    if (!c) return;
    if (c.state === 'suspended') swallow(c.resume());
    // iOS Safari / WKWebView: a silent buffer kick is what actually unlocks.
    try {
      const buf = c.createBuffer(1, 1, c.sampleRate || 44100);
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.start(0);
    } catch {
      // ignore
    }
    notifyUnlock();
  } catch {
    // ignore
  }
}

export function onAudioUnlock(fn) {
  unlockListeners.add(fn);
  if (unlocked && ctx) {
    try { fn(); } catch { /* ignore */ }
  }
  return () => unlockListeners.delete(fn);
}

export function getAudioContext() {
  return ctx;
}

export function getMusicInput() {
  if (!ctx) getCtx();
  return musicGain || (ctx && ctx.destination);
}

export function getAudioGraph() {
  return {
    context: ctx,
    state: ctx ? ctx.state : 'none',
    sfxGain,
    musicGain,
    compressor: sfxComp,
    mix,
    limiter,
    filter,
    sfxMaster: SFX_MASTER,
    musicMaster: MUSIC_MASTER,
    voiceCount,
    peakCap: PEAK_CAP
  };
}

export function isMuted() {
  return muted;
}

export function isUnlocked() {
  return unlocked;
}

export function contextCreated() {
  return !!ctx;
}

export function contextState() {
  return ctx ? ctx.state : 'none';
}

export function getMutePref() {
  try {
    return localStorage.getItem(MUTE_KEY) || 'on';
  } catch {
    return muted ? 'off' : 'on';
  }
}

export function setMuted(nextMuted) {
  const value = !!nextMuted;
  if (muted === value) {
    writeMute(value);
    return muted;
  }
  muted = value;
  writeMute(value);
  muteListeners.forEach((fn) => {
    try { fn(muted); } catch { /* listener errors shouldn't break audio */ }
  });
  if (!muted) resumeIfAllowed();
  return muted;
}

export function toggleMute() {
  return setMuted(!muted);
}

export function onMuteChange(fn) {
  muteListeners.add(fn);
  return () => muteListeners.delete(fn);
}

function devLog(name) {
  try {
    if (typeof import.meta === 'undefined' || !import.meta.env || !import.meta.env.DEV) return;
    window.__vpgSfxLog = window.__vpgSfxLog || [];
    window.__vpgSfxLog.push(name);
    window.__vpgSfxCounts = window.__vpgSfxCounts || {};
    window.__vpgSfxCounts[name] = (window.__vpgSfxCounts[name] || 0) + 1;
  } catch {
    // ignore
  }
}

export function resetSfxLog() {
  try {
    window.__vpgSfxLog = [];
    window.__vpgSfxCounts = {};
  } catch {
    // ignore
  }
}

function gameIsFrozen() {
  try {
    const ctl = window.__vpg && window.__vpg.pauseCtl;
    return !!(ctl && typeof ctl.isFrozen === 'function' && ctl.isFrozen());
  } catch {
    return false;
  }
}

/**
 * Whether a named effect may start now.
 * allowWhenPaused: pause / resume / countdown ticks (and mute feedback).
 */
export function canPlay(name, { allowWhenPaused = false, throttleMs = 0 } = {}) {
  if (!unlocked || muted || silenced) return false;
  if (typeof document !== 'undefined' && document.hidden && !allowWhenPaused) return false;
  if (!allowWhenPaused && gameIsFrozen()) return false;
  if (voiceCount >= MAX_VOICES) return false;
  if (throttleMs > 0) {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const last = lastPlayed.get(name) || 0;
    if (now - last < throttleMs) return false;
    lastPlayed.set(name, now);
  }
  return true;
}

function trackVoice(node) {
  voiceCount += 1;
  const done = () => {
    voiceCount = Math.max(0, voiceCount - 1);
    try { node.onended = null; } catch { /* already gone */ }
  };
  try {
    node.onended = done;
  } catch {
    setTimeout(done, 1000);
  }
}

function stopMono() {
  if (!monoOsc) return;
  try {
    const c = ctx;
    const now = c ? c.currentTime : 0;
    if (monoGain) {
      try {
        monoGain.gain.cancelScheduledValues(now);
        monoGain.gain.setValueAtTime(Math.max(0.0001, monoGain.gain.value || 0.0001), now);
        monoGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);
      } catch { /* ignore */ }
    }
    monoOsc.stop(now + 0.02);
  } catch {
    // already stopped
  }
  monoOsc = null;
  monoGain = null;
}

function pulseWave(c) {
  const n = 24;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  const duty = 0.25;
  for (let k = 1; k < n; k++) {
    imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  }
  return c.createPeriodicWave(real, imag);
}

function readyLive() {
  const c = resumeCtx();
  if (!c) return null;
  if (c.state === 'suspended') return null;
  return c;
}

/**
 * Play a short tone. No-ops until unlockAudio() has been called, and
 * never throws.
 *
 * @param {number} freq      Hz
 * @param {number} duration  seconds
 * @param {string} type      oscillator type, or 'pulse'
 * @param {number} gain      peak gain (keep under PEAK_CAP)
 */
export function beep(freq = 440, duration = 0.16, type = 'square', gain = 0.14) {
  try {
    const c = readyLive();
    if (!c) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    if (type === 'pulse') {
      try { osc.setPeriodicWave(pulseWave(c)); } catch { osc.type = 'square'; }
    } else {
      osc.type = type;
    }
    const f = Math.max(40, Math.min(freq, 1400));
    osc.frequency.value = f;
    const now = c.currentTime;
    const dur = Math.max(0.02, duration);
    const peak = Math.max(0.0001, Math.min(gain, PEAK_CAP));
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g);
    g.connect(dest());
    osc.start(now);
    osc.stop(now + dur + 0.03);
    voiceCount += 1;
    osc.onended = () => {
      voiceCount = Math.max(0, voiceCount - 1);
      try { osc.disconnect(); g.disconnect(); } catch { /* already gone */ }
    };
  } catch {
    // ignore
  }
}

/**
 * Monophonic square/pulse phrase — one oscillator, notes in sequence.
 * Cuts any previous phrase, like a late-90s feature phone.
 *
 * @param {Array<{f:number, d:number, gap?:number, gain?:number}>} notes
 * @param {{ type?: string, gain?: number, name?: string }} [opts]
 */
export function playPhrase(notes, opts = {}) {
  try {
    if (!notes || !notes.length) return;
    const c = readyLive();
    if (!c) return;
    stopMono();
    const osc = c.createOscillator();
    const g = c.createGain();
    const type = opts.type || 'square';
    if (type === 'pulse') {
      try { osc.setPeriodicWave(pulseWave(c)); } catch { osc.type = 'square'; }
    } else {
      osc.type = type;
    }
    const baseGain = opts.gain != null ? opts.gain : 0.14;
    const now = c.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    let t = now;
    notes.forEach((n, i) => {
      const f = Math.max(40, Math.min(n.f, 1400));
      const d = Math.max(0.02, n.d);
      const peak = Math.max(0.0001, Math.min(n.gain != null ? n.gain : baseGain, PEAK_CAP));
      if (i === 0) osc.frequency.setValueAtTime(f, t);
      else osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
      t += d;
      g.gain.exponentialRampToValueAtTime(0.0001, t);
      t += n.gap != null ? n.gap : 0.018;
    });
    osc.connect(g);
    g.connect(dest());
    osc.start(now);
    osc.stop(t + 0.03);
    monoOsc = osc;
    monoGain = g;
    voiceCount += 1;
    osc.onended = () => {
      voiceCount = Math.max(0, voiceCount - 1);
      if (monoOsc === osc) {
        monoOsc = null;
        monoGain = null;
      }
      try { osc.disconnect(); g.disconnect(); } catch { /* already gone */ }
    };
  } catch {
    // ignore
  }
}

/**
 * Short filtered noise burst (explosions, crashes, quake rumble).
 * @param {number} duration seconds
 * @param {number} gain
 * @param {number} [cutoff] lowpass Hz
 */
export function noise(duration = 0.18, gain = 0.16, cutoff = 800) {
  try {
    const c = readyLive();
    if (!c) return;
    const len = Math.max(0.02, duration);
    const frames = Math.max(1, Math.floor((c.sampleRate || 44100) * len));
    const buf = c.createBuffer(1, frames, c.sampleRate || 44100);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      // Slightly brown-ish: integrate a little so it isn't harsh white
      const w = Math.random() * 2 - 1;
      data[i] = (i === 0 ? w : data[i - 1] * 0.6 + w * 0.4) * (1 - i / frames);
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.max(120, Math.min(cutoff, 1800));
    const g = c.createGain();
    const now = c.currentTime;
    const peak = Math.max(0.0001, Math.min(gain, PEAK_CAP));
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + len);
    src.connect(lp);
    lp.connect(g);
    g.connect(dest());
    src.start(now);
    src.stop(now + len + 0.02);
    trackVoice(src);
    src.onended = () => {
      voiceCount = Math.max(0, voiceCount - 1);
      try { src.disconnect(); lp.disconnect(); g.disconnect(); } catch { /* already gone */ }
    };
  } catch {
    // ignore
  }
}

export function isAudioReady() {
  return unlocked && !!ctx && ctx.state === 'running';
}

function onVisibility() {
  try {
    if (!ctx) return;
    if (document.hidden) {
      if (ctx.state === 'running') swallow(ctx.suspend());
    } else {
      resumeIfAllowed();
    }
  } catch {
    // ignore
  }
}

function onGesture() {
  unlockAudio();
}

function onKey(e) {
  if (!e || e.metaKey || e.ctrlKey || e.altKey) return;
  unlockAudio();
  if (e.repeat) return;
  if (e.key === 'm' || e.key === 'M') {
    if (muteToggleFn) muteToggleFn();
    else toggleMute();
  }
}

/** Bind gesture unlock, M-to-mute, and tab-hidden suspend. Safe to call twice. */
export function initAudio() {
  if (listenersBound) return;
  listenersBound = true;
  muted = readMute();
  const opts = { capture: true, passive: true };
  // touchend is required to unlock audio on iOS Safari / WKWebView
  ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'click'].forEach((ev) => {
    window.addEventListener(ev, onGesture, opts);
  });
  window.addEventListener('keydown', onKey, true);
  document.addEventListener('visibilitychange', onVisibility);
}

export function logSfx(name) {
  devLog(name);
}

/**
 * Render a phrase or beep into an OfflineAudioContext and return the
 * peak absolute sample. Used by tests to confirm nothing clips.
 * Never throws; returns 0 on failure.
 */
export async function renderOffline(kind, spec = {}) {
  try {
    const AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!AC) return 0;
    const rate = 22050;
    const seconds = spec.seconds || 1.2;
    const c = new AC(1, Math.floor(rate * seconds), rate);
    const sg = c.createGain();
    sg.gain.value = SFX_MASTER;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 8;
    comp.ratio.value = 8;
    comp.attack.value = 0.004;
    comp.release.value = 0.15;
    const outLim = c.createDynamicsCompressor();
    outLim.threshold.value = -1.5;
    outLim.knee.value = 0.5;
    outLim.ratio.value = 20;
    outLim.attack.value = 0.001;
    outLim.release.value = 0.05;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = LOWPASS_HZ;
    sg.connect(comp);
    comp.connect(outLim);
    outLim.connect(lp);
    lp.connect(c.destination);
    if (kind === 'noise') {
      const len = spec.duration || 0.2;
      const frames = Math.max(1, Math.floor(rate * len));
      const buf = c.createBuffer(1, frames, rate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < frames; i++) {
        const w = Math.random() * 2 - 1;
        data[i] = (i === 0 ? w : data[i - 1] * 0.6 + w * 0.4) * (1 - i / frames);
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      const g = c.createGain();
      const peak = spec.gain || 0.16;
      g.gain.setValueAtTime(0.0001, 0);
      g.gain.exponentialRampToValueAtTime(Math.min(peak, PEAK_CAP), 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, len);
      src.connect(g);
      g.connect(sg);
      src.start(0);
    } else {
      const notes = spec.notes || [{ f: 440, d: 0.12 }];
      const osc = c.createOscillator();
      osc.type = 'square';
      const g = c.createGain();
      const gain = spec.gain || 0.14;
      let t = 0;
      g.gain.setValueAtTime(0.0001, 0);
      notes.forEach((n) => {
        osc.frequency.setValueAtTime(Math.max(40, Math.min(n.f, 1400)), t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(
          Math.min(n.gain != null ? n.gain : gain, PEAK_CAP),
          t + 0.008
        );
        t += n.d;
        g.gain.exponentialRampToValueAtTime(0.0001, t);
        t += n.gap != null ? n.gap : 0.018;
      });
      osc.connect(g);
      g.connect(sg);
      osc.start(0);
      osc.stop(t + 0.03);
    }
    const rendered = await c.startRendering();
    const data = rendered.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      const a = Math.abs(data[i]);
      if (a > peak) peak = a;
    }
    return peak;
  } catch {
    return 0;
  }
}

export {
  SFX_MASTER,
  MUSIC_MASTER,
  PEAK_CAP,
  MAX_VOICES
};

export default {
  beep,
  unlockAudio,
  isAudioReady,
  isMuted,
  isUnlocked,
  contextCreated,
  contextState,
  getMutePref,
  setMuted,
  toggleMute,
  onMuteChange,
  onAudioUnlock,
  canPlay,
  playPhrase,
  noise,
  initAudio,
  resetSfxLog,
  logSfx,
  renderOffline,
  getAudioContext,
  getMusicInput,
  getAudioGraph,
  resumeIfAllowed
};
