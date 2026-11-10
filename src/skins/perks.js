/*
 * Phone perks: every phone changes how the games play, not just how they
 * look. Perk data is keyed by skin id. Game scenes call the small helpers
 * below so every game reads the same rules:
 *
 *   attachPerks(scene, gameId)  — once in create(), after attachPause()
 *   perkSpeed(scene)            — multiply the game's motion / fall speed
 *   perkPoints(scene, n, opts)  — wrap every score gain (multipliers, Lucky,
 *                                 Glitch windows, full-battery bonus)
 *   perkLives(scene, base)      — starting lives (Executive: one fewer)
 *   useTough(scene)             — true once per run if the phone forgives
 *                                 a fatal hit (LINICRO 1000 "Tough")
 *   toughLives(scene)           — +1 starting life for Tough in lives games
 *   hasLuck(scene)              — Lucky phone: more power-ups where a game
 *                                 has them
 *
 * Timed perks (Sunlight bonus, Glitch events) run off the pausable game
 * clock (gameNow), so they freeze with the pause overlay and never fire
 * on the game-over screen.
 */

import Phaser from 'phaser';
import { getSkin } from './SkinManager.js';
import { gameNow, isFrozen } from '../ui/PauseOverlay.js';
import * as Lcd from '../phone/Lcd.js';
import * as Phone from '../phone/Phone.js';
import * as Sfx from '../audio/Sfx.js';

const BASE = {
  speed: 1,
  score: 1,
  tough: false,
  ghost: false,
  sunlight: false,
  luck: 0,
  lifeDelta: 0,
  glitch: false
};

export const PERKS = {
  'linicro-1000': {
    id: 'tough', name: 'Tough',
    desc: 'Built like a brick: survive one fatal hit per run',
    tough: true
  },
  'purplex-grape': {
    id: 'ghosting', name: 'Ghosting',
    desc: 'Laggy LCD leaves ghost trails · x1.1 score',
    ghost: true, score: 1.1
  },
  'glacio-ice': {
    id: 'slowmo', name: 'Slow-mo',
    desc: 'Cold circuits: games run 15% slower · x0.9 score',
    speed: 0.85, score: 0.9
  },
  'rubytel-cherry': {
    id: 'turbo', name: 'Turbo',
    desc: 'Overclocked: 15% faster · x1.25 score',
    speed: 1.15, score: 1.25
  },
  'solara-sunburst': {
    id: 'sunlight', name: 'Sunlight',
    desc: 'Bright screen · +25 sun bonus every 20s alive',
    sunlight: true, sunEvery: 20000, sunBonus: 25
  },
  'mintra-minty': {
    id: 'lucky', name: 'Lucky',
    desc: '12% chance to double points · extra power-ups',
    luck: 0.12
  },
  'aurum-executive': {
    id: 'executive', name: 'Executive',
    desc: 'x1.5 score, but 10% faster and one less life',
    speed: 1.1, score: 1.5, lifeDelta: -1
  },
  'volta-neon': {
    id: 'glitch', name: 'Glitch',
    desc: 'Random glitches give x2 score for 6 seconds',
    glitch: true
  },
  'proto-clear': {
    id: 'overclock', name: 'Overclock',
    desc: 'Secret prototype: x1.3 score · 5% faster · glitches',
    speed: 1.05, score: 1.3, glitch: true
  }
};

const GLITCH_MIN = 18000;
const GLITCH_MAX = 30000;
const GLITCH_LEN = 6000;
const FULL_CHARGE_BONUS = 1.05;

export function perkFor(skinId) {
  const p = PERKS[skinId] || PERKS['linicro-1000'];
  return { ...BASE, ...p };
}

export function currentPerk() {
  return perkFor(getSkin().id);
}

function rt(scene) {
  return scene && scene.__perk ? scene.__perk : null;
}

export function perkSpeed(scene) {
  const r = rt(scene);
  return r ? r.perk.speed : 1;
}

export function perkLives(scene, base) {
  const r = rt(scene);
  const d = r ? r.perk.lifeDelta : 0;
  return Math.max(1, base + d);
}

/** Tough phones in lives-based games simply start with one extra life. */
export function toughLives(scene) {
  const r = rt(scene);
  return r && r.perk.tough ? 1 : 0;
}

export function hasLuck(scene) {
  const r = rt(scene);
  return !!(r && r.perk.luck > 0);
}

/**
 * Turn a base score gain into the real gain for this phone.
 * opts.quiet: tiny, frequent gains (distance ticks, soft drops) never roll
 * Lucky and never pop text, but still get the multipliers.
 */
export function perkPoints(scene, base, opts = {}) {
  const n = Number(base) || 0;
  const r = rt(scene);
  if (!r || n <= 0) return Math.max(0, Math.round(n));
  let mult = r.perk.score * (r.fullCharge ? FULL_CHARGE_BONUS : 1);
  if (r.glitchUntil && gameNow(scene) < r.glitchUntil) mult *= 2;
  let lucky = false;
  if (!opts.quiet && r.perk.luck > 0 && Math.random() < r.perk.luck) {
    mult *= 2;
    lucky = true;
  }
  const raw = n * mult + r.carry;
  const whole = Math.floor(raw);
  r.carry = raw - whole;
  if (lucky) {
    r.luckyHits += 1;
    popText(scene, 'LUCKY x2!', 'warn');
    Sfx.play('perkBonus');
  }
  r.awarded += whole;
  return whole;
}

/** Tough phones forgive one fatal hit per run. */
export function useTough(scene) {
  const r = rt(scene);
  if (!r || !r.perk.tough || r.toughUsed) return false;
  r.toughUsed = true;
  popText(scene, 'TOUGH! saved', 'accent');
  Sfx.play('perkBonus');
  try { scene.cameras.main.flash(160, 255, 255, 255); } catch { /* ignore */ }
  return true;
}

function popText(scene, msg, colorKey = 'warn') {
  if (!scene || !scene.sys || !scene.sys.isActive()) return;
  const pal = getSkin().palette;
  const t = scene.add.text(180, 64, msg, {
    fontSize: '18px', color: pal[colorKey] || pal.warn, fontFamily: 'monospace', fontStyle: 'bold',
    stroke: pal.bg, strokeThickness: 4
  }).setOrigin(0.5).setDepth(960);
  scene.tweens.add({ targets: t, y: 40, alpha: 0, delay: 500, duration: 700, onComplete: () => t.destroy() });
}

function addBonus(scene, base, label) {
  const gain = perkPoints(scene, base, { quiet: true });
  scene.score = (Number(scene.score) || 0) + gain;
  if (scene.scoreText && scene.scoreText.active) scene.scoreText.setText(`Score: ${scene.score}`);
  popText(scene, `${label} +${gain}`, 'warn');
  Sfx.play('perkBonus');
  return gain;
}

function showBanner(scene, perk, fullCharge) {
  const pal = getSkin().palette;
  const toInt = (h) => parseInt(String(h).replace('#', ''), 16);
  const h = fullCharge ? 76 : 62;
  const y = 120;
  const box = scene.add.rectangle(180, y, 316, h, toInt(pal.panel), 0.94)
    .setStrokeStyle(2, toInt(pal.fg)).setDepth(950);
  const title = scene.add.text(180, y - h / 2 + 16, `PERK: ${perk.name.toUpperCase()}`, {
    fontSize: '18px', color: pal.warn, fontFamily: 'monospace', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(951);
  const desc = scene.add.text(180, y - h / 2 + 38, perk.desc, {
    fontSize: '12px', color: pal.text, fontFamily: 'monospace', align: 'center', wordWrap: { width: 300 }
  }).setOrigin(0.5).setDepth(951);
  const nodes = [box, title, desc];
  if (fullCharge) {
    nodes.push(scene.add.text(180, y + h / 2 - 12, 'Full battery: +5% score', {
      fontSize: '12px', color: pal.accent, fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(951));
  }
  scene.tweens.add({
    targets: nodes, alpha: 0, delay: 2000, duration: 500,
    onComplete: () => nodes.forEach((n) => n.destroy())
  });
  return nodes;
}

/** Call once in a game scene's create(), after attachPause(). */
export function attachPerks(scene, gameId) {
  const skin = getSkin();
  const perk = perkFor(skin.id);
  const fullCharge = Phone.batteryLevel() >= 99;
  const now = gameNow(scene);
  const r = {
    gameId,
    skinId: skin.id,
    perk,
    fullCharge,
    carry: 0,
    awarded: 0,
    luckyHits: 0,
    toughUsed: false,
    nextSunAt: perk.sunlight ? now + perk.sunEvery : Infinity,
    nextGlitchAt: perk.glitch ? now + Phaser.Math.Between(GLITCH_MIN, GLITCH_MAX) : Infinity,
    glitchUntil: 0,
    glitches: 0,
    suns: 0
  };
  scene.__perk = r;

  Lcd.setGhost(!!perk.ghost);
  Lcd.setSunlight(!!perk.sunlight);
  showBanner(scene, perk, fullCharge);

  const onUpdate = () => {
    if (isFrozen(scene) || scene.alive === false) return;
    const t = gameNow(scene);
    if (t >= r.nextSunAt) {
      r.nextSunAt = t + perk.sunEvery;
      r.suns += 1;
      addBonus(scene, perk.sunBonus, 'SUN');
    }
    if (t >= r.nextGlitchAt) {
      r.nextGlitchAt = t + GLITCH_LEN + Phaser.Math.Between(GLITCH_MIN, GLITCH_MAX);
      r.glitchUntil = t + GLITCH_LEN;
      r.glitches += 1;
      Lcd.glitch();
      popText(scene, 'GLITCH! x2', 'danger');
      Sfx.play('perkGlitch');
    }
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
    Lcd.setGhost(false);
    Lcd.setSunlight(false);
    if (scene.__perk === r) scene.__perk = null;
  });

  window.__vpg = window.__vpg || {};
  window.__vpg.perkRun = () => ({
    scene: scene.scene.key,
    perk: { ...r.perk },
    fullCharge: r.fullCharge,
    toughUsed: r.toughUsed,
    awarded: r.awarded,
    luckyHits: r.luckyHits,
    glitches: r.glitches,
    suns: r.suns,
    glitchActive: !!(r.glitchUntil && gameNow(scene) < r.glitchUntil),
    lives: scene.lives ?? null,
    maxLives: scene.maxLives ?? null
  });
  window.__vpg.perkDebug = {
    forceGlitch: () => { r.nextGlitchAt = gameNow(scene); },
    forceSun: () => { r.nextSunAt = gameNow(scene); },
    points: (n, quiet = true) => perkPoints(scene, n, { quiet })
  };
  return r;
}

export function publishPerks() {
  window.__vpg = window.__vpg || {};
  window.__vpg.perks = {
    all: () => JSON.parse(JSON.stringify(PERKS)),
    current: () => currentPerk(),
    forSkin: (id) => perkFor(id)
  };
}

export default { PERKS, perkFor, currentPerk, attachPerks, perkSpeed, perkPoints, perkLives, toughLives, useTough, hasLuck, publishPerks };
