import Phaser from 'phaser';
import { bindPhoneInput, isHeld, setSoftKeys } from '../input/PhoneInput.js';
import { attachPause, isFrozen, gameNow } from '../ui/PauseOverlay.js';
import { hexToInt, shadeHex } from '../skins/skins.js';
import { getSkin } from '../skins/SkinManager.js';
import { addScore, formatUnlockLine } from '../progress/Progress.js';
import * as Sfx from '../audio/Sfx.js';
import * as Music from '../audio/Music.js';
import { attachPerks, perkSpeed, perkPoints, perkLives, toughLives, hasLuck } from '../skins/perks.js';
import { onRunStart } from '../phone/Sms.js';

// ---- Tuning -------------------------------------------------------------
const W = 360;
const H = 480;
const HUD_H = 32;
const SHIP_W = 18;
const SHIP_H = 12;
const SHIP_SPEED = 190;
const ECHO_DELAY = 1200;
const FIRE_INTERVAL = 220;
const RAPID_INTERVAL = 90;
const BURST_DURATION = 3000;
const BURST_COOLDOWN = 8000;
const START_LIVES = 3;
const INVULN_MS = 1500;
const BULLET_SPEED = 330;
const BEST_KEY = 'vpg.impact.best';
const BOSS_EVERY = 1500;

export default class ImpactScene extends Phaser.Scene {
  constructor() {
    super('ImpactScene');
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
      body: shadeHex(pal.fg, 0.7),
      enemy: shadeHex(pal.danger, 0.85),
      css: pal
    };

    this.score = 0;
    this.best = Number(localStorage.getItem(BEST_KEY) || 0);
    this.lives = START_LIVES;
    this.alive = true;
    this.canRestart = false;
    this.startedAt = gameNow(this);
    this.invulnUntil = gameNow(this) + 900;
    this.shield = false;
    this.rapidUntil = 0;
    this.lastFire = 0;
    this.burstUntil = 0;
    this.burstReadyAt = 0;
    this.burstLabel = '';
    this.nextBossAt = BOSS_EVERY;
    this.bossIndex = 0;
    this.spawnTimer = 1.1;
    this.killed = 0;

    this.ship = { x: 56, y: (HUD_H + H) / 2 };
    this.ghost = { x: this.ship.x, y: this.ship.y, visible: false };
    this.tape = [];
    this.firedThisFrame = false;
    this.lastGhostT = gameNow(this) - ECHO_DELAY;

    this.enemies = [];
    this.bullets = [];
    this.pickups = [];
    this.stars = Array.from({ length: 28 }, () => ({
      x: Math.random() * W,
      y: HUD_H + Math.random() * (H - HUD_H),
      s: 0.4 + Math.random() * 1.4
    }));
    this.boss = null;

    this.cameras.main.setBackgroundColor(this.pal.bg);
    this.graphics = this.add.graphics();

    this.scoreText = this.add.text(8, 2, 'Score: 0', {
      fontSize: '16px', color: pal.fg, fontFamily: 'monospace'
    });
    this.bestText = this.add.text(352, 2, `Best: ${this.best}`, {
      fontSize: '16px', color: pal.accent, fontFamily: 'monospace'
    }).setOrigin(1, 0);
    this.statusText = this.add.text(8, 16, '', {
      fontSize: '13px', color: pal.warn, fontFamily: 'monospace'
    });

    bindPhoneInput(this, {
      ok: () => this.onOk(),
      softLeft: () => this.onBurst(),
      softRight: () => this.scene.start('MenuScene'),
      back: () => this.scene.start('MenuScene'),
      digit: (d) => {
        // 5 is already aliased to OK (fire). Burst is the left soft key, 0 or *.
        if (d === '0' || d === '*') this.onBurst();
      }
    });
    setSoftKeys('Burst', 'Menu');

    this.pauseCtl = attachPause(this);
    attachPerks(this, 'impact');
    onRunStart('impact');
    // Tough: +1 life · Executive: -1 life
    this.maxLives = perkLives(this, START_LIVES) + toughLives(this);
    this.lives = this.maxLives;
    Music.enter('impact');
    this.draw();
  }

  onOk() {
    if (!this.alive) {
      if (this.canRestart) this.scene.restart();
      return;
    }
    this.tryFire(false);
  }

  onBurst() {
    if (!this.alive) {
      if (this.canRestart) this.scene.restart();
      return;
    }
    const now = gameNow(this);
    if (now < this.burstReadyAt) {
      this.floatText(this.ship.x, this.ship.y, 'Wait', this.pal.css.dim);
      return;
    }
    this.burstUntil = now + BURST_DURATION;
    this.burstReadyAt = this.burstUntil + BURST_COOLDOWN;
    this.floatText(this.ship.x, this.ship.y - 16, 'ECHO BURST', this.pal.css.warn);
    Sfx.impactBurst();
  }

  // ---- Game loop --------------------------------------------------------
  update(_time, delta) {
    if (isFrozen(this) || !this.alive) return;
    const dt = Math.min(delta, 50) / 1000 * perkSpeed(this);
    const now = gameNow(this);

    this.moveShip(dt);
    this.recordTape(now);
    this.updateGhost(now);
    this.autoFire(now);
    this.updateStars(dt);
    this.updateBullets(dt);
    this.updateEnemies(dt, now);
    this.updatePickups(dt);
    this.spawnStep(dt);
    this.collide();
    this.updateBurstButton();
    this.scoreText.setText(`Score: ${this.score}`);
    this.statusText.setText(this.statusLine(now));
    this.draw();
  }

  moveShip(dt) {
    let dx = 0;
    let dy = 0;
    if (isHeld('left')) dx -= 1;
    if (isHeld('right')) dx += 1;
    if (isHeld('up')) dy -= 1;
    if (isHeld('down')) dy += 1;
    if (dx && dy) {
      const inv = 1 / Math.SQRT2;
      dx *= inv;
      dy *= inv;
    }
    this.ship.x = Phaser.Math.Clamp(this.ship.x + dx * SHIP_SPEED * dt, 14, 200);
    this.ship.y = Phaser.Math.Clamp(this.ship.y + dy * SHIP_SPEED * dt, HUD_H + 14, H - 14);
  }

  recordTape(now) {
    this.tape.push({
      t: now,
      x: this.ship.x,
      y: this.ship.y,
      fire: this.firedThisFrame
    });
    this.firedThisFrame = false;
    const keepAfter = now - ECHO_DELAY - 80;
    while (this.tape.length && this.tape[0].t < keepAfter) this.tape.shift();
  }

  updateGhost(now) {
    if (now < this.burstUntil) {
      // Wingman: snap beside the ship for the burst window
      this._wasBurst = true;
      const below = this.ship.y + 26 <= H - 16;
      this.ghost.x = this.ship.x + 4;
      this.ghost.y = below ? this.ship.y + 26 : this.ship.y - 26;
      this.ghost.visible = true;
      return;
    }

    // When a burst ends, seed the tape at the current pose so the ghost
    // doesn't jump back to a 1.2s-old pre-burst position.
    if (this._wasBurst) {
      this._wasBurst = false;
      this.tape = [];
      for (let t = now - ECHO_DELAY; t <= now; t += 16) {
        this.tape.push({ t, x: this.ship.x, y: this.ship.y, fire: false });
      }
      this.lastGhostT = now - ECHO_DELAY;
    }

    const target = now - ECHO_DELAY;
    if (now - this.startedAt < ECHO_DELAY) {
      this.ghost.visible = false;
      this.lastGhostT = target;
      return;
    }
    const pose = this.sampleTape(target);
    if (pose) {
      this.ghost.x = pose.x;
      this.ghost.y = pose.y;
      this.ghost.visible = true;
    }
    // Replay any shots recorded between the last ghost time and now
    for (const ev of this.tape) {
      if (ev.fire && ev.t > this.lastGhostT && ev.t <= target) {
        this.spawnBullet(ev.x + 12, ev.y, BULLET_SPEED, 0, true, true);
        Sfx.impactGhostShot();
      }
    }
    this.lastGhostT = target;
  }

  sampleTape(t) {
    const tape = this.tape;
    if (!tape.length) return null;
    if (t <= tape[0].t) return tape[0];
    if (t >= tape[tape.length - 1].t) return tape[tape.length - 1];
    for (let i = 1; i < tape.length; i++) {
      if (tape[i].t >= t) {
        const a = tape[i - 1];
        const b = tape[i];
        const u = (t - a.t) / Math.max(1, b.t - a.t);
        return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
      }
    }
    return tape[tape.length - 1];
  }

  autoFire(now) {
    if (!isHeld('ok')) return;
    const interval = now < this.rapidUntil ? RAPID_INTERVAL : FIRE_INTERVAL;
    if (now - this.lastFire >= interval) this.tryFire(false);
  }

  tryFire(fromGhost) {
    const now = gameNow(this);
    const interval = now < this.rapidUntil ? RAPID_INTERVAL : FIRE_INTERVAL;
    if (!fromGhost) {
      if (now - this.lastFire < interval) return;
      this.lastFire = now;
      this.firedThisFrame = true;
      this.spawnBullet(this.ship.x + 12, this.ship.y, BULLET_SPEED, 0, true, false);
      Sfx.impactShoot();
      if (now < this.burstUntil) {
        // During burst the wingman fires with you
        this.spawnBullet(this.ghost.x + 12, this.ghost.y, BULLET_SPEED, 0, true, true);
        Sfx.impactGhostShot();
      }
    }
  }

  spawnBullet(x, y, vx, vy, friend, ghost) {
    this.bullets.push({ x, y, vx, vy, friend, ghost, life: 2.2 });
  }

  updateStars(dt) {
    const spd = 30 + Math.min(50, this.score / 80);
    for (const s of this.stars) {
      s.x -= s.s * spd * dt;
      if (s.x < 0) {
        s.x = W;
        s.y = HUD_H + Math.random() * (H - HUD_H);
      }
    }
  }

  updateBullets(dt) {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
    }
    this.bullets = this.bullets.filter((b) => b.life > 0 && b.x > -20 && b.x < W + 30 && b.y > HUD_H - 20 && b.y < H + 20);
  }

  updateEnemies(dt, now) {
    for (const e of this.enemies) {
      if (e.kind === 'sine') {
        e.phase += e.freq * dt;
        e.x += e.vx * dt;
        e.y = e.baseY + Math.sin(e.phase) * e.amp;
      } else if (e.kind === 'boss') {
        this.updateBoss(e, dt, now);
      } else {
        e.x += e.vx * dt;
        e.y += (e.vy || 0) * dt;
        if (e.kind === 'shooter') {
          e.y = Phaser.Math.Clamp(e.y, HUD_H + 18, H - 18);
          if (now >= e.nextShot) {
            e.nextShot = now + e.shotEvery;
            const ang = Math.atan2(this.ship.y - e.y, this.ship.x - e.x);
            const sp = 110 + Math.min(50, this.score / 40);
            this.spawnBullet(e.x - 8, e.y, Math.cos(ang) * sp, Math.sin(ang) * sp, false, false);
          }
        }
      }
      e.y = Phaser.Math.Clamp(e.y, HUD_H + 12, H - 12);
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0 && e.x > -40);
  }

  updateBoss(e, dt, now) {
    // Enter from the right, then bob and fire
    if (e.x > 292) e.x += e.vx * dt;
    else {
      e.x = 292;
      e.phase += dt;
      e.y = e.baseY + Math.sin(e.phase * 1.15) * e.amp;
      if (now >= e.nextShot) {
        e.nextShot = now + e.shotEvery;
        e.volleys = (e.volleys || 0) + 1;
        if (e.volleys % 3 === 0) {
          // Aimed shot
          const ang = Math.atan2(this.ship.y - e.y, this.ship.x - e.x);
          this.spawnBullet(e.x - 16, e.y, Math.cos(ang) * 150, Math.sin(ang) * 150, false, false);
        } else {
          // 3-shot spread
          for (const a of [-0.4, 0, 0.4]) {
            this.spawnBullet(e.x - 16, e.y, -Math.cos(a) * 130, Math.sin(a) * 130, false, false);
          }
        }
      }
    }
  }

  updatePickups(dt) {
    for (const p of this.pickups) {
      p.x += p.vx * dt;
      p.y += Math.sin((gameNow(this) + p.wobble) / 200) * 10 * dt * 8;
    }
    this.pickups = this.pickups.filter((p) => p.x > -20 && !p.taken);
  }

  spawnStep(dt) {
    if (gameNow(this) - this.startedAt < 800) return;
    if (this.score >= this.nextBossAt && !this.boss) {
      this.spawnBoss();
      this.nextBossAt += BOSS_EVERY;
    }
    if (this.boss) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    const scale = Math.max(0.42, 1.15 - this.score / 4000);
    this.spawnTimer = Phaser.Math.FloatBetween(0.45, 1.15) * scale;
    this.spawnEnemy();
  }

  spawnEnemy() {
    const y = Phaser.Math.Between(HUD_H + 24, H - 24);
    const roll = Math.random();
    const speedBoost = Math.min(70, this.score / 35);
    if (this.score > 350 && roll < 0.22) {
      this.enemies.push({
        kind: 'shooter', x: W + 16, y, vx: -(46 + speedBoost * 0.3), vy: 0,
        hp: 2, r: 11, score: 100,
        nextShot: gameNow(this) + 700,
        shotEvery: Math.max(700, 1300 - this.score / 8)
      });
    } else if (roll < 0.5) {
      this.enemies.push({
        kind: 'sine', x: W + 16, y, baseY: y, vx: -(70 + speedBoost * 0.5),
        hp: 1, r: 10, score: 75,
        amp: Phaser.Math.Between(28, 64),
        phase: Math.random() * Math.PI * 2,
        freq: 1.6 + Math.random() * 1.4
      });
    } else {
      this.enemies.push({
        kind: 'drifter', x: W + 16, y, vx: -(80 + speedBoost), vy: 0,
        hp: 1, r: 9, score: 50
      });
    }
  }

  spawnBoss() {
    this.bossIndex += 1;
    const hp = 16 + this.bossIndex * 6;
    const y = (HUD_H + H) / 2;
    const boss = {
      kind: 'boss', x: W + 40, y, baseY: y, vx: -50, vy: 0,
      hp, maxHp: hp, r: 24, score: 500,
      amp: 90, phase: 0,
      nextShot: gameNow(this) + 800,
      shotEvery: Math.max(520, 900 - this.bossIndex * 60),
      volleys: 0
    };
    this.boss = boss;
    this.enemies.push(boss);
    this.floatText(W / 2, HUD_H + 40, 'BOSS', this.pal.css.warn);
    Sfx.impactBoss();
  }

  // ---- Combat -----------------------------------------------------------
  collide() {
    const now = gameNow(this);
    // Friend bullets vs enemies
    for (const b of this.bullets) {
      if (!b.friend || b.life <= 0) continue;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (this.dist2(b.x, b.y, e.x, e.y) < (e.r + 3) * (e.r + 3)) {
          b.life = 0;
          e.hp -= 1;
          if (e.hp <= 0) this.killEnemy(e);
          else Sfx.impactHit();
          break;
        }
      }
    }

    // Enemy bodies + hostile bullets vs the player (ghost is invulnerable,
    // and overlapping your own ghost is harmless)
    if (now >= this.invulnUntil) {
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (this.dist2(this.ship.x, this.ship.y, e.x, e.y) < (e.r + 8) * (e.r + 8)) {
          this.hitPlayer();
          if (!this.alive) return;
          break;
        }
      }
      if (this.alive && now >= this.invulnUntil) {
        for (const b of this.bullets) {
          if (b.friend || b.life <= 0) continue;
          if (this.dist2(this.ship.x, this.ship.y, b.x, b.y) < 10 * 10) {
            b.life = 0;
            this.hitPlayer();
            if (!this.alive) return;
            break;
          }
        }
      }
    }

    // Pickups
    for (const p of this.pickups) {
      if (p.taken) continue;
      if (this.dist2(this.ship.x, this.ship.y, p.x, p.y) < 16 * 16) {
        p.taken = true;
        if (p.kind === 'rapid') {
          this.rapidUntil = now + 5000;
          this.floatText(this.ship.x, this.ship.y, 'RAPID', this.pal.css.warn);
        } else {
          this.shield = true;
          this.floatText(this.ship.x, this.ship.y, 'SHIELD', this.pal.css.accent);
        }
        Sfx.impactPickup();
      }
    }
  }

  killEnemy(e) {
    const gain = perkPoints(this, e.score);
    this.score += gain;
    this.killed += 1;
    this.floatText(e.x, e.y, `+${gain}`, this.pal.css.text);
    Sfx.impactExplosion();
    if (e.kind === 'boss') {
      this.boss = null;
      this.dropPickup(e.x, e.y, Math.random() < 0.5 ? 'rapid' : 'shield');
      this.dropPickup(e.x, e.y + 18, Math.random() < 0.5 ? 'rapid' : 'shield');
    } else if (Math.random() < (hasLuck(this) ? 0.21 : 0.12) || this.killed % 10 === 0) {
      this.dropPickup(e.x, e.y, Math.random() < 0.5 ? 'rapid' : 'shield');
    }
  }

  dropPickup(x, y, kind) {
    this.pickups.push({ x, y, vx: -30, kind, taken: false, wobble: Math.random() * 800 });
  }

  hitPlayer() {
    if (this.shield) {
      this.shield = false;
      this.invulnUntil = gameNow(this) + 700;
      this.cameras.main.shake(80, 0.004);
      this.floatText(this.ship.x, this.ship.y, 'SHIELD!', this.pal.css.accent);
      Sfx.impactPlayerHit();
      return;
    }
    this.lives -= 1;
    this.cameras.main.shake(160, 0.01);
    Sfx.impactPlayerHit();
    if (this.lives <= 0) {
      this.gameOver('Ship destroyed');
      return;
    }
    this.invulnUntil = gameNow(this) + INVULN_MS;
    this.floatText(this.ship.x, this.ship.y, `-1  ${this.lives} left`, this.pal.css.danger);
  }

  dist2(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  }

  updateBurstButton() {
    const now = gameNow(this);
    let label = 'Burst';
    if (now < this.burstUntil) label = `Burst ${Math.ceil((this.burstUntil - now) / 1000)}`;
    else if (now < this.burstReadyAt) label = `Burst ${Math.ceil((this.burstReadyAt - now) / 1000)}`;
    if (label !== this.burstLabel) {
      this.burstLabel = label;
      setSoftKeys(label, 'Menu');
    }
  }

  statusLine(now) {
    const bits = [];
    if (now < this.rapidUntil) bits.push(`RAPID ${Math.ceil((this.rapidUntil - now) / 1000)}`);
    if (this.shield) bits.push('SHIELD');
    return bits.join('  ');
  }

  floatText(x, y, msg, color) {
    const t = this.add.text(x, y, msg, {
      fontSize: '14px', color, fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.tweens.add({
      targets: t, y: t.y - 24, alpha: 0, duration: 650,
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

    // Starfield
    g.fillStyle(pal.dim, 0.7);
    for (const s of this.stars) g.fillRect(s.x, s.y, s.s > 1.1 ? 2 : 1, s.s > 1.1 ? 2 : 1);

    // Hostile bullets first (under ships)
    for (const b of this.bullets) {
      if (b.friend) continue;
      g.fillStyle(pal.danger, 1);
      g.fillRect(b.x - 3, b.y - 2, 6, 4);
    }
    for (const b of this.bullets) {
      if (!b.friend) continue;
      g.fillStyle(b.ghost ? pal.accent : pal.fg, b.ghost ? 0.8 : 1);
      g.fillRect(b.x - 4, b.y - 1.5, 8, 3);
    }

    for (const e of this.enemies) this.drawEnemy(g, e, pal);

    for (const p of this.pickups) this.drawPickup(g, p, pal, now);

    if (this.ghost.visible) this.drawShip(g, this.ghost.x, this.ghost.y, true, pal);

    const flash = now < this.invulnUntil && Math.floor(now / 80) % 2 === 0;
    if (!flash) this.drawShip(g, this.ship.x, this.ship.y, false, pal);
    if (this.shield) {
      g.lineStyle(2, pal.accent, 0.85);
      g.strokeCircle(this.ship.x, this.ship.y, 16);
    }

    // HUD bar + lives
    g.fillStyle(pal.panel, 1);
    g.fillRect(0, 0, W, HUD_H);
    g.fillStyle(pal.fg, 0.35);
    g.fillRect(0, HUD_H - 1, W, 1);
    for (let i = 0; i < this.maxLives; i++) {
      const lx = 178 + i * 16;
      g.fillStyle(i < this.lives ? pal.fg : pal.dim, i < this.lives ? 1 : 0.4);
      g.fillTriangle(lx, 8, lx + 10, 16, lx, 22);
    }

    if (this.boss && this.boss.hp > 0) {
      const bw = 200;
      const bx = 80;
      const by = HUD_H + 6;
      const frac = this.boss.hp / this.boss.maxHp;
      g.fillStyle(pal.panel, 0.9);
      g.fillRect(bx - 1, by - 1, bw + 2, 8);
      g.fillStyle(pal.danger, 1);
      g.fillRect(bx, by, bw * frac, 6);
      g.lineStyle(1, pal.fg, 0.8);
      g.strokeRect(bx - 1, by - 1, bw + 2, 8);
    }
  }

  drawShip(g, x, y, ghost, pal) {
    if (ghost) {
      g.lineStyle(2, pal.accent, 0.95);
      g.strokeTriangle(x + 12, y, x - 9, y - 8, x - 9, y + 8);
      g.fillStyle(pal.dim, 0.25);
      g.fillTriangle(x + 12, y, x - 9, y - 8, x - 9, y + 8);
    } else {
      g.fillStyle(pal.fg, 1);
      g.fillTriangle(x + 12, y, x - 9, y - 8, x - 9, y + 8);
      g.fillStyle(pal.body, 1);
      g.fillRect(x - 9, y - 3, 8, 6);
    }
  }

  drawEnemy(g, e, pal) {
    if (e.kind === 'boss') {
      g.fillStyle(pal.danger, 1);
      g.fillRect(e.x - 26, e.y - 20, 52, 40);
      g.fillStyle(pal.warn, 1);
      g.fillRect(e.x - 18, e.y - 8, 8, 8);
      g.fillRect(e.x - 18, e.y + 2, 8, 8);
      g.fillStyle(pal.fg, 0.8);
      g.fillRect(e.x - 30, e.y - 3, 10, 6);
      return;
    }
    if (e.kind === 'shooter') {
      g.fillStyle(pal.warn, 1);
      g.fillRect(e.x - 10, e.y - 8, 20, 16);
      g.fillStyle(pal.danger, 1);
      g.fillTriangle(e.x - 10, e.y - 5, e.x - 10, e.y + 5, e.x - 18, e.y);
      return;
    }
    if (e.kind === 'sine') {
      g.fillStyle(pal.accent, 1);
      g.fillCircle(e.x, e.y, 8);
      g.fillRect(e.x - 2, e.y - 14, 4, 8);
      g.fillRect(e.x - 2, e.y + 6, 4, 8);
      return;
    }
    // drifter
    g.fillStyle(pal.danger, 1);
    g.fillTriangle(e.x - 10, e.y, e.x + 8, e.y - 8, e.x + 8, e.y + 8);
  }

  drawPickup(g, p, pal, now) {
    const pulse = 1 + Math.sin(now / 120) * 0.12;
    if (p.kind === 'rapid') {
      g.fillStyle(pal.warn, 1);
      g.fillRect(p.x - 7 * pulse, p.y - 7 * pulse, 14 * pulse, 14 * pulse);
    } else {
      g.lineStyle(2, pal.accent, 1);
      g.strokeCircle(p.x, p.y, 8 * pulse);
      g.fillStyle(pal.accent, 0.35);
      g.fillCircle(p.x, p.y, 5);
    }
  }

  // ---- Game over --------------------------------------------------------
  gameOver(reason) {
    if (!this.alive) return;
    this.alive = false;
    setSoftKeys('Retry', 'Menu');
    this.cameras.main.shake(220, 0.012);
    this.draw();
    const pal = this.pal;

    const newBest = this.score > this.best;
    if (newBest) {
      this.best = this.score;
      localStorage.setItem(BEST_KEY, String(this.best));
      this.bestText.setText(`Best: ${this.best}`);
    }

    const unlockMsg = formatUnlockLine(addScore('impact', this.score, { newBest }));
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
      this.input.on('pointerdown', () => this.scene.restart());
    });
  }
}
