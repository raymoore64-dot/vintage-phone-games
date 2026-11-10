import Phaser from 'phaser';
import { bindPhoneInput, setSoftKeys } from '../input/PhoneInput.js';
import { attachPause, isFrozen, gameNow } from '../ui/PauseOverlay.js';
import { hexToInt, shadeHex } from '../skins/skins.js';
import { getSkin } from '../skins/SkinManager.js';
import { addScore, formatUnlockLine } from '../progress/Progress.js';
import * as Sfx from '../audio/Sfx.js';
import * as Music from '../audio/Music.js';
import { attachPerks, perkSpeed, perkPoints, useTough } from '../skins/perks.js';
import { onRunStart } from '../phone/Sms.js';

const W = 360;
const H = 480;
const BEST_KEY = 'vpg.simon.best';

const GRID = 3;
const CELL = 92;
const GAP = 10;
const GRID_W = GRID * CELL + (GRID - 1) * GAP;
const GRID_X = (W - GRID_W) / 2;
const GRID_Y = 70;

// 9 distinct frequencies (a minor-ish scale, easy to tell apart)
const TONES = [262, 294, 330, 349, 392, 440, 494, 523, 587];

const FLASH_START = 560;
const FLASH_MIN = 240;
const FLASH_GAP = 120;
const INPUT_FLASH = 180;

export default class SimonScene extends Phaser.Scene {
  constructor() {
    super('SimonScene');
  }

  create() {
    const pal = getSkin().palette;
    // 9 distinct cell colours, all readable against pal.bg. We mix the
    // skin palette with a spread of hues so cells stay unique even on a
    // mostly-monochrome LCD.
    const bases = [
      pal.fg, pal.warn, pal.accent, pal.danger,
      pal.text, pal.fg, pal.warn, pal.accent, pal.danger
    ];
    const shades = [1, 1, 1, 1, 0.75, 0.6, 0.65, 0.7, 0.85];
    this.pal = {
      bg: hexToInt(pal.bg),
      fg: hexToInt(pal.fg),
      dim: hexToInt(pal.dim),
      accent: hexToInt(pal.accent),
      warn: hexToInt(pal.warn),
      danger: hexToInt(pal.danger),
      text: hexToInt(pal.text),
      panel: hexToInt(pal.panel),
      css: pal,
      cells: bases.map((c, i) => shadeHex(c, shades[i]))
    };

    this.score = 0;
    this.best = Number(localStorage.getItem(BEST_KEY) || 0);
    this.streak = 0;
    this.round = 0;
    this.sequence = [];
    this.alive = true;
    this.canRestart = false;
    this.phase = 'watch'; // watch | input | over
    this.reverse = false;
    this.inputIndex = 0;
    this.cursor = 4; // centre cell (digit 5), 0-8
    this.lit = -1;   // cell currently flashing, 0-8, or -1
    this.fromDigit = false;
    this.seqToken = 0;
    this.status = 'WATCH';
    this.substatus = '';

    this.cameras.main.setBackgroundColor(this.pal.bg);
    this.graphics = this.add.graphics();

    this.scoreText = this.add.text(8, 4, 'Score: 0', {
      fontSize: '15px', color: pal.fg, fontFamily: 'monospace'
    });
    this.bestText = this.add.text(352, 4, `Best: ${this.best}`, {
      fontSize: '15px', color: pal.accent, fontFamily: 'monospace'
    }).setOrigin(1, 0);

    this.statusText = this.add.text(180, 40, 'WATCH', {
      fontSize: '22px', color: pal.warn, fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5, 0);
    this.subText = this.add.text(180, 378, '', {
      fontSize: '14px', color: pal.accent, fontFamily: 'monospace', align: 'center',
      wordWrap: { width: 330 }
    }).setOrigin(0.5, 0);
    this.roundText = this.add.text(180, 430, 'Round 0', {
      fontSize: '14px', color: pal.dim, fontFamily: 'monospace'
    }).setOrigin(0.5, 0);
    this.hintText = this.add.text(180, 454, '1-9  ·  D-pad+OK  ·  tap', {
      fontSize: '12px', color: pal.dim, fontFamily: 'monospace'
    }).setOrigin(0.5, 0);

    bindPhoneInput(this, {
      digit: (d) => {
        Sfx.unlockAudio();
        this.fromDigit = true;
        this.onDigit(d);
        queueMicrotask(() => { this.fromDigit = false; });
      },
      up: () => this.onCursor(0, -1),
      down: () => this.onCursor(0, 1),
      left: () => this.onCursor(-1, 0),
      right: () => this.onCursor(1, 0),
      ok: () => this.onOk(),
      softLeft: () => this.onOk(),
      softRight: () => this.scene.start('MenuScene'),
      back: () => this.scene.start('MenuScene')
    });
    setSoftKeys('OK', 'Menu');

    // Tap a cell on the canvas
    this.input.on('pointerdown', (p) => {
      if (isFrozen(this)) return;
      Sfx.unlockAudio();
      if (!this.alive) {
        if (this.canRestart) this.scene.restart();
        return;
      }
      const cell = this.hitCell(p.x, p.y);
      if (cell >= 0) {
        this.cursor = cell;
        this.submit(cell);
      }
    });

    window.__vpg = window.__vpg || {};
    window.__vpg.simon = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (window.__vpg && window.__vpg.simon === this) delete window.__vpg.simon;
    });

    this.createLabels();
    this.pauseCtl = attachPause(this);
    attachPerks(this, 'simon');
    onRunStart('simon');
    Music.enter('simon');
    Music.setDuck(0.06);
    this.draw();
    this.time.delayedCall(500, () => this.nextRound());
  }

  flashMs() {
    // Phone speed perk: faster phones flash quicker, Slow-mo flashes longer
    const ms = Math.max(FLASH_MIN, FLASH_START - this.round * 28) / perkSpeed(this);
    return Math.max(200, Math.round(ms));
  }

  onCursor(dx, dy) {
    Sfx.unlockAudio();
    if (this.fromDigit) {
      this.fromDigit = false;
      return;
    }
    if (!this.alive) return;
    const col = this.cursor % 3;
    const row = Math.floor(this.cursor / 3);
    const nc = Phaser.Math.Clamp(col + dx, 0, 2);
    const nr = Phaser.Math.Clamp(row + dy, 0, 2);
    this.cursor = nr * 3 + nc;
    this.draw();
  }

  onOk() {
    Sfx.unlockAudio();
    if (this.fromDigit) {
      this.fromDigit = false;
      return;
    }
    if (!this.alive) {
      if (this.canRestart) this.scene.restart();
      return;
    }
    this.submit(this.cursor);
  }

  onDigit(d) {
    if (!this.alive) {
      if (this.canRestart && (d === '5' || d === '0')) this.scene.restart();
      return;
    }
    if (!/^[1-9]$/.test(d)) return;
    const cell = Number(d) - 1;
    this.cursor = cell;
    this.submit(cell);
  }

  expected() {
    if (this.reverse) return this.sequence.slice().reverse();
    return this.sequence.slice();
  }

  submit(cell) {
    if (this.phase !== 'input' || !this.alive) return false;
    const want = this.expected();
    const need = want[this.inputIndex];
    this.flashCell(cell, INPUT_FLASH);
    if (cell !== need) {
      if (useTough(this)) {
        // Tough phone: one wrong note forgiven, the round replays
        this.inputIndex = 0;
        this.phase = 'watch';
        this.status = 'TOUGH! AGAIN';
        this.substatus = 'Watch the sequence again';
        this.drawHud();
        this.time.delayedCall(900, () => {
          if (!this.alive) return;
          this.status = this.reverse ? 'REVERSE!' : 'WATCH';
          this.drawHud();
          this.playSequence();
        });
        return false;
      }
      this.gameOver(this.reverse ? 'Wrong reverse note' : 'Wrong note');
      return false;
    }
    this.inputIndex += 1;
    this.draw();
    if (this.inputIndex >= want.length) this.completeRound();
    return true;
  }

  completeRound() {
    this.streak += 1;
    const base = 10 * this.round;
    const streakBonus = 5 * this.streak;
    const reverseBonus = this.reverse ? 25 : 0;
    const gain = perkPoints(this, base + streakBonus + reverseBonus);
    this.score += gain;
    const bits = [`+${base}`];
    if (streakBonus) bits.push(`streak +${streakBonus}`);
    if (reverseBonus) bits.push('REV +25');
    this.substatus = bits.join('  ');
    this.status = 'GOOD!';
    this.phase = 'watch';
    this.drawHud();
    this.time.delayedCall(700, () => this.nextRound());
  }

  nextRound() {
    if (!this.alive) return;
    this.round += 1;
    this.sequence.push(Phaser.Math.Between(0, 8));
    this.reverse = this.round % 3 === 0;
    this.inputIndex = 0;
    this.phase = 'watch';
    this.status = this.reverse ? 'REVERSE!' : 'WATCH';
    this.substatus = this.reverse
      ? 'Repeat the sequence BACKWARDS'
      : 'Repeat the sequence';
    this.drawHud();
    this.playSequence();
  }

  playSequence() {
    Music.setDuck(0.06, 0.08);
    const token = this.seqToken;
    const seq = this.sequence;
    const on = this.flashMs();
    const gap = FLASH_GAP;
    let t = 200;
    seq.forEach((cell) => {
      this.time.delayedCall(t, () => {
        if (!this.alive || this.phase !== 'watch' || this.seqToken !== token) return;
        this.flashCell(cell, on);
      });
      t += on + gap;
    });
    this.time.delayedCall(t + 80, () => {
      if (!this.alive || this.seqToken !== token) return;
      this.phase = 'input';
      Music.setDuck(1, 0.1);
      this.status = this.reverse ? 'YOUR TURN  «' : 'YOUR TURN';
      this.substatus = this.reverse
        ? 'Backwards!  last note first'
        : 'Play it back';
      this.drawHud();
    });
  }

  flashCell(cell, ms) {
    this.lit = cell;
    this.playTone(cell);
    this.draw();
    this.time.delayedCall(ms, () => {
      if (this.lit === cell) this.lit = -1;
      this.draw();
    });
  }

  playTone(cell) {
    Sfx.simonTone(cell);
  }

  hitCell(x, y) {
    for (let i = 0; i < 9; i++) {
      const r = this.cellRect(i);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return -1;
  }

  cellRect(i) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    return {
      x: GRID_X + col * (CELL + GAP),
      y: GRID_Y + row * (CELL + GAP),
      w: CELL,
      h: CELL
    };
  }

  drawHud() {
    this.scoreText.setText(`Score: ${this.score}`);
    this.statusText.setText(this.status);
    this.statusText.setColor(
      this.reverse && (this.phase === 'watch' || this.phase === 'input')
        ? this.pal.css.danger
        : this.phase === 'input' ? this.pal.css.fg : this.pal.css.warn
    );
    this.subText.setText(this.substatus);
    this.roundText.setText(`Round ${this.round}   Streak ${this.streak}`);
  }

  // ---- Rendering --------------------------------------------------------
  update() {
    // Lights are event-driven; we still refresh the cursor pulse
    if (isFrozen(this)) return;
    if (this.alive) this.draw();
  }

  draw() {
    const g = this.graphics;
    const pal = this.pal;
    const now = gameNow(this);
    g.clear();

    g.fillStyle(pal.bg, 1);
    g.fillRect(0, 58, W, 310);

    for (let i = 0; i < 9; i++) {
      const r = this.cellRect(i);
      const lit = this.lit === i;
      const onCursor = this.cursor === i && this.phase === 'input';
      const color = pal.cells[i];
      g.fillStyle(pal.panel, 1);
      g.fillRect(r.x, r.y, r.w, r.h);
      g.fillStyle(color, lit ? 1 : 0.38);
      g.fillRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
      if (lit) {
        g.lineStyle(3, pal.text, 1);
        g.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
      } else if (onCursor) {
        const pulse = 0.55 + 0.45 * Math.sin(now / 160);
        g.lineStyle(3, pal.fg, pulse);
        g.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      } else {
        g.lineStyle(1, pal.dim, 0.7);
        g.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      }
    }
  }

  // Called after create so the numbers sit above the graphics
  initNumbers() {
    // no-op leftover
  }

  // We add the digit labels once, as text objects that sit above graphics
  init() {
    // Phaser Scene.init — don't add display objects here
  }

  // ---- Test helpers -----------------------------------------------------
  getState() {
    return {
      phase: this.phase,
      sequence: this.sequence.slice(),
      reverse: this.reverse,
      expected: this.expected(),
      inputIndex: this.inputIndex,
      cursor: this.cursor,
      round: this.round,
      score: this.score,
      alive: this.alive
    };
  }

  /**
   * Jump to an input phase with a chosen sequence (and optional reverse).
   * Used by tests so they don't wait for the watch playback.
   */
  debugBeginInput(sequence, reverse = false) {
    this.seqToken = (this.seqToken || 0) + 1;
    this.sequence = sequence.slice();
    this.reverse = !!reverse;
    this.round = Math.max(this.round, sequence.length);
    this.inputIndex = 0;
    this.phase = 'input';
    this.alive = true;
    Music.setDuck(1, 0.05);
    this.status = this.reverse ? 'YOUR TURN  «' : 'YOUR TURN';
    this.substatus = this.reverse ? 'Backwards!  last note first' : 'Play it back';
    this.drawHud();
    this.draw();
  }

  // ---- Overlay digits (created once in create via delayed add) ----------
  // Labels are drawn every frame as text would flicker if recreated, so we
  // spawn them in create after super setup — see createLabels().

  createLabels() {
    if (this.cellLabels) return;
    this.cellLabels = [];
    for (let i = 0; i < 9; i++) {
      const r = this.cellRect(i);
      const t = this.add.text(r.x + r.w / 2, r.y + r.h / 2, String(i + 1), {
        fontSize: '28px',
        color: this.pal.css.bg,
        fontFamily: 'monospace',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      t.setStroke(this.pal.css.text, 3);
      this.cellLabels.push(t);
    }
  }

  // ---- Game over --------------------------------------------------------
  gameOver(reason) {
    if (!this.alive) return;
    this.alive = false;
    this.phase = 'over';
    setSoftKeys('Retry', 'Menu');
    this.cameras.main.shake(200, 0.01);
    this.draw();
    const pal = this.pal;

    const newBest = this.score > this.best;
    if (newBest) {
      this.best = this.score;
      localStorage.setItem(BEST_KEY, String(this.best));
      this.bestText.setText(`Best: ${this.best}`);
    }
    const unlockMsg = formatUnlockLine(addScore('simon', this.score, { newBest }));
    Music.stop();
    Sfx.playEnd({ newBest, unlocked: !!unlockMsg });

    this.add.rectangle(180, 270, 300, unlockMsg ? 240 : 220, 0x000000, 0.8).setStrokeStyle(2, pal.fg);
    const style = (size, color) => ({ fontSize: size, color, fontFamily: 'monospace', align: 'center', wordWrap: { width: 280 } });
    this.add.text(180, 200, 'GAME OVER', style('34px', pal.css.danger)).setOrigin(0.5);
    this.add.text(180, 240, reason, style('15px', pal.css.accent)).setOrigin(0.5);
    this.add.text(180, 280, `Score: ${this.score}`, style('22px', pal.css.text)).setOrigin(0.5);
    this.add.text(180, 310, newBest ? 'NEW BEST!' : `Best: ${this.best}`,
      style('16px', newBest ? pal.css.warn : pal.css.accent)).setOrigin(0.5);
    if (unlockMsg) {
      this.add.text(180, 338, unlockMsg, style('13px', pal.css.warn)).setOrigin(0.5);
    }
    this.add.text(180, unlockMsg ? 368 : 355, 'Tap or OK to retry', style('15px', pal.css.fg)).setOrigin(0.5);

    this.time.delayedCall(400, () => {
      this.canRestart = true;
    });
  }
}
