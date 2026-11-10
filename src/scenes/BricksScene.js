import Phaser from 'phaser';
import { bindPhoneInput, isHeld, setSoftKeys } from '../input/PhoneInput.js';
import { attachPause, isFrozen, gameNow } from '../ui/PauseOverlay.js';
import { hexToInt, shadeHex } from '../skins/skins.js';
import { getSkin } from '../skins/SkinManager.js';
import { addScore, formatUnlockLine } from '../progress/Progress.js';

const W = 360;
const H = 480;
const HUD_H = 28;
const BEST_KEY = 'vpg.bricks.best';

const PADDLE_W = 70;
const PADDLE_H = 10;
const PADDLE_Y = 452;
const PADDLE_SPEED = 340;
const BALL_R = 5.5;
const START_SPEED = 250;
const MAX_SPEED = 460;
const NUDGE_COOLDOWN = 1400;
const NUDGE_WINDOW = 2200;
const NUDGE_BOOST = 1.28;
const NUDGE_SPIN = 160;
const LIVES = 3;

const COLS = 9;
const BRICK_W = 36;
const BRICK_H = 14;
const BRICK_GAP = 3;
const GRID_LEFT = (W - (COLS * BRICK_W + (COLS - 1) * BRICK_GAP)) / 2;
const GRID_TOP = 48;

export default class BricksScene extends Phaser.Scene {
  constructor() {
    super('BricksScene');
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
      brickA: shadeHex(pal.fg, 0.85),
      brickB: shadeHex(pal.accent, 1),
      brickC: shadeHex(pal.text, 0.7),
      css: pal
    };

    this.score = 0;
    this.best = Number(localStorage.getItem(BEST_KEY) || 0);
    this.lives = LIVES;
    this.level = 1;
    this.alive = true;
    this.canRestart = false;
    this.serving = true;
    this.nudgeReadyAt = 0;
    this.nudgeArmedUntil = 0;
    this.nudgeLabel = '';
    this.flashes = [];
    this.paddleX = W / 2;
    this.ball = { x: W / 2, y: PADDLE_Y - BALL_R - PADDLE_H / 2, vx: 0, vy: 0 };

    this.bricks = [];
    this.loadLevel(this.level);

    this.cameras.main.setBackgroundColor(this.pal.bg);
    this.graphics = this.add.graphics();

    this.scoreText = this.add.text(8, 4, 'Score: 0', {
      fontSize: '15px', color: pal.fg, fontFamily: 'monospace'
    });
    this.bestText = this.add.text(352, 4, `Best: ${this.best}`, {
      fontSize: '15px', color: pal.accent, fontFamily: 'monospace'
    }).setOrigin(1, 0);
    this.livesText = this.add.text(8, 22, this.livesStr(), {
      fontSize: '13px', color: pal.warn, fontFamily: 'monospace'
    });
    this.levelText = this.add.text(352, 22, 'Lv 1', {
      fontSize: '13px', color: pal.accent, fontFamily: 'monospace'
    }).setOrigin(1, 0);

    bindPhoneInput(this, {
      ok: () => this.onAction(),
      softLeft: () => this.onAction(),
      softRight: () => this.scene.start('MenuScene'),
      back: () => this.scene.start('MenuScene')
    });
    setSoftKeys('Nudge', 'Menu');

    this.hook = 'bricks';
    window.__vpg = window.__vpg || {};
    window.__vpg.bricks = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (window.__vpg && window.__vpg.bricks === this) delete window.__vpg.bricks;
    });

    this.pauseCtl = attachPause(this);
    this.draw();
  }

  livesStr() {
    return `Lives ${this.lives}/${LIVES}`;
  }

  onAction() {
    if (!this.alive) {
      if (this.canRestart) this.scene.restart();
      return;
    }
    if (this.serving) this.serve();
    else this.armNudge();
  }

  serve() {
    if (!this.serving || !this.alive) return;
    this.serving = false;
    const dir = Phaser.Math.Between(0, 1) ? 1 : -1;
    const speed = START_SPEED + (this.level - 1) * 16;
    const angle = Phaser.Math.DegToRad(-70 + dir * Phaser.Math.Between(8, 22));
    this.ball.vx = Math.cos(angle) * speed * (dir);
    // Launch upward regardless of the sideways sign
    this.ball.vy = -Math.abs(Math.sin(angle) * speed);
    if (Math.abs(this.ball.vy) < 180) this.ball.vy = -200;
  }

  armNudge() {
    const now = gameNow(this);
    if (now < this.nudgeReadyAt) {
      this.floatText(this.paddleX, PADDLE_Y - 18, 'Wait', this.pal.css.dim);
      return;
    }
    this.nudgeArmedUntil = now + NUDGE_WINDOW;
    this.nudgeReadyAt = now + NUDGE_COOLDOWN;
    this.floatText(this.paddleX, PADDLE_Y - 18, 'NUDGE', this.pal.css.warn);
  }

  // ---- Level layouts ----------------------------------------------------
  loadLevel(level) {
    this.bricks = [];
    const layout = this.layoutFor(level);
    layout.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (!cell) return;
        this.bricks.push({
          c, r,
          x: GRID_LEFT + c * (BRICK_W + BRICK_GAP),
          y: GRID_TOP + r * (BRICK_H + BRICK_GAP),
          w: BRICK_W,
          h: BRICK_H,
          type: cell === 9 || cell === 'X' ? 'explosive' : 'normal',
          tone: typeof cell === 'number' && cell !== 9 ? cell : ((r + c) % 3) + 1,
          alive: true
        });
      });
    });
  }

  layoutFor(level) {
    const n = ((level - 1) % 5) + 1;
    const X = 9;
    if (n === 1) {
      return [
        [1, 1, 1, 1, X, 1, 1, 1, 1],
        [2, 2, 2, 2, 2, 2, 2, 2, 2],
        [3, 3, 3, X, 3, X, 3, 3, 3],
        [1, 1, 1, 1, 1, 1, 1, 1, 1]
      ];
    }
    if (n === 2) {
      return [
        [0, 0, 0, 1, X, 1, 0, 0, 0],
        [0, 0, 2, 2, 2, 2, 2, 0, 0],
        [0, 3, 3, 3, X, 3, 3, 3, 0],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [0, 2, 2, X, 2, X, 2, 2, 0]
      ];
    }
    if (n === 3) {
      return [
        [X, 1, 1, 0, 0, 0, 1, 1, X],
        [1, 2, 2, 2, 0, 2, 2, 2, 1],
        [1, 2, X, 2, 0, 2, X, 2, 1],
        [1, 3, 3, 3, 0, 3, 3, 3, 1],
        [X, 1, 1, 0, 0, 0, 1, 1, X]
      ];
    }
    if (n === 4) {
      return [
        [1, X, 1, X, 1, X, 1, X, 1],
        [2, 2, 2, 2, 2, 2, 2, 2, 2],
        [X, 3, X, 3, X, 3, X, 3, X],
        [1, 1, 1, 1, 1, 1, 1, 1, 1],
        [2, X, 2, X, 2, X, 2, X, 2]
      ];
    }
    return [
      [1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, X, 2, 2, X, 2, 2, X, 1],
      [1, 2, 3, 3, 3, 3, 3, 2, 1],
      [1, 2, 3, X, 3, X, 3, 2, 1],
      [1, 2, 3, 3, 3, 3, 3, 2, 1],
      [1, X, 2, 2, X, 2, 2, X, 1]
    ];
  }

  // ---- Loop -------------------------------------------------------------
  update(_time, delta) {
    if (isFrozen(this) || !this.alive) return;
    const dt = Math.min(delta, 50) / 1000;

    let vx = 0;
    if (isHeld('left')) vx -= PADDLE_SPEED;
    if (isHeld('right')) vx += PADDLE_SPEED;
    this.paddleX = Phaser.Math.Clamp(this.paddleX + vx * dt, PADDLE_W / 2 + 2, W - PADDLE_W / 2 - 2);

    if (this.serving) {
      this.ball.x = this.paddleX;
      this.ball.y = PADDLE_Y - PADDLE_H / 2 - BALL_R - 1;
    } else {
      this.stepBall(dt);
    }

    this.updateNudgeButton();
    this.scoreText.setText(`Score: ${this.score}`);
    this.livesText.setText(this.livesStr());
    this.levelText.setText(`Lv ${this.level}`);
    this.draw();
  }

  stepBall(dt) {
    // Sub-step so we don't tunnel through bricks at high speed
    const speed = Math.hypot(this.ball.vx, this.ball.vy);
    const steps = Math.max(1, Math.ceil(speed * dt / 3));
    const sdt = dt / steps;
    for (let i = 0; i < steps && this.alive && !this.serving; i++) {
      this.ball.x += this.ball.vx * sdt;
      this.ball.y += this.ball.vy * sdt;
      this.bounceWalls();
      if (!this.alive) return;
      this.bouncePaddle();
      if (this.serving) return;
      this.bounceBricks();
    }
  }

  bounceWalls() {
    if (this.ball.x - BALL_R < 0) {
      this.ball.x = BALL_R;
      this.ball.vx = Math.abs(this.ball.vx);
    } else if (this.ball.x + BALL_R > W) {
      this.ball.x = W - BALL_R;
      this.ball.vx = -Math.abs(this.ball.vx);
    }
    if (this.ball.y - BALL_R < HUD_H) {
      this.ball.y = HUD_H + BALL_R;
      this.ball.vy = Math.abs(this.ball.vy);
    }
    if (this.ball.y - BALL_R > H + 8) {
      this.loseLife();
    }
  }

  bouncePaddle() {
    const px = this.paddleX - PADDLE_W / 2;
    const py = PADDLE_Y - PADDLE_H / 2;
    if (!this.circleRect(this.ball.x, this.ball.y, BALL_R, px, py, PADDLE_W, PADDLE_H)) return;
    if (this.ball.vy < 0) return; // already heading up

    this.ball.y = py - BALL_R - 0.5;
    const offset = (this.ball.x - this.paddleX) / (PADDLE_W / 2);
    const clamped = Phaser.Math.Clamp(offset, -1, 1);
    let speed = Math.max(START_SPEED, Math.hypot(this.ball.vx, this.ball.vy));

    const now = gameNow(this);
    const nudged = now < this.nudgeArmedUntil;
    if (nudged) {
      this.nudgeArmedUntil = 0;
      speed = Math.min(MAX_SPEED, speed * NUDGE_BOOST + 40);
      this.floatText(this.ball.x, this.ball.y - 16, 'KICK!', this.pal.css.warn);
      this.cameras.main.shake(50, 0.003);
    }

    const angle = (-0.35 + clamped * 0.85) * Math.PI; // mostly upward, angled by hit
    // Map offset to angle between ~-150 and -30 deg
    const theta = Phaser.Math.DegToRad(-90 + clamped * 55);
    this.ball.vx = Math.cos(theta) * speed + (nudged ? clamped * NUDGE_SPIN : 0);
    this.ball.vy = -Math.abs(Math.sin(theta) * speed);
    if (Math.abs(this.ball.vy) < 160) this.ball.vy = -160;
    const cap = nudged ? MAX_SPEED : MAX_SPEED - 20;
    this.clampSpeed(cap);
    void angle;
  }

  bounceBricks() {
    for (const b of this.bricks) {
      if (!b.alive) continue;
      if (this.circleRect(this.ball.x, this.ball.y, BALL_R, b.x, b.y, b.w, b.h)) {
        this.resolveBrickBounce(b);
        this.hitBrick(b);
        return;
      }
    }
  }

  resolveBrickBounce(b) {
    const cx = Phaser.Math.Clamp(this.ball.x, b.x, b.x + b.w);
    const cy = Phaser.Math.Clamp(this.ball.y, b.y, b.y + b.h);
    const dx = this.ball.x - cx;
    const dy = this.ball.y - cy;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.ball.vx = dx >= 0 ? Math.abs(this.ball.vx) : -Math.abs(this.ball.vx);
      this.ball.x = dx >= 0 ? b.x + b.w + BALL_R : b.x - BALL_R;
    } else {
      this.ball.vy = dy >= 0 ? Math.abs(this.ball.vy) : -Math.abs(this.ball.vy);
      this.ball.y = dy >= 0 ? b.y + b.h + BALL_R : b.y - BALL_R;
    }
  }

  /**
   * Hit a brick as if the ball struck it. Explosive bricks start a chain
   * that removes neighbours in a radius (and any explosives among them).
   * Returns the list of bricks removed. Used by gameplay and tests.
   */
  hitBrick(brick) {
    if (!brick || !brick.alive) return [];
    const removed = [];
    if (brick.type === 'explosive') {
      const chain = this.explode(brick);
      removed.push(...chain);
      const n = chain.length;
      const gained = chain.reduce((s, _, i) => s + 10 * (i + 1), 0);
      this.score += gained;
      this.floatText(brick.x + brick.w / 2, brick.y, n > 1 ? `CHAIN x${n} +${gained}` : `+${gained}`, this.pal.css.warn);
      this.cameras.main.shake(80 + Math.min(120, n * 20), 0.004 + n * 0.001);
    } else {
      brick.alive = false;
      removed.push(brick);
      this.score += 10;
      this.flashBrick(brick, this.pal.fg, 180);
    }
    this.checkCleared();
    return removed;
  }

  /**
   * Blow up `start` and every brick whose centre is within radius of any
   * exploding brick (chain reaction). Radius covers a brick plus its
   * 8 neighbours.
   */
  explode(start) {
    const radius = Math.hypot(BRICK_W + BRICK_GAP, BRICK_H + BRICK_GAP) * 1.05;
    const queue = [start];
    const seen = new Set([start]);
    const removed = [];

    while (queue.length) {
      const b = queue.shift();
      if (!b.alive && b !== start) continue;
      b.alive = false;
      removed.push(b);
      this.flashBrick(b, b.type === 'explosive' ? this.pal.danger : this.pal.warn, 280);

      if (b.type !== 'explosive' && b !== start) continue;
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      for (const other of this.bricks) {
        if (!other.alive || seen.has(other)) continue;
        const ox = other.x + other.w / 2;
        const oy = other.y + other.h / 2;
        if (Math.hypot(ox - cx, oy - cy) <= radius + 0.5) {
          seen.add(other);
          // Non-explosives are removed; explosives continue the chain
          queue.push(other);
        }
      }
    }
    return removed;
  }

  flashBrick(b, color, ms) {
    this.flashes.push({ x: b.x, y: b.y, w: b.w, h: b.h, color, until: gameNow(this) + ms });
  }

  checkCleared() {
    if (this.bricks.some((b) => b.alive)) return;
    this.level += 1;
    this.floatText(W / 2, H / 2, `LEVEL ${this.level}`, this.pal.css.fg);
    this.loadLevel(this.level);
    this.resetBall();
  }

  loseLife() {
    this.lives -= 1;
    this.cameras.main.shake(140, 0.008);
    if (this.lives <= 0) {
      this.gameOver('No lives left');
      return;
    }
    this.resetBall();
  }

  resetBall() {
    this.serving = true;
    this.nudgeArmedUntil = 0;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.x = this.paddleX;
    this.ball.y = PADDLE_Y - PADDLE_H / 2 - BALL_R - 1;
  }

  clampSpeed(max) {
    const s = Math.hypot(this.ball.vx, this.ball.vy);
    if (s > max) {
      this.ball.vx *= max / s;
      this.ball.vy *= max / s;
    }
  }

  circleRect(cx, cy, r, x, y, w, h) {
    const nx = Phaser.Math.Clamp(cx, x, x + w);
    const ny = Phaser.Math.Clamp(cy, y, y + h);
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy <= r * r;
  }

  updateNudgeButton() {
    let label = 'Nudge';
    if (this.serving) label = 'Serve';
    else {
      const left = this.nudgeReadyAt - gameNow(this);
      if (left > 0) label = `Nudge ${Math.ceil(left / 1000)}`;
      else if (gameNow(this) < this.nudgeArmedUntil) label = 'Armed';
    }
    if (label !== this.nudgeLabel) {
      this.nudgeLabel = label;
      setSoftKeys(label, 'Menu');
    }
  }

  floatText(x, y, msg, color) {
    const t = this.add.text(x, y, msg, {
      fontSize: '14px', color, fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.tweens.add({
      targets: t, y: t.y - 26, alpha: 0, duration: 700,
      onComplete: () => t.destroy()
    });
  }

  // ---- Rendering --------------------------------------------------------
  draw() {
    const g = this.graphics;
    const pal = this.pal;
    const now = gameNow(this);
    g.clear();

    g.fillStyle(pal.bg, 1);
    g.fillRect(0, HUD_H, W, H - HUD_H);

    // Bricks
    const tones = [pal.brickA, pal.brickB, pal.brickC];
    for (const b of this.bricks) {
      if (!b.alive) continue;
      if (b.type === 'explosive') {
        const pulse = 0.7 + 0.3 * Math.sin(now / 140);
        g.fillStyle(pal.danger, pulse);
        g.fillRect(b.x, b.y, b.w, b.h);
        g.lineStyle(1, pal.warn, 1);
        g.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
        // Star / fuse mark
        g.fillStyle(pal.warn, 1);
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        g.fillCircle(cx, cy, 2.4);
        g.lineStyle(1.5, pal.warn, 1);
        g.lineBetween(cx - 5, cy, cx + 5, cy);
        g.lineBetween(cx, cy - 4, cx, cy + 4);
      } else {
        g.fillStyle(tones[(b.tone - 1) % tones.length], 1);
        g.fillRect(b.x, b.y, b.w, b.h);
        g.fillStyle(0xffffff, 0.18);
        g.fillRect(b.x, b.y, b.w, 3);
      }
    }

    // Explosion flashes
    this.flashes = this.flashes.filter((f) => f.until > now);
    for (const f of this.flashes) {
      const a = Math.max(0, (f.until - now) / 280);
      g.fillStyle(f.color, 0.35 + 0.5 * a);
      g.fillRect(f.x - 2, f.y - 2, f.w + 4, f.h + 4);
    }

    // Paddle
    const px = this.paddleX - PADDLE_W / 2;
    const py = PADDLE_Y - PADDLE_H / 2;
    const armed = now < this.nudgeArmedUntil;
    g.fillStyle(armed ? pal.warn : pal.fg, 1);
    g.fillRect(px, py, PADDLE_W, PADDLE_H);
    g.fillStyle(0xffffff, 0.25);
    g.fillRect(px, py, PADDLE_W, 3);

    // Ball
    g.fillStyle(pal.text, 1);
    g.fillCircle(this.ball.x, this.ball.y, BALL_R);
    if (this.serving) {
      // Aim arrow
      g.lineStyle(2, pal.accent, 0.8);
      g.lineBetween(this.ball.x, this.ball.y - BALL_R - 2, this.ball.x, this.ball.y - 18);
    }
  }

  // ---- Test helpers -----------------------------------------------------
  getBrickState() {
    return this.bricks.map((b) => ({
      c: b.c, r: b.r, type: b.type, alive: b.alive, x: b.x, y: b.y
    }));
  }

  debugHit(c, r) {
    const b = this.bricks.find((x) => x.c === c && x.r === r);
    return b ? this.hitBrick(b) : [];
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
    const unlockMsg = formatUnlockLine(addScore('bricks', this.score));

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
