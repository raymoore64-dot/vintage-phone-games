/*
 * Shared plumbing for the WAP cartridge games (batch C) so each scene
 * reads like the built-in games:
 *   palette()                 skin palette as ints + css strings
 *   showHowTo(scene, spec)    1-screen 'how to play'; OK / 5 / tap starts
 *   beginRun(scene, id)       pause overlay, perks (+ calls, eggs, share
 *                             strip), night texts, music
 *   endRun(scene, opts)       best score, Progress points (which feed the
 *                             pet and check dares), end jingle, panel
 *   toMenu(scene, id)         back to the menu with this game selected
 * Retry restarts with { skipHowTo: true }.
 */

import Phaser from 'phaser';
import { bindPhoneInput, setSoftKeys } from '../input/PhoneInput.js';
import { attachPause } from '../ui/PauseOverlay.js';
import { hexToInt, shadeHex } from '../skins/skins.js';
import { getSkin } from '../skins/SkinManager.js';
import { addScore, formatUnlockLine } from '../progress/Progress.js';
import * as Sfx from '../audio/Sfx.js';
import * as Music from '../audio/Music.js';
import { attachPerks } from '../skins/perks.js';
import { onRunStart } from '../phone/Sms.js';

export function palette() {
  const pal = getSkin().palette;
  return {
    bg: hexToInt(pal.bg),
    fg: hexToInt(pal.fg),
    dim: hexToInt(pal.dim),
    accent: hexToInt(pal.accent),
    warn: hexToInt(pal.warn),
    danger: hexToInt(pal.danger),
    text: hexToInt(pal.text),
    panel: hexToInt(pal.panel),
    body: shadeHex(pal.fg, 0.72),
    css: pal
  };
}

export const mono = (size, color, extra = {}) => ({ fontSize: size, color, fontFamily: 'monospace', fontStyle: 'bold', ...extra });

/**
 * spec: { title, tagline, lines: [..] (how it works), keys: [[keys, action], ..], onStart }
 * Sets scene.phase = 'howto' until started.
 */
export function showHowTo(scene, spec) {
  const pal = scene.pal.css;
  scene.phase = 'howto';
  const depth = 900;
  const nodes = [];
  nodes.push(scene.add.rectangle(180, 240, 360, 480, scene.pal.bg, 1).setDepth(depth));
  nodes.push(scene.add.rectangle(180, 22, 360, 44, scene.pal.fg).setDepth(depth));
  nodes.push(scene.add.text(180, 22, spec.title.toUpperCase(), mono('22px', pal.bg)).setOrigin(0.5).setDepth(depth));
  nodes.push(scene.add.text(180, 60, spec.tagline || '', mono('13px', pal.warn, { align: 'center', wordWrap: { width: 330 } })).setOrigin(0.5, 0).setDepth(depth));
  let y = spec.tagline ? 98 : 64;
  nodes.push(scene.add.text(180, y, 'HOW TO PLAY', mono('14px', pal.accent)).setOrigin(0.5, 0).setDepth(depth));
  y += 22;
  spec.lines.forEach((l) => {
    const t = scene.add.text(18, y, `• ${l}`, mono('12px', pal.text, { wordWrap: { width: 326 }, lineSpacing: 2 })).setDepth(depth);
    nodes.push(t);
    y += t.height + 5;
  });
  y += 6;
  nodes.push(scene.add.text(180, y, 'KEYS', mono('14px', pal.accent)).setOrigin(0.5, 0).setDepth(depth));
  y += 22;
  spec.keys.forEach(([k, a]) => {
    nodes.push(scene.add.text(18, y, k, mono('12px', pal.fg)).setDepth(depth));
    const t = scene.add.text(140, y, a, mono('12px', pal.text, { wordWrap: { width: 204 } })).setDepth(depth);
    nodes.push(t);
    y += Math.max(16, t.height + 3);
  });
  if (spec.extra) spec.extra(nodes, depth, y);
  const go = scene.add.text(180, 458, 'OK / 5 / tap to start', mono('15px', pal.bg, { backgroundColor: pal.fg, padding: { x: 10, y: 4 } }))
    .setOrigin(0.5).setDepth(depth);
  nodes.push(go);
  scene.tweens.add({ targets: go, alpha: 0.45, yoyo: true, repeat: -1, duration: 600 });
  setSoftKeys('Start', 'Menu');

  let started = false;
  const start = () => {
    if (started || scene.phase !== 'howto') return;
    started = true;
    Sfx.menuSelect();
    // next frame, so the same key press doesn't also act in the game
    scene.time.delayedCall(1, () => {
      nodes.forEach((n) => n.destroy());
      spec.onStart();
    });
  };
  scene.__howto = { start, nodes };
  bindPhoneInput(scene, {
    ok: () => start(),
    softLeft: () => start(),
    digit: (d) => { if (spec.startDigits && spec.startDigits.includes(d)) start(); }
  });
  // ignore the tail of the tap that opened this screen
  scene.time.delayedCall(350, () => { if (!started) scene.input.once('pointerup', () => start()); });
  return scene.__howto;
}

/** Begin the run proper (after the how-to). */
export function beginRun(scene, gameId, track) {
  scene.phase = 'play';
  scene.alive = true;
  scene.pauseCtl = attachPause(scene);
  attachPerks(scene, gameId);
  onRunStart(gameId);
  Music.enter(track || gameId);
}

/**
 * Game over. opts: { gameId, bestKey, reason, title }. Returns { newBest }.
 * The share strip (perks.js) and pet feeding (Pet.js) react to addScore.
 */
export function endRun(scene, opts) {
  if (scene.alive === false) return null;
  scene.alive = false;
  scene.phase = 'over';
  setSoftKeys('Retry', 'Menu');
  const pal = scene.pal;
  const best = Number(localStorage.getItem(opts.bestKey) || 0);
  const newBest = scene.score > best;
  if (newBest) localStorage.setItem(opts.bestKey, String(scene.score));
  scene.best = Math.max(best, scene.score);
  if (scene.bestText && scene.bestText.active) scene.bestText.setText(`Best: ${scene.best}`);
  const unlockMsg = formatUnlockLine(addScore(opts.gameId, scene.score, { newBest }));
  Music.stop();
  Sfx.playEnd({ newBest, unlocked: !!unlockMsg });

  const depth = 800;
  const h = unlockMsg ? 240 : 220;
  scene.add.rectangle(180, 270, 300, h, 0x000000, 0.82).setStrokeStyle(2, pal.fg).setDepth(depth);
  const style = (size, color) => mono(size, color, { align: 'center', wordWrap: { width: 280 } });
  scene.add.text(180, 196, opts.title || 'GAME OVER', style('30px', opts.win ? pal.css.fg : pal.css.danger)).setOrigin(0.5).setDepth(depth);
  scene.add.text(180, 236, opts.reason || '', style('14px', pal.css.accent)).setOrigin(0.5).setDepth(depth);
  scene.add.text(180, 276, `Score: ${scene.score}`, style('22px', pal.css.text)).setOrigin(0.5).setDepth(depth);
  scene.add.text(180, 306, newBest ? 'NEW BEST!' : `Best: ${scene.best}`, style('16px', newBest ? pal.css.warn : pal.css.accent)).setOrigin(0.5).setDepth(depth);
  if (unlockMsg) scene.add.text(180, 334, unlockMsg, style('13px', pal.css.warn)).setOrigin(0.5).setDepth(depth);
  scene.add.text(180, unlockMsg ? 366 : 352, 'Tap or OK to retry', style('15px', pal.css.fg)).setOrigin(0.5).setDepth(depth);
  scene.canRestart = false;
  scene.time.delayedCall(400, () => {
    scene.canRestart = true;
    scene.input.once('pointerup', () => retry(scene));
  });
  return { newBest };
}

export function retry(scene) {
  if (!scene.canRestart) return;
  scene.canRestart = false;
  scene.scene.restart({ skipHowTo: true });
}

export function toMenu(scene, gameId) {
  scene.scene.start('MenuScene', { item: gameId });
}

/** Seconds of game time (pausable) — helper for HUD timers. */
export function fmtTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default { palette, mono, showHowTo, beginRun, endRun, retry, toMenu, fmtTime };
