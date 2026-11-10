/*
 * Seeded PRNG for the Daily Challenge (and anything else that wants a
 * repeatable sequence). mulberry32: tiny, fast, good enough for games.
 *
 * Game scenes call gameRng(this) at the very top of create(). For a daily
 * run (scene started with { daily: { seed } }) it returns a seeded stream,
 * so every player gets the same food spots, level layout, piece bag and
 * Simon sequence that day. Otherwise it wraps Math.random.
 *
 * Purely cosmetic randomness (background stars) may keep Math.random so a
 * frame-rate dependent effect never shifts the gameplay sequence.
 */

export function hash32(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wrap(next, seed = null) {
  let calls = 0;
  const n = () => { calls += 1; return next(); };
  const rng = {
    seeded: seed !== null,
    seed,
    next: n,
    /** integer in [min, max] inclusive (same contract as Phaser.Math.Between) */
    between: (min, max) => Math.floor(n() * (max - min + 1)) + min,
    /** float in [min, max) */
    float: (min, max) => n() * (max - min) + min,
    chance: (p) => n() < p,
    pick: (arr) => arr[Math.floor(n() * arr.length)],
    shuffle: (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(n() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    calls: () => calls
  };
  return rng;
}

export function makeRng(seed) {
  return wrap(mulberry32(seed >>> 0), seed >>> 0);
}

export function randomRng() {
  return wrap(Math.random);
}

/** The daily context a scene was started with, if any. */
export function dailyOf(scene) {
  const d = scene && scene.sys && scene.sys.settings && scene.sys.settings.data;
  return d && d.daily && Number.isFinite(d.daily.seed) ? d.daily : null;
}

/** RNG for one run of a game scene. Call at the top of create(). */
export function gameRng(scene) {
  const daily = dailyOf(scene);
  const rng = daily ? makeRng(daily.seed) : randomRng();
  if (scene) {
    scene.rng = rng;
    scene.daily = daily;
  }
  return rng;
}

export default { hash32, mulberry32, makeRng, randomRng, gameRng, dailyOf };
