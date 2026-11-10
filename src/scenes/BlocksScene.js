import Phaser from 'phaser';
import { bindPhoneInput, isHeld, setSoftKeys } from '../input/PhoneInput.js';
import { attachPause, isFrozen, gameNow } from '../ui/PauseOverlay.js';
import { hexToInt, shadeHex } from '../skins/skins.js';
import { getSkin } from '../skins/SkinManager.js';
import { addScore, formatUnlockLine } from '../progress/Progress.js';
import * as Sfx from '../audio/Sfx.js';

const W = 360;
const H = 480;
const COLS = 10;
const ROWS = 20;
const CELL = 20;
const WELL_X = 16;
const WELL_Y = 40;
const WELL_W = COLS * CELL;
const WELL_H = ROWS * CELL;

const DAS_DELAY = 170;
const DAS_REPEAT = 50;
const SOFT_REPEAT = 40;
const LOCK_MS = 280;
const BEST_KEY = 'vpg.blocks.best';
const MAX_QUAKE = 3;
const LINES_PER_LEVEL = 10;

// 4 rotation states for each of the 7 tetrominoes, in a 4x4 box.
const SHAPES = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]]
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]]
  ],
  T: [
    [[0, 1], [1, 1], [2, 1], [1, 0]],
    [[1, 0], [1, 1], [1, 2], [2, 1]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [1, 1], [1, 2], [0, 1]]
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]]
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]]
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]]
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]]
  ]
};

const KICKS = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0], [-1, -1], [1, -1]];
const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

export default class BlocksScene extends Phaser.Scene {
  constructor() {
    super('BlocksScene');
  }

  create() {
    const pal = getSkin().palette;
    this.pal = {
      bg: hexToInt(pal.bg),
      fg: hexToInt(pal.fg),
      dim: hexToInt(pal.dim),
      accent: hexToInt(pal.accent),
      warn: hexToInt(pal.warn),
      danger: hexToInt(pal.danger),
      text: hexToInt(pal.text),
      panel: hexToInt(pal.panel),
      well: shadeHex(pal.panel, 0.8),
      grid: shadeHex(pal.dim, 0.55),
      css: pal,
      piece: {
        I: hexToInt(pal.fg),
        O: hexToInt(pal.warn),
        T: hexToInt(pal.accent),
        S: shadeHex(pal.fg, 0.7),
        Z: hexToInt(pal.danger),
        J: hexToInt(pal.text),
        L: shadeHex(pal.warn, 0.85)
      }
    };

    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.score = 0;
    this.best = Number(localStorage.getItem(BEST_KEY) || 0);
    this.lines = 0;
    this.level = 1;
    this.alive = true;
    this.canRestart = false;
    this.quakeCharges = 1;
    this.quakeLabel = '';
    this.bag = [];
    this.nextType = this.takeBag();
    this.fallTimer = 0;
    this.lockTimer = 0;
    this.locking = false;
    this.holdDir = 0;
    this.holdTime = 0;
    this.shiftAccum = 0;
    this.softAccum = 0;
    this.lastCleared = 0;

    this.cameras.main.setBackgroundColor(this.pal.bg);
    this.graphics = this.add.graphics();

    this.scoreText = this.add.text(8, 4, 'Score: 0', {
      fontSize: '15px', color: pal.fg, fontFamily: 'monospace'
    });
    this.bestText = this.add.text(352, 4, `Best: ${this.best}`, {
      fontSize: '15px', color: pal.accent, fontFamily: 'monospace'
    }).setOrigin(1, 0);
    this.metaText = this.add.text(8, 22, 'Lv 1  Lines 0', {
      fontSize: '13px', color: pal.accent, fontFamily: 'monospace'
    });

    // Sidebar labels (static)
    this.add.text(240, 48, 'NEXT', {
      fontSize: '13px', color: pal.dim, fontFamily: 'monospace', fontStyle: 'bold'
    });
    this.add.text(240, 160, 'QUAKE', {
      fontSize: '13px', color: pal.dim, fontFamily: 'monospace', fontStyle: 'bold'
    });
    this.quakeText = this.add.text(240, 178, '●○○', {
      fontSize: '20px', color: pal.warn, fontFamily: 'monospace', fontStyle: 'bold'
    });
    this.add.text(240, 230, 'OK quake', {
      fontSize: '12px', color: pal.dim, fontFamily: 'monospace'
    });
    this.add.text(240, 248, 'clears', {
      fontSize: '12px', color: pal.dim, fontFamily: 'monospace'
    });
    this.add.text(240, 264, 'recharge', {
      fontSize: '12px', color: pal.dim, fontFamily: 'monospace'
    });

    bindPhoneInput(this, {
      left: () => { if (this.alive) this.tryMove(-1, 0); },
      right: () => { if (this.alive) this.tryMove(1, 0); },
      up: () => { if (this.alive) this.rotate(); },
      down: () => { if (this.alive) this.softDrop(); },
      ok: () => this.onAction(),
      softLeft: () => this.onAction(),
      softRight: () => this.scene.start('MenuScene'),
      back: () => this.scene.start('MenuScene')
    });
    setSoftKeys('Quake', 'Menu');

    window.__vpg = window.__vpg || {};
    window.__vpg.blocks = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (window.__vpg && window.__vpg.blocks === this) delete window.__vpg.blocks;
    });

    this.spawn(this.takeNext());
    this.pauseCtl = attachPause(this);
    this.draw();
  }

  fallInterval() {
    return Math.max(90, 800 - (this.level - 1) * 70);
  }

  takeBag() {
    if (!this.bag.length) {
      this.bag = TYPES.slice();
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.bag.pop();
  }

  takeNext() {
    const t = this.nextType;
    this.nextType = this.takeBag();
    return t;
  }

  spawn(type) {
    this.piece = { type, r: 0, x: 3, y: 0 };
    this.locking = false;
    this.lockTimer = 0;
    if (this.collides(this.piece)) {
      this.gameOver('Stack topped out');
      return false;
    }
    return true;
  }

  cellsOf(p) {
    return SHAPES[p.type][p.r].map(([x, y]) => [p.x + x, p.y + y]);
  }

  collides(p, grid = this.grid) {
    for (const [x, y] of this.cellsOf(p)) {
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && grid[y][x]) return true;
    }
    return false;
  }

  tryMove(dx, dy) {
    if (!this.alive || !this.piece) return false;
    const next = { ...this.piece, x: this.piece.x + dx, y: this.piece.y + dy };
    if (this.collides(next)) return false;
    this.piece = next;
    this.locking = false;
    this.lockTimer = 0;
    if (dx !== 0) Sfx.blocksMove();
    return true;
  }

  rotate() {
    if (!this.alive || !this.piece) return false;
    const nextR = (this.piece.r + 1) % 4;
    for (const [kx, ky] of KICKS) {
      const next = { ...this.piece, r: nextR, x: this.piece.x + kx, y: this.piece.y + ky };
      if (!this.collides(next)) {
        this.piece = next;
        this.locking = false;
        this.lockTimer = 0;
        Sfx.blocksRotate();
        return true;
      }
    }
    return false;
  }

  softDrop() {
    if (this.tryMove(0, 1)) {
      this.score += 1;
      this.fallTimer = 0;
      return true;
    }
    return false;
  }

  lockPiece() {
    if (!this.piece) return;
    Sfx.blocksDrop();
    for (const [x, y] of this.cellsOf(this.piece)) {
      if (y < 0) {
        this.gameOver('Stack topped out');
        return;
      }
      this.grid[y][x] = this.piece.type;
    }
    this.piece = null;
    const cleared = this.clearLines();
    this.lastCleared = cleared;
    if (this.alive) this.spawn(this.takeNext());
  }

  /**
   * Clear full rows. Returns the number of lines removed. Also awards
   * score, level, and Quake charges (one per line, capped).
   */
  clearLines() {
    const remaining = [];
    let cleared = 0;
    for (let y = 0; y < ROWS; y++) {
      if (this.grid[y].every((c) => c)) {
        cleared += 1;
      } else {
        remaining.push(this.grid[y]);
      }
    }
    while (remaining.length < ROWS) remaining.unshift(Array(COLS).fill(null));
    this.grid = remaining;
    if (cleared > 0) {
      const table = [0, 100, 300, 500, 800];
      const prevLevel = this.level;
      this.score += (table[cleared] || 800) * this.level;
      this.lines += cleared;
      this.level = 1 + Math.floor(this.lines / LINES_PER_LEVEL);
      this.quakeCharges = Math.min(MAX_QUAKE, this.quakeCharges + cleared);
      this.floatText(WELL_X + WELL_W / 2, WELL_Y + 40, cleared === 4 ? 'QUAD!' : `${cleared} LINE${cleared > 1 ? 'S' : ''}`, this.pal.css.warn);
      this.cameras.main.shake(60, 0.003);
      Sfx.blocksLine(cleared);
      if (this.level > prevLevel) Sfx.blocksLevelUp();
    }
    return cleared;
  }

  /**
   * Quake: each column's blocks settle downward, closing floating gaps.
   * Newly completed rows then clear (and can recharge a charge).
   */
  quake() {
    if (!this.alive) return { settled: 0, cleared: 0 };
    if (this.quakeCharges <= 0) {
      this.floatText(WELL_X + WELL_W / 2, WELL_Y + 80, 'No charge', this.pal.css.dim);
      return { settled: 0, cleared: 0 };
    }
    this.quakeCharges -= 1;
    let settled = 0;
    for (let x = 0; x < COLS; x++) {
      const stack = [];
      for (let y = 0; y < ROWS; y++) {
        if (this.grid[y][x]) stack.push(this.grid[y][x]);
      }
      const start = ROWS - stack.length;
      // Count how many blocks actually fall
      let i = 0;
      for (let y = 0; y < ROWS; y++) {
        if (this.grid[y][x]) {
          if (y !== start + i) settled += 1;
          i += 1;
        }
      }
      for (let y = 0; y < ROWS; y++) this.grid[y][x] = null;
      stack.forEach((t, i2) => { this.grid[start + i2][x] = t; });
    }
    this.cameras.main.shake(180, 0.01);
    this.floatText(WELL_X + WELL_W / 2, WELL_Y + 30, 'QUAKE!', this.pal.css.warn);
    Sfx.blocksQuake();
    const cleared = this.clearLines();
    return { settled, cleared };
  }

  onAction() {
    if (!this.alive) {
      if (this.canRestart) this.scene.restart();
      return;
    }
    this.quake();
  }

  // ---- Loop -------------------------------------------------------------
  update(_time, delta) {
    if (isFrozen(this)) return;
    if (!this.alive || !this.piece) {
      this.draw();
      return;
    }

    // DAS left / right
    const left = isHeld('left');
    const right = isHeld('right');
    if (left !== right) {
      const dir = left ? -1 : 1;
      if (this.holdDir !== dir) {
        this.holdDir = dir;
        this.holdTime = 0;
        this.shiftAccum = 0;
        // the press handler already moved once
      } else {
        this.holdTime += delta;
        if (this.holdTime >= DAS_DELAY) {
          this.shiftAccum += delta;
          while (this.shiftAccum >= DAS_REPEAT) {
            this.shiftAccum -= DAS_REPEAT;
            this.tryMove(dir, 0);
          }
        }
      }
    } else {
      this.holdDir = 0;
      this.holdTime = 0;
      this.shiftAccum = 0;
    }

    // Soft drop hold-to-repeat
    if (isHeld('down')) {
      this.softAccum += delta;
      while (this.softAccum >= SOFT_REPEAT) {
        this.softAccum -= SOFT_REPEAT;
        this.softDrop();
      }
    } else {
      this.softAccum = 0;
    }

    // Gravity
    this.fallTimer += delta;
    const interval = this.fallInterval();
    while (this.fallTimer >= interval && this.alive && this.piece) {
      this.fallTimer -= interval;
      if (!this.tryMove(0, 1)) {
        this.locking = true;
      }
    }

    if (this.locking && this.piece) {
      this.lockTimer += delta;
      if (this.lockTimer >= LOCK_MS) this.lockPiece();
    }

    this.updateQuakeButton();
    this.scoreText.setText(`Score: ${this.score}`);
    this.metaText.setText(`Lv ${this.level}  Lines ${this.lines}`);
    this.quakeText.setText(`${'●'.repeat(this.quakeCharges)}${'○'.repeat(MAX_QUAKE - this.quakeCharges)}`);
    this.draw();
  }

  updateQuakeButton() {
    const label = this.quakeCharges > 0 ? `Quake ${this.quakeCharges}` : 'Quake -';
    if (label !== this.quakeLabel) {
      this.quakeLabel = label;
      setSoftKeys(label, 'Menu');
    }
  }

  floatText(x, y, msg, color) {
    const t = this.add.text(x, y, msg, {
      fontSize: '14px', color, fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.tweens.add({
      targets: t, y: t.y - 24, alpha: 0, duration: 700,
      onComplete: () => t.destroy()
    });
  }

  // ---- Rendering --------------------------------------------------------
  draw() {
    const g = this.graphics;
    const pal = this.pal;
    g.clear();

    // Well background + grid
    g.fillStyle(pal.well, 1);
    g.fillRect(WELL_X, WELL_Y, WELL_W, WELL_H);
    g.lineStyle(1, pal.grid, 0.4);
    for (let x = 0; x <= COLS; x++) {
      g.lineBetween(WELL_X + x * CELL, WELL_Y, WELL_X + x * CELL, WELL_Y + WELL_H);
    }
    for (let y = 0; y <= ROWS; y++) {
      g.lineBetween(WELL_X, WELL_Y + y * CELL, WELL_X + WELL_W, WELL_Y + y * CELL);
    }
    g.lineStyle(2, pal.fg, 0.85);
    g.strokeRect(WELL_X - 1, WELL_Y - 1, WELL_W + 2, WELL_H + 2);

    // Locked blocks
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = this.grid[y][x];
        if (t) this.drawCell(g, WELL_X + x * CELL, WELL_Y + y * CELL, pal.piece[t]);
      }
    }

    // Ghost
    if (this.piece) {
      const ghost = { ...this.piece };
      while (!this.collides({ ...ghost, y: ghost.y + 1 })) ghost.y += 1;
      for (const [x, y] of this.cellsOf(ghost)) {
        if (y < 0) continue;
        this.drawCell(g, WELL_X + x * CELL, WELL_Y + y * CELL, pal.piece[this.piece.type], 0.22);
      }
      for (const [x, y] of this.cellsOf(this.piece)) {
        if (y < 0) continue;
        this.drawCell(g, WELL_X + x * CELL, WELL_Y + y * CELL, pal.piece[this.piece.type]);
      }
    }

    // Next preview box
    const boxX = 236;
    const boxY = 66;
    g.fillStyle(pal.panel, 1);
    g.fillRect(boxX, boxY, 108, 80);
    g.lineStyle(1, pal.dim, 0.8);
    g.strokeRect(boxX, boxY, 108, 80);
    if (this.nextType) {
      const cells = SHAPES[this.nextType][0];
      const minX = Math.min(...cells.map((c) => c[0]));
      const maxX = Math.max(...cells.map((c) => c[0]));
      const minY = Math.min(...cells.map((c) => c[1]));
      const maxY = Math.max(...cells.map((c) => c[1]));
      const pw = (maxX - minX + 1) * 16;
      const ph = (maxY - minY + 1) * 16;
      const ox = boxX + (108 - pw) / 2 - minX * 16;
      const oy = boxY + (80 - ph) / 2 - minY * 16;
      for (const [x, y] of cells) {
        this.drawCell(g, ox + x * 16, oy + y * 16, pal.piece[this.nextType], 1, 16);
      }
    }
  }

  drawCell(g, x, y, color, alpha = 1, size = CELL) {
    g.fillStyle(color, alpha);
    g.fillRect(x + 1, y + 1, size - 2, size - 2);
    if (alpha > 0.5) {
      g.fillStyle(0xffffff, 0.22 * alpha);
      g.fillRect(x + 1, y + 1, size - 2, 3);
    }
  }

  // ---- Test helpers -----------------------------------------------------
  getGrid() {
    return this.grid.map((row) => row.map((c) => c || ''));
  }

  debugSetGrid(rows) {
    this.grid = Array.from({ length: ROWS }, (_, y) => (
      Array.from({ length: COLS }, (_, x) => (rows[y] && rows[y][x] ? rows[y][x] : null))
    ));
  }

  // ---- Game over --------------------------------------------------------
  gameOver(reason) {
    if (!this.alive) return;
    this.alive = false;
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
    const unlockMsg = formatUnlockLine(addScore('blocks', this.score));
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
      this.input.on('pointerdown', () => this.scene.restart());
    });
  }
}
