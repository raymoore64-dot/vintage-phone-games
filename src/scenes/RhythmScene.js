import Phaser from 'phaser';
import { bindPhoneInput, setSoftKeys } from '../input/PhoneInput.js';
import { isFrozen, gameNow } from '../ui/PauseOverlay.js';
import * as Sfx from '../audio/Sfx.js';
import * as Music from '../audio/Music.js';
import { getAudioContext } from '../audio/beep.js';
import { perkSpeed, perkPoints, perkLives, useTough } from '../skins/perks.js';
import { palette, mono, showHowTo, beginRun, endRun, retry, toMenu } from '../games/runKit.js';

/*
 * RING RHYTHM — tap along to your ringtone.
 * The chart is generated from the chosen ringtone's melody (Music.js
 * songs: four built-in ringtones + the menu theme). Notes fall into three
 * lanes (low / mid / high pitch) and are judged against the AudioContext
 * clock that schedules the music: PERFECT ±45 ms, GOOD ±100 ms, BAD ±150 ms.
 * Combo raises the multiplier (x2 at 10, x3 at 20, x4 at 30). Misses drain
 * the signal bar; empty = dropped call. 6 loops, getting denser.
 * If music is off the chart runs on the pausable game clock and your taps
 * play the melody instead.
 *
 * Keys: left lane 1 4 7 / ◀ · middle 2 5 8 / ▲ ▼ OK · right 3 6 9 / ▶
 * Touch: tap the left / middle / right third of the screen.
 */

const GAME_ID = 'rhythm';
const BEST_KEY = 'vpg.rhythm.best';
const TONE_KEY = 'vpg.rhythm.tone';
const LOOPS = 6;
const PERFECT = 0.045;
const GOOD = 0.1;
const BAD = 0.15;
const HIT_Y = 396;
const SPAWN_Y = 64;
const LANE_X = [70, 180, 290];
const LANE_KEYS = ['1 4 7', '2 5 8', '3 6 9'];
const DIGIT_LANE = { 1: 0, 4: 0, 7: 0, 2: 1, 5: 1, 8: 1, 3: 2, 6: 2, 9: 2 };
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function midiOf(n) {
  const m = /^([A-G])([#b]?)(-?\d+)$/.exec(n);
  if (!m) return 60;
  let s = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return (parseInt(m[3], 10) + 1) * 12 + s;
}
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

export default class RhythmScene extends Phaser.Scene {
  constructor() {
    super('RhythmScene');
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
    this.fromDigit = false;
    this.toneIndex = Math.max(0, Music.RINGTONES.findIndex((r) => r.id === localStorage.getItem(TONE_KEY)));
    this.notes = [];
    this.combo = 0;
    this.maxCombo = 0;
    this.health = 100;
    this.counts = { perfect: 0, good: 0, bad: 0, miss: 0, ghost: 0 };
    this.epochKey = '';
    this.loopIdx = 0;
    this.flashes = [0, 0, 0];
    this.lastJudge = null;

    this.g = this.add.graphics();
    this.scoreText = this.add.text(6, 2, 'Score: 0', mono('15px', css.fg));
    this.bestText = this.add.text(354, 2, `Best: ${this.best}`, mono('15px', css.accent)).setOrigin(1, 0);
    this.comboText = this.add.text(180, 150, '', mono('26px', css.fg, { stroke: css.bg, strokeThickness: 4 })).setOrigin(0.5).setDepth(5);
    this.judgeText = this.add.text(180, 300, '', mono('22px', css.warn, { stroke: css.bg, strokeThickness: 5 })).setOrigin(0.5).setDepth(5);
    this.infoText = this.add.text(180, 40, '', mono('12px', css.dim)).setOrigin(0.5, 0);
    this.laneLabels = LANE_X.map((x, i) => this.add.text(x, HIT_Y + 30, LANE_KEYS[i], mono('14px', css.text)).setOrigin(0.5).setDepth(5));
    this.selectNodes = [];

    const lane = (i) => this.act(() => this.press(i));
    bindPhoneInput(this, {
      digit: (d) => {
        this.fromDigit = true;
        queueMicrotask(() => { this.fromDigit = false; });
        if (this.phase === 'select') { if (d === '2') this.pickTone(-1); else if (d === '8') this.pickTone(1); else if (d === '5') this.startPlay(); return; }
        if (DIGIT_LANE[d] != null) lane(DIGIT_LANE[d]);
      },
      left: () => { if (!this.alias()) lane(0); },
      right: () => { if (!this.alias()) lane(2); },
      up: () => { if (this.alias()) return; if (this.phase === 'select') this.pickTone(-1); else lane(1); },
      down: () => { if (this.alias()) return; if (this.phase === 'select') this.pickTone(1); else lane(1); },
      ok: () => this.onOk(),
      softLeft: () => this.onOk(),
      softRight: () => toMenu(this, GAME_ID),
      back: () => toMenu(this, GAME_ID)
    });
    this.input.on('pointerdown', (p) => {
      if (this.phase === 'play') this.act(() => this.press(p.x < 120 ? 0 : p.x < 240 ? 1 : 2));
    });

    Music.enter(GAME_ID);
    window.__vpg = window.__vpg || {};
    window.__vpg.game = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { if (window.__vpg.game === this) window.__vpg.game = null; });

    if (this.skipHowTo) this.startPlay();
    else {
      showHowTo(this, {
        title: 'Ring Rhythm',
        tagline: 'Your ringtone is the level.',
        lines: [
          'Pick a ringtone. Notes fall into 3 lanes: low, mid, high.',
          'Hit the lane key as a note crosses the line: PERFECT, GOOD or BAD.',
          'Combos raise your multiplier up to x4. Misses drain your signal; empty = dropped call.',
          '6 loops of the tune, each one busier. Survive to the end for an accuracy bonus.'
        ],
        keys: [['1 4 7 / ◀', 'left lane'], ['2 5 8 / ▲▼ OK', 'middle lane'], ['3 6 9 / ▶', 'right lane'], ['Touch', 'tap a third of the screen']],
        onStart: () => this.showSelect()
      });
      this.draw();
    }
  }

  alias() {
    if (this.fromDigit) { this.fromDigit = false; return true; }
    return false;
  }

  act(fn) {
    if (this.phase !== 'play' || !this.alive || isFrozen(this)) return;
    fn();
  }

  onOk() {
    if (this.alias()) return;
    if (this.phase === 'over') { retry(this); return; }
    if (this.phase === 'select') { this.startPlay(); return; }
    this.act(() => this.press(1));
  }

  // ---- ringtone select -------------------------------------------------------------

  showSelect() {
    const css = this.pal.css;
    this.phase = 'select';
    this.selectNodes.forEach((n) => n.destroy());
    this.selectNodes = [];
    const add = (o) => { this.selectNodes.push(o); return o.setDepth(30); };
    add(this.add.rectangle(180, 240, 360, 480, this.pal.bg, 1));
    add(this.add.rectangle(180, 22, 360, 44, this.pal.fg));
    add(this.add.text(180, 22, 'PICK A RINGTONE', mono('20px', css.bg)).setOrigin(0.5));
    this.toneRows = Music.RINGTONES.map((r, i) => {
      const y = 90 + i * 56;
      const bg = add(this.add.rectangle(180, y, 320, 46, this.pal.panel));
      const t = add(this.add.text(36, y, r.name, mono('16px', css.text)).setOrigin(0, 0.5));
      const song = Music.getSong(r.id);
      const sub = add(this.add.text(324, y, `${song ? song.bpm : '?'} bpm`, mono('12px', css.dim)).setOrigin(1, 0.5));
      bg.setInteractive().on('pointerdown', () => { this.toneIndex = i; this.pickTone(0); this.startPlay(); });
      return { bg, t, sub };
    });
    add(this.add.text(180, 392, 'Preview playing...', mono('12px', css.accent)).setOrigin(0.5));
    add(this.add.text(180, 432, '▲▼ choose · OK play', mono('14px', css.dim)).setOrigin(0.5));
    add(this.add.text(180, 456, 'Music off? Your taps play the tune.', mono('11px', css.dim)).setOrigin(0.5));
    setSoftKeys('Play', 'Menu');
    this.pickTone(0);
  }

  pickTone(d) {
    const n = Music.RINGTONES.length;
    this.toneIndex = (this.toneIndex + d + n) % n;
    if (d) Sfx.menuMove();
    (this.toneRows || []).forEach((r, i) => {
      const on = i === this.toneIndex;
      r.bg.setFillStyle(on ? this.pal.fg : this.pal.panel);
      r.t.setColor(on ? this.pal.css.bg : this.pal.css.text);
      r.sub.setColor(on ? this.pal.css.bg : this.pal.css.dim);
    });
    Music.enter(Music.RINGTONES[this.toneIndex].id);
  }

  // ---- play ------------------------------------------------------------------------

  startPlay() {
    this.tone = Music.RINGTONES[this.toneIndex].id;
    localStorage.setItem(TONE_KEY, this.tone);
    this.selectNodes.forEach((n) => n.destroy());
    this.selectNodes = [];
    this.song = Music.getSong(this.tone);
    this.stepDur = 60 / this.song.bpm / 4;
    this.loopDur = this.stepDur * this.song.length;
    this.lead = Math.max(0.9, 1.6 / perkSpeed(this));
    this.missDamage = perkLives(this, 3) < 3 ? 13 : 10;
    this.buildPitchLanes();
    Music.stop();
    beginRun(this, GAME_ID, this.tone);
    this.silentOrigin = null;
    setSoftKeys('', 'Menu');
    this.infoText.setText(Music.RINGTONES[this.toneIndex].name);
  }

  buildPitchLanes() {
    const ps = [];
    this.song.lead.notes.forEach((n) => { if (n && n.n) ps.push(midiOf(n.n)); });
    ps.sort((a, b) => a - b);
    this.cut1 = ps[Math.floor(ps.length / 3)] || 60;
    this.cut2 = ps[Math.floor((ps.length * 2) / 3)] || 67;
  }

  laneOf(midi, bass) {
    if (bass) return midi % 3;
    if (midi < this.cut1) return 0;
    if (midi < this.cut2) return 1;
    return 2;
  }

  /** Current clock: AudioContext when the ringtone plays, else game time. */
  clock() {
    const tr = Music.transport();
    if (tr && tr.id === this.tone) {
      const c = getAudioContext();
      const lat = c ? (c.outputLatency || 0) : 0;
      return { src: 'audio', now: tr.now - lat, origin: tr.origin, swing: tr.swing };
    }
    if (this.silentOrigin == null) this.silentOrigin = gameNow(this) / 1000 + 0.5;
    return { src: 'game', now: gameNow(this) / 1000, origin: this.silentOrigin, swing: this.song.swing || 0 };
  }

  rebuild(clk) {
    const k0 = Math.min(this.loopIdx, LOOPS - 1);
    this.k0 = k0;
    this.notes = [];
    const L = this.song.length;
    const lead = this.song.lead.notes;
    const bass = this.song.bass.notes;
    for (let k = k0; k < LOOPS; k++) {
      let lastStep = -9;
      for (let s = 0; s < L; s++) {
        const swing = s % 2 === 1 ? clk.swing * this.stepDur : 0;
        const t = clk.origin + ((k - k0) * L + s) * this.stepDur + swing;
        if (t < clk.now + this.lead * 0.85) continue;   // count-in: skip notes too close to show
        const ln = lead[s];
        let note = null;
        if (ln && ln.n) {
          const strong = s % 4 === 0 || (ln.l || 1) >= 4;
          if (k >= 2 || strong) note = { midi: midiOf(ln.n), bass: false };
        } else if (k >= 4 && bass[s] && bass[s].n && s % 2 === 0) {
          note = { midi: midiOf(bass[s].n), bass: true };
        }
        if (!note) continue;
        if (s - lastStep < (k < 2 ? 2 : 1)) continue;
        lastStep = s;
        this.notes.push({ t, lane: this.laneOf(note.midi, note.bass), midi: note.midi, judged: null, loop: k });
      }
    }
    this.endTime = clk.origin + (LOOPS - k0) * this.loopDur;
  }

  press(lane) {
    const clk = this.clock();
    this.flashes[lane] = this.time.now;
    let best = null;
    let bd = Infinity;
    this.notes.forEach((n) => {
      if (n.judged || n.lane !== lane) return;
      const d = Math.abs(clk.now - n.t);
      if (d < bd) { bd = d; best = n; }
    });
    if (!best || bd > BAD) {
      this.counts.ghost += 1;
      this.health = Math.max(0, this.health - 2);
      return { judged: 'ghost' };
    }
    const delta = clk.now - best.t;
    const ad = Math.abs(delta);
    const j = ad <= PERFECT ? 'perfect' : ad <= GOOD ? 'good' : 'bad';
    best.judged = j;
    best.delta = delta;
    this.judge(j, best, clk.src);
    return { judged: j, delta };
  }

  judge(j, note, src) {
    this.counts[j] += 1;
    const css = this.pal.css;
    if (j === 'miss' || j === 'bad') {
      this.combo = 0;
      if (j === 'miss') {
        this.health -= this.missDamage;
        Sfx.play('rhythmMiss');
      }
    } else {
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.health = Math.min(100, this.health + (j === 'perfect' ? 3 : 1));
      if (src !== 'audio') Sfx.tone('rhythmTap', hz(note.midi), 0.12, 'square', 0.09);
      else Sfx.play(j === 'perfect' ? 'rhythmPerfect' : 'rhythmGood');
      if (this.combo % 10 === 0) Sfx.play('rhythmCombo');
    }
    const base = { perfect: 30, good: 15, bad: 3, miss: 0 }[j];
    if (base) {
      const gain = perkPoints(this, base * this.mult(), { quiet: true });
      this.score += gain;
      this.scoreText.setText(`Score: ${this.score}`);
    }
    this.lastJudge = { j, delta: note.delta };
    const label = { perfect: 'PERFECT!', good: 'GOOD', bad: note.delta < 0 ? 'EARLY' : 'LATE', miss: 'MISS' }[j];
    const col = { perfect: css.fg, good: css.accent, bad: css.warn, miss: css.danger }[j];
    this.judgeText.setText(label).setColor(col).setAlpha(1).setScale(1.2);
    this.tweens.killTweensOf(this.judgeText);
    this.tweens.add({ targets: this.judgeText, alpha: 0, scale: 1, delay: 250, duration: 300 });
    if (this.health <= 0) {
      if (useTough(this)) this.health = 40;
      else this.finish('Dropped call! Signal ran out', false);
    }
  }

  mult() {
    return Math.min(4, 1 + Math.floor(this.combo / 10));
  }

  finish(reason, win) {
    if (this.phase !== 'play') return;
    if (win) {
      const total = this.counts.perfect + this.counts.good + this.counts.bad + this.counts.miss;
      const acc = total ? (this.counts.perfect + this.counts.good * 0.6 + this.counts.bad * 0.2) / total : 0;
      this.accuracy = Math.round(acc * 100);
      const bonus = perkPoints(this, this.accuracy * 5, { quiet: true });
      this.score += bonus;
      Sfx.play('rhythmClear');
      reason = `Track clear! ${this.accuracy}% accuracy · max combo ${this.maxCombo}`;
    }
    endRun(this, { gameId: GAME_ID, bestKey: BEST_KEY, reason, title: win ? 'ENCORE!' : 'GAME OVER', win });
    this.draw();
  }

  update() {
    if (this.phase !== 'play' || !this.alive || isFrozen(this)) { if (this.phase !== 'play') this.draw(); return; }
    const clk = this.clock();
    const key = `${clk.src}:${clk.origin.toFixed(3)}`;
    if (key !== this.epochKey) {
      this.epochKey = key;
      this.rebuild(clk);
    }
    this.loopIdx = this.k0 + Math.max(0, Math.floor((clk.now - clk.origin) / this.loopDur));
    // misses
    this.notes.forEach((n) => {
      if (!n.judged && clk.now - n.t > BAD) {
        n.judged = 'miss';
        n.delta = clk.now - n.t;
        this.judge('miss', n, clk.src);
      }
    });
    if (this.phase !== 'play') return;
    if (clk.now > this.endTime + 0.3 && this.notes.every((n) => n.judged)) { this.finish('', true); return; }
    this.comboText.setText(this.combo >= 3 ? `${this.combo} combo  x${this.mult()}` : '');
    this.infoText.setText(`${Music.RINGTONES[this.toneIndex].name} · loop ${Math.min(LOOPS, this.loopIdx + 1)}/${LOOPS}`);
    this.clk = clk;
    this.draw();
  }

  draw() {
    const g = this.g;
    const P = this.pal;
    g.clear();
    // signal bar
    g.fillStyle(P.panel, 1).fillRect(0, 24, 360, 14);
    g.fillStyle(this.health < 30 ? P.danger : P.fg, 1).fillRect(2, 27, 356 * Math.max(0, this.health) / 100, 8);
    // lanes
    LANE_X.forEach((x, i) => {
      const lit = this.time.now - this.flashes[i] < 110;
      g.fillStyle(lit ? P.body : P.panel, lit ? 0.6 : 0.5).fillRect(x - 46, 58, 92, HIT_Y + 14 - 58);
      g.lineStyle(1, P.dim, 0.6).strokeRect(x - 46, 58, 92, HIT_Y + 14 - 58);
      g.lineStyle(3, lit ? P.warn : P.fg, 1).strokeRect(x - 40, HIT_Y - 10, 80, 20);
    });
    if (this.phase !== 'play' && this.phase !== 'over') return;
    const clk = this.clk;
    if (!clk) return;
    this.notes.forEach((n) => {
      if (n.judged && n.judged !== 'miss') return;
      const dt = n.t - clk.now;
      if (dt > this.lead) return;
      const y = HIT_Y - (dt / this.lead) * (HIT_Y - SPAWN_Y);
      if (y > HIT_Y + 60) return;
      const x = LANE_X[n.lane];
      const col = n.judged === 'miss' ? P.danger : n.lane === 1 ? P.accent : P.fg;
      g.fillStyle(col, n.judged === 'miss' ? 0.4 : 1).fillRoundedRect(x - 34, y - 8, 68, 16, 4);
      g.fillStyle(P.bg, 1).fillRect(x - 20, y - 2, 40, 4);
    });
  }
}
