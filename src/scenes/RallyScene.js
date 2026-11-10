import Phaser from 'phaser';
import { bindPhoneInput, setSoftKeys, isHeld } from '../input/PhoneInput.js';
import { isFrozen, gameNow } from '../ui/PauseOverlay.js';
import * as Sfx from '../audio/Sfx.js';
import * as Music from '../audio/Music.js';
import { perkSpeed, perkPoints, useTough, hasLuck } from '../skins/perks.js';
import { palette, mono, showHowTo, beginRun, endRun, retry, toMenu, fmtTime } from '../games/runKit.js';

/*
 * DIAL-UP RALLY — a pseudo-3D racer on a 56k connection.
 * The road ahead only exists as far as it has "downloaded": your
 * BANDWIDTH sets the loaded draw distance, it trickles away over time,
 * and the edge of the loaded area streams in line by line. Past it you
 * get a dotted wireframe and no traffic — you can't see what's coming.
 * Collect ◆ bandwidth packets to see further. PACKET LOSS glitches
 * scramble bands of the screen, flicker cars and lag your steering.
 * 2 minutes: drive as far as you can; every lap pays a bonus.
 *
 * Keys: ◀ ▶ / 4 6 steer (hold) · ▼ / 8 brake (hold)
 * Touch: hold the left / right third to steer, the middle to brake.
 */

const GAME_ID = 'rally';
const BEST_KEY = 'vpg.rally.best';
const RUN_MS = 120000;
const HY = 150;              // horizon
const HD = 120000;           // camera height * focal
const SEG = 400;
const NSEG = 220;
const TRACK_L = SEG * NSEG;
const MAX_SPEED = 2600;
const OFFROAD_SPEED = 900;
const ROW = 3;
const CAR_Z = [330, 480];    // depth band of the player's car
const LAG_MS = 180;

export default class RallyScene extends Phaser.Scene {
  constructor() {
    super('RallyScene');
  }

  init(data) {
    this.skipHowTo = !!(data && data.skipHowTo);
  }

  create() {
    this.pal = palette();
    const css = this.pal.css;
    this.cameras.main.setBackgroundColor(this.pal.bg);
    this.score = 0;
    this.best = Number(localStorage.getItem(BEST_KEY) || 0);
    this.alive = true;
    this.phase = 'howto';
    this.pos = 0;
    this.px = 0;
    this.speed = 0;
    this.bandwidth = 60;
    this.loadDist = 2500;
    this.lap = 1;
    this.lapStart = 0;
    this.lapTimes = [];
    this.distCarry = 0;
    this.crashes = 0;
    this.pickups = 0;
    this.glitchUntil = 0;
    this.nextGlitch = Infinity;
    this.steerHist = [];
    this.touchSteer = 0;
    this.touchBrake = false;
    this.clockStart = null;
    this.buildTrack();

    this.g = this.add.graphics();
    this.scoreText = this.add.text(6, 2, 'Score: 0', mono('15px', css.fg)).setDepth(10);
    this.bestText = this.add.text(354, 2, `Best: ${this.best}`, mono('15px', css.accent)).setOrigin(1, 0).setDepth(10);
    this.timeText = this.add.text(180, 2, '', mono('18px', css.warn)).setOrigin(0.5, 0).setDepth(10);
    this.lapText = this.add.text(6, 22, '', mono('12px', css.text)).setDepth(10);
    this.bwText = this.add.text(354, 22, '', mono('12px', css.fg)).setOrigin(1, 0).setDepth(10);
    this.loadText = this.add.text(180, HY - 16, '', mono('11px', css.dim)).setOrigin(0.5).setDepth(10);
    this.bigText = this.add.text(180, 110, '', mono('22px', css.warn, { stroke: css.bg, strokeThickness: 5 })).setOrigin(0.5).setDepth(10);
    this.spdText = this.add.text(354, 462, '', mono('13px', css.text)).setOrigin(1, 0.5).setDepth(10);

    bindPhoneInput(this, {
      ok: () => { if (this.phase === 'over') retry(this); },
      softLeft: () => { if (this.phase === 'over') retry(this); },
      softRight: () => toMenu(this, GAME_ID),
      back: () => toMenu(this, GAME_ID)
    });
    const touch = (p, down) => {
      if (!down) { this.touchSteer = 0; this.touchBrake = false; return; }
      this.touchSteer = p.x < 120 ? -1 : p.x > 240 ? 1 : 0;
      this.touchBrake = this.touchSteer === 0;
    };
    this.input.on('pointerdown', (p) => touch(p, true));
    this.input.on('pointermove', (p) => { if (p.isDown) touch(p, true); });
    this.input.on('pointerup', (p) => touch(p, false));

    Music.enter(GAME_ID);
    window.__vpg = window.__vpg || {};
    window.__vpg.game = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { if (window.__vpg.game === this) window.__vpg.game = null; });

    const start = () => this.startRun();
    if (this.skipHowTo) start();
    else {
      showHowTo(this, {
        title: 'Dial-Up Rally',
        tagline: 'The track downloads while you drive it.',
        lines: [
          'You only see as far as the road has LOADED. Bandwidth drains, so the view shrinks.',
          'Grab ◆ bandwidth packets to load further ahead and spot traffic in time.',
          'PACKET LOSS glitches scramble the screen and lag your steering. Hold your line!',
          'Off-road and crashes slow you down. 2 minutes: distance + lap bonuses.'
        ],
        keys: [['◀ ▶ / 4 6', 'steer (hold)'], ['▼ / 8', 'brake (hold)'], ['Touch', 'hold left / right third to steer, middle to brake'], ['# / P', 'pause']],
        onStart: start
      });
      this.draw();
    }
  }

  startRun() {
    beginRun(this, GAME_ID);
    setSoftKeys('', 'Menu');
    this.speed = 400;
  }

  now() {
    return gameNow(this);
  }

  timeLeft() {
    if (this.clockStart == null) return RUN_MS;
    return Math.max(0, RUN_MS - (this.now() - this.clockStart));
  }

  // ---- track -----------------------------------------------------------------------

  buildTrack() {
    const curves = [];
    let i = 0;
    let cur = 0;
    const opts = [0, 0, 0.35, -0.35, 0.7, -0.7, 1, -1];
    while (i < NSEG) {
      const len = Phaser.Math.Between(8, 24);
      const target = i < 10 ? 0 : Phaser.Utils.Array.GetRandom(opts);
      for (let k = 0; k < len && i < NSEG; k++, i++) {
        cur += (target - cur) * 0.25;
        curves.push(cur);
      }
    }
    for (let k = NSEG - 8; k < NSEG; k++) curves[k] *= (NSEG - k) / 8;  // ease into the start line
    this.curves = curves;
    this.cars = [];
    for (let c = 0; c < 14; c++) {
      this.cars.push({ z: 6000 + c * (TRACK_L / 14) + Phaser.Math.Between(-1500, 1500), x: Phaser.Utils.Array.GetRandom([-600, 0, 600]), speed: Phaser.Math.Between(900, 1500) });
    }
    this.orbs = [];
    const n = hasLuck(this) ? 52 : 40;
    for (let o = 0; o < n; o++) {
      this.orbs.push({ z: 3000 + o * (TRACK_L / n) + Phaser.Math.Between(-600, 600), x: Phaser.Math.Between(-750, 750), taken: false });
    }
  }

  curveAt(z) {
    const s = Math.floor((((z % TRACK_L) + TRACK_L) % TRACK_L) / SEG);
    return this.curves[s] || 0;
  }

  rel(z) {
    return (((z - this.pos) % TRACK_L) + TRACK_L) % TRACK_L;
  }

  // ---- update ------------------------------------------------------------------------

  steerInput() {
    let s = 0;
    if (isHeld('left')) s -= 1;
    if (isHeld('right')) s += 1;
    if (this.touchSteer) s = this.touchSteer;
    return s;
  }

  update(time, delta) {
    if (this.phase !== 'play' || !this.alive || isFrozen(this)) { if (this.phase !== 'play') this.draw(); return; }
    const t = this.now();
    if (this.clockStart == null) {
      this.clockStart = t;
      this.lapStart = t;
      this.nextGlitch = t + Phaser.Math.Between(12000, 18000);
    }
    const s = Math.min(delta, 50) / 1000;
    if (this.timeLeft() <= 0) { this.finish(); return; }

    // steering with packet-loss lag
    const raw = this.steerInput();
    this.steerHist.push({ t, v: raw });
    while (this.steerHist.length > 2 && this.steerHist[1].t <= t - LAG_MS) this.steerHist.shift();
    const glitching = t < this.glitchUntil;
    const steer = glitching ? this.steerHist[0].v : raw;
    this.steer = steer;
    const braking = isHeld('down') || this.touchBrake;
    const maxSp = MAX_SPEED * perkSpeed(this);
    const offroad = Math.abs(this.px) > 1000;
    const cap = offroad ? OFFROAD_SPEED : maxSp;
    if (braking) this.speed -= 2600 * s;
    else if (this.speed < cap) this.speed += 950 * s;
    if (this.speed > cap) this.speed -= (offroad ? 2200 : 800) * s;
    this.speed = Phaser.Math.Clamp(this.speed, 0, maxSp);
    const sf = Math.max(0.3, this.speed / maxSp);
    this.px += steer * 1900 * s * sf;
    this.px -= this.curveAt(this.pos + 400) * this.speed * s * 0.5;
    this.px = Phaser.Math.Clamp(this.px, -1700, 1700);
    if (offroad && this.speed > 600) this.cameras.main.shake(60, 0.002);

    // move
    const dz = this.speed * s;
    this.pos += dz;
    this.distCarry += dz;
    if (this.distCarry >= 100) {
      const n = Math.floor(this.distCarry / 100);
      this.distCarry -= n * 100;
      this.addPoints(n, true);
    }
    if (this.pos >= TRACK_L) {
      this.pos -= TRACK_L;
      this.lapTimes.push(t - this.lapStart);
      this.lapStart = t;
      this.lap += 1;
      const bonus = this.addPoints(300);
      Sfx.play('rallyLap');
      this.big(`LAP ${this.lap}!  +${bonus}`);
      this.orbs.forEach((o) => { o.taken = false; });
    }

    // traffic + collisions
    this.cars.forEach((c) => {
      c.z = (c.z + c.speed * s) % TRACK_L;
      const r = this.rel(c.z);
      if (r > CAR_Z[0] && r < CAR_Z[1] && Math.abs(c.x - this.px) < 380 && this.speed > c.speed) this.crash(c);
    });
    this.orbs.forEach((o) => {
      if (o.taken) return;
      const r = this.rel(o.z);
      if (r > CAR_Z[0] - 60 && r < CAR_Z[1] + 60 && Math.abs(o.x - this.px) < 420) {
        o.taken = true;
        this.pickups += 1;
        this.bandwidth = Math.min(100, this.bandwidth + 22);
        this.addPoints(25);
        Sfx.play('rallyPickup');
      }
    });

    // bandwidth -> loaded distance (streams in gradually)
    this.bandwidth = Math.max(0, this.bandwidth - 2.4 * s);
    const target = 1400 + this.bandwidth * 95;
    if (this.loadDist < target) this.loadDist = Math.min(target, this.loadDist + (900 + this.bandwidth * 40) * s);
    else this.loadDist = Math.max(target, this.loadDist - 1500 * s);

    // packet loss
    if (t >= this.nextGlitch) {
      this.glitchUntil = t + 1800;
      this.nextGlitch = t + Phaser.Math.Between(13000, 21000);
      this.glitchSeed = Math.random() * 1000;
      this.glitches = (this.glitches || 0) + 1;
      Sfx.play('rallyGlitch');
      this.big('PACKET LOSS!');
    }

    const left = this.timeLeft();
    if (left < 10000 && Math.floor(left / 1000) !== this.lastTick) { this.lastTick = Math.floor(left / 1000); Sfx.play('rallyTick'); }
    this.timeText.setText(fmtTime(left));
    this.lapText.setText(`LAP ${this.lap}  ${fmtTime(t - this.lapStart).replace(/^0:/, '')}s`);
    const kbps = (this.bandwidth / 100) * 56;
    const bars = Math.ceil(this.bandwidth / 20);
    this.bwText.setText(`${kbps.toFixed(1)}k ${'▮'.repeat(bars)}${'▯'.repeat(5 - bars)}`);
    this.bwText.setColor(this.bandwidth < 25 ? this.pal.css.danger : this.pal.css.fg);
    this.spdText.setText(`${Math.round(this.speed / 20)} km/h`);
    this.draw();
  }

  crash(c) {
    c.z = (c.z + 900) % TRACK_L;
    this.crashes += 1;
    this.cameras.main.shake(220, 0.012);
    Sfx.play('rallyCrash');
    if (useTough(this)) return;
    this.speed *= 0.3;
    this.big('CRASH!');
  }

  big(msg) {
    this.bigText.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.bigText);
    this.tweens.add({ targets: this.bigText, alpha: 0, delay: 900, duration: 400 });
  }

  addPoints(n, quiet = false) {
    const gain = perkPoints(this, n, { quiet });
    this.score += gain;
    this.scoreText.setText(`Score: ${this.score}`);
    return gain;
  }

  finish() {
    endRun(this, { gameId: GAME_ID, bestKey: BEST_KEY, title: 'TIME!', win: true, reason: `${this.lap - 1} laps · ${this.pickups} packets · ${this.crashes} crashes` });
    this.draw();
  }

  // ---- render ---------------------------------------------------------------------

  draw() {
    const g = this.g;
    const P = this.pal;
    const t = this.phase === 'play' ? this.now() : this.time.now;
    g.clear();
    const glitch = this.phase === 'play' && t < this.glitchUntil;
    // sky
    g.fillStyle(P.bg, 1).fillRect(0, 40, 360, HY - 40);
    const fullyLoaded = this.loadDist > 9000;
    if (fullyLoaded) {
      g.fillStyle(P.panel, 1);
      const off = (this.pos * 0.002 + (this.px * 0.02)) % 120;
      for (let x = -off - 120; x < 400; x += 60) g.fillTriangle(x, HY, x + 30, HY - 22 - ((x / 60) % 2 ? 10 : 0), x + 60, HY);
    } else {
      // "loading" horizon
      const pct = Math.round(Math.min(100, this.loadDist / 90));
      this.loadText.setText(`loading ${pct}%${'.'.repeat(1 + Math.floor(t / 300) % 3)}`);
    }
    this.loadText.setVisible(!fullyLoaded && this.phase !== 'howto');

    // road, near to far
    this.rows = [];
    let zPrev = 0;
    let accDX = 0;
    let accX = 0;
    for (let y = 479; y > HY; y -= ROW) {
      const z = HD / (y - HY);
      const dz = z - zPrev;
      zPrev = z;
      accDX += this.curveAt(this.pos + z) * dz * 6e-5;
      accX += accDX * dz;
      const sc = (y - HY) * 0.5 / 1000;
      let cx = 180 + (accX - this.px) * sc;
      const hw = 1000 * sc;
      const wz = this.pos + z;
      const stripe = Math.floor(wz / 220) % 2;
      this.rows.push({ y, z, cx, sc });
      const loaded = z < this.loadDist;
      const fringe = !loaded && z < this.loadDist * 1.35;
      if (glitch) {
        const band = Math.floor((y + this.glitchSeed) / 24) % 5;
        if (band === 0) cx += Math.sin(this.glitchSeed + y) * 40;
      }
      if (loaded || (fringe && Math.floor((t / 80 + y / ROW)) % 2 === 0)) {
        const blocky = fringe;
        g.fillStyle(stripe ? P.panel : P.bg, 1).fillRect(0, y - ROW + 1, 360, ROW);
        const rw = hw * 0.12;
        g.fillStyle(stripe ? P.fg : P.danger, blocky ? 0.5 : 1).fillRect(cx - hw - rw, y - ROW + 1, rw, ROW);
        g.fillRect(cx + hw, y - ROW + 1, rw, ROW);
        g.fillStyle(P.body, blocky ? 0.4 : 0.85).fillRect(cx - hw, y - ROW + 1, hw * 2, ROW);
        if (stripe && !blocky) {
          g.fillStyle(P.text, 0.9);
          g.fillRect(cx - hw * 0.35 - hw * 0.02, y - ROW + 1, hw * 0.04, ROW);
          g.fillRect(cx + hw * 0.35 - hw * 0.02, y - ROW + 1, hw * 0.04, ROW);
        }
        if (glitch && Math.floor((y + this.glitchSeed) / 24) % 5 === 2) {
          for (let x = 0; x < 360; x += 12) {
            if (((x * 7 + y * 13 + Math.floor(t / 50)) % 5) < 2) { g.fillStyle(((x + y) % 3) ? P.fg : P.warn, 0.8).fillRect(x, y - ROW + 1, 12, ROW); }
          }
        }
      } else {
        // not downloaded yet: dark, dotted wireframe edges
        if ((y / ROW) % 3 < 1) {
          g.fillStyle(P.dim, 0.7);
          g.fillRect(cx - hw, y, 2, 1);
          g.fillRect(cx + hw, y, 2, 1);
        }
        if ((y + Math.floor(t / 120)) % 9 === 0) { g.fillStyle(P.dim, 0.25).fillRect(((y * 37) % 340), y, 6, 1); }
      }
    }

    // sprites (only inside the loaded area), far to near
    const sprites = [];
    this.cars.forEach((c) => { const r = this.rel(c.z); if (r > 150 && r < this.loadDist) sprites.push({ kind: 'car', r, x: c.x }); });
    this.orbs.forEach((o) => { if (o.taken) return; const r = this.rel(o.z); if (r > 150 && r < this.loadDist) sprites.push({ kind: 'orb', r, x: o.x }); });
    sprites.sort((a, b) => b.r - a.r);
    sprites.forEach((sp) => {
      if (glitch && Math.floor(t / 70 + sp.r) % 2) return;
      const row = this.rowFor(sp.r);
      if (!row) return;
      const x = row.cx + (sp.x) * row.sc;
      const w = 700 * row.sc;
      if (sp.kind === 'car') {
        const h = w * 0.55;
        g.fillStyle(P.warn, 1).fillRect(x - w / 2, row.y - h, w, h);
        g.fillStyle(P.bg, 1).fillRect(x - w * 0.35, row.y - h * 0.85, w * 0.7, h * 0.3);
        g.fillStyle(P.danger, 1).fillRect(x - w / 2, row.y - h * 0.3, w * 0.15, h * 0.15).fillRect(x + w * 0.35, row.y - h * 0.3, w * 0.15, h * 0.15);
      } else {
        const r = Math.max(2, w * 0.18);
        const bob = Math.sin(t / 150 + sp.r) * r * 0.3;
        g.fillStyle(P.accent, 1).fillTriangle(x, row.y - r * 3 + bob, x - r, row.y - r * 2 + bob, x + r, row.y - r * 2 + bob);
        g.fillTriangle(x, row.y - r + bob, x - r, row.y - r * 2 + bob, x + r, row.y - r * 2 + bob);
      }
    });

    // player car
    const cx = 180;
    const cy = 452;
    const tilt = (this.steer || 0) * 4;
    g.fillStyle(0x000000, 0.35).fillRect(cx - 28, cy + 10, 56, 6);
    g.fillStyle(P.fg, 1).fillRect(cx - 26, cy - 10 + tilt * 0.2, 52, 20);
    g.fillStyle(P.fg, 1).fillRect(cx - 16, cy - 22, 32, 14);
    g.fillStyle(P.bg, 1).fillRect(cx - 12, cy - 19, 24, 8);
    g.fillStyle(P.text, 1).fillRect(cx - 30, cy + 2, 8, 10).fillRect(cx + 22, cy + 2, 8, 10);
    g.fillStyle(P.danger, 1).fillRect(cx - 24, cy - 6, 8, 4).fillRect(cx + 16, cy - 6, 8, 4);
    // HUD band
    g.fillStyle(P.panel, 1).fillRect(0, 0, 360, 40);
  }

  rowFor(r) {
    const rows = this.rows || [];
    let best = null;
    let bd = Infinity;
    for (let i = 0; i < rows.length; i++) {
      const d = Math.abs(rows[i].z - r);
      if (d < bd) { bd = d; best = rows[i]; }
      if (rows[i].z > r * 1.5) break;
    }
    return best;
  }
}
