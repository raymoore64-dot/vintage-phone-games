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
  setMuteToggleHandler,
  getAudioGraph,
  getAudioContext
} from './beep.js';

const PAUSED_OK = new Set([
  'pause', 'resume', 'countdownTick', 'muteOn', 'muteOff',
  'smsAlert', 'batteryLow',
  // batch A: power, boot, calls and the code book play over frozen games
  'powerOff', 'pinKey', 'pinOk', 'eggFound', 'callAnswer', 'callEnd', 'callMissed',
  'boot_linicro', 'boot_purplex', 'boot_glacio', 'boot_rubytel', 'boot_solara',
  'boot_mintra', 'boot_aurum', 'boot_volta', 'boot_proto',
  'ring_mum', 'ring_dex', 'ring_kaz', 'ring_unknown', 'ring_bank'
]);

const THROTTLE = {
  bounceBounce: 140,
  impactShoot: 90,
  impactGhostShot: 90,
  snakeTrailWarn: 180,
  blocksMove: 80,
  bricksPaddle: 80,
  hopDrain: 260,
  fishReel: 70,
  rallyTick: 120,
  rhythmTap: 40
};

const PHRASES = {
  menuMove:        { notes: [{ f: 620, d: 0.045 }], gain: 0.12, type: 'square' },
  menuSelect:      { notes: [{ f: 440, d: 0.05 }, { f: 660, d: 0.08 }], gain: 0.14, type: 'square' },
  back:            { notes: [{ f: 392, d: 0.05 }, { f: 262, d: 0.07 }], gain: 0.13, type: 'square' },
  pause:           { notes: [{ f: 494, d: 0.07 }, { f: 330, d: 0.11 }], gain: 0.14, type: 'square' },
  resume:          { notes: [{ f: 330, d: 0.05 }, { f: 494, d: 0.09 }], gain: 0.14, type: 'square' },
  countdownTick:   { notes: [{ f: 784, d: 0.05 }], gain: 0.12, type: 'square' },
  gameOver:        { notes: [{ f: 392, d: 0.12 }, { f: 330, d: 0.12 }, { f: 262, d: 0.18, gap: 0.04 }, { f: 196, d: 0.28 }], gain: 0.15, type: 'square' },
  newBest:         { notes: [{ f: 523, d: 0.09 }, { f: 659, d: 0.09 }, { f: 784, d: 0.18 }], gain: 0.15, type: 'square' },
  unlock:          { notes: [{ f: 392, d: 0.08 }, { f: 523, d: 0.08 }, { f: 659, d: 0.08 }, { f: 784, d: 0.1 }, { f: 988, d: 0.22 }], gain: 0.15, type: 'pulse' },
  muteOn:          { notes: [{ f: 520, d: 0.05 }, { f: 700, d: 0.07 }], gain: 0.12, type: 'square' },
  muteOff:         { notes: [{ f: 400, d: 0.08 }], gain: 0.12, type: 'square' },

  snakeEat:        { notes: [{ f: 660, d: 0.05 }, { f: 880, d: 0.07 }], gain: 0.15, type: 'square' },
  snakeShed:       { notes: [{ f: 330, d: 0.06 }, { f: 247, d: 0.1 }], gain: 0.14, type: 'pulse' },
  snakeTrailWarn:  { notes: [{ f: 880, d: 0.035 }], gain: 0.11, type: 'square' },
  snakeCrash:      { notes: [{ f: 180, d: 0.16 }], gain: 0.18, type: 'square' },

  bounceBounce:    { notes: [{ f: 196, d: 0.05 }], gain: 0.13, type: 'square' },
  bounceFlip:      { notes: [{ f: 392, d: 0.05 }, { f: 523, d: 0.08 }], gain: 0.14, type: 'pulse' },
  bounceRing:      { notes: [{ f: 784, d: 0.07 }], gain: 0.14, type: 'square' },
  bounceCombo:     { notes: [{ f: 659, d: 0.05 }, { f: 880, d: 0.09 }], gain: 0.14, type: 'square' },
  bounceDeath:     { notes: [{ f: 247, d: 0.08 }, { f: 165, d: 0.16 }], gain: 0.16, type: 'square' },

  impactShoot:     { notes: [{ f: 880, d: 0.03 }], gain: 0.11, type: 'square' },
  impactGhostShot: { notes: [{ f: 700, d: 0.025 }], gain: 0.08, type: 'square' },
  impactHit:       { notes: [{ f: 440, d: 0.04 }], gain: 0.12, type: 'square' },
  impactPickup:    { notes: [{ f: 523, d: 0.05 }, { f: 784, d: 0.08 }], gain: 0.14, type: 'square' },
  impactBurst:     { notes: [{ f: 330, d: 0.05 }, { f: 494, d: 0.05 }, { f: 660, d: 0.1 }], gain: 0.14, type: 'pulse' },
  impactBoss:      { notes: [{ f: 196, d: 0.12 }, { f: 147, d: 0.12 }, { f: 196, d: 0.18 }], gain: 0.16, type: 'square' },
  impactPlayerHit: { notes: [{ f: 220, d: 0.08 }, { f: 147, d: 0.12 }], gain: 0.16, type: 'square' },

  bricksPaddle:    { notes: [{ f: 262, d: 0.04 }], gain: 0.13, type: 'square' },
  bricksBrick:     { notes: [{ f: 523, d: 0.04 }], gain: 0.13, type: 'square' },
  bricksNudge:     { notes: [{ f: 392, d: 0.04 }, { f: 588, d: 0.07 }], gain: 0.14, type: 'pulse' },
  bricksLifeLost:  { notes: [{ f: 247, d: 0.1 }, { f: 185, d: 0.14 }], gain: 0.15, type: 'square' },

  blocksMove:      { notes: [{ f: 392, d: 0.03 }], gain: 0.10, type: 'square' },
  blocksRotate:    { notes: [{ f: 494, d: 0.04 }], gain: 0.12, type: 'square' },
  blocksDrop:      { notes: [{ f: 220, d: 0.06 }], gain: 0.13, type: 'square' },
  blocksLevelUp:   { notes: [{ f: 523, d: 0.06 }, { f: 659, d: 0.06 }, { f: 784, d: 0.12 }], gain: 0.14, type: 'square' },

  // Living phone: the classic "S M S" morse alert ( ... -- ... )
  smsAlert: {
    notes: [
      { f: 1320, d: 0.06, gap: 0.05 }, { f: 1320, d: 0.06, gap: 0.05 }, { f: 1320, d: 0.06, gap: 0.14 },
      { f: 1320, d: 0.17, gap: 0.05 }, { f: 1320, d: 0.17, gap: 0.14 },
      { f: 1320, d: 0.06, gap: 0.05 }, { f: 1320, d: 0.06, gap: 0.05 }, { f: 1320, d: 0.06 }
    ],
    gain: 0.13, type: 'square'
  },
  batteryLow:      { notes: [{ f: 880, d: 0.09, gap: 0.06 }, { f: 660, d: 0.09, gap: 0.06 }, { f: 440, d: 0.2 }], gain: 0.14, type: 'square' },
  perkBonus:       { notes: [{ f: 988, d: 0.05 }, { f: 1319, d: 0.08 }], gain: 0.12, type: 'pulse' },
  perkGlitch:      { notes: [{ f: 1200, d: 0.03 }, { f: 300, d: 0.03 }, { f: 1500, d: 0.03 }, { f: 200, d: 0.05 }], gain: 0.12, type: 'square' },
  codeOk:          { notes: [{ f: 523, d: 0.07 }, { f: 784, d: 0.07 }, { f: 1047, d: 0.07 }, { f: 1319, d: 0.18 }], gain: 0.14, type: 'pulse' },
  codeBad:         { notes: [{ f: 196, d: 0.12, gap: 0.04 }, { f: 165, d: 0.18 }], gain: 0.14, type: 'square' },
  codeKey:         { notes: [{ f: 1040, d: 0.04 }], gain: 0.1, type: 'square' },

  // ---- Batch A: power, boot jingles (one per invented brand), calls, eggs ----
  powerOff:        { notes: [{ f: 784, d: 0.1 }, { f: 659, d: 0.1 }, { f: 523, d: 0.1 }, { f: 392, d: 0.12 }, { f: 262, d: 0.3 }], gain: 0.14, type: 'square' },
  pinKey:          { notes: [{ f: 1100, d: 0.035 }], gain: 0.1, type: 'square' },
  pinOk:           { notes: [{ f: 880, d: 0.06 }, { f: 1175, d: 0.1 }], gain: 0.12, type: 'square' },
  eggFound:        { notes: [{ f: 659, d: 0.06 }, { f: 988, d: 0.06 }, { f: 784, d: 0.06 }, { f: 1175, d: 0.06 }, { f: 1319, d: 0.2 }], gain: 0.14, type: 'pulse' },
  callAnswer:      { notes: [{ f: 523, d: 0.05 }, { f: 784, d: 0.09 }], gain: 0.12, type: 'square' },
  callEnd:         { notes: [{ f: 494, d: 0.08, gap: 0.05 }, { f: 494, d: 0.08, gap: 0.05 }, { f: 494, d: 0.08 }], gain: 0.12, type: 'square' },
  callMissed:      { notes: [{ f: 440, d: 0.12 }, { f: 349, d: 0.22 }], gain: 0.13, type: 'square' },

  boot_linicro:    { notes: [{ f: 523, d: 0.09 }, { f: 659, d: 0.09 }, { f: 784, d: 0.16, gap: 0.08 }, { f: 784, d: 0.09 }, { f: 659, d: 0.09 }, { f: 1047, d: 0.3 }], gain: 0.14, type: 'square' },
  boot_purplex:    { notes: [{ f: 1047, d: 0.12 }, { f: 880, d: 0.12 }, { f: 698, d: 0.12 }, { f: 880, d: 0.12 }, { f: 1175, d: 0.34 }], gain: 0.13, type: 'triangle' },
  boot_glacio:     { notes: [{ f: 1319, d: 0.07 }, { f: 988, d: 0.07 }, { f: 1175, d: 0.07 }, { f: 880, d: 0.07 }, { f: 1319, d: 0.07 }, { f: 1397, d: 0.3 }], gain: 0.15, type: 'sine' },
  boot_rubytel:    { notes: [{ f: 392, d: 0.07, gap: 0.04 }, { f: 392, d: 0.07 }, { f: 523, d: 0.08 }, { f: 659, d: 0.08 }, { f: 784, d: 0.26 }], gain: 0.14, type: 'square' },
  boot_solara:     { notes: [{ f: 523, d: 0.08 }, { f: 587, d: 0.08 }, { f: 659, d: 0.08 }, { f: 784, d: 0.08 }, { f: 880, d: 0.08 }, { f: 1047, d: 0.32 }], gain: 0.13, type: 'pulse' },
  boot_mintra:     { notes: [{ f: 659, d: 0.08 }, { f: 523, d: 0.08 }, { f: 659, d: 0.08 }, { f: 784, d: 0.08 }, { f: 659, d: 0.08 }, { f: 1047, d: 0.26 }], gain: 0.13, type: 'square' },
  boot_aurum:      { notes: [{ f: 392, d: 0.16 }, { f: 523, d: 0.16 }, { f: 659, d: 0.16 }, { f: 523, d: 0.12 }, { f: 784, d: 0.42 }], gain: 0.13, type: 'triangle' },
  boot_volta:      { notes: [{ f: 220, d: 0.05 }, { f: 440, d: 0.05 }, { f: 880, d: 0.05 }, { f: 330, d: 0.05 }, { f: 660, d: 0.05 }, { f: 1320, d: 0.05 }, { f: 990, d: 0.24 }], gain: 0.13, type: 'square' },
  boot_proto:      { notes: [{ f: 1200, d: 0.04 }, { f: 300, d: 0.04 }, { f: 900, d: 0.06 }, { f: 450, d: 0.04 }, { f: 1300, d: 0.06 }, { f: 600, d: 0.04 }, { f: 1100, d: 0.28 }], gain: 0.12, type: 'pulse' },

  // ---- Batch B: pocket pet, WAP downloads, share card ----
  petBlip:         { notes: [{ f: 1047, d: 0.03 }, { f: 1319, d: 0.04 }], gain: 0.1, type: 'square' },
  petHappy:        { notes: [{ f: 880, d: 0.05 }, { f: 1175, d: 0.05 }, { f: 1397, d: 0.08 }], gain: 0.11, type: 'pulse' },
  petEat:          { notes: [{ f: 330, d: 0.04, gap: 0.05 }, { f: 392, d: 0.04, gap: 0.05 }, { f: 330, d: 0.04 }], gain: 0.11, type: 'square' },
  petWin:          { notes: [{ f: 784, d: 0.06 }, { f: 988, d: 0.06 }, { f: 1175, d: 0.06 }, { f: 1397, d: 0.14 }], gain: 0.12, type: 'pulse' },
  petLose:         { notes: [{ f: 392, d: 0.08 }, { f: 330, d: 0.14 }], gain: 0.11, type: 'square' },
  petGrumpy:       { notes: [{ f: 196, d: 0.07 }, { f: 185, d: 0.12 }], gain: 0.11, type: 'square' },
  petEvolve:       { notes: [{ f: 523, d: 0.06 }, { f: 659, d: 0.06 }, { f: 784, d: 0.06 }, { f: 1047, d: 0.06 }, { f: 784, d: 0.06 }, { f: 1047, d: 0.06 }, { f: 1319, d: 0.24 }], gain: 0.13, type: 'pulse' },
  wapConnect:      { notes: [{ f: 1200, d: 0.12 }, { f: 1380, d: 0.08 }, { f: 980, d: 0.1 }, { f: 1300, d: 0.06 }, { f: 600, d: 0.14 }, { f: 1250, d: 0.2 }], gain: 0.09, type: 'square' },
  wapTick:         { notes: [{ f: 1400, d: 0.02 }], gain: 0.06, type: 'square' },
  wapDone:         { notes: [{ f: 659, d: 0.07 }, { f: 784, d: 0.07 }, { f: 988, d: 0.07 }, { f: 1319, d: 0.1, gap: 0.06 }, { f: 1175, d: 0.07 }, { f: 1319, d: 0.24 }], gain: 0.13, type: 'square' },
  wapFail:         { notes: [{ f: 300, d: 0.12, gap: 0.05 }, { f: 220, d: 0.2 }], gain: 0.12, type: 'square' },
  shareSnap:       { notes: [{ f: 1319, d: 0.03 }, { f: 988, d: 0.05 }], gain: 0.11, type: 'square' },

  // ---- Batch C: WAP cartridge games ----
  hopHop:          { notes: [{ f: 660, d: 0.03 }, { f: 990, d: 0.03 }], gain: 0.1, type: 'square' },
  hopBoost:        { notes: [{ f: 523, d: 0.03 }, { f: 784, d: 0.03 }, { f: 1047, d: 0.03 }, { f: 1319, d: 0.06 }], gain: 0.12, type: 'pulse' },
  hopBar:          { notes: [{ f: 1175, d: 0.04 }, { f: 1397, d: 0.07 }], gain: 0.11, type: 'pulse' },
  hopZap:          { notes: [{ f: 220, d: 0.05 }, { f: 160, d: 0.05 }, { f: 110, d: 0.12 }], gain: 0.13, type: 'square' },
  hopDrain:        { notes: [{ f: 300, d: 0.03 }], gain: 0.06, type: 'square' },
  hopDeliver:      { notes: [{ f: 784, d: 0.06 }, { f: 988, d: 0.06 }, { f: 1175, d: 0.06 }, { f: 1319, d: 0.06 }, { f: 1175, d: 0.05 }, { f: 1319, d: 0.16 }], gain: 0.12, type: 'pulse' },
  fishCast:        { notes: [{ f: 900, d: 0.04 }, { f: 700, d: 0.05 }, { f: 500, d: 0.06 }, { f: 330, d: 0.08 }], gain: 0.1, type: 'triangle' },
  fishNibble:      { notes: [{ f: 140, d: 0.04 }], gain: 0.12, type: 'square' },
  fishBite:        { notes: [{ f: 110, d: 0.06, gap: 0.02 }, { f: 110, d: 0.06, gap: 0.02 }, { f: 110, d: 0.09 }], gain: 0.16, type: 'square' },
  fishHook:        { notes: [{ f: 660, d: 0.04 }, { f: 1320, d: 0.08 }], gain: 0.12, type: 'pulse' },
  fishReel:        { notes: [{ f: 420, d: 0.02 }], gain: 0.07, type: 'square' },
  fishSnap:        { notes: [{ f: 1200, d: 0.03 }, { f: 300, d: 0.05 }, { f: 150, d: 0.14 }], gain: 0.14, type: 'square' },
  fishEscape:      { notes: [{ f: 392, d: 0.07 }, { f: 330, d: 0.07 }, { f: 262, d: 0.14 }], gain: 0.11, type: 'triangle' },
  fishCatch:       { notes: [{ f: 523, d: 0.06 }, { f: 659, d: 0.06 }, { f: 784, d: 0.06 }, { f: 1047, d: 0.18 }], gain: 0.13, type: 'pulse' },
  rhythmPerfect:   { notes: [{ f: 1319, d: 0.03 }], gain: 0.06, type: 'pulse' },
  rhythmGood:      { notes: [{ f: 988, d: 0.03 }], gain: 0.05, type: 'square' },
  rhythmMiss:      { notes: [{ f: 140, d: 0.06 }], gain: 0.09, type: 'square' },
  rhythmCombo:     { notes: [{ f: 1047, d: 0.04 }, { f: 1319, d: 0.04 }, { f: 1397, d: 0.08 }], gain: 0.08, type: 'pulse' },
  rhythmClear:     { notes: [{ f: 784, d: 0.08 }, { f: 1047, d: 0.08 }, { f: 1319, d: 0.08 }, { f: 1047, d: 0.08 }, { f: 1319, d: 0.24 }], gain: 0.13, type: 'pulse' },
  rallyPickup:     { notes: [{ f: 880, d: 0.03 }, { f: 1320, d: 0.05 }], gain: 0.1, type: 'pulse' },
  rallyCrash:      { notes: [{ f: 180, d: 0.06 }, { f: 120, d: 0.12 }], gain: 0.15, type: 'square' },
  rallyLap:        { notes: [{ f: 659, d: 0.07 }, { f: 880, d: 0.07 }, { f: 1319, d: 0.2 }], gain: 0.13, type: 'pulse' },
  rallyGlitch:     { notes: [{ f: 1300, d: 0.02, gap: 0.02 }, { f: 200, d: 0.02, gap: 0.02 }, { f: 1100, d: 0.02, gap: 0.02 }, { f: 260, d: 0.04 }], gain: 0.1, type: 'square' },
  rallyTick:       { notes: [{ f: 1000, d: 0.02 }], gain: 0.06, type: 'square' },

  // One ring cycle each; Calls.js repeats them while the phone rings
  ring_mum:        { notes: [{ f: 880, d: 0.05, gap: 0.01 }, { f: 1047, d: 0.05, gap: 0.01 }, { f: 880, d: 0.05, gap: 0.01 }, { f: 1047, d: 0.05, gap: 0.01 }, { f: 880, d: 0.05, gap: 0.01 }, { f: 1047, d: 0.05, gap: 0.01 }, { f: 880, d: 0.05, gap: 0.01 }, { f: 1047, d: 0.05 }], gain: 0.12, type: 'square' },
  ring_dex:        { notes: [{ f: 659, d: 0.09 }, { f: 659, d: 0.09 }, { f: 784, d: 0.09 }, { f: 659, d: 0.09 }, { f: 587, d: 0.09 }, { f: 523, d: 0.18 }], gain: 0.13, type: 'square' },
  ring_kaz:        { notes: [{ f: 1175, d: 0.08 }, { f: 988, d: 0.08 }, { f: 784, d: 0.08 }, { f: 988, d: 0.08 }, { f: 1175, d: 0.08 }, { f: 1319, d: 0.2 }], gain: 0.12, type: 'pulse' },
  ring_unknown:    { notes: [{ f: 466, d: 0.18 }, { f: 440, d: 0.18 }, { f: 466, d: 0.18 }, { f: 349, d: 0.36 }], gain: 0.13, type: 'triangle' },
  ring_bank:       { notes: [{ f: 700, d: 0.04, gap: 0.005 }, { f: 600, d: 0.04, gap: 0.005 }, { f: 700, d: 0.04, gap: 0.005 }, { f: 600, d: 0.04, gap: 0.005 }, { f: 700, d: 0.04, gap: 0.005 }, { f: 600, d: 0.04, gap: 0.2 }, { f: 700, d: 0.04, gap: 0.005 }, { f: 600, d: 0.04, gap: 0.005 }, { f: 700, d: 0.04, gap: 0.005 }, { f: 600, d: 0.04 }], gain: 0.12, type: 'square' }
};

const NOISE = {
  impactExplosion: { duration: 0.16, gain: 0.18, cutoff: 900 },
  snakeCrashNoise: { duration: 0.14, gain: 0.16, cutoff: 600 },
  bounceDeathNoise:{ duration: 0.12, gain: 0.14, cutoff: 500 },
  blocksQuake:     { duration: 0.28, gain: 0.18, cutoff: 400 }
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

/**
 * A one-off tone at any pitch (fishing proximity buzz, rhythm taps).
 * Gated like every other sound; name is used for throttling and the log.
 */
export function tone(name, freq, dur = 0.06, type = 'square', gain = 0.1) {
  try {
    const throttleMs = THROTTLE[name] || 0;
    if (!canPlay(name, { allowWhenPaused: false, throttleMs })) return false;
    beep(freq, dur, type, gain);
    logSfx(name);
    return true;
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
  beep(180, 0.16, 'square', 0.18);
  noise(0.14, 0.16, 600);
  logSfx('snakeCrash');
  return true;
}

export function bounceBounce() { return firePhrase('bounceBounce'); }
export function bounceFlip() { return firePhrase('bounceFlip'); }
export function bounceRing() { return firePhrase('bounceRing'); }
export function bounceCombo() { return firePhrase('bounceCombo'); }
export function bounceDeath() {
  if (!canPlay('bounceDeath')) return false;
  beep(196, 0.1, 'square', 0.16);
  noise(0.12, 0.14, 500);
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
    gain: Math.min(0.18, 0.12 + n * 0.008),
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
  return firePhrase('blocksLine', { notes, gain: 0.14, type: 'square' });
}

const SIMON_TONES = [262, 294, 330, 349, 392, 440, 494, 523, 587];

export function simonTone(cell = 0) {
  const i = Math.max(0, Math.min(8, cell | 0));
  const name = 'simonTone';
  if (!canPlay(name, { allowWhenPaused: false, throttleMs: 0 })) return false;
  beep(SIMON_TONES[i], 0.16, 'square', 0.15);
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
      renderOffline,
      getAudioGraph,
      getAudioContext
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
  tone,
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
