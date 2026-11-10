import Phaser from 'phaser';
import { bindPhoneInput, setSoftKeys } from '../input/PhoneInput.js';
import { isFrozen } from '../ui/PauseOverlay.js';
import * as Sfx from '../audio/Sfx.js';
import * as Music from '../audio/Music.js';
import { perkSpeed, perkPoints, perkLives, toughLives, hasLuck } from '../skins/perks.js';
import { palette, mono, showHowTo, beginRun, endRun, retry, toMenu } from '../games/runKit.js';

/*
 * SIGNAL HOPPER — you are a signal packet hopping up to the tower.
 *   Bottom half: lanes of STATIC (interference bursts) — touching one zaps you.
 *   Top half: DATA STREAMS — ride the moving packets; the gaps are dead air.
 * Twist: a signal meter. Dead air and shaded dead-zone cells drain it, normal
 * ground and packets top it up; empty = signal lost (a life). Collect bars to
 * charge BOOST HOP, which jumps 2 lanes at once.
 *
 * Keys: ▲▼◀▶ / 2 8 4 6 hop · OK / 5 / left soft boost hop (2 lanes)
 * Touch: tap above / below / beside the packet to hop · swipe up = boost
 */

const GAME_ID = 'hopper';
const BEST_KEY = 'vpg.hopper.best';
const CELL = 40;
const TOP = 40;            // y of row 0
const ROWS = 11;           // 0 tower · 1-4 streams · 5 relay · 6-9 static · 10 start
const START_ROW = 10;
const START_X = 180;
const BOOST_MAX = 3;
const DRAIN_DEAD_AIR = 55; // % per second
const DRAIN_ZONE = 24;
const REGEN = 7;
const HOP_MS = 90;

const rowY = (r) => TOP + r * CELL + CELL / 2;

export default class HopperScene extends Phaser.Scene {
  constructor() {
    super('HopperScene');
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
    this.level = 1;
    this.deliveries = 0;
    this.meter = 100;
    this.boost = 0;
    this.player = { x: START_X, row: START_ROW, fromX: START_X, fromRow: START_ROW, hopAt: -1000 };
    this.maxRow = START_ROW;
    this.invulnUntil = 0;
    this.bars = [];
    this.nextBarAt = 3000;
    this.clock = 0;          // ms of play (pauses with the game)
    this.zaps = 0;
    this.lastCause = '';

    this.g = this.add.graphics();
    this.scoreText = this.add.text(6, 2, 'Score: 0', mono('15px', css.fg));
    this.bestText = this.add.text(354, 2, `Best: ${this.best}`, mono('15px', css.accent)).setOrigin(1, 0);
    this.meterText = this.add.text(6, 21, '', mono('12px', css.fg));
    this.boostText = this.add.text(150, 21, '', mono('12px', css.warn));
    this.livesText = this.add.text(354, 21, '', mono('12px', css.danger)).setOrigin(1, 0);
    this.warnText = this.add.text(180, 252, '', mono('16px', css.danger, { stroke: css.bg, strokeThickness: 4 })).setOrigin(0.5).setDepth(20);

    bindPhoneInput(this, {
      up: () => this.act(() => this.hop(0, -1)),
      down: () => this.act(() => this.hop(0, 1)),
      left: () => this.act(() => this.hop(-1, 0)),
      right: () => this.act(() => this.hop(1, 0)),
      ok: () => this.onOk(),
      softLeft: () => this.onOk(),
      softRight: () => toMenu(this, GAME_ID),
      back: () => toMenu(this, GAME_ID)
    });
    this.input.on('pointerdown', (p) => { this.swipe = { x: p.x, y: p.y }; });
    this.input.on('pointerup', (p) => this.onTouch(p));

    this.buildLevel();
    Music.enter(GAME_ID);
    window.__vpg = window.__vpg || {};
    window.__vpg.game = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { if (window.__vpg.game === this) window.__vpg.game = null; });

    const start = () => this.startRun();
    if (this.skipHowTo) start();
    else {
      showHowTo(this, {
        title: 'Signal Hopper',
        tagline: 'You are a text message. Get to the tower!',
        lines: [
          'Dodge the STATIC bursts in the bottom lanes.',
          'Ride the DATA packets up top - the gaps are dead air.',
          'Dead air and shaded dead zones DRAIN your signal meter. Empty = signal lost.',
          'Grab ▮ bars to charge BOOST HOP (jumps 2 lanes).',
          'Reach the tower row to deliver. Each delivery speeds things up.'
        ],
        keys: [['▲▼◀▶ 2 8 4 6', 'hop'], ['OK / 5', 'boost hop (2 lanes up)'], ['Touch', 'tap a side to hop · swipe up = boost'], ['# / P', 'pause']],
        onStart: start
      });
      this.draw();
    }
  }

  act(fn) {
    if (this.phase !== 'play' || !this.alive || isFrozen(this)) return;
    fn();
  }

  startRun() {
    this.lives = perkLives(this, 3) + toughLives(this);
    beginRun(this, GAME_ID);
    setSoftKeys('Boost', 'Menu');
    this.refreshHud();
  }

  // ---- level ------------------------------------------------------------------

  buildLevel() {
    const sp = perkSpeed(this) * (1 + (this.level - 1) * 0.12);
    const lanes = [];
    const mk = (row, kind, dir, speed, w, gapMin, gapMax) => {
      const items = [];
      const L = 360 + 200;
      let x = Math.random() * 80;
      while (x < L) {
        const ww = Array.isArray(w) ? Phaser.Math.Between(w[0], w[1]) : w;
        items.push({ x, w: ww });
        x += ww + Phaser.Math.Between(gapMin, gapMax);
      }
      lanes[row] = { row, kind, dir, speed: speed * sp, items, L: Math.max(L, x), offset: 0 };
    };
    mk(1, 'stream', -1, 38, [110, 150], 50, 90);
    mk(2, 'stream', 1, 54, [80, 110], 60, 100);
    mk(3, 'stream', -1, 34, [120, 160], 50, 80);
    mk(4, 'stream', 1, 62, [80, 100], 70, 110);
    mk(6, 'static', 1, 70, 40, 100, 170);
    mk(7, 'static', -1, 92, 56, 110, 180);
    mk(8, 'static', 1, 58, 72, 120, 190);
    mk(9, 'static', -1, 108, 40, 120, 200);
    this.lanes = lanes;
    // dead zones: fixed cells on the relay row and in static lanes
    const zones = new Set();
    const cols = Phaser.Utils.Array.Shuffle([0, 1, 2, 3, 5, 6, 7, 8]);
    zones.add(`5,${cols[0]}`);
    zones.add(`5,${cols[1]}`);
    if (this.level > 1) zones.add(`5,${cols[2]}`);
    [6, 7, 8, 9].forEach((r) => { if (Math.random() < 0.5 + this.level * 0.1) zones.add(`${r},${Phaser.Math.Between(0, 8)}`); });
    this.zones = zones;
  }

  // ---- input --------------------------------------------------------------------

  onOk() {
    if (this.phase === 'over') { retry(this); return; }
    this.act(() => this.boostHop());
  }

  onTouch(p) {
    if (this.phase !== 'play' || !this.alive || isFrozen(this) || !this.swipe) return;
    const dx = p.x - this.swipe.x;
    const dy = p.y - this.swipe.y;
    this.swipe = null;
    if (dy < -70 && Math.abs(dy) > Math.abs(dx)) { this.boostHop(); return; }
    if (Math.hypot(dx, dy) >= 20) {
      if (Math.abs(dx) > Math.abs(dy)) this.hop(Math.sign(dx), 0);
      else this.hop(0, Math.sign(dy));
      return;
    }
    const px = this.player.x;
    const py = rowY(this.player.row);
    const ex = p.x - px;
    const ey = p.y - py;
    if (Math.abs(ey) > Math.abs(ex)) this.hop(0, Math.sign(ey));
    else this.hop(Math.sign(ex), 0);
  }

  hop(dx, dy, rows = 1) {
    const pl = this.player;
    const nr = Phaser.Math.Clamp(pl.row + dy * rows, 0, ROWS - 1);
    const nx = Phaser.Math.Clamp(pl.x + dx * CELL, 20, 340);
    if (nr === pl.row && nx === pl.x) return false;
    pl.fromX = pl.x;
    pl.fromRow = pl.row;
    pl.hopAt = this.clock;
    pl.row = nr;
    pl.x = nx;
    if (dy < 0 && nr < this.maxRow) {
      const gained = this.maxRow - nr;
      this.maxRow = nr;
      this.addPoints(10 * gained, true);
    }
    Sfx.play(rows > 1 ? 'hopBoost' : 'hopHop');
    if (nr === 0) this.deliver();
    return true;
  }

  boostHop() {
    if (this.boost <= 0) { Sfx.play('hopDrain'); this.flashWarn('No bars for boost!'); return false; }
    if (this.player.row === 0) return false;
    this.boost -= 1;
    this.hop(0, -1, 2);
    this.refreshHud();
    return true;
  }

  // ---- rules ----------------------------------------------------------------------

  addPoints(n, quiet = false) {
    const gain = perkPoints(this, n, { quiet });
    this.score += gain;
    this.scoreText.setText(`Score: ${this.score}`);
    return gain;
  }

  deliver() {
    this.deliveries += 1;
    const bonus = this.addPoints(100 + Math.floor(this.meter));
    Sfx.play('hopDeliver');
    this.flashWarn(`DELIVERED! +${bonus}`, this.pal.css.fg);
    this.level += 1;
    this.buildLevel();
    this.resetPlayer();
  }

  resetPlayer() {
    const pl = this.player;
    pl.x = START_X; pl.row = START_ROW; pl.fromX = START_X; pl.fromRow = START_ROW; pl.hopAt = -1000;
    this.maxRow = START_ROW;
    this.meter = 100;
    this.invulnUntil = this.clock + 1000;
  }

  loseLife(cause) {
    this.lives -= 1;
    this.zaps += 1;
    this.lastCause = cause;
    Sfx.play('hopZap');
    this.cameras.main.shake(180, 0.012);
    this.flashWarn(cause);
    this.refreshHud();
    if (this.lives <= 0) {
      endRun(this, { gameId: GAME_ID, bestKey: BEST_KEY, reason: cause });
      this.draw();
      return;
    }
    this.resetPlayer();
  }

  flashWarn(msg, color) {
    this.warnText.setText(msg).setColor(color || this.pal.css.danger).setAlpha(1);
    this.tweens.killTweensOf(this.warnText);
    this.tweens.add({ targets: this.warnText, alpha: 0, delay: 700, duration: 400 });
  }

  refreshHud() {
    const m = Math.max(0, Math.round(this.meter));
    const bars = Math.ceil(m / 20);
    this.meterText.setText(`SIG ${'▮'.repeat(bars)}${'▯'.repeat(5 - bars)} ${m}%`);
    this.meterText.setColor(m < 30 ? this.pal.css.danger : this.pal.css.fg);
    this.boostText.setText(`BOOST ${'◆'.repeat(this.boost)}${'◇'.repeat(BOOST_MAX - this.boost)}`);
    this.livesText.setText(this.lives != null ? '♥'.repeat(Math.max(0, this.lives)) : '');
  }

  laneItemsAt(lane) {
    // items in screen coords, wrapped
    const out = [];
    lane.items.forEach((it) => {
      let x = ((it.x + lane.offset) % lane.L + lane.L) % lane.L - 100;
      out.push({ x, w: it.w, ref: it });
    });
    return out;
  }

  update(time, delta) {
    if (this.phase !== 'play' || !this.alive || isFrozen(this)) { if (this.phase !== 'play') this.draw(); return; }
    const dt = Math.min(delta, 50);
    this.clock += dt;
    const s = dt / 1000;
    // lanes move
    this.lanes.forEach((lane) => { if (lane) lane.offset = (lane.offset || 0) + lane.dir * lane.speed * s; });
    const pl = this.player;
    const lane = this.lanes[pl.row];
    let drain = 0;
    let onPacket = false;
    let cause = '';
    if (lane && lane.kind === 'stream') {
      const items = this.laneItemsAt(lane);
      onPacket = items.some((it) => pl.x >= it.x - 6 && pl.x <= it.x + it.w + 6);
      if (onPacket) {
        pl.x += lane.dir * lane.speed * s;
        pl.fromX += lane.dir * lane.speed * s;
        if (pl.x < 6 || pl.x > 354) cause = 'Carried out of range!';
      } else {
        drain = DRAIN_DEAD_AIR;
      }
    }
    if (lane && lane.kind === 'static' && this.clock > this.invulnUntil && this.clock - pl.hopAt > HOP_MS * 0.5) {
      const items = this.laneItemsAt(lane);
      if (items.some((it) => pl.x + 12 > it.x && pl.x - 12 < it.x + it.w)) cause = 'Zapped by static!';
    }
    const col = Math.round((pl.x - 20) / CELL);
    if (this.zones.has(`${pl.row},${col}`)) drain = Math.max(drain, DRAIN_ZONE);
    if (drain) {
      this.meter -= drain * s;
      Sfx.play('hopDrain');
    } else {
      this.meter = Math.min(100, this.meter + REGEN * s * (onPacket ? 0.6 : 1));
    }
    this.draining = drain;
    if (this.meter <= 0 && !cause) cause = 'Signal lost in a dead zone!';
    // bars
    if (this.clock >= this.nextBarAt) {
      this.nextBarAt = this.clock + Phaser.Math.Between(hasLuck(this) ? 3500 : 5500, hasLuck(this) ? 6000 : 9000);
      this.spawnBar();
    }
    this.bars = this.bars.filter((b) => this.clock < b.until);
    this.bars.forEach((b) => {
      const bx = this.barX(b);
      if (b.row === pl.row && Math.abs(bx - pl.x) < 24) {
        b.until = 0;
        this.boost = Math.min(BOOST_MAX, this.boost + 1);
        this.meter = Math.min(100, this.meter + 20);
        this.addPoints(25);
        Sfx.play('hopBar');
      }
    });
    this.refreshHud();
    if (cause) { this.loseLife(cause); return; }
    this.draw();
  }

  spawnBar() {
    const row = Phaser.Utils.Array.GetRandom([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const lane = this.lanes[row];
    if (lane && lane.kind === 'stream') {
      const it = Phaser.Utils.Array.GetRandom(lane.items);
      this.bars.push({ row, lane, item: it, dx: it.w / 2, until: this.clock + 8000 });
    } else {
      this.bars.push({ row, x: 20 + Phaser.Math.Between(0, 8) * CELL, until: this.clock + 8000 });
    }
  }

  barX(b) {
    if (!b.lane) return b.x;
    return ((b.item.x + b.lane.offset) % b.lane.L + b.lane.L) % b.lane.L - 100 + b.dx;
  }

  // ---- drawing --------------------------------------------------------------------

  draw() {
    const g = this.g;
    const P = this.pal;
    g.clear();
    // HUD band
    g.fillStyle(P.panel, 1).fillRect(0, 0, 360, TOP);
    // tower row
    g.fillStyle(P.panel, 1).fillRect(0, TOP, 360, CELL);
    const tx = 180;
    g.fillStyle(P.fg, 1);
    g.fillRect(tx - 2, TOP + 6, 4, 32);
    g.fillTriangle(tx - 12, TOP + 38, tx + 12, TOP + 38, tx, TOP + 14);
    g.fillStyle(P.bg, 1).fillTriangle(tx - 6, TOP + 38, tx + 6, TOP + 38, tx, TOP + 24);
    const wave = Math.floor((this.clock || this.time.now) / 300) % 3;
    g.lineStyle(2, P.accent, 1);
    for (let i = 0; i <= wave; i++) {
      g.beginPath(); g.arc(tx, TOP + 8, 8 + i * 7, Math.PI * 1.15, Math.PI * 1.45); g.strokePath();
      g.beginPath(); g.arc(tx, TOP + 8, 8 + i * 7, Math.PI * 1.55, Math.PI * 1.85); g.strokePath();
    }
    for (let i = 0; i < 9; i++) { if (Math.abs(i - 4) > 0) { g.fillStyle(P.dim, 1).fillRect(20 + i * CELL - 2, TOP + 30, 4, 8); } }
    // rows
    for (let r = 1; r < ROWS; r++) {
      const y = TOP + r * CELL;
      const lane = this.lanes[r];
      if (lane && lane.kind === 'stream') {
        // dead air
        g.fillStyle(0x000000, 0.35).fillRect(0, y, 360, CELL);
        g.fillStyle(P.dim, 0.5);
        for (let x = (r * 7) % 12; x < 360; x += 12) g.fillRect(x, y + ((x / 12 + r) % 3) * 12 + 6, 2, 2);
        lane.offset = lane.offset || 0;
        this.laneItemsAt(lane).forEach((it) => {
          g.fillStyle(P.body, 1).fillRect(it.x, y + 6, it.w, CELL - 12);
          g.fillStyle(P.fg, 1);
          for (let bx = it.x + 6; bx < it.x + it.w - 6; bx += 10) g.fillRect(bx, y + 12 + ((Math.floor(bx) >> 3) % 2) * 8, 5, 6);
          g.lineStyle(2, P.fg, 1).strokeRect(it.x, y + 6, it.w, CELL - 12);
        });
      } else if (lane && lane.kind === 'static') {
        g.fillStyle(P.bg, 1).fillRect(0, y, 360, CELL);
        g.lineStyle(1, P.dim, 0.6).lineBetween(0, y + CELL, 360, y + CELL);
        lane.offset = lane.offset || 0;
        const jitter = Math.floor((this.clock || 0) / 60);
        this.laneItemsAt(lane).forEach((it) => {
          g.lineStyle(3, P.danger, 1);
          g.beginPath();
          for (let k = 0; k <= it.w; k += 6) {
            const yy = y + CELL / 2 + (((k / 6 + jitter) % 2) ? -12 : 12) * (0.6 + ((k * 13 + jitter) % 5) / 10);
            if (k === 0) g.moveTo(it.x + k, yy); else g.lineTo(it.x + k, yy);
          }
          g.strokePath();
        });
      } else {
        g.fillStyle(r === START_ROW ? P.panel : P.panel, 1).fillRect(0, y, 360, CELL);
        g.fillStyle(P.dim, 0.5);
        for (let x = 0; x < 360; x += 20) g.fillRect(x + 8, y + CELL / 2 - 1, 6, 2);
      }
    }
    // dead zones
    this.zones.forEach((k) => {
      const [r, c] = k.split(',').map(Number);
      const x = c * CELL;
      const y = TOP + r * CELL;
      g.fillStyle(0x000000, 0.45).fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      g.lineStyle(1, P.dim, 0.9);
      for (let d = -CELL; d < CELL; d += 8) g.lineBetween(x + Math.max(0, d), y + Math.max(0, -d), x + Math.min(CELL, d + CELL), y + Math.min(CELL, CELL - d));
    });
    // bars
    this.bars.forEach((b) => {
      const bx = this.barX(b);
      const by = rowY(b.row);
      const blink = b.until - this.clock < 2000 && Math.floor(this.clock / 150) % 2;
      if (blink) return;
      g.fillStyle(P.warn, 1);
      for (let i = 0; i < 3; i++) g.fillRect(bx - 9 + i * 7, by + 8 - i * 5 - 4, 5, 4 + i * 5);
    });
    // player packet
    const pl = this.player;
    const t = Phaser.Math.Clamp((this.clock - pl.hopAt) / HOP_MS, 0, 1);
    const px = Phaser.Math.Linear(pl.fromX, pl.x, t);
    const py = Phaser.Math.Linear(rowY(pl.fromRow), rowY(pl.row), t) - Math.sin(t * Math.PI) * 8;
    const inv = this.clock < this.invulnUntil && Math.floor(this.clock / 100) % 2;
    if (!inv) {
      g.fillStyle(P.fg, 1).fillRect(px - 13, py - 9, 26, 18);
      g.lineStyle(2, P.bg, 1);
      g.lineBetween(px - 12, py - 8, px, py + 1);
      g.lineBetween(px + 12, py - 8, px, py + 1);
      g.fillStyle(P.warn, 1).fillRect(px + 9, py - 15, 2, 6);
      if (this.draining) {
        g.lineStyle(2, P.danger, 1).strokeRect(px - 16, py - 12, 32, 24);
      }
    }
  }
}
