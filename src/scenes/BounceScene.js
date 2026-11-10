import Phaser from 'phaser';
import { bindPhoneInput, isHeld, setSoftKeys } from '../input/PhoneInput.js';
import { hexToInt, shadeHex } from '../skins/skins.js';
import { getSkin } from '../skins/SkinManager.js';

// ---- Tuning -------------------------------------------------------------
const W = 360;
const H = 480;
const HUD_H = 28;
const BALL_R = 11;
const WALL = 18;
const GRAVITY = 1600;
const BOUNCE_SPEED = 520;
const MOVE_ACCEL = 900;
const MOVE_MAX = 170;
const SCROLL_START = 95;
const SCROLL_MAX = 210;
const FLIP_COOLDOWN = 700;
const HOP_BOOST = 180;
const HOP_COOLDOWN = 380;
const TRAIL_LEN = 10;
const BEST_KEY = 'vpg.bounce.best';

const SPIKE_W = 18;
const SPIKE_H = 22;

export default class BounceScene extends Phaser.Scene {
  constructor() {
    super('BounceScene');
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
      wall: shadeHex(pal.fg, 0.45),
      wallLip: shadeHex(pal.fg, 0.7),
      ring: hexToInt(pal.warn),
      css: pal
    };

    this.score = 0;
    this.best = Number(localStorage.getItem(BEST_KEY) || 0);
    this.alive = true;
    this.canRestart = false;
    this.gravSign = 1;          // 1 = down, -1 = up
    this.flips = 0;
    this.lastCollectFlips = -99;
    this.combo = 0;
    this.flipReadyAt = 0;
    this.hopReadyAt = 0;
    this.flipLabel = '';
    this.distanceAwarded = 0;
    this.squash = 0;            // 1 = freshly bounced, decays to 0
    this.trail = [];

    this.viewX = 0;
    this.scroll = SCROLL_START;
    this.segments = [];
    this.nextX = 0;
    this.seedSafeUntil = 560;

    // First stretch is a wide, empty tunnel so the first bounce feels fair
    this.addSegment(this.makeSegment(0, 280, { forced: 'safe', ceilY: HUD_H + WALL, floorY: 430 }));
    this.addSegment(this.makeSegment(this.nextX, 220, { forced: 'safe', prev: this.segments[0] }));

    const first = this.segments[0];
    this.ball = {
      x: 120,
      y: (first.ceilY + first.floorY) / 2 + 40,
      vx: 0,
      vy: 80
    };

    this.cameras.main.setBackgroundColor(this.pal.bg);
    this.graphics = this.add.graphics();

    this.scoreText = this.add.text(8, 2, 'Score: 0', {
      fontSize: '16px', color: pal.fg, fontFamily: 'monospace'
    });
    this.bestText = this.add.text(352, 2, `Best: ${this.best}`, {
      fontSize: '16px', color: pal.accent, fontFamily: 'monospace'
    }).setOrigin(1, 0);
    this.gravText = this.add.text(180, 2, 'GRAV ▼', {
      fontSize: '16px', color: pal.warn, fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5, 0);

    bindPhoneInput(this, {
      up: () => this.hop(),
      ok: () => this.onAction(),
      softLeft: () => this.onAction(),
      softRight: () => this.scene.start('MenuScene'),
      back: () => this.scene.start('MenuScene')
    });
    setSoftKeys('Flip', 'Menu');

    this.draw();
  }

  onAction() {
    if (this.alive) this.flip();
    else if (this.canRestart) this.scene.restart();
  }

  // ---- Ability ----------------------------------------------------------
  flip() {
    if (!this.alive) return;
    const now = this.time.now;
    if (now < this.flipReadyAt) {
      this.floatText(this.ball.x, this.ball.y, 'Wait', this.pal.css.dim);
      return;
    }
    this.gravSign *= -1;
    this.flips += 1;
    this.flipReadyAt = now + FLIP_COOLDOWN;
    this.vyDampenOnFlip();
    this.checkFlipThru();
    this.cameras.main.shake(60, 0.003);
    this.floatText(this.ball.x, this.ball.y - this.gravSign * 18, 'FLIP', this.pal.css.warn);
    this.updateGravLabel();
  }

  vyDampenOnFlip() {
    // Kill a bit of the old fall so the new gravity takes over cleanly
    this.ball.vy *= 0.35;
    this.ball.vy += -this.gravSign * 70;
  }

  hop() {
    if (!this.alive) return;
    const now = this.time.now;
    if (now < this.hopReadyAt) return;
    this.ball.vy -= this.gravSign * HOP_BOOST;
    this.hopReadyAt = now + HOP_COOLDOWN;
  }

  updateGravLabel() {
    this.gravText.setText(this.gravSign > 0 ? 'GRAV ▼' : 'GRAV ▲');
  }

  updateFlipButton() {
    const left = this.flipReadyAt - this.time.now;
    const label = left > 0 ? `Flip ${Math.ceil(left / 1000)}` : 'Flip';
    if (label !== this.flipLabel) {
      this.flipLabel = label;
      setSoftKeys(label, 'Menu');
    }
  }

  // ---- Game loop --------------------------------------------------------
  update(_time, delta) {
    if (!this.alive) return;
    const dt = Math.min(delta, 50) / 1000;

    this.scroll = Math.min(
      SCROLL_MAX,
      SCROLL_START + Math.max(0, this.viewX) / 28
    );

    // Steer
    let ax = 0;
    if (isHeld('left')) ax -= MOVE_ACCEL;
    if (isHeld('right')) ax += MOVE_ACCEL;
    if (ax === 0) this.ball.vx *= Math.pow(0.08, dt);
    this.ball.vx = Phaser.Math.Clamp(this.ball.vx + ax * dt, -MOVE_MAX, MOVE_MAX);

    this.ball.vy += this.gravSign * GRAVITY * dt;
    this.ball.vy = Phaser.Math.Clamp(this.ball.vy, -980, 980);

    this.ball.x += (this.scroll + this.ball.vx) * dt;
    this.ball.y += this.ball.vy * dt;
    this.viewX += this.scroll * dt;

    // Keep the ball in a comfortable column of the screen
    const sx = this.ball.x - this.viewX;
    if (sx < 54) {
      this.ball.x = this.viewX + 54;
      this.ball.vx = Math.max(this.ball.vx, 0);
    } else if (sx > 200) {
      this.ball.x = this.viewX + 200;
      this.ball.vx = Math.min(this.ball.vx, 0);
    }

    this.squash = Math.max(0, this.squash - dt * 4);

    this.resolveWalls();
    if (!this.alive) return;
    for (const seg of this.segments) {
      for (const m of seg.movers) this.advanceMover(m);
    }
    this.collideHazards();
    if (!this.alive) return;
    this.collectRings();
    this.awardDistance();

    this.trail.push({ x: this.ball.x, y: this.ball.y });
    if (this.trail.length > TRAIL_LEN) this.trail.shift();

    while (this.nextX < this.viewX + 560) this.generateNext();
    this.segments = this.segments.filter((s) => s.x + s.w > this.viewX - 40);

    this.updateFlipButton();
    this.scoreText.setText(`Score: ${this.score}`);
    this.draw();
  }

  // ---- Collisions -------------------------------------------------------
  resolveWalls() {
    const walls = this.wallsAt(this.ball.x);
    const r = BALL_R;

    if (walls.floorY != null) {
      if (this.ball.y + r > walls.floorY) {
        this.ball.y = walls.floorY - r;
        if (this.ball.vy > 0) {
          this.ball.vy = -BOUNCE_SPEED;
          this.squash = 1;
        }
      }
    } else if (this.ball.y > H + 40) {
      this.gameOver('Fell through');
      return;
    }

    if (walls.ceilY != null) {
      if (this.ball.y - r < walls.ceilY) {
        this.ball.y = walls.ceilY + r;
        if (this.ball.vy < 0) {
          this.ball.vy = BOUNCE_SPEED;
          this.squash = 1;
        }
      }
    } else if (this.ball.y < HUD_H - 40) {
      this.gameOver('Flew off');
      return;
    }

    // Crushed if a narrow section somehow overlaps the ball from both sides
    if (walls.floorY != null && walls.ceilY != null && walls.floorY - walls.ceilY < r * 2 + 2) {
      this.gameOver('Crushed');
    }
  }

  collideHazards() {
    const bx = this.ball.x;
    const by = this.ball.y;
    for (const seg of this.segments) {
      if (bx < seg.x - 20 || bx > seg.x + seg.w + 20) continue;
      for (const sp of seg.spikes) {
        if (this.hitsSpike(bx, by, sp)) {
          this.gameOver('Hit a spike');
          return;
        }
      }
      for (const m of seg.movers) {
        if (this.circleRect(bx, by, BALL_R - 2, m.x - 9, m.y - 9, 18, 18)) {
          this.gameOver('Hit a blocker');
          return;
        }
      }
    }
  }

  advanceMover(m) {
    // Movers are updated from the draw/collide path once per frame; use
    // a stamped time so we don't double-step if both loops touch one.
    const now = this.time.now;
    if (m._t == null) m._t = now;
    const dt = Math.min(0.05, (now - m._t) / 1000);
    m._t = now;
    m.y += m.vy * dt;
    if (m.y < m.minY) { m.y = m.minY; m.vy = Math.abs(m.vy); }
    if (m.y > m.maxY) { m.y = m.maxY; m.vy = -Math.abs(m.vy); }
  }

  hitsSpike(bx, by, sp) {
    // Fair: a slightly smaller circle sitting inside the visible triangle
    const cx = sp.x + sp.w / 2;
    const dir = sp.side === 'floor' ? -1 : 1;
    const cy = sp.baseY + dir * (sp.h * 0.42);
    const rr = sp.w * 0.28 + 2;
    const dx = bx - cx;
    const dy = by - cy;
    return dx * dx + dy * dy < (BALL_R + rr) * (BALL_R + rr) * 0.72;
  }

  circleRect(cx, cy, r, x, y, w, h) {
    const nx = Phaser.Math.Clamp(cx, x, x + w);
    const ny = Phaser.Math.Clamp(cy, y, y + h);
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy < r * r;
  }

  collectRings() {
    for (const seg of this.segments) {
      for (const ring of seg.rings) {
        if (ring.collected) continue;
        const dx = this.ball.x - ring.x;
        const dy = this.ball.y - ring.y;
        const reach = ring.r + BALL_R - 2;
        if (dx * dx + dy * dy < reach * reach) {
          ring.collected = true;
          if (this.flips === this.lastCollectFlips + 1) this.combo += 1;
          else this.combo = 1;
          this.lastCollectFlips = this.flips;
          const gain = 10 * this.combo;
          this.score += gain;
          const label = this.combo > 1 ? `+${gain} x${this.combo}` : `+${gain}`;
          this.floatText(ring.x, ring.y, label, this.combo > 1 ? this.pal.css.warn : this.pal.css.text);
        }
      }
    }
  }

  checkFlipThru() {
    // Bonus if you flip while between a ring pair
    for (const seg of this.segments) {
      if (!seg.pair || seg.pairBonus) continue;
      const [a, b] = seg.pair;
      if (Math.abs(this.ball.x - a.x) > 28) continue;
      const lo = Math.min(a.y, b.y);
      const hi = Math.max(a.y, b.y);
      if (this.ball.y > lo - 10 && this.ball.y < hi + 10) {
        seg.pairBonus = true;
        this.score += 50;
        this.floatText(a.x, (lo + hi) / 2, 'FLIP THRU +50', this.pal.css.warn);
      }
    }
  }

  awardDistance() {
    const marks = Math.floor(this.viewX / 50);
    if (marks > this.distanceAwarded) {
      this.score += marks - this.distanceAwarded;
      this.distanceAwarded = marks;
    }
  }

  // ---- World gen --------------------------------------------------------
  wallsAt(x) {
    for (const s of this.segments) {
      if (x >= s.x && x < s.x + s.w) {
        let floorY = s.floorY;
        let ceilY = s.ceilY;
        if (s.floorHole && x >= s.floorHole.x && x < s.floorHole.x + s.floorHole.w) floorY = null;
        if (s.ceilHole && x >= s.ceilHole.x && x < s.ceilHole.x + s.ceilHole.w) ceilY = null;
        return { floorY, ceilY };
      }
    }
    return { floorY: null, ceilY: null };
  }

  generateNext() {
    const dist = this.nextX;
    const diff = Phaser.Math.Clamp((dist - this.seedSafeUntil) / 2400, 0, 1);
    let forced = null;
    if (dist < this.seedSafeUntil) forced = 'safe';
    const prev = this.segments[this.segments.length - 1];
    this.addSegment(this.makeSegment(this.nextX, Phaser.Math.Between(150, 230), { forced, diff, prev }));
  }

  addSegment(seg) {
    this.segments.push(seg);
    this.nextX = seg.x + seg.w;
  }

  makeSegment(x, w, { forced, diff = 0, prev, ceilY: forcedCeil, floorY: forcedFloor } = {}) {
    const minGap = Math.round(200 - diff * 50);
    const maxGap = Math.round(280 - diff * 40);
    const topMin = HUD_H + WALL;
    const botMax = H - 8;

    let ceilY;
    let floorY;
    if (forcedCeil != null && forcedFloor != null) {
      ceilY = forcedCeil;
      floorY = forcedFloor;
    } else if (prev) {
      // Walk heights gently so adjacent segments don't form unfair cliffs
      const maxStep = 26;
      let gap = prev.floorY - prev.ceilY + Phaser.Math.Between(-22, 22);
      gap = Phaser.Math.Clamp(gap, minGap, maxGap);
      ceilY = prev.ceilY + Phaser.Math.Between(-maxStep, maxStep);
      ceilY = Phaser.Math.Clamp(ceilY, topMin, botMax - gap);
      floorY = ceilY + gap;
      if (floorY > botMax) {
        floorY = botMax;
        ceilY = floorY - gap;
      }
    } else {
      const gap = Phaser.Math.Between(minGap, maxGap);
      const slack = Math.max(0, (botMax - topMin) - gap);
      const offset = Phaser.Math.Between(0, slack);
      ceilY = topMin + offset;
      floorY = ceilY + gap;
    }

    const seg = {
      x, w, ceilY, floorY,
      floorHole: null,
      ceilHole: null,
      spikes: [],
      rings: [],
      movers: [],
      pair: null,
      pairBonus: false
    };

    if (forced === 'safe') return seg;

    const roll = Math.random();
    const spikeChance = 0.22 + diff * 0.15;
    const gapChance = 0.1 + diff * 0.06;
    const ringChance = 0.24;
    const moverChance = diff > 0.25 ? 0.1 + diff * 0.08 : 0;
    const tunnel = floorY - ceilY;

    if (roll < spikeChance) {
      this.placeSpikes(seg, 'floor', 1 + Math.floor(Math.random() * (diff > 0.5 ? 3 : 2)));
    } else if (roll < spikeChance * 1.8) {
      this.placeSpikes(seg, 'ceil', 1 + Math.floor(Math.random() * 2));
    } else if (roll < spikeChance * 2.15 && tunnel >= 180) {
      // Staggered spikes on both sides, never stacked on the same x
      this.placeSpikes(seg, 'floor', 1, 0.22);
      this.placeSpikes(seg, 'ceil', 1, 0.62);
    } else if (roll < spikeChance * 2.15 + gapChance) {
      // A short, readable hole — not the whole segment — so you have time to flip
      const hw = Phaser.Math.Between(52, 78);
      const hx = x + Phaser.Math.Between(40, Math.max(40, w - hw - 40));
      if (Math.random() < 0.5) seg.floorHole = { x: hx, w: hw };
      else seg.ceilHole = { x: hx, w: hw };
      const y = seg.floorHole ? seg.floorY - 52 : seg.ceilY + 52;
      seg.rings.push(this.makeRing(hx - 28, y));
    } else if (roll < spikeChance * 2.15 + gapChance + ringChance) {
      this.placeRings(seg);
    } else if (roll < spikeChance * 2.15 + gapChance + ringChance + moverChance) {
      const mid = (seg.ceilY + seg.floorY) / 2;
      seg.movers.push({
        x: x + w * 0.55,
        y: mid,
        vy: (Math.random() < 0.5 ? 1 : -1) * (70 + diff * 50),
        minY: seg.ceilY + 28,
        maxY: seg.floorY - 28
      });
    }

    // Occasional extra ring in a spike segment, placed away from the spikes
    if (seg.spikes.length && Math.random() < 0.4) {
      const y = Math.random() < 0.5 ? seg.floorY - 58 : seg.ceilY + 58;
      seg.rings.push(this.makeRing(x + w * 0.18, y));
    }

    return seg;
  }

  placeSpikes(seg, side, count, atFrac) {
    const baseY = side === 'floor' ? seg.floorY : seg.ceilY;
    const hole = side === 'floor' ? seg.floorHole : seg.ceilHole;
    const inner = 36;
    const usable = seg.w - inner * 2;
    for (let i = 0; i < count; i++) {
      const frac = atFrac != null
        ? atFrac
        : 0.3 + (i + 0.5) / (count + 1) * 0.5;
      const sx = seg.x + inner + usable * frac - SPIKE_W / 2;
      if (hole && sx + SPIKE_W > hole.x - 8 && sx < hole.x + hole.w + 8) continue;
      seg.spikes.push({
        side, x: sx, w: SPIKE_W, h: SPIKE_H, baseY
      });
    }
  }

  placeRings(seg) {
    const floorBand = seg.floorY - 56;
    const ceilBand = seg.ceilY + 56;
    if (Math.random() < 0.45 && seg.floorY - seg.ceilY > 170) {
      // Vertical pair: collect both by flipping, bonus if you flip between them
      const rx = seg.x + seg.w * 0.55;
      const a = this.makeRing(rx, floorBand);
      const b = this.makeRing(rx, ceilBand);
      seg.rings.push(a, b);
      seg.pair = [a, b];
    } else {
      const y = Math.random() < 0.5 ? floorBand : ceilBand;
      seg.rings.push(this.makeRing(seg.x + seg.w * 0.5, y));
    }
  }

  makeRing(x, y) {
    return { x, y, r: 16, collected: false };
  }

  // ---- Effects & HUD ----------------------------------------------------
  floatText(worldX, worldY, msg, color) {
    const t = this.add.text(worldX - this.viewX, worldY, msg, {
      fontSize: '15px', color, fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.tweens.add({
      targets: t, y: t.y - 28, alpha: 0, duration: 700,
      onComplete: () => t.destroy()
    });
  }

  // ---- Rendering --------------------------------------------------------
  draw() {
    const g = this.graphics;
    const pal = this.pal;
    const vx = this.viewX;
    g.clear();

    g.fillStyle(pal.bg, 1);
    g.fillRect(0, HUD_H, W, H - HUD_H);

    for (const seg of this.segments) {
      this.drawSegment(g, seg, vx);
    }

    // Trail
    for (let i = 0; i < this.trail.length; i++) {
      const p = this.trail[i];
      const a = (i + 1) / this.trail.length * 0.35;
      g.fillStyle(pal.fg, a);
      g.fillCircle(p.x - vx, p.y, 3 + i * 0.35);
    }

    // Ball with squash / stretch
    const speedStretch = Phaser.Math.Clamp(Math.abs(this.ball.vy) / 900, 0, 1);
    let sx = 1 - speedStretch * 0.18 + this.squash * 0.35;
    let sy = 1 + speedStretch * 0.22 - this.squash * 0.4;
    const bx = this.ball.x - vx;
    const by = this.ball.y;
    g.fillStyle(pal.fg, 1);
    g.fillEllipse(bx, by, BALL_R * 2 * sx, BALL_R * 2 * sy);
    g.fillStyle(pal.text, 0.35);
    g.fillEllipse(bx - 2.5, by - 2.5, 5 * sx, 4 * sy);

    // HUD bar
    g.fillStyle(pal.panel, 1);
    g.fillRect(0, 0, W, HUD_H);
    g.fillStyle(pal.fg, 0.35);
    g.fillRect(0, HUD_H - 1, W, 1);
  }

  drawSlab(g, pal, x, w, y, h, isCeil, hole, vx) {
    const lipY = isCeil ? y + h - 3 : y;
    const fill = (sx, sw) => {
      if (sw <= 0) return;
      g.fillStyle(pal.wall, 1);
      g.fillRect(sx, y, sw, h);
      g.fillStyle(pal.wallLip, 1);
      g.fillRect(sx, lipY, sw, 3);
    };
    if (!hole) {
      fill(x, w + 1);
      return;
    }
    const hx = hole.x - vx;
    fill(x, hx - x);
    fill(hx + hole.w, (x + w + 1) - (hx + hole.w));
    // Mark the cut edges so a hole is obvious at a glance
    g.fillStyle(pal.danger, 0.55);
    g.fillRect(hx - 2, isCeil ? y : y, 2, isCeil ? h : 8);
    g.fillRect(hx + hole.w, isCeil ? y : y, 2, isCeil ? h : 8);
  }

  drawSegment(g, seg, vx) {
    const pal = this.pal;
    const x = seg.x - vx;
    const w = seg.w;
    if (x + w < 0 || x > W) return;

    // Ceiling / floor slabs (with optional short holes)
    this.drawSlab(g, pal, x, w, HUD_H, seg.ceilY - HUD_H, true, seg.ceilHole, vx);
    this.drawSlab(g, pal, x, w, seg.floorY, H - seg.floorY, false, seg.floorHole, vx);

    // Spikes (drawn larger than their hitbox, so they're readable and fair)
    for (const sp of seg.spikes) {
      const sx = sp.x - vx;
      g.fillStyle(pal.danger, 1);
      if (sp.side === 'floor') {
        g.fillTriangle(sx, sp.baseY, sx + sp.w, sp.baseY, sx + sp.w / 2, sp.baseY - sp.h);
      } else {
        g.fillTriangle(sx, sp.baseY, sx + sp.w, sp.baseY, sx + sp.w / 2, sp.baseY + sp.h);
      }
    }

    // Moving blockers
    for (const m of seg.movers) {
      const mx = m.x - vx;
      g.fillStyle(pal.danger, 1);
      g.fillRect(mx - 10, m.y - 10, 20, 20);
      g.fillTriangle(mx - 8, m.y - 10, mx + 8, m.y - 10, mx, m.y - 20);
      g.fillTriangle(mx - 8, m.y + 10, mx + 8, m.y + 10, mx, m.y + 20);
    }

    // Rings
    for (const ring of seg.rings) {
      if (ring.collected) continue;
      const pulse = 1 + Math.sin(this.time.now / 140) * 0.08;
      const rx = ring.x - vx;
      g.lineStyle(3, pal.ring, 1);
      g.strokeCircle(rx, ring.y, ring.r * pulse);
      g.lineStyle(2, pal.accent, 0.7);
      g.strokeCircle(rx, ring.y, (ring.r - 5) * pulse);
    }
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

    this.add.rectangle(180, 270, 300, 220, 0x000000, 0.8).setStrokeStyle(2, pal.fg);
    const style = (size, color) => ({ fontSize: size, color, fontFamily: 'monospace', align: 'center' });
    this.add.text(180, 200, 'GAME OVER', style('34px', pal.css.danger)).setOrigin(0.5);
    this.add.text(180, 240, reason, style('15px', pal.css.accent)).setOrigin(0.5);
    this.add.text(180, 280, `Score: ${this.score}`, style('22px', pal.css.text)).setOrigin(0.5);
    this.add.text(180, 310, newBest ? 'NEW BEST!' : `Best: ${this.best}`,
      style('16px', newBest ? pal.css.warn : pal.css.accent)).setOrigin(0.5);
    this.add.text(180, 355, 'Tap or OK to retry', style('15px', pal.css.fg)).setOrigin(0.5);

    this.time.delayedCall(400, () => {
      this.canRestart = true;
      this.input.on('pointerdown', () => this.scene.restart());
    });
  }
}
