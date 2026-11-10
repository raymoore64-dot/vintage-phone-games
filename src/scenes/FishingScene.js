import Phaser from 'phaser';
import { bindPhoneInput, setSoftKeys } from '../input/PhoneInput.js';
import { isFrozen, gameNow } from '../ui/PauseOverlay.js';
import * as Sfx from '../audio/Sfx.js';
import * as Music from '../audio/Music.js';
import * as Phone from '../phone/Phone.js';
import { perkSpeed, perkPoints, perkLives, toughLives, hasLuck } from '../skins/perks.js';
import { palette, mono, showHowTo, beginRun, endRun, retry, toMenu, fmtTime } from '../games/runKit.js';

/*
 * BUZZ FISHING — fishing by feel.
 * Aim: move the bobber over the lake. The phone pulses (vibration where the
 * device supports it, a screen shake and a buzz tone): the closer the fish,
 * the faster, stronger and higher-pitched. A faint ripple on the LCD is
 * the only visual clue, so it's playable with no vibration motor.
 * Cast (OK), feel the nibbles, then press OK on the BITE buzz — too early
 * spooks it, too late and it's gone. Reel by ALTERNATING ◀ ▶ while
 * keeping the tension meter out of the red (snap) and off zero (slack).
 * 2 minutes, 3 lines.
 */

const GAME_ID = 'fishing';
const BEST_KEY = 'vpg.fishing.best';
const RUN_MS = 120000;
const COLS = 7;
const ROWS = 5;
const LAKE = { x: 10, y: 48, w: 340, h: 330 };
const cellX = (c) => 40 + c * 46.67;
const cellY = (r) => 92 + r * 62;
const SPECIES = [
  { name: 'Pixel Perch', min: 0.5, max: 1.5, pull: 0.8, pts: 0 },
  { name: 'Byte Bass', min: 1, max: 3, pull: 1, pts: 20 },
  { name: 'Static Eel', min: 2, max: 4, pull: 1.4, pts: 45 },
  { name: 'Golden Modem Carp', min: 4, max: 6, pull: 1.2, pts: 120 }
];

export default class FishingScene extends Phaser.Scene {
  constructor() {
    super('FishingScene');
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
    this.mode = 'aim';            // aim | cast | wait | reel
    this.cursor = { c: 3, r: 2 };
    this.catches = [];
    this.nextPulseAt = 0;
    this.ripples = [];
    this.nextFishRipple = 0;
    this.clockStart = null;
    this.spawnFish();

    this.g = this.add.graphics();
    this.scoreText = this.add.text(6, 2, 'Score: 0', mono('15px', css.fg));
    this.bestText = this.add.text(354, 2, `Best: ${this.best}`, mono('15px', css.accent)).setOrigin(1, 0);
    this.timeText = this.add.text(6, 22, '', mono('13px', css.text));
    this.linesText = this.add.text(354, 22, '', mono('13px', css.danger)).setOrigin(1, 0);
    this.msg = this.add.text(180, 400, '', mono('15px', css.warn, { align: 'center' })).setOrigin(0.5, 0);
    this.hint = this.add.text(180, 458, '', mono('12px', css.dim)).setOrigin(0.5);
    this.bigMsg = this.add.text(180, 200, '', mono('22px', css.fg, { stroke: css.bg, strokeThickness: 5, align: 'center' })).setOrigin(0.5).setDepth(20);

    bindPhoneInput(this, {
      up: () => this.act(() => this.moveCursor(0, -1)),
      down: () => this.act(() => this.moveCursor(0, 1)),
      left: () => this.act(() => this.onSide('left')),
      right: () => this.act(() => this.onSide('right')),
      ok: () => this.onOk(),
      softLeft: () => this.onOk(),
      softRight: () => toMenu(this, GAME_ID),
      back: () => toMenu(this, GAME_ID)
    });
    this.input.on('pointerup', (p) => this.onTouch(p));

    Music.enter(GAME_ID);
    window.__vpg = window.__vpg || {};
    window.__vpg.game = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { if (window.__vpg.game === this) window.__vpg.game = null; });

    const start = () => this.startRun();
    if (this.skipHowTo) start();
    else {
      showHowTo(this, {
        title: 'Buzz Fishing',
        tagline: 'Fishing by feel. Close your eyes if you dare.',
        lines: [
          'Move the bobber. The phone buzzes faster, harder and higher the closer you are to fish (watch for faint ripples too).',
          'OK to cast. Little nibbles... wait for the BIG BITE buzz, then OK! Too early spooks it.',
          'Reel by ALTERNATING ◀ ▶. Keep tension out of the red (line snaps) and above zero (slack = it escapes).',
          '2 minutes, 3 lines. Bigger fish = more points.'
        ],
        keys: [['▲▼◀▶ 2 8 4 6', 'move bobber'], ['OK / 5', 'cast · strike'], ['◀ ▶ / 4 6', 'reel (alternate!)'], ['Touch', 'tap water = aim · tap shore = cast/strike · tap L/R halves to reel']],
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
    this.lines = perkLives(this, 3) + toughLives(this);
    beginRun(this, GAME_ID);
    setSoftKeys('Cast', 'Menu');
    this.setMode('aim');
  }

  now() {
    return gameNow(this);
  }

  timeLeft() {
    if (this.clockStart == null) return RUN_MS;
    return Math.max(0, RUN_MS - (this.now() - this.clockStart));
  }

  // ---- fish ----------------------------------------------------------------------

  spawnFish() {
    const roll = Math.random();
    const luck = hasLuck(this) ? 0.08 : 0;
    const sp = roll < 0.06 + luck ? 3 : roll < 0.3 ? 2 : roll < 0.65 ? 1 : 0;
    const s = SPECIES[sp];
    this.fish = {
      x: Phaser.Math.Between(40, 320), y: Phaser.Math.Between(92, 340),
      tx: 0, ty: 0, species: s, weight: Math.round(Phaser.Math.FloatBetween(s.min, s.max) * 10) / 10
    };
    this.pickFishTarget();
  }

  pickFishTarget() {
    const f = this.fish;
    f.tx = Phaser.Math.Clamp(f.x + Phaser.Math.Between(-60, 60), 40, 320);
    f.ty = Phaser.Math.Clamp(f.y + Phaser.Math.Between(-50, 50), 92, 340);
  }

  bobber() {
    return { x: cellX(this.cursor.c), y: cellY(this.cursor.r) };
  }

  proximity() {
    const b = this.bobber();
    const d = Math.hypot(b.x - this.fish.x, b.y - this.fish.y);
    return { d, p: Phaser.Math.Clamp(1 - d / 260, 0, 1) };
  }

  // ---- input ---------------------------------------------------------------------

  moveCursor(dc, dr) {
    if (this.mode !== 'aim') return;
    this.cursor.c = Phaser.Math.Clamp(this.cursor.c + dc, 0, COLS - 1);
    this.cursor.r = Phaser.Math.Clamp(this.cursor.r + dr, 0, ROWS - 1);
    this.nextPulseAt = Math.min(this.nextPulseAt, this.now() + 120);
    Sfx.play('menuMove');
  }

  onSide(side) {
    if (this.mode === 'aim') this.moveCursor(side === 'left' ? -1 : 1, 0);
    else if (this.mode === 'reel') this.reelPress(side);
  }

  onOk() {
    if (this.phase === 'over') { retry(this); return; }
    this.act(() => {
      if (this.mode === 'aim') this.cast();
      else if (this.mode === 'wait') this.strike();
    });
  }

  onTouch(p) {
    if (this.phase !== 'play' || !this.alive || isFrozen(this)) return;
    if (this.mode === 'reel') { this.reelPress(p.x < 180 ? 'left' : 'right'); return; }
    if (p.y > LAKE.y + LAKE.h) { this.onOk(); return; }
    if (this.mode === 'aim') {
      this.cursor.c = Phaser.Math.Clamp(Math.round((p.x - 40) / 46.67), 0, COLS - 1);
      this.cursor.r = Phaser.Math.Clamp(Math.round((p.y - 92) / 62), 0, ROWS - 1);
      this.nextPulseAt = this.now() + 100;
    } else if (this.mode === 'wait') this.strike();
  }

  // ---- phases --------------------------------------------------------------------

  setMode(m) {
    this.mode = m;
    const hints = {
      aim: '▲▼◀▶ aim by feel · OK cast',
      cast: '',
      wait: 'wait for the BIG buzz... then OK!',
      reel: 'alternate ◀ ▶ to reel · watch tension'
    };
    this.hint.setText(hints[m] || '');
    setSoftKeys(m === 'aim' ? 'Cast' : m === 'wait' ? 'Strike' : '', 'Menu');
  }

  say(text, color) {
    this.msg.setText(text).setColor(color || this.pal.css.warn);
  }

  cast() {
    const { d } = this.proximity();
    const t = this.now();
    this.cast_ = { at: t, d };
    Sfx.play('fishCast');
    this.setMode('cast');
    this.say('');
    this.castEnd = t + 450;
  }

  beginWait() {
    const t = this.now();
    const { d } = this.cast_;
    const w = { start: t, nibbles: [], biteAt: Infinity, window: 0, giveUpAt: t + 4200 };
    if (d < 110) {
      const n = Phaser.Math.Between(1, 3);
      let at = t + Phaser.Math.Between(600, 1200);
      for (let i = 0; i < n; i++) { w.nibbles.push(at); at += Phaser.Math.Between(450, 1000); }
      w.biteAt = at + Phaser.Math.Between(200, 700);
      w.window = (d < 60 ? 650 : 480) / perkSpeed(this);
      w.giveUpAt = w.biteAt + w.window;
    }
    this.wait = w;
    this.setMode('wait');
  }

  strike() {
    const t = this.now();
    const w = this.wait;
    if (!w) return;
    if (t >= w.biteAt && t <= w.biteAt + w.window) {
      Sfx.play('fishHook');
      this.say('HOOKED!', this.pal.css.fg);
      this.startReel();
      return;
    }
    // too early
    Sfx.play('fishEscape');
    this.say(w.biteAt === Infinity ? 'Nothing there...' : 'Too early! Spooked it.', this.pal.css.danger);
    if (w.biteAt !== Infinity) this.spawnFish();
    this.wait = null;
    this.setMode('aim');
  }

  startReel() {
    const f = this.fish;
    this.reel = {
      dist: 100, tension: 35, last: null, slackSince: null,
      surgeUntil: 0, nextSurge: this.now() + Phaser.Math.Between(900, 1800),
      pull: f.species.pull * (0.7 + f.weight / 6) * perkSpeed(this)
    };
    this.wait = null;
    this.setMode('reel');
  }

  reelPress(side) {
    const r = this.reel;
    if (!r) return;
    if (r.last === side) {
      r.tension = Math.min(100, r.tension + 3);
      this.say('Alternate ◀ ▶!', this.pal.css.danger);
      return;
    }
    r.last = side;
    const w = this.fish.weight;
    r.dist -= Math.max(1.4, 4 - w * 0.35);
    r.tension = Math.min(100, r.tension + 5 + w * 1.1);
    Sfx.play('fishReel');
    if (r.dist <= 0) this.landFish();
  }

  landFish() {
    const f = this.fish;
    const pts = this.addPoints(Math.round(f.weight * 40 + f.species.pts));
    this.catches.push({ name: f.species.name, weight: f.weight, pts });
    Sfx.play('fishCatch');
    Phone.vibrate([40, 40, 40]);
    this.bigMsg.setText(`${f.species.name}\n${f.weight} kg  +${pts}`).setAlpha(1);
    this.tweens.killTweensOf(this.bigMsg);
    this.tweens.add({ targets: this.bigMsg, alpha: 0, delay: 1300, duration: 500 });
    this.say('');
    this.reel = null;
    this.spawnFish();
    this.setMode('aim');
  }

  loseFish(snap) {
    this.reel = null;
    if (snap) {
      this.lines -= 1;
      Sfx.play('fishSnap');
      this.cameras.main.shake(160, 0.01);
      this.say('SNAP! Line broke.', this.pal.css.danger);
      if (this.lines <= 0) { this.finish('Out of fishing line'); return; }
    } else {
      Sfx.play('fishEscape');
      this.say('Slack line... it escaped.', this.pal.css.danger);
    }
    this.spawnFish();
    this.setMode('aim');
  }

  addPoints(n) {
    const gain = perkPoints(this, n);
    this.score += gain;
    this.scoreText.setText(`Score: ${this.score}`);
    return gain;
  }

  finish(reason) {
    endRun(this, { gameId: GAME_ID, bestKey: BEST_KEY, reason: `${reason} · ${this.catches.length} caught` });
    this.draw();
  }

  pulse(p) {
    const strength = Math.round(10 + 55 * p);
    Phone.vibrate(strength);
    Sfx.tone('fishBuzz', 150 + 650 * p, 0.05 + 0.04 * p, 'square', 0.04 + 0.08 * p);
    if (p > 0.05) this.cameras.main.shake(90, 0.0006 + 0.006 * p * p);
    const b = this.bobber();
    this.ripples.push({ x: b.x, y: b.y, born: this.now(), max: 10 + 26 * p, alpha: 0.25 + 0.5 * p });
    this.lastPulse = { p, strength, at: this.now() };
  }

  // ---- update ---------------------------------------------------------------------

  update(time, delta) {
    if (this.phase !== 'play' || !this.alive || isFrozen(this)) { if (this.phase !== 'play') this.draw(); return; }
    const t = this.now();
    if (this.clockStart == null) this.clockStart = t;
    const s = Math.min(delta, 50) / 1000;
    if (this.timeLeft() <= 0) { this.finish("Time's up"); return; }
    // fish wander (not while hooked)
    const f = this.fish;
    if (this.mode === 'aim' || this.mode === 'cast') {
      const dx = f.tx - f.x;
      const dy = f.ty - f.y;
      const d = Math.hypot(dx, dy);
      if (d < 3) this.pickFishTarget();
      else { f.x += dx / d * 14 * s; f.y += dy / d * 14 * s; }
    }
    if (t >= this.nextFishRipple) {
      this.nextFishRipple = t + Phaser.Math.Between(2400, 4200);
      this.ripples.push({ x: f.x, y: f.y, born: t, max: 14, alpha: 0.18, faint: true });
    }
    if (this.mode === 'aim' && t >= this.nextPulseAt) {
      const { p } = this.proximity();
      this.pulse(p);
      this.nextPulseAt = t + (1300 - 1050 * p);
    }
    if (this.mode === 'cast' && t >= this.castEnd) this.beginWait();
    if (this.mode === 'wait') {
      const w = this.wait;
      while (w.nibbles.length && t >= w.nibbles[0]) {
        w.nibbles.shift();
        Sfx.play('fishNibble');
        Phone.vibrate(15);
        this.cameras.main.shake(70, 0.0015);
        this.dipUntil = t + 150;
      }
      if (t >= w.biteAt && !w.bit) {
        w.bit = true;
        Sfx.play('fishBite');
        Phone.vibrate([60, 40, 60]);
        this.cameras.main.shake(260, 0.009);
        this.dipUntil = t + w.window;
      }
      if (t > w.giveUpAt) {
        this.say(w.biteAt === Infinity ? "Nothing's biting here..." : 'Too slow! It got away.', this.pal.css.danger);
        if (w.biteAt !== Infinity) { Sfx.play('fishEscape'); this.spawnFish(); }
        this.wait = null;
        this.setMode('aim');
      }
    }
    if (this.mode === 'reel') {
      const r = this.reel;
      if (t >= r.nextSurge) {
        r.surgeUntil = t + Phaser.Math.Between(400, 800);
        r.nextSurge = r.surgeUntil + Phaser.Math.Between(700, 1800);
        Phone.vibrate(40);
      }
      const surging = t < r.surgeUntil;
      r.tension += (surging ? 45 * r.pull : 0) * s - 26 * s;
      r.dist = Math.min(100, r.dist + (surging ? 7 * r.pull : 1.2) * s);
      if (surging) this.cameras.main.shake(50, 0.002);
      r.tension = Math.max(0, r.tension);
      if (r.tension >= 100) { this.loseFish(true); this.draw(); return; }
      if (r.tension < 8) {
        if (r.slackSince == null) r.slackSince = t;
        if (t - r.slackSince > 2500) { this.loseFish(false); this.draw(); return; }
      } else r.slackSince = null;
    }
    this.timeText.setText(`⏱ ${fmtTime(this.timeLeft())}`);
    this.linesText.setText(`LINES ${'|'.repeat(Math.max(0, this.lines))}`);
    this.ripples = this.ripples.filter((rp) => t - rp.born < 1200);
    this.draw();
  }

  // ---- draw ---------------------------------------------------------------------

  draw() {
    const g = this.g;
    const P = this.pal;
    const t = this.phase === 'play' ? this.now() : this.time.now;
    g.clear();
    // lake
    g.fillStyle(P.panel, 1).fillRect(LAKE.x, LAKE.y, LAKE.w, LAKE.h);
    g.lineStyle(2, P.dim, 1).strokeRect(LAKE.x, LAKE.y, LAKE.w, LAKE.h);
    // gentle water lines
    g.lineStyle(1, P.dim, 0.5);
    for (let y = LAKE.y + 20; y < LAKE.y + LAKE.h; y += 26) {
      const off = ((t / 60) + y * 3) % 40;
      for (let x = LAKE.x + off - 40; x < LAKE.x + LAKE.w - 10; x += 40) {
        if (x > LAKE.x) g.lineBetween(x, y, x + 12, y);
      }
    }
    // ripples (faint hints + bobber pulses)
    this.ripples.forEach((rp) => {
      const k = (t - rp.born) / 1200;
      g.lineStyle(1, rp.faint ? P.dim : P.accent, rp.alpha * (1 - k));
      g.strokeCircle(rp.x, rp.y, 4 + rp.max * k);
      if (!rp.faint && rp.max > 20) g.strokeCircle(rp.x, rp.y, 2 + rp.max * k * 0.6);
    });
    // aim grid dots
    if (this.mode === 'aim') {
      g.fillStyle(P.dim, 0.6);
      for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) g.fillRect(cellX(c) - 1, cellY(r) - 1, 2, 2);
    }
    // shore + angler
    g.fillStyle(P.bg, 1).fillRect(0, LAKE.y + LAKE.h + 2, 360, 100);
    g.fillStyle(P.body, 1).fillRect(0, LAKE.y + LAKE.h + 4, 360, 6);
    const ax = 180;
    const ay = 392;
    g.fillStyle(P.fg, 1).fillRect(ax - 5, ay - 2, 10, 10);
    // bobber + line
    const b = this.bobber();
    let by = b.y;
    let bx = b.x;
    if (this.mode === 'cast') {
      const k = Phaser.Math.Clamp(1 - (this.castEnd - t) / 450, 0, 1);
      bx = Phaser.Math.Linear(ax, b.x, k);
      by = Phaser.Math.Linear(ay, b.y, k) - Math.sin(k * Math.PI) * 60;
    }
    if (this.mode === 'reel' && this.reel) {
      const k = this.reel.dist / 100;
      bx = Phaser.Math.Linear(ax, b.x, k) + Math.sin(t / 90) * (t < this.reel.surgeUntil ? 6 : 2);
      by = Phaser.Math.Linear(ay - 20, b.y, k);
    }
    const dipping = this.dipUntil && t < this.dipUntil;
    g.lineStyle(1, P.text, 0.8).lineBetween(ax, ay - 4, bx, by + (dipping ? 4 : 0));
    if (this.mode !== 'aim' || Math.floor(t / 400) % 2 === 0 || true) {
      if (this.mode === 'aim') {
        g.lineStyle(2, P.fg, 1).strokeCircle(bx, by, 9);
        g.lineBetween(bx - 13, by, bx - 6, by); g.lineBetween(bx + 6, by, bx + 13, by);
      } else {
        g.fillStyle(P.danger, 1).fillRect(bx - 4, by - 6 + (dipping ? 6 : 0), 8, dipping ? 3 : 7);
        g.fillStyle(P.text, 1).fillRect(bx - 4, by + 1 + (dipping ? 3 : 0), 8, dipping ? 1 : 4);
      }
    }
    // reel UI: tension meter
    if (this.mode === 'reel' && this.reel) {
      const r = this.reel;
      g.fillStyle(P.bg, 1).fillRect(20, 408, 320, 18);
      g.lineStyle(2, P.fg, 1).strokeRect(20, 408, 320, 18);
      g.fillStyle(P.danger, 0.35).fillRect(20 + 320 * 0.85, 409, 320 * 0.15 - 1, 16);
      g.fillStyle(P.dim, 0.5).fillRect(21, 409, 320 * 0.08, 16);
      g.fillStyle(r.tension > 85 ? P.danger : P.fg, 1).fillRect(22, 411, 316 * Math.min(1, r.tension / 100), 12);
      g.fillStyle(P.accent, 1).fillRect(20, 432, 320 * (1 - r.dist / 100), 4);
      this.msg.setY(440);
    } else this.msg.setY(404);
  }
}
