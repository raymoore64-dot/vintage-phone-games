/*
 * Glue between a running game scene and the Daily Challenge. attachPerks()
 * calls attachDailyRun(scene) when the scene was started with { daily }.
 *
 * - Shows a "DAILY #n · modifier" badge (or PRACTICE) while playing.
 * - At game over (the game's addScore() run event) the official result is
 *   recorded, later restarts of the same scene become practice, and after a
 *   short beat the Daily result screen opens.
 * - Leaving an official run early (menu / back) records the score so far:
 *   the attempt is used either way.
 */

import Phaser from 'phaser';
import * as Progress from '../progress/Progress.js';
import * as Daily from './Daily.js';
import { getSkin } from '../skins/SkinManager.js';

export const HANDOFF_MS = 1700;

export function attachDailyRun(scene, daily) {
  if (!daily) return null;
  const pal = getSkin().palette;
  let done = false;
  const label = daily.practice ? `PRACTICE #${daily.n}` : `DAILY #${daily.n}`;
  const badge = scene.add.text(180, 470, `${label} · ${daily.mod.name}`, {
    fontSize: '11px', color: pal.bg, backgroundColor: daily.practice ? pal.dim : pal.warn,
    fontFamily: 'monospace', fontStyle: 'bold', padding: { x: 5, y: 1 }
  }).setOrigin(0.5).setDepth(980).setAlpha(0.92);
  scene.__dailyBadge = badge;

  const off = Progress.onRun((evt) => {
    if (done || !evt || evt.kind !== 'run' || evt.gameId !== daily.game) return;
    if (!scene.sys || !scene.sys.isActive()) return;
    done = true;
    const res = Daily.finishRun(daily, evt.score);
    scene.__dailyResult = res;
    // a restart of this scene is a practice run from now on
    const data = scene.sys.settings.data;
    if (data && data.daily) data.daily = { ...data.daily, practice: true };
    badge.setText(daily.practice ? `PRACTICE: ${evt.score} (not counted)` : `DAILY #${daily.n} DONE: ${evt.score}`);
    const timer = setTimeout(() => {
      if (!scene.sys || !scene.sys.isActive() || scene.alive !== false) return;
      scene.scene.start('DailyScene', { view: 'result', date: daily.date, practiceScore: daily.practice ? evt.score : null });
    }, HANDOFF_MS);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => clearTimeout(timer));
  });

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    off();
    if (!done && !daily.practice) {
      done = true;
      Daily.finishRun(daily, Number(scene.score) || 0);
      const data = scene.sys.settings.data;
      if (data && data.daily) data.daily = { ...data.daily, practice: true };
    }
    if (scene.__dailyBadge === badge) scene.__dailyBadge = null;
  });
  return { badge };
}

export default { attachDailyRun };
