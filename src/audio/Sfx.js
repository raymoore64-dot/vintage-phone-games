/*
 * Named retro feature-phone sound effects, built on the WebAudio helper
 * in beep.js. All playback is gated by mute, pause, unlock, and a voice
 * cap — call play(name) or the named wrappers; nothing throws.
 */

import {
  unlockAudio,
  initAudio,
  isMuted,
  isUnlocked,
  isAudioReady,
  contextCreated,
  contextState,
  getMutePref,
  setMuted,
  toggleMute,
  onMuteChange,
  canPlay,
  playPhrase,
  beep,
  noise,
  logSfx,
  resetSfxLog,
  renderOffline,
  setMuteToggleHandler
} from './beep.js';

const PAUSED_OK = new Set([
  'pause', 'resume', 'countdownTick', 'muteOn', 'muteOff'
]);

const THROTTLE = {
  bounceBounce: 140,
  impactShoot: 90,
  impactGhostShot: 90,
  snakeTrailWarn: 180,
  blocksMove: 80,
  bricksPaddle: 80
};

const PHRASES = {
  menuMove:        { notes: [{ f: 620, d: 0.045 }], gain: 0.04, type: 'square' },
  menuSelect:      { notes: [{ f: 440, d: 0.05 }, { f: 660, d: 0.08 }], gain: 0.05, type: 'square' },
  back:            { notes: [{ f: 392, d: 0.05 }, { f: 262, d: 0.07 }], gain: 0.045, type: 'square' },
  pause:           { notes: [{ f: 494, d: 0.07 }, { f: 330, d: 0.11 }], gain: 0.05, type: 'square' },
  resume:          { notes: [{ f: 330, d: 0.05 }, { f: 494, d: 0.09 }], gain: 0.05, type: 'square' },
  countdownTick:   { notes: [{ f: 784, d: 0.05 }], gain: 0.04, type: 'square' },
  gameOver:        { notes: [{ f: 392, d: 0.12 }, { f: 330, d: 0.12 }, { f: 262, d: 0.18, gap: 0.04 }, { f: 196, d: 0.28 }], gain: 0.055, type: 'square' },
  newBest:         { notes: [{ f: 523, d: 0.09 }, { f: 659, d: 0.09 }, { f: 784, d: 0.18 }], gain: 0.055, type: 'square' },
  unlock:          { notes: [{ f: 392, d: 0.08 }, { f: 523, d: 0.08 }, { f: 659, d: 0.08 }, { f: 784, d: 0.1 }, { f: 988, d: 0.22 }], gain: 0.055, type: 'pulse' },
  muteOn:          { notes: [{ f: 520, d: 0.05 }, { f: 700, d: 0.07 }], gain: 0.04, type: 'square' },
  muteOff:         { notes: [{ f: 400, d: 0.08 }], gain: 0.04, type: 'square' },

  snakeEat:        { notes: [{ f: 660, d: 0.05 }, { f: 880, d: 0.07 }], gain: 0.055, type: 'square' },
  snakeShed:       { notes: [{ f: 330, d: 0.06 }, { f: 247, d: 0.1 }], gain: 0.05, type: 'pulse' },
  snakeTrailWarn:  { notes: [{ f: 880, d: 0.035 }], gain: 0.035, type: 'square' },
  snakeCrash:      { notes: [{ f: 180, d: 0.16 }], gain: 0.07, type: 'square' },

  bounceBounce:    { notes: [{ f: 196, d: 0.05 }], gain: 0.045, type: 'square' },
  bounceFlip:      { notes: [{ f: 392, d: 0.05 }, { f: 523, d: 0.08 }], gain: 0.05, type: 'pulse' },
  bounceRing:      { notes: [{ f: 784, d: 0.07 }], gain: 0.05, type: 'square' },
  bounceCombo:     { notes: [{ f: 659, d: 0.05 }, { f: 880, d: 0.09 }], gain: 0.05, type: 'square' },
  bounceDeath:     { notes: [{ f: 247, d: 0.08 }, { f: 165, d: 0.16 }], gain: 0.06, type: 'square' },

  impactShoot:     { notes: [{ f: 880, d: 0.03 }], gain: 0.035, type: 'square' },
  impactGhostShot: { notes: [{ f: 700, d: 0.025 }], gain: 0.02, type: 'square' },
  impactHit:       { notes: [{ f: 440, d: 0.04 }], gain: 0.04, type: 'square' },
  impactPickup:    { notes: [{ f: 523, d: 0.05 }, { f: 784, d: 0.08 }], gain: 0.05, type: 'square' },
  impactBurst:     { notes: [{ f: 330, d: 0.05 }, { f: 494, d: 0.05 }, { f: 660, d: 0.1 }], gain: 0.05, type: 'pulse' },
  impactBoss:      { notes: [{ f: 196, d: 0.12 }, { f: 147, d: 0.12 }, { f: 196, d: 0.18 }], gain: 0.06, type: 'square' },
  impactPlayerHit: { notes: [{ f: 220, d: 0.08 }, { f: 147, d: 0.12 }], gain: 0.06, type: 'square' },

  bricksPaddle:    { notes: [{ f: 262, d: 0.04 }], gain: 0.045, type: 'square' },
  bricksBrick:     { notes: [{ f: 523, d: 0.04 }], gain: 0.045, type: 'square' },
  bricksNudge:     { notes: [{ f: 392, d: 0.04 }, { f: 588, d: 0.07 }], gain: 0.05, type: 'pulse' },
  bricksLifeLost:  { notes: [{ f: 247, d: 0.1 }, { f: 185, d: 0.14 }], gain: 0.055, type: 'square' },

  blocksMove:      { notes: [{ f: 392, d: 0.03 }], gain: 0.03, type: 'square' },
  blocksRotate:    { notes: [{ f: 494, d: 0.04 }], gain: 0.04, type: 'square' },
  blocksDrop:      { notes: [{ f: 220, d: 0.06 }], gain: 0.045, type: 'square' },
  blocksLevelUp:   { notes: [{ f: 523, d: 0.06 }, { f: 659, d: 0.06 }, { f: 784, d: 0.12 }], gain: 0.05, type: 'square' }
};

const NOISE = {
  impactExplosion: { duration: 0.16, gain: 0.07, cutoff: 900 },
  snakeCrashNoise: { duration: 0.14, gain: 0.06, cutoff: 600 },
  bounceDeathNoise:{ duration: 0.12, gain: 0.05, cutoff: 500 },
  blocksQuake:     { duration: 0.28, gain: 0.07, cutoff: 400 }
};

function firePhrase(name, extra = null) {
  const spec = extra || PHRASES[name];
  if (!spec) return false;
  const allowWhenPaused = PAUSED_OK.has(name);
  const throttleMs = THROTTLE[name] || 0;
  if (!canPlay(name, { allowWhenPaused, throttleMs })) return false;
  playPhrase(spec.notes, { type: spec.type || 'square', gain: spec.gain });
  logSfx(name);
  return true;
}

function fireNoise(name, override = null) {
  const spec = override || NOISE[name];
  if (!spec) return false;
  const allowWhenPaused = PAUSED_OK.has(name);
  const throttleMs = THROTTLE[name] || 0;
  if (!canPlay(name, { allowWhenPaused, throttleMs })) return false;
  noise(spec.duration, spec.gain, spec.cutoff);
  logSfx(name);
  return true;
}

/** Play a named effect. Returns true if it actually started. */
export function play(name, opts) {
  try {
    if (name === 'bricksChain') return bricksChain(opts && opts.size);
    if (name === 'blocksLine') return blocksLine(opts && opts.count);
    if (name === 'simonTone') return simonTone(opts && opts.cell);
    if (NOISE[name]) return fireNoise(name);
    return firePhrase(name);
  } catch {
    return false;
  }
}

export function menuMove() { return firePhrase('menuMove'); }
export function menuSelect() { return firePhrase('menuSelect'); }
export function back() { return firePhrase('back'); }
export function pause() { return firePhrase('pause'); }
export function resume() { return firePhrase('resume'); }
export function countdownTick() { return firePhrase('countdownTick'); }
export function gameOver() { return firePhrase('gameOver'); }
export function newBest() { return firePhrase('newBest'); }
export function unlock() { return firePhrase('unlock'); }

export function playEnd({ newBest: isBest = false, unlocked = false } = {}) {
  if (unlocked) return firePhrase('unlock');
  if (isBest) return firePhrase('newBest');
  return firePhrase('gameOver');
}

export function snakeEat() { return firePhrase('snakeEat'); }
export function snakeShed() { return firePhrase('snakeShed'); }
export function snakeTrailWarn() { return firePhrase('snakeTrailWarn'); }
export function snakeCrash() {
  // Uses beep+noise so the end jingle (mono phrase) isn't cut off.
  if (!canPlay('snakeCrash')) return false;
  beep(180, 0.16, 'square', 0.07);
  noise(0.14, 0.06, 600);
  logSfx('snakeCrash');
  return true;
}

export function bounceBounce() { return firePhrase('bounceBounce'); }
export function bounceFlip() { return firePhrase('bounceFlip'); }
export function bounceRing() { return firePhrase('bounceRing'); }
export function bounceCombo() { return firePhrase('bounceCombo'); }
export function bounceDeath() {
  if (!canPlay('bounceDeath')) return false;
  beep(196, 0.1, 'square', 0.06);
  noise(0.12, 0.05, 500);
  logSfx('bounceDeath');
  return true;
}

export function impactShoot() { return firePhrase('impactShoot'); }
export function impactGhostShot() { return firePhrase('impactGhostShot'); }
export function impactHit() { return firePhrase('impactHit'); }
export function impactExplosion() { return fireNoise('impactExplosion'); }
export function impactPickup() { return firePhrase('impactPickup'); }
export function impactBurst() { return firePhrase('impactBurst'); }
export function impactBoss() { return firePhrase('impactBoss'); }
export function impactPlayerHit() { return firePhrase('impactPlayerHit'); }

export function bricksPaddle() { return firePhrase('bricksPaddle'); }
export function bricksBrick() { return firePhrase('bricksBrick'); }
export function bricksNudge() { return firePhrase('bricksNudge'); }
export function bricksLifeLost() { return firePhrase('bricksLifeLost'); }
export function bricksChain(size = 1) {
  const n = Math.max(1, Math.min(12, size | 0));
  const f = Math.min(980, 392 + (n - 1) * 70);
  return firePhrase('bricksChain', {
    notes: [
      { f, d: 0.05 },
      { f: Math.min(1100, f + 80), d: 0.07 + n * 0.008 }
    ],
    gain: Math.min(0.07, 0.04 + n * 0.003),
    type: 'square'
  });
}

export function blocksMove() { return firePhrase('blocksMove'); }
export function blocksRotate() { return firePhrase('blocksRotate'); }
export function blocksDrop() { return firePhrase('blocksDrop'); }
export function blocksQuake() { return fireNoise('blocksQuake'); }
export function blocksLevelUp() { return firePhrase('blocksLevelUp'); }
export function blocksLine(count = 1) {
  const n = Math.max(1, Math.min(4, count | 0));
  const notes = [];
  const base = 392;
  for (let i = 0; i < n; i++) {
    notes.push({ f: Math.min(980, base + i * 130), d: 0.07, gap: 0.02 });
  }
  if (n === 4) notes.push({ f: 784, d: 0.16 });
  return firePhrase('blocksLine', { notes, gain: 0.05, type: 'square' });
}

const SIMON_TONES = [262, 294, 330, 349, 392, 440, 494, 523, 587];

export function simonTone(cell = 0) {
  const i = Math.max(0, Math.min(8, cell | 0));
  const name = 'simonTone';
  if (!canPlay(name, { allowWhenPaused: false, throttleMs: 0 })) return false;
  beep(SIMON_TONES[i], 0.16, 'square', 0.055);
  logSfx(name);
  return true;
}

export function soundLabel() {
  return isMuted() ? 'Sound: Off' : 'Sound: On';
}

export function toggleMuteWithClick() {
  if (isMuted()) {
    setMuted(false);
    firePhrase('muteOn');
    return isMuted();
  }
  firePhrase('muteOff');
  setMuted(true);
  return isMuted();
}

function publishApi() {
  try {
    window.__vpg = window.__vpg || {};
    const api = {
      play,
      isMuted,
      isUnlocked,
      isAudioReady,
      contextCreated,
      contextState,
      getMutePref,
      setMuted,
      toggleMute,
      toggleMuteWithClick,
      unlockAudio,
      resetLog: resetSfxLog,
      log: () => window.__vpgSfxLog || [],
      counts: () => window.__vpgSfxCounts || {},
      renderOffline
    };
    window.__vpg.sfx = api;
    window.__vpgSfx = api;
  } catch {
    // ignore
  }
}

export function initSfx() {
  initAudio();
  setMuteToggleHandler(toggleMuteWithClick);
  publishApi();
}

export {
  unlockAudio,
  initAudio,
  isMuted,
  isUnlocked,
  isAudioReady,
  contextCreated,
  contextState,
  getMutePref,
  setMuted,
  toggleMute,
  onMuteChange,
  beep,
  resetSfxLog,
  renderOffline
};

export default {
  initSfx,
  play,
  playEnd,
  menuMove,
  menuSelect,
  back,
  pause,
  resume,
  countdownTick,
  gameOver,
  newBest,
  unlock,
  snakeEat,
  snakeShed,
  snakeTrailWarn,
  snakeCrash,
  bounceBounce,
  bounceFlip,
  bounceRing,
  bounceCombo,
  bounceDeath,
  impactShoot,
  impactGhostShot,
  impactHit,
  impactExplosion,
  impactPickup,
  impactBurst,
  impactBoss,
  impactPlayerHit,
  bricksPaddle,
  bricksBrick,
  bricksChain,
  bricksNudge,
  bricksLifeLost,
  blocksMove,
  blocksRotate,
  blocksDrop,
  blocksLine,
  blocksQuake,
  blocksLevelUp,
  simonTone,
  soundLabel,
  unlockAudio,
  isMuted,
  isUnlocked,
  toggleMute,
  setMuted,
  onMuteChange,
  beep,
  initSfx,
  renderOffline
};
