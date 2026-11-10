/*
 * Shared pause overlay + freeze helper for every playable game.
 *
 * Mapping (also shown on the overlay and in index.html):
 *   keyboard P           — pause / resume
 *   keypad #             — pause / resume  (the hash key; visible on touch)
 *   OK / left soft key   — resume, with a short 3-2-1 countdown (~1 s)
 *   C / Esc / right soft — leave to the menu
 *
 * Escape / C stays "back" and is not a pause key. Space stays OK.
 * Star (*) is left alone because Space Impact uses it for Echo Burst.
 * Simon only accepts digits 1-9, so # never counts as a note.
 *
 * Freeze: the scene clock (this.time) is paused, so this.time.now,
 * delayedCall timers and clock-based cooldowns stop. Tweens and arcade
 * physics are paused too. Each game's update() bails out via isFrozen().
 * Timestamp logic that uses this.time.now (Snake trail ages, Impact
 * ghost tape, Bounce / Bricks / Impact cooldowns, Simon playback)
 * therefore resumes exactly where it left off — the clock itself stops,
 * so nothing jumps.
 *
 * Simon: if you pause mid-playback, the delayedCalls are paused with the
 * clock and simply continue after the countdown, rather than restarting
 * the round. That is the simplest correct behaviour.
 *
 * Pausing is disabled on game-over screens (alive === false).
 * Visibility-change and window blur auto-pause a running game.
 * Listeners are removed on scene shutdown so they cannot leak.
 */

import Phaser from 'phaser';
import { bindPhoneInput, setSoftKeys, getSoftKeys } from '../input/PhoneInput.js';
import { hexToInt } from '../skins/skins.js';
import { getSkin } from '../skins/SkinManager.js';
import * as Sfx from '../audio/Sfx.js';

function publish(ctl) {
  window.__vpg = window.__vpg || {};
  window.__vpg.pause = ctl ? ctl.probe() : null;
  window.__vpg.pauseCtl = ctl || null;
}

export function isFrozen(scene) {
  const ctl = scene && scene.__pauseCtl;
  return !!(ctl && ctl.isFrozen());
}

export function isPaused(scene) {
  const ctl = scene && scene.__pauseCtl;
  return !!(ctl && ctl.isPaused());
}

/**
 * Pausable game clock. Phaser still advances scene.time.now while the
 * Clock is paused (it only freezes TimerEvents), so every timestamp
 * comparison in a game must use this instead of this.time.now.
 */
export function gameNow(scene) {
  const raw = scene.time.now;
  const ctl = scene && scene.__pauseCtl;
  if (!ctl) return raw;
  return ctl.clockNow(raw);
}

export function attachPause(scene) {
  if (scene.__pauseCtl) return scene.__pauseCtl;

  const pal = (scene.pal && scene.pal.css) ? scene.pal.css : getSkin().palette;
  const state = {
    paused: false,
    countdown: false,
    savedSoft: { left: '', right: '' },
    timers: [],
    shutdown: false,
    pausedAccum: 0,
    pauseStartedAt: 0
  };

  // Swallow clicks on the dim so they don't reach the game underneath.
  const dim = scene.add.rectangle(180, 240, 360, 480, 0x000000, 0.72)
    .setScrollFactor(0)
    .setDepth(1000)
    .setVisible(false);

  const panel = scene.add.rectangle(180, 240, 284, 228, hexToInt(pal.panel), 1)
    .setStrokeStyle(3, hexToInt(pal.fg))
    .setScrollFactor(0)
    .setDepth(1001)
    .setVisible(false);

  const style = (size, color) => ({
    fontSize: size,
    color,
    fontFamily: 'monospace',
    fontStyle: 'bold',
    align: 'center',
    wordWrap: { width: 260 }
  });

  const title = scene.add.text(180, 168, 'PAUSED', style('36px', pal.warn))
    .setOrigin(0.5).setScrollFactor(0).setDepth(1002).setVisible(false);
  const line1 = scene.add.text(180, 220, 'OK / #  resume', style('16px', pal.text))
    .setOrigin(0.5).setScrollFactor(0).setDepth(1002).setVisible(false);
  const line2 = scene.add.text(180, 248, 'C / Esc  menu', style('16px', pal.text))
    .setOrigin(0.5).setScrollFactor(0).setDepth(1002).setVisible(false);
  const line3 = scene.add.text(180, 286, 'P or # to pause', style('14px', pal.accent))
    .setOrigin(0.5).setScrollFactor(0).setDepth(1002).setVisible(false);
  const soundLine = scene.add.text(180, 318, '', style('14px', pal.dim))
    .setOrigin(0.5).setScrollFactor(0).setDepth(1002).setVisible(false);

  const nodes = [dim, panel, title, line1, line2, line3, soundLine];

  function refreshSoundLine() {
    soundLine.setText(Sfx.isMuted() ? 'Sound: Off  ·  M unmute' : 'Sound: On  ·  M mute');
  }
  refreshSoundLine();
  const unsubMute = Sfx.onMuteChange(() => refreshSoundLine());

  function showPausedVisual() {
    title.setText('PAUSED').setFontSize(36);
    line1.setVisible(true);
    line2.setVisible(true);
    line3.setVisible(true);
    soundLine.setVisible(true);
    refreshSoundLine();
    dim.setVisible(true);
    panel.setVisible(true);
    title.setVisible(true);
    dim.setInteractive();
  }

  function showCountdownVisual(text) {
    title.setText(text).setFontSize(64);
    line1.setVisible(false);
    line2.setVisible(false);
    line3.setVisible(false);
    soundLine.setVisible(false);
    dim.setVisible(true);
    panel.setVisible(true);
    title.setVisible(true);
    dim.setInteractive();
  }

  function hideVisual() {
    nodes.forEach((n) => n.setVisible(false));
    dim.disableInteractive();
  }

  function freezeClock() {
    if (!state.pauseStartedAt) state.pauseStartedAt = scene.time.now;
    scene.time.paused = true;
    scene.tweens.pauseAll();
    if (scene.physics && scene.physics.world) scene.physics.world.pause();
    if (scene.cameras && scene.cameras.main && scene.cameras.main.shakeEffect) {
      scene.cameras.main.shakeEffect.reset();
    }
  }

  function unfreezeClock() {
    if (state.shutdown) return;
    const raw = scene.time.now;
    if (state.pauseStartedAt) {
      state.pausedAccum += raw - state.pauseStartedAt;
      state.pauseStartedAt = 0;
    }
    scene.time.paused = false;
    scene.tweens.resumeAll();
    if (scene.physics && scene.physics.world) scene.physics.world.resume();
  }

  function clearTimers() {
    state.timers.forEach((id) => clearTimeout(id));
    state.timers = [];
  }

  function pause(opts) {
    if (state.shutdown || scene.alive === false) return false;
    if (state.paused && !state.countdown) return false;
    if (state.countdown) {
      clearTimers();
      state.countdown = false;
    }
    state.paused = true;
    state.savedSoft = getSoftKeys();
    freezeClock();
    setSoftKeys('Resume', 'Menu');
    showPausedVisual();
    publish(ctl);
    if (!(opts && opts.silent)) Sfx.pause();
    return true;
  }

  function requestResume() {
    if (state.shutdown) return;
    if (state.countdown) return;
    if (!state.paused) return;
    state.paused = false;
    state.countdown = true;
    clearTimers();
    showCountdownVisual('3');
    setSoftKeys('Resume', 'Menu');
    publish(ctl);
    Sfx.countdownTick();
    state.timers.push(setTimeout(() => {
      if (!state.countdown) return;
      showCountdownVisual('2');
      publish(ctl);
      Sfx.countdownTick();
    }, 330));
    state.timers.push(setTimeout(() => {
      if (!state.countdown) return;
      showCountdownVisual('1');
      publish(ctl);
      Sfx.countdownTick();
    }, 660));
    state.timers.push(setTimeout(() => finishResume(), 1000));
  }

  function finishResume() {
    if (state.shutdown) return;
    clearTimers();
    state.paused = false;
    state.countdown = false;
    hideVisual();
    unfreezeClock();
    setSoftKeys(state.savedSoft.left || '', state.savedSoft.right || '');
    publish(ctl);
    Sfx.resume();
  }

  function toMenu() {
    if (state.shutdown) return;
    clearTimers();
    state.paused = false;
    state.countdown = false;
    hideVisual();
    unfreezeClock();
    setSoftKeys('', '');
    publish(null);
    scene.scene.start('MenuScene');
  }

  function autoPause() {
    if (state.shutdown || scene.alive === false) return;
    if (state.paused && !state.countdown) return;
    if (state.countdown) {
      clearTimers();
      state.countdown = false;
      state.paused = true;
      freezeClock();
      setSoftKeys('Resume', 'Menu');
      showPausedVisual();
      publish(ctl);
      return;
    }
    pause({ silent: true });
  }

  const ctl = {
    isFrozen: () => state.paused || state.countdown,
    isPaused: () => state.paused,
    isCountdown: () => state.countdown,
    clockNow: (raw = scene.time.now) => {
      let adj = raw - state.pausedAccum;
      if ((state.paused || state.countdown) && state.pauseStartedAt) {
        adj -= (raw - state.pauseStartedAt);
      }
      return adj;
    },
    pause,
    resume: requestResume,
    toMenu,
    probe: () => ({
      paused: state.paused,
      countdown: state.countdown,
      frozen: state.paused || state.countdown,
      countText: title.visible ? title.text : null,
      scene: scene.scene.key,
      timeNow: ctl.clockNow(),
      timePaused: !!scene.time.paused,
      alive: scene.alive !== false,
      score: scene.score ?? null
    }),
    signature: () => freezeSignature(scene)
  };

  scene.__pauseCtl = ctl;

  bindPhoneInput(scene, {
    pause: () => {
      if (ctl.isFrozen()) ctl.resume();
      else ctl.pause();
    }
  });

  const visHandler = () => { if (document.hidden) autoPause(); };
  const blurHandler = () => { autoPause(); };
  document.addEventListener('visibilitychange', visHandler);
  window.addEventListener('blur', blurHandler);

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    state.shutdown = true;
    clearTimers();
    if (typeof unsubMute === 'function') unsubMute();
    document.removeEventListener('visibilitychange', visHandler);
    window.removeEventListener('blur', blurHandler);
    if (scene.__pauseCtl === ctl) scene.__pauseCtl = null;
    if (window.__vpg && window.__vpg.pauseCtl === ctl) {
      window.__vpg.pauseCtl = null;
      window.__vpg.pause = null;
    }
  });

  publish(ctl);
  return ctl;
}

function freezeSignature(scene) {
  const key = scene.scene.key;
  const base = {
    key,
    timeNow: scene.__pauseCtl ? scene.__pauseCtl.clockNow() : scene.time.now,
    score: scene.score,
    alive: scene.alive
  };
  try {
    if (key === 'SnakeScene') {
      return {
        ...base,
        snake: JSON.stringify(scene.snake),
        dir: { ...scene.direction },
        queue: JSON.stringify(scene.dirQueue),
        trail: JSON.stringify([...scene.trail.entries()]),
        food: { ...scene.food },
        moveTimer: scene.moveTimer,
        moveInterval: scene.moveInterval,
        shedReadyAt: scene.shedReadyAt
      };
    }
    if (key === 'BounceScene') {
      return {
        ...base,
        ball: { ...scene.ball },
        viewX: scene.viewX,
        gravSign: scene.gravSign,
        flipReadyAt: scene.flipReadyAt,
        hopReadyAt: scene.hopReadyAt,
        flips: scene.flips,
        combo: scene.combo,
        movers: scene.segments.map((s) => s.movers.map((m) => ({ x: m.x, y: m.y, vy: m.vy })))
      };
    }
    if (key === 'ImpactScene') {
      return {
        ...base,
        ship: { ...scene.ship },
        ghost: { ...scene.ghost },
        tape: JSON.stringify(scene.tape),
        lastGhostT: scene.lastGhostT,
        startedAt: scene.startedAt,
        invulnUntil: scene.invulnUntil,
        burstUntil: scene.burstUntil,
        burstReadyAt: scene.burstReadyAt,
        lastFire: scene.lastFire,
        rapidUntil: scene.rapidUntil,
        spawnTimer: scene.spawnTimer,
        lives: scene.lives,
        enemies: JSON.stringify(scene.enemies.map((e) => ({
          kind: e.kind, x: e.x, y: e.y, hp: e.hp, phase: e.phase, nextShot: e.nextShot
        }))),
        bullets: JSON.stringify(scene.bullets.map((b) => ({
          x: b.x, y: b.y, vx: b.vx, vy: b.vy, life: b.life
        })))
      };
    }
    if (key === 'BricksScene') {
      return {
        ...base,
        ball: { ...scene.ball },
        paddleX: scene.paddleX,
        serving: scene.serving,
        lives: scene.lives,
        level: scene.level,
        nudgeReadyAt: scene.nudgeReadyAt,
        nudgeArmedUntil: scene.nudgeArmedUntil,
        bricks: scene.bricks.map((b) => (b.alive ? 1 : 0)).join(''),
        flashes: JSON.stringify(scene.flashes)
      };
    }
    if (key === 'BlocksScene') {
      return {
        ...base,
        grid: JSON.stringify(scene.grid),
        piece: scene.piece ? { ...scene.piece } : null,
        fallTimer: scene.fallTimer,
        lockTimer: scene.lockTimer,
        locking: scene.locking,
        holdTime: scene.holdTime,
        shiftAccum: scene.shiftAccum,
        softAccum: scene.softAccum,
        quakeCharges: scene.quakeCharges,
        nextType: scene.nextType
      };
    }
    if (key === 'SimonScene') {
      return {
        ...base,
        phase: scene.phase,
        sequence: scene.sequence.slice(),
        reverse: scene.reverse,
        inputIndex: scene.inputIndex,
        lit: scene.lit,
        cursor: scene.cursor,
        round: scene.round,
        seqToken: scene.seqToken
      };
    }
  } catch (err) {
    return { ...base, error: String(err) };
  }
  return base;
}

export default { attachPause, isFrozen, isPaused, gameNow };
