import Phaser from 'phaser';
import { bindPhoneInput, setSoftKeys } from '../input/PhoneInput.js';
import { hexToInt, shadeHex } from '../skins/skins.js';
import { getSkin } from '../skins/SkinManager.js';

// ---- Tuning -------------------------------------------------------------
const GRID = 20;            // cell size in px
const COLS = 18;            // 18 * 20 = 360px (full width)
const TOP = 1;              // first playable row (row 0 is the score bar)
const ROWS = 24;            // rows 1..23 are playable (20px..480px)

const GLOW_MS = 2500;       // trail is safe (glowing) for this long...
const SOLID_MS = 6000;      // ...then a solid wall for this long, then crumbles
const SHED_COUNT = 3;       // segments dropped by a shed
const SHED_MIN_LEN = 5;     // need at least this many segments to shed
const SHED_COOLDOWN = 5000; // ms between sheds
const SHED_GRACE = 300;     // shed segments harden almost instantly

const START_INTERVAL = 160; // ms per step at start
const MIN_INTERVAL = 70;    // fastest speed
const BEST_KEY = 'vpg.snake.best';

const key = (c) => `${c.x},${c.y}`;

export default class SnakeScene extends Phaser.Scene {
  constructor() {
    super('SnakeScene');
  }

  create() {
    const pal = getSkin().palette;
    this.pal = {
      bg: hexToInt(pal.bg),
      fg: hexToInt(pal.fg),
      body: shadeHex(pal.fg, 0.72),
      dim: hexToInt(pal.dim),
      accent: hexToInt(pal.accent),
      warn: hexToInt(pal.warn),
      danger: hexToInt(pal.danger),
      text: hexToInt(pal.text),
      panel: hexToInt(pal.panel),
      solidOuter: shadeHex(pal.accent, 0.9),
      solidInner: shadeHex(pal.dim, 0.7),
      css: pal
    };

    this.snake = [{ x: 9, y: 12 }, { x: 8, y: 12 }, { x: 7, y: 12 }];
    this.direction = { x: 1, y: 0 };
    this.dirQueue = [];
    this.trail = new Map();     // "x,y" -> { x, y, born }
    this.score = 0;
    this.best = Number(localStorage.getItem(BEST_KEY) || 0);
    this.alive = true;
    this.canRestart = false;
    this.moveTimer = 0;
    this.moveInterval = START_INTERVAL;
    this.shedReadyAt = 0;
    this.food = this.spawnFood();

    this.cameras.main.setBackgroundColor(this.pal.bg);
    this.graphics = this.add.graphics();

    // ---- HUD ----
    this.scoreText = this.add.text(8, 0, 'Score: 0', {
      fontSize: '18px', color: pal.fg, fontFamily: 'monospace'
    });
    this.bestText = this.add.text(352, 0, `Best: ${this.best}`, {
      fontSize: '18px', color: pal.accent, fontFamily: 'monospace'
    }).setOrigin(1, 0);

    // ---- Phone keypad + keyboard (arrows/WASD, keypad 2/4/6/8, OK/5 or left soft key = shed) ----
    this.shedLabel = '';
    bindPhoneInput(this, {
      up: () => this.queueDirection(0, -1),
      down: () => this.queueDirection(0, 1),
      left: () => this.queueDirection(-1, 0),
      right: () => this.queueDirection(1, 0),
      ok: () => this.onAction(),
      softLeft: () => this.onAction(),
      softRight: () => this.scene.start('MenuScene'),
      back: () => this.scene.start('MenuScene')
    });
    setSoftKeys('Shed', 'Menu');

    // ---- Touch: swipe anywhere on the board, or tap to turn toward the tap ----
    this.input.on('pointerdown', (p) => {
      this.swipeStart = { x: p.x, y: p.y };
    });
    this.input.on('pointerup', (p) => {
      if (!this.alive || !this.swipeStart) return;
      const dx = p.x - this.swipeStart.x;
      const dy = p.y - this.swipeStart.y;
      this.swipeStart = null;

      if (Math.hypot(dx, dy) >= 15) {
        // Swipe
        if (Math.abs(dx) > Math.abs(dy)) this.queueDirection(Math.sign(dx), 0);
        else this.queueDirection(0, Math.sign(dy));
      } else {
        // Tap: turn perpendicular, toward the side of the head you tapped
        const last = this.lastQueuedDirection();
        const head = this.snake[0];
        const hx = head.x * GRID + GRID / 2;
        const hy = head.y * GRID + GRID / 2;
        if (last.x !== 0) this.queueDirection(0, p.y < hy ? -1 : 1);
        else this.queueDirection(p.x < hx ? -1 : 1, 0);
      }
    });

    this.draw();
  }

  // OK / 5 / left soft key: shed while playing, restart after game over
  onAction() {
    if (this.alive) this.shed();
    else if (this.canRestart) this.scene.restart();
  }

  // ---- Input helpers ------------------------------------------------------
  lastQueuedDirection() {
    return this.dirQueue.length ? this.dirQueue[this.dirQueue.length - 1] : this.direction;
  }

  queueDirection(x, y) {
    if (!this.alive) return;
    const last = this.lastQueuedDirection();
    if (last.x === x && last.y === y) return;     // same direction
    if (last.x === -x && last.y === -y) return;   // no instant reversal
    if (this.dirQueue.length < 3) this.dirQueue.push({ x, y });
  }

  // ---- Game loop ----------------------------------------------------------
  update(time, delta) {
    if (!this.alive) return;

    this.moveTimer += delta;
    while (this.moveTimer >= this.moveInterval && this.alive) {
      this.moveTimer -= this.moveInterval;
      this.moveSnake();
    }

    this.cleanTrail();
    this.updateShedButton();
    this.draw();
  }

  isSolid(cell, now) {
    return now - cell.born >= GLOW_MS;
  }

  solidCount(now) {
    let n = 0;
    this.trail.forEach((c) => { if (this.isSolid(c, now)) n++; });
    return n;
  }

  moveSnake() {
    const now = this.time.now;
    if (this.dirQueue.length) this.direction = this.dirQueue.shift();

    const head = {
      x: this.snake[0].x + this.direction.x,
      y: this.snake[0].y + this.direction.y
    };

    // Wrap around the board
    if (head.x < 0) head.x = COLS - 1;
    if (head.x >= COLS) head.x = 0;
    if (head.y < TOP) head.y = ROWS - 1;
    if (head.y >= ROWS) head.y = TOP;

    const willEat = head.x === this.food.x && head.y === this.food.y;

    // Self collision (the tail moves away this step unless we're eating)
    const body = willEat ? this.snake : this.snake.slice(0, -1);
    if (body.some((s) => s.x === head.x && s.y === head.y)) {
      this.gameOver('You bit yourself');
      return;
    }

    // Hardened trail collision (glowing trail is safe to cross)
    const t = this.trail.get(key(head));
    if (t && this.isSolid(t, now)) {
      this.gameOver('Hit your hardened trail');
      return;
    }

    this.snake.unshift(head);

    if (willEat) {
      // Risk bonus: +1 for every solid wall on the board right now
      const bonus = this.solidCount(now);
      const gain = 10 + bonus;
      this.score += gain;
      this.scoreText.setText(`Score: ${this.score}`);
      this.floatText(head, bonus > 0 ? `+${gain}!` : `+${gain}`, bonus > 0 ? this.pal.css.warn : this.pal.css.text);
      this.food = this.spawnFood();
      this.moveInterval = Math.max(MIN_INTERVAL, this.moveInterval - 3);
    } else {
      const tail = this.snake.pop();
      this.addTrail(tail, now);
    }
  }

  addTrail(cell, born) {
    if (this.snake.some((s) => s.x === cell.x && s.y === cell.y)) return;
    this.trail.set(key(cell), { x: cell.x, y: cell.y, born });
  }

  cleanTrail() {
    const now = this.time.now;
    this.trail.forEach((c, k) => {
      if (now - c.born >= GLOW_MS + SOLID_MS) this.trail.delete(k);
    });
  }

  // ---- Shed: drop your last segments as near-instant walls ----------------
  shed() {
    if (!this.alive) return;
    const now = this.time.now;
    const head = this.snake[0];

    if (now < this.shedReadyAt) {
      this.floatText(head, 'Recharging', this.pal.css.dim);
      return;
    }
    if (this.snake.length < SHED_MIN_LEN) {
      this.floatText(head, 'Too short', this.pal.css.dim);
      return;
    }

    const dropped = this.snake.splice(-SHED_COUNT);
    dropped.forEach((c) => this.addTrail(c, now - GLOW_MS + SHED_GRACE));
    this.shedReadyAt = now + SHED_COOLDOWN;
    this.cameras.main.shake(80, 0.004);
    this.floatText(head, 'SHED!', this.pal.css.accent);
  }

  updateShedButton() {
    const left = this.shedReadyAt - this.time.now;
    let label = 'Shed';
    if (left > 0) label = `Shed ${Math.ceil(left / 1000)}`;
    else if (this.snake.length < SHED_MIN_LEN) label = 'Shed -';
    if (label !== this.shedLabel) {
      this.shedLabel = label;
      setSoftKeys(label, 'Menu');
    }
  }

  // ---- Spawning & effects -------------------------------------------------
  spawnFood() {
    let pos;
    let attempts = 0;
    do {
      pos = {
        x: Phaser.Math.Between(0, COLS - 1),
        y: Phaser.Math.Between(TOP, ROWS - 1)
      };
      attempts++;
    } while (
      (this.snake.some((s) => s.x === pos.x && s.y === pos.y) || this.trail.has(key(pos))) &&
      attempts < 200
    );
    return pos;
  }

  floatText(cell, msg, color) {
    const t = this.add.text(cell.x * GRID + GRID / 2, cell.y * GRID - 4, msg, {
      fontSize: '16px', color, fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.tweens.add({
      targets: t, y: t.y - 30, alpha: 0, duration: 700,
      onComplete: () => t.destroy()
    });
  }

  // ---- Rendering ----------------------------------------------------------
  draw() {
    const g = this.graphics;
    const now = this.time.now;
    const pal = this.pal;
    g.clear();

    // Board
    g.fillStyle(pal.bg, 1);
    g.fillRect(0, TOP * GRID, COLS * GRID, (ROWS - TOP) * GRID);

    // Trail
    this.trail.forEach((c) => {
      const age = now - c.born;
      const px = c.x * GRID;
      const py = c.y * GRID;
      if (age < GLOW_MS) {
        // Glowing: pulses faster as it's about to harden
        const p = age / GLOW_MS;
        const pulse = 0.5 + 0.5 * Math.sin(now / (120 - 80 * p));
        g.fillStyle(pal.warn, 0.15 + 0.35 * p * pulse + 0.1);
        g.fillRect(px + 3, py + 3, GRID - 6, GRID - 6);
      } else {
        // Solid wall: fades out in its last second
        const remaining = GLOW_MS + SOLID_MS - age;
        const alpha = remaining < 1000 ? 0.3 + 0.7 * (remaining / 1000) : 1;
        g.fillStyle(pal.solidOuter, alpha);
        g.fillRect(px + 1, py + 1, GRID - 2, GRID - 2);
        g.fillStyle(pal.solidInner, alpha);
        g.fillRect(px + 4, py + 4, GRID - 8, GRID - 8);
      }
    });

    // Snake
    this.snake.forEach((s, i) => {
      g.fillStyle(i === 0 ? pal.fg : pal.body, 1);
      g.fillRect(s.x * GRID + 1, s.y * GRID + 1, GRID - 2, GRID - 2);
    });

    // Food (gentle pulse)
    const r = GRID / 2 - 3 + Math.sin(now / 150) * 1.5;
    g.fillStyle(pal.danger, 1);
    g.fillCircle(this.food.x * GRID + GRID / 2, this.food.y * GRID + GRID / 2, r);
  }

  // ---- Game over ----------------------------------------------------------
  gameOver(reason) {
    this.alive = false;
    setSoftKeys('Retry', 'Menu');
    this.cameras.main.shake(200, 0.01);
    const pal = this.pal;

    const newBest = this.score > this.best;
    if (newBest) {
      this.best = this.score;
      localStorage.setItem(BEST_KEY, String(this.best));
      this.bestText.setText(`Best: ${this.best}`);
    }

    this.add.rectangle(180, 270, 300, 220, 0x000000, 0.8).setStrokeStyle(2, pal.fg);
    const style = (size, color) => ({ fontSize: size, color, fontFamily: 'monospace', align: 'center' });
    this.add.text(180, 200, 'GAME OVER', style('34px', pal.css.danger)).setOrigin(0.5);
    this.add.text(180, 240, reason, style('15px', pal.css.accent)).setOrigin(0.5);
    this.add.text(180, 280, `Score: ${this.score}`, style('22px', pal.css.text)).setOrigin(0.5);
    this.add.text(180, 310, newBest ? 'NEW BEST!' : `Best: ${this.best}`,
      style('16px', newBest ? pal.css.warn : pal.css.accent)).setOrigin(0.5);
    this.add.text(180, 355, 'Tap or OK to retry', style('15px', pal.css.fg)).setOrigin(0.5);

    // Short delay so the swipe that killed you doesn't instantly restart
    this.time.delayedCall(400, () => {
      this.canRestart = true;
      this.input.on('pointerdown', () => this.scene.restart());
    });
  }
}
