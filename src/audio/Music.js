/*
 * Chiptune background music for Vintage Phone Games.
 *
 * All themes are original step-sequencer loops — square / triangle lead,
 * triangle bass, and a short noise hat. Nothing here is a ringtone,
 * folk melody, or commercial game theme.
 *
 * Scheduling uses the Web Audio "lookahead" pattern: a short timer
 * looks ahead on AudioContext.currentTime and starts notes in the
 * future so the beat stays steady even if the main thread hiccups.
 *
 * Music starts only after unlockAudio() (first user gesture). It has
 * its own mute, stored in localStorage 'vpg.music' as 'on' or 'off'
 * (default on), independent of SFX mute. N toggles it anywhere.
 */

import {
  getAudioContext,
  getMusicInput,
  getAudioGraph,
  onAudioUnlock,
  isUnlocked,
  isAudioReady,
  contextCreated,
  contextState,
  resumeIfAllowed,
  setMusicActiveFn,
  unlockAudio
} from './beep.js';

const MUSIC_KEY = 'vpg.music';
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function hzOf(name) {
  if (name == null || name === '.' || name === '-' || name === '~') return 0;
  if (typeof name === 'number') return name;
  const m = /^([A-G])([#b]?)(-?\d+)$/.exec(String(name).trim());
  if (!m) return 0;
  let sem = SEMI[m[1]];
  if (m[2] === '#') sem += 1;
  if (m[2] === 'b') sem -= 1;
  const midi = (parseInt(m[3], 10) + 1) * 12 + sem;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function hats(pattern, bars) {
  const out = [];
  for (let i = 0; i < bars; i++) out.push(...pattern);
  return out;
}

// Tight closed-hat 16th groove, 1 bar (16 steps).
const HAT_A = [0.7, 0, 0.28, 0, 0.5, 0, 0.28, 0, 0.7, 0, 0.28, 0, 0.55, 0, 0.4, 0.22];
const HAT_B = [0.65, 0, 0.2, 0.2, 0.5, 0, 0.2, 0, 0.65, 0.15, 0.2, 0, 0.5, 0, 0.35, 0];
const HAT_SPARSE = [0.4, 0, 0, 0, 0.25, 0, 0, 0, 0.4, 0, 0, 0, 0.25, 0, 0.15, 0];

/*
 * Songs. Each `notes` array is one entry per 16th-note step. A note is
 * either null or { n: 'C4', l: lengthInSteps }. All themes original.
 */
const SONGS = {
  // "Lobby Glow" — F major, unhurried, a rising F–A–C motif that falls away.
  menu: {
    bpm: 104,
    length: 64,
    swing: 0.08,
    lead: {
      wave: 'square',
      gain: 0.48,
      artic: 0.86,
      notes: [
        { n: 'F4', l: 4 }, null, null, null, { n: 'A4', l: 2 }, null, { n: 'C5', l: 2 }, null,
        { n: 'D5', l: 4 }, null, null, null, { n: 'C5', l: 4 }, null, null, null,
        { n: 'Bb4', l: 4 }, null, null, null, { n: 'A4', l: 2 }, null, { n: 'G4', l: 2 }, null,
        { n: 'A4', l: 4 }, null, null, null, { n: 'F4', l: 4 }, null, null, null,
        { n: 'F4', l: 2 }, null, { n: 'A4', l: 2 }, null, { n: 'C5', l: 2 }, null, { n: 'F5', l: 2 }, null,
        { n: 'E5', l: 4 }, null, null, null, { n: 'C5', l: 4 }, null, null, null,
        { n: 'D5', l: 2 }, null, { n: 'C5', l: 2 }, null, { n: 'Bb4', l: 2 }, null, { n: 'A4', l: 2 }, null,
        { n: 'G4', l: 4 }, null, null, null, { n: 'F4', l: 4 }, null, null, null
      ]
    },
    bass: {
      wave: 'triangle',
      gain: 0.78,
      artic: 0.96,
      notes: [
        { n: 'F2', l: 4 }, null, null, null, { n: 'F2', l: 2 }, null, { n: 'C3', l: 2 }, null,
        { n: 'F2', l: 4 }, null, null, null, { n: 'A2', l: 4 }, null, null, null,
        { n: 'Bb2', l: 4 }, null, null, null, { n: 'Bb2', l: 2 }, null, { n: 'F2', l: 2 }, null,
        { n: 'C3', l: 4 }, null, null, null, { n: 'C2', l: 4 }, null, null, null,
        { n: 'D3', l: 4 }, null, null, null, { n: 'D2', l: 2 }, null, { n: 'A2', l: 2 }, null,
        { n: 'C3', l: 4 }, null, null, null, { n: 'C2', l: 4 }, null, null, null,
        { n: 'Bb2', l: 4 }, null, null, null, { n: 'A2', l: 4 }, null, null, null,
        { n: 'G2', l: 4 }, null, null, null, { n: 'C2', l: 4 }, null, null, null
      ]
    },
    hat: hats(HAT_A, 4)
  },

  // "Shed Path" — E minor, a slithery chromatic neighbour around E.
  snake: {
    bpm: 92,
    length: 64,
    swing: 0.14,
    lead: {
      wave: 'square',
      gain: 0.42,
      artic: 0.9,
      notes: [
        { n: 'E4', l: 4 }, null, null, null, { n: 'F#4', l: 2 }, null, { n: 'G4', l: 2 }, null,
        { n: 'B4', l: 4 }, null, null, null, { n: 'A4', l: 2 }, null, { n: 'G4', l: 2 }, null,
        { n: 'F#4', l: 4 }, null, null, null, { n: 'G4', l: 2 }, null, { n: 'E4', l: 2 }, null,
        { n: 'D4', l: 6 }, null, null, null, null, null, { n: 'E4', l: 2 }, null,
        { n: 'G4', l: 2 }, null, { n: 'A4', l: 2 }, null, { n: 'B4', l: 4 }, null, null, null,
        { n: 'A4', l: 2 }, null, { n: 'G4', l: 2 }, null, { n: 'F#4', l: 4 }, null, null, null,
        { n: 'E4', l: 2 }, null, { n: 'D4', l: 2 }, null, { n: 'C4', l: 2 }, null, { n: 'D4', l: 2 }, null,
        { n: 'E4', l: 8 }, null, null, null, null, null, null, null
      ]
    },
    bass: {
      wave: 'triangle',
      gain: 0.8,
      artic: 0.97,
      notes: [
        { n: 'E2', l: 8 }, null, null, null, null, null, null, null,
        { n: 'B1', l: 8 }, null, null, null, null, null, null, null,
        { n: 'C2', l: 8 }, null, null, null, null, null, null, null,
        { n: 'B1', l: 8 }, null, null, null, null, null, null, null,
        { n: 'A1', l: 8 }, null, null, null, null, null, null, null,
        { n: 'G2', l: 8 }, null, null, null, null, null, null, null,
        { n: 'F#2', l: 4 }, null, null, null, { n: 'G2', l: 4 }, null, null, null,
        { n: 'E2', l: 8 }, null, null, null, null, null, null, null
      ]
    },
    hat: hats(HAT_SPARSE, 4)
  },

  // "Flip Ring" — G major, bouncy staccato 8ths, a little hop in the lead.
  bounce: {
    bpm: 128,
    length: 32,
    swing: 0.06,
    lead: {
      wave: 'square',
      gain: 0.44,
      artic: 0.7,
      notes: [
        { n: 'G4', l: 2 }, null, { n: 'B4', l: 2 }, null, { n: 'D5', l: 2 }, null, { n: 'G4', l: 2 }, null,
        { n: 'A4', l: 2 }, null, { n: 'C5', l: 2 }, null, { n: 'D5', l: 2 }, null, { n: 'B4', l: 2 }, null,
        { n: 'G5', l: 2 }, null, { n: 'D5', l: 2 }, null, { n: 'B4', l: 2 }, null, { n: 'D5', l: 2 }, null,
        { n: 'C5', l: 2 }, null, { n: 'A4', l: 2 }, null, { n: 'G4', l: 4 }, null, null, null
      ]
    },
    bass: {
      wave: 'triangle',
      gain: 0.76,
      artic: 0.88,
      notes: [
        { n: 'G2', l: 4 }, null, null, null, { n: 'D3', l: 4 }, null, null, null,
        { n: 'C3', l: 4 }, null, null, null, { n: 'G2', l: 4 }, null, null, null,
        { n: 'E2', l: 4 }, null, null, null, { n: 'B2', l: 4 }, null, null, null,
        { n: 'D3', l: 4 }, null, null, null, { n: 'D2', l: 4 }, null, null, null
      ]
    },
    hat: hats(HAT_B, 2)
  },

  // "Echo Run" — D minor, driving, a syncopated lead over a pulsing bass.
  impact: {
    bpm: 136,
    length: 32,
    swing: 0,
    lead: {
      wave: 'square',
      gain: 0.4,
      artic: 0.72,
      notes: [
        { n: 'D5', l: 2 }, null, null, null, { n: 'F5', l: 2 }, null, { n: 'A5', l: 2 }, null,
        null, null, { n: 'G5', l: 2 }, null, { n: 'F5', l: 2 }, null, { n: 'E5', l: 2 }, null,
        { n: 'D5', l: 2 }, null, { n: 'A4', l: 2 }, null, { n: 'C5', l: 2 }, null, { n: 'D5', l: 2 }, null,
        { n: 'F5', l: 4 }, null, null, null, { n: 'E5', l: 4 }, null, null, null
      ]
    },
    bass: {
      wave: 'triangle',
      gain: 0.82,
      artic: 0.84,
      notes: [
        { n: 'D2', l: 2 }, null, { n: 'D2', l: 2 }, null, { n: 'D3', l: 2 }, null, { n: 'D2', l: 2 }, null,
        { n: 'C3', l: 2 }, null, { n: 'A2', l: 2 }, null, { n: 'C3', l: 2 }, null, { n: 'A2', l: 2 }, null,
        { n: 'D2', l: 2 }, null, { n: 'D2', l: 2 }, null, { n: 'F2', l: 2 }, null, { n: 'D2', l: 2 }, null,
        { n: 'A2', l: 2 }, null, { n: 'A1', l: 2 }, null, { n: 'C2', l: 2 }, null, { n: 'A1', l: 2 }, null
      ]
    },
    hat: hats(HAT_A, 2)
  },

  // "Chain Row" — C major arcade arpeggios walking I–IV–V–I. Not a known hook.
  bricks: {
    bpm: 118,
    length: 32,
    swing: 0.04,
    lead: {
      wave: 'square',
      gain: 0.44,
      artic: 0.78,
      notes: [
        { n: 'C5', l: 2 }, null, { n: 'G4', l: 2 }, null, { n: 'E4', l: 2 }, null, { n: 'G4', l: 2 }, null,
        { n: 'F5', l: 2 }, null, { n: 'C5', l: 2 }, null, { n: 'A4', l: 2 }, null, { n: 'C5', l: 2 }, null,
        { n: 'G5', l: 2 }, null, { n: 'D5', l: 2 }, null, { n: 'B4', l: 2 }, null, { n: 'D5', l: 2 }, null,
        { n: 'E5', l: 2 }, null, { n: 'C5', l: 2 }, null, { n: 'G4', l: 2 }, null, { n: 'C5', l: 2 }, null
      ]
    },
    bass: {
      wave: 'triangle',
      gain: 0.76,
      artic: 0.92,
      notes: [
        { n: 'C2', l: 4 }, null, null, null, { n: 'C3', l: 4 }, null, null, null,
        { n: 'F2', l: 4 }, null, null, null, { n: 'F2', l: 2 }, null, { n: 'A2', l: 2 }, null,
        { n: 'G2', l: 4 }, null, null, null, { n: 'D3', l: 4 }, null, null, null,
        { n: 'C3', l: 4 }, null, null, null, { n: 'C2', l: 4 }, null, null, null
      ]
    },
    hat: hats(HAT_A, 2)
  },

  // "Quake Stack" — A minor, a climbing then falling figure. Not Korobeiniki.
  blocks: {
    bpm: 108,
    length: 32,
    swing: 0.1,
    lead: {
      wave: 'square',
      gain: 0.42,
      artic: 0.84,
      notes: [
        { n: 'A4', l: 2 }, null, { n: 'C5', l: 2 }, null, { n: 'E5', l: 2 }, null, { n: 'A5', l: 2 }, null,
        { n: 'G5', l: 2 }, null, { n: 'E5', l: 2 }, null, { n: 'F5', l: 2 }, null, { n: 'D5', l: 2 }, null,
        { n: 'E5', l: 2 }, null, { n: 'C5', l: 2 }, null, { n: 'D5', l: 2 }, null, { n: 'B4', l: 2 }, null,
        { n: 'C5', l: 2 }, null, { n: 'A4', l: 2 }, null, { n: 'G4', l: 2 }, null, { n: 'A4', l: 2 }, null
      ]
    },
    bass: {
      wave: 'triangle',
      gain: 0.8,
      artic: 0.95,
      notes: [
        { n: 'A2', l: 6 }, null, null, null, null, null, { n: 'E2', l: 2 }, null,
        { n: 'A2', l: 4 }, null, null, null, { n: 'G2', l: 4 }, null, null, null,
        { n: 'F2', l: 6 }, null, null, null, null, null, { n: 'C3', l: 2 }, null,
        { n: 'E2', l: 4 }, null, null, null, { n: 'G2', l: 4 }, null, null, null
      ]
    },
    hat: hats(HAT_B, 2)
  },

  // "Soft Prompt" — sparse C-major pentatonic, leaves room for Simon tones.
  simon: {
    bpm: 84,
    length: 32,
    swing: 0.12,
    lead: {
      wave: 'triangle',
      gain: 0.36,
      artic: 0.95,
      notes: [
        { n: 'C5', l: 6 }, null, null, null, null, null, { n: 'E5', l: 2 }, null,
        { n: 'G4', l: 6 }, null, null, null, null, null, { n: 'A4', l: 2 }, null,
        { n: 'G4', l: 4 }, null, null, null, { n: 'E4', l: 4 }, null, null, null,
        { n: 'C4', l: 8 }, null, null, null, null, null, null, null
      ]
    },
    bass: {
      wave: 'triangle',
      gain: 0.62,
      artic: 0.98,
      notes: [
        { n: 'C2', l: 8 }, null, null, null, null, null, null, null,
        { n: 'G1', l: 8 }, null, null, null, null, null, null, null,
        { n: 'A1', l: 8 }, null, null, null, null, null, null, null,
        { n: 'C2', l: 8 }, null, null, null, null, null, null, null
      ]
    },
    hat: hats(HAT_SPARSE, 2)
  }
};


/*
 * Compact score notation for the batch C tracks: bars split by '|',
 * tokens 'C5-2' (note, length in 16th steps) or '.' (16th rest). Each
 * bar is padded / trimmed to 16 steps.
 */
function seq(str) {
  const out = [];
  str.split('|').map((b) => b.trim()).filter(Boolean).forEach((bar) => {
    const steps = [];
    bar.split(/\s+/).forEach((tok) => {
      if (tok === '.') { steps.push(null); return; }
      const m = /^([A-G][#b]?-?\d)-(\d+)$/.exec(tok);
      if (!m) { steps.push(null); return; }
      const l = parseInt(m[2], 10);
      steps.push({ n: m[1], l });
      for (let i = 1; i < l; i++) steps.push(null);
    });
    while (steps.length < 16) steps.push(null);
    out.push(...steps.slice(0, 16));
  });
  return out;
}

function track(bpm, swing, lead, bass, hat, opts = {}) {
  const leadNotes = seq(lead);
  return {
    bpm,
    length: leadNotes.length,
    swing,
    name: opts.name,
    lead: { wave: opts.wave || 'square', gain: opts.gain || 0.42, artic: opts.artic || 0.86, notes: leadNotes },
    bass: { wave: 'triangle', gain: 0.78, artic: 0.95, notes: seq(bass) },
    hat: hats(hat, leadNotes.length / 16)
  };
}

/*
 * Batch C: loops for the WAP games plus four original ringtones that
 * Ring Rhythm charts from (the menu theme 'Lobby Glow' is the fifth).
 */
const BATCH_C = {
  // "Tower Hop" — D major, bouncy
  hopper: track(132, 0.04,
    '| D5-2 F#5-2 A5-2 F#5-2 D5-2 E5-2 F#5-4 | G5-2 F#5-2 E5-2 D5-2 E5-4 A4-4 | D5-2 F#5-2 A5-2 B5-2 A5-2 F#5-2 D5-4 | E5-2 G5-2 F#5-2 E5-2 D5-8 |',
    '| D3-2 A2-2 D3-2 A2-2 D3-2 A2-2 D3-2 A2-2 | G2-2 D3-2 G2-2 D3-2 A2-2 E3-2 A2-2 E3-2 | D3-2 A2-2 D3-2 A2-2 B2-2 F#3-2 B2-2 F#3-2 | G2-2 D3-2 A2-2 E3-2 D3-4 A2-4 |',
    HAT_A),
  // "Still Water" — A minor, slow and calm
  fishing: track(76, 0.1,
    '| A4-6 C5-2 E5-8 | D5-6 C5-2 B4-8 | A4-4 G4-4 E4-8 | F4-4 G4-4 A4-8 |',
    '| A2-8 E2-8 | D2-8 G2-8 | C2-8 E2-8 | F2-8 E2-8 |',
    HAT_SPARSE, { wave: 'triangle', gain: 0.5 }),
  // "Pick a Tone" — the Ring Rhythm select screen
  rhythm: track(120, 0.12,
    '| C5-1 . C5-1 . Eb5-2 C5-2 G5-2 F5-2 Eb5-2 C5-2 | Bb4-2 C5-2 . . Eb5-2 F5-4 G5-4 | C5-1 . C5-1 . Eb5-2 C5-2 G5-2 Bb5-2 G5-2 F5-2 | Eb5-2 F5-2 Eb5-2 C5-2 C5-8 |',
    '| C3-4 C3-4 Eb3-4 F3-4 | Bb2-4 Bb2-4 C3-8 | C3-4 C3-4 Eb3-4 G3-4 | Ab2-4 Bb2-4 C3-8 |',
    HAT_B),
  // "Fifty-Six K" — E minor, driving
  rally: track(150, 0,
    '| E5-2 E5-2 G5-2 E5-2 A5-2 G5-2 E5-2 D5-2 | E5-2 E5-2 G5-2 B5-2 A5-4 G5-4 | C6-2 B5-2 A5-2 G5-2 A5-2 G5-2 E5-2 D5-2 | E5-4 B4-4 E5-8 |',
    '| E2-2 E3-2 E2-2 E3-2 E2-2 E3-2 E2-2 E3-2 | C2-2 C3-2 C2-2 C3-2 D2-2 D3-2 D2-2 D3-2 | A1-2 A2-2 A1-2 A2-2 C2-2 C3-2 C2-2 C3-2 | B1-2 B2-2 B1-2 B2-2 E2-4 E2-4 |',
    HAT_A),
  // ---- Ringtones ----
  ring_polka: track(132, 0,
    '| C5-2 E5-2 G5-2 E5-2 C5-2 E5-2 G5-4 | F5-2 D5-2 B4-2 D5-2 F5-2 D5-2 B4-4 | C5-2 E5-2 G5-2 C6-2 B5-2 A5-2 G5-4 | F5-2 E5-2 D5-2 B4-2 C5-8 |',
    '| C3-4 G2-4 C3-4 G2-4 | G2-4 D3-4 G2-4 D3-4 | C3-4 G2-4 A2-4 E2-4 | F2-4 G2-4 C3-8 |',
    HAT_A, { name: 'Pocket Polka' }),
  ring_neon: track(140, 0,
    '| A4-1 . A5-1 . E5-1 . A4-1 C5-1 . E5-1 . G5-2 E5-2 . | F5-1 . F5-1 . C5-1 . A4-1 . F5-2 E5-2 D5-2 C5-2 | A4-1 . A5-1 . E5-1 . A4-1 C5-1 . E5-1 . G5-2 B5-2 . | A5-2 G5-2 E5-2 D5-2 E5-4 A4-4 |',
    '| A2-4 A2-4 E2-4 E2-4 | F2-4 F2-4 C2-4 C2-4 | A2-4 A2-4 G2-4 G2-4 | D2-4 E2-4 A2-8 |',
    HAT_B, { name: 'Neon Bleep', wave: 'square' }),
  ring_bossa: track(112, 0.06,
    '| G4-3 B4-3 D5-2 E5-3 D5-3 B4-2 | A4-3 C5-3 E5-2 D5-8 | G4-3 B4-3 D5-2 G5-3 F#5-3 E5-2 | D5-3 C5-3 A4-2 G4-8 |',
    '| G2-3 D3-3 G2-2 C3-3 G2-3 C3-2 | A2-3 E3-3 A2-2 D3-8 | G2-3 D3-3 G2-2 E2-3 B2-3 E3-2 | D2-3 A2-3 D3-2 G2-8 |',
    HAT_SPARSE, { name: 'Bus Stop Bossa', wave: 'triangle', gain: 0.55 }),
  ring_blues: track(96, 0.2,
    '| C5-3 Eb5-1 F5-2 F#5-1 G5-3 Bb5-2 G5-4 | F5-3 Eb5-1 C5-4 Bb4-2 C5-6 | Eb5-3 F5-1 G5-2 Bb5-2 C6-4 Bb5-4 | G5-2 F5-2 Eb5-2 C5-2 C5-8 |',
    '| C3-2 E3-2 G3-2 A3-2 Bb3-2 A3-2 G3-2 E3-2 | F2-2 A2-2 C3-2 D3-2 Eb3-2 D3-2 C3-2 A2-2 | C3-2 E3-2 G3-2 A3-2 Bb3-2 A3-2 G3-2 E3-2 | G2-2 B2-2 D3-2 F3-2 C3-8 |',
    HAT_SPARSE, { name: 'Low Battery Blues' })
};
Object.assign(SONGS, BATCH_C);

/** Ring Rhythm's tracks: four ringtones + the menu theme. */
export const RINGTONES = [
  { id: 'ring_polka', name: 'Pocket Polka' },
  { id: 'ring_neon', name: 'Neon Bleep' },
  { id: 'ring_bossa', name: 'Bus Stop Bossa' },
  { id: 'ring_blues', name: 'Low Battery Blues' },
  { id: 'menu', name: 'Lobby Glow (menu)' }
];

const SCENE_TRACKS = {
  MenuScene: 'menu',
  SkinScene: 'menu',
  SnakeScene: 'snake',
  BounceScene: 'bounce',
  ImpactScene: 'impact',
  BricksScene: 'bricks',
  BlocksScene: 'blocks',
  SimonScene: 'simon',
  HopperScene: 'hopper',
  FishingScene: 'fishing',
  RhythmScene: 'rhythm',
  RallyScene: 'rally'
};

let enabled = true;
let bound = false;
let currentId = null;
let pendingId = null;
let currentStep = 0;
let nextNoteTime = 0;
let timerId = null;
let duckGain = null;
let duckLevel = 1;
let hatBuffer = null;
let playing = false;
let originTime = 0;   // AudioContext time of step 0 of the current play-through
let absStep = 0;      // steps scheduled since originTime
const holds = new Set();
const live = new Set();
const musicListeners = new Set();

function readPref() {
  try {
    return localStorage.getItem(MUSIC_KEY) !== 'off';
  } catch {
    return true;
  }
}

function writePref(on) {
  try {
    localStorage.setItem(MUSIC_KEY, on ? 'on' : 'off');
  } catch {
    // private mode / blocked storage
  }
}

enabled = readPref();

function notify() {
  musicListeners.forEach((fn) => {
    try { fn(enabled); } catch { /* ignore */ }
  });
}

export function onMusicChange(fn) {
  musicListeners.add(fn);
  return () => musicListeners.delete(fn);
}

export function isMusicEnabled() {
  return enabled;
}

export function isMusicPlaying() {
  return playing && enabled && holds.size === 0 && !!currentId;
}

export function currentTrack() {
  return currentId;
}

export function musicLabel() {
  return enabled ? 'Music: On' : 'Music: Off';
}

export function getMusicPref() {
  try {
    return localStorage.getItem(MUSIC_KEY) || 'on';
  } catch {
    return enabled ? 'on' : 'off';
  }
}

function musicWantsContext() {
  return enabled && !!(currentId || pendingId);
}

function ensureDuck(c) {
  const dest = getMusicInput();
  if (!c || !dest) return null;
  if (duckGain) return duckGain;
  try {
    duckGain = c.createGain();
    duckGain.gain.value = Math.max(0.0001, duckLevel);
    duckGain.connect(dest);
  } catch {
    duckGain = null;
  }
  return duckGain;
}

function ensureHatBuffer(c) {
  if (hatBuffer && hatBuffer.sampleRate === c.sampleRate) return hatBuffer;
  try {
    const len = Math.max(1, Math.floor(c.sampleRate * 0.04));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    hatBuffer = buf;
  } catch {
    hatBuffer = null;
  }
  return hatBuffer;
}

function silenceLive(fade = 0.04) {
  const c = getAudioContext();
  const now = c ? c.currentTime : 0;
  live.forEach((node) => {
    try {
      if (node._gain) {
        const g = node._gain.gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(Math.max(0.0001, g.value || 0.0001), now);
        g.exponentialRampToValueAtTime(0.0001, now + fade);
      }
      node.stop(now + fade + 0.01);
    } catch {
      // already stopped
    }
  });
  live.clear();
}

function watchLive(node, gainNode) {
  node._gain = gainNode;
  live.add(node);
  const prev = node.onended;
  node.onended = () => {
    live.delete(node);
    try { if (typeof prev === 'function') prev(); } catch { /* ignore */ }
    try { node.disconnect(); if (gainNode) gainNode.disconnect(); } catch { /* ignore */ }
  };
}

function scheduleTone(c, dest, time, freq, dur, wave, gain) {
  if (!freq || gain <= 0 || dur <= 0) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  try {
    osc.type = wave || 'square';
  } catch {
    osc.type = 'square';
  }
  const f = Math.max(40, Math.min(freq, 1600));
  osc.frequency.setValueAtTime(f, time);
  const peak = Math.max(0.0001, Math.min(gain, 0.9));
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(peak, time + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.03, dur));
  osc.connect(g);
  g.connect(dest);
  osc.start(time);
  osc.stop(time + dur + 0.03);
  watchLive(osc, g);
}

function scheduleHat(c, dest, time, vel) {
  if (!vel) return;
  const buf = ensureHatBuffer(c);
  if (!buf) return;
  const src = c.createBufferSource();
  src.buffer = buf;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 5000;
  hp.Q.value = 0.4;
  const g = c.createGain();
  const peak = Math.max(0.0001, Math.min(0.28 * vel, 0.3));
  const dur = 0.032;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(peak, time + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  src.connect(hp);
  hp.connect(g);
  g.connect(dest);
  src.start(time);
  src.stop(time + dur + 0.02);
  watchLive(src, g);
}

function triggerStep(song, step, time, stepDur) {
  const c = getAudioContext();
  const dest = ensureDuck(c);
  if (!c || !dest) return;

  const fire = (voice) => {
    if (!voice || !voice.notes) return;
    const ev = voice.notes[step];
    if (!ev || !ev.n) return;
    const steps = Math.max(1, ev.l || 1);
    const dur = steps * stepDur * (voice.artic != null ? voice.artic : 0.85);
    scheduleTone(c, dest, time, hzOf(ev.n), dur, voice.wave, voice.gain);
  };

  fire(song.lead);
  fire(song.bass);
  if (song.hat && song.hat[step]) scheduleHat(c, dest, time, song.hat[step]);
}

function scheduler() {
  if (!enabled || holds.size > 0 || !currentId) return;
  const c = getAudioContext();
  if (!c || c.state !== 'running') return;
  const song = SONGS[currentId];
  if (!song) return;
  const stepDur = 60 / song.bpm / 4;
  const length = song.length || 32;
  while (nextNoteTime < c.currentTime + SCHEDULE_AHEAD) {
    const swing = (currentStep % 2 === 1) ? (song.swing || 0) * stepDur : 0;
    triggerStep(song, currentStep, nextNoteTime + swing, stepDur);
    nextNoteTime += stepDur;
    absStep += 1;
    currentStep = (currentStep + 1) % length;
  }
}

function startScheduler() {
  if (timerId) return;
  scheduler();
  timerId = setInterval(scheduler, LOOKAHEAD_MS);
  playing = true;
}

function stopScheduler() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  playing = false;
}

function actuallyStop(fade = 0.05) {
  stopScheduler();
  silenceLive(fade);
}

function canStart() {
  return enabled && isUnlocked() && holds.size === 0 && !!pendingId;
}

function startTrack(id, fromTop = true) {
  const song = SONGS[id];
  if (!song) return false;
  const c = getAudioContext();
  if (!c || c.state === 'suspended') resumeIfAllowed();
  const liveCtx = getAudioContext();
  if (!liveCtx) return false;
  ensureDuck(liveCtx);
  if (currentId !== id || fromTop) {
    actuallyStop(0.03);
    currentId = id;
    currentStep = 0;
    nextNoteTime = liveCtx.currentTime + 0.06;
    absStep = 0;
    originTime = nextNoteTime;
  } else if (!playing) {
    nextNoteTime = liveCtx.currentTime + 0.06;
    originTime = nextNoteTime - absStep * (60 / song.bpm / 4);
  }
  if (id !== 'simon') applyDuck(1, 0.04);
  startScheduler();
  return true;
}

function startPending() {
  if (!canStart()) return false;
  if (getAudioContext() && getAudioContext().state === 'suspended') resumeIfAllowed();
  return startTrack(pendingId, currentId !== pendingId || !playing);
}

export function enter(trackId) {
  const id = trackId && SONGS[trackId] ? trackId : (trackId ? null : pendingId);
  if (trackId && !SONGS[trackId] && trackId !== 'none' && trackId !== 'off') return false;
  if (trackId === 'none' || trackId === 'off') {
    pendingId = null;
    currentId = null;
    holds.delete('ended');
    actuallyStop(0.06);
    return true;
  }
  pendingId = id;
  currentId = id;
  holds.delete('ended');
  if (id !== 'simon') applyDuck(1, 0.08);
  if (!enabled) {
    actuallyStop(0.04);
    return true;
  }
  if (!isUnlocked()) return true;
  if (holds.size > 0) return true;
  if (playing && currentId === id) return true;
  return startPending();
}

/**
 * Where the music is, in AudioContext time (Ring Rhythm syncs to this).
 * Step s of loop k sounds at origin + (k * length + s) * stepDur
 * (+ swing * stepDur on odd steps). null when nothing is playing.
 */
export function transport() {
  const c = getAudioContext();
  const song = currentId ? SONGS[currentId] : null;
  if (!c || !song || !playing || c.state !== 'running') return null;
  return {
    id: currentId,
    bpm: song.bpm,
    length: song.length || 32,
    stepDur: 60 / song.bpm / 4,
    swing: song.swing || 0,
    origin: originTime,
    now: c.currentTime
  };
}

/** Song data (read-only use: Ring Rhythm builds its chart from it). */
export function getSong(id) {
  return SONGS[id] || null;
}

export function playForScene(sceneKey) {
  const id = SCENE_TRACKS[sceneKey] || 'menu';
  return enter(id);
}

export function stop() {
  pendingId = null;
  currentId = null;
  holds.add('ended');
  actuallyStop(0.08);
}

function applyDuck(level, seconds = 0.08) {
  duckLevel = Math.max(0, Math.min(1, level));
  const c = getAudioContext();
  if (!duckGain || !c) return;
  try {
    const now = c.currentTime;
    const g = duckGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(0.0001, g.value || 0.0001), now);
    g.linearRampToValueAtTime(Math.max(0.0001, duckLevel), now + Math.max(0.02, seconds));
  } catch {
    // ignore
  }
}

export function setDuck(level, seconds) {
  applyDuck(level, seconds);
}

export function pause(reason = 'game') {
  holds.add(reason || 'game');
  if (playing) actuallyStop(0.05);
}

export function resume(reason = 'game') {
  holds.delete(reason || 'game');
  if (holds.size === 0 && enabled && pendingId && isUnlocked()) {
    startPending();
  }
}

export function setEnabled(on) {
  const value = !!on;
  const changed = enabled !== value;
  enabled = value;
  writePref(value);
  if (!enabled) {
    actuallyStop(0.08);
  } else {
    resumeIfAllowed();
    if (pendingId && isUnlocked() && holds.size === 0) startPending();
  }
  if (changed) notify();
  return enabled;
}

export function toggle() {
  return setEnabled(!enabled);
}

export function probe() {
  const graph = getAudioGraph();
  const c = getAudioContext();
  return {
    enabled,
    playing: isMusicPlaying(),
    transportPlaying: playing,
    track: currentId,
    pending: pendingId,
    step: currentStep,
    bpm: currentId && SONGS[currentId] ? SONGS[currentId].bpm : null,
    duck: duckLevel,
    holds: Array.from(holds),
    liveVoices: live.size,
    unlocked: isUnlocked(),
    contextCreated: contextCreated(),
    contextState: contextState(),
    contextCurrentTime: c ? c.currentTime : 0,
    nextNoteTime,
    musicMaster: graph.musicMaster,
    sfxMaster: graph.sfxMaster,
    hasMusicGain: !!graph.musicGain,
    hasCompressor: !!graph.compressor,
    hasLimiter: !!graph.limiter,
    tracks: Object.keys(SONGS)
  };
}

function publishApi() {
  try {
    window.__vpg = window.__vpg || {};
    const api = {
      enter,
      playForScene,
      stop,
      pause,
      resume,
      toggle,
      setEnabled,
      setDuck,
      isEnabled: isMusicEnabled,
      isPlaying: isMusicPlaying,
      current: currentTrack,
      label: musicLabel,
      getPref: getMusicPref,
      probe,
      transport,
      songs: () => Object.keys(SONGS)
    };
    window.__vpg.music = api;
    window.__vpgMusic = api;
  } catch {
    // ignore
  }
}

function onKey(e) {
  if (!e || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.repeat) return;
  if (e.key === 'n' || e.key === 'N') {
    unlockAudio();
    toggle();
  }
}

function onVisibility() {
  if (typeof document === 'undefined') return;
  if (document.hidden) pause('hidden');
  else resume('hidden');
}

function onBlur() {
  pause('blur');
}

function onFocus() {
  if (typeof document !== 'undefined' && document.hidden) return;
  resume('blur');
}

export function initMusic() {
  if (bound) return;
  bound = true;
  enabled = readPref();
  setMusicActiveFn(musicWantsContext);
  onAudioUnlock(() => startPending());
  window.addEventListener('keydown', onKey, true);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);
  publishApi();
}

export const SONG_IDS = Object.keys(SONGS);
export const SCENE_TO_TRACK = SCENE_TRACKS;

export default {
  transport,
  getSong,
  RINGTONES,
  initMusic,
  enter,
  playForScene,
  stop,
  pause,
  resume,
  toggle,
  setEnabled,
  setDuck,
  isMusicEnabled,
  isMusicPlaying,
  currentTrack,
  musicLabel,
  getMusicPref,
  onMusicChange,
  probe
};
