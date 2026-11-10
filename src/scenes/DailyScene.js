import Phaser from 'phaser';
import { bindPhoneInput, setSoftKeys } from '../input/PhoneInput.js';
import { hexToInt } from '../skins/skins.js';
import { getSkin } from '../skins/SkinManager.js';
import * as Sfx from '../audio/Sfx.js';
import * as Music from '../audio/Music.js';
import * as Daily from '../daily/Daily.js';
import { shareScore } from '../share/ScoreCard.js';
import { shareText } from '../native/Native.js';
import { haptic } from '../native/Haptics.js';
import { bestOf } from '../games.js';

/*
 * Daily Challenge (menu "!").
 *   today     today's game + modifier. OK / 5 play (1 official attempt,
 *             then practice) · * share · ▶ / 6 calendar · C back
 *   result    after the run: score, ▓▓▓░░ blocks, streak · * / left soft
 *             share text + DAILY #n card · OK practice · ▶ calendar · C menu
 *   calendar  month grid of played days, ◀ ▶ month · C back
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default class DailyScene extends Phaser.Scene {
  constructor() {
    super('DailyScene');
  }

  init(data) {
    this.view = (data && data.view) || 'today';
    this.date = (data && data.date) || Daily.today();
    this.practiceScore = data && Number.isFinite(data.practiceScore) ? data.practiceScore : null;
  }

  create() {
    const pal = getSkin().palette;
    this.pal = pal;
    this.fromDigit = false;
    this.busy = false;
    this.mono = (size, color, extra = {}) => ({ fontSize: size, color, fontFamily: 'monospace', fontStyle: 'bold', ...extra });
    this.cameras.main.setBackgroundColor(pal.bg);
    this.layer = this.add.container(0, 0);
    this.g = this.add.graphics();
    this.layer.add(this.g);
    const t = new Date();
    this.calYear = t.getFullYear();
    this.calMonth = t.getMonth();
    if (/^\d{4}-\d{2}-\d{2}$/.test(this.date)) {
      const [y, m] = this.date.split('-').map(Number);
      this.calYear = y; this.calMonth = m - 1;
    }

    bindPhoneInput(this, {
      ok: () => { if (!this.alias()) this.primary(); },
      softLeft: () => (this.view === 'result' ? this.share() : this.primary()),
      softRight: () => this.back(),
      back: () => this.back(),
      left: () => { if (!this.alias()) this.horizontal(-1); },
      right: () => { if (!this.alias()) this.horizontal(1); },
      digit: (d) => {
        this.fromDigit = true;
        queueMicrotask(() => { this.fromDigit = false; });
        if (d === '*') this.share();
        else if (d === '5') this.primary();
        else if (d === '4') this.horizontal(-1);
        else if (d === '6') this.horizontal(1);
      }
    });
    this.input.on('pointerup', (p) => this.onTap(p));
    Music.enter('menu');
    window.__vpg = window.__vpg || {};
    window.__vpg.dailyScene = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (window.__vpg && window.__vpg.dailyScene === this) delete window.__vpg.dailyScene;
    });
    if (this.view === 'result' && Daily.entry(this.date)) {
      haptic(Daily.entry(this.date).blocks >= 4 ? 'newBest' : 'combo');
    }
    this.render();
  }

  alias() {
    if (this.fromDigit) { this.fromDigit = false; return true; }
    return false;
  }

  clear() {
    this.layer.removeAll(true);
    this.g = this.add.graphics();
    this.layer.add(this.g);
  }

  txt(x, y, s, size, color, extra = {}, origin = 0.5) {
    const t = this.add.text(x, y, s, this.mono(size, color, extra)).setOrigin(origin, 0.5);
    this.layer.add(t);
    return t;
  }

  header(title, right = '') {
    const pal = this.pal;
    this.g.fillStyle(hexToInt(pal.fg), 1).fillRect(0, 0, 360, 44);
    this.txt(16, 22, title, '22px', pal.bg, {}, 0);
    if (right) this.txt(344, 22, right, '13px', pal.bg).setOrigin(1, 0.5);
  }

  /** ▓▓▓░░ drawn as LCD blocks (the share text uses the characters). */
  blocks(cx, cy, n, size) {
    const gap = Math.round(size * 0.3);
    const w = 5 * size + 4 * gap;
    for (let i = 0; i < 5; i++) {
      const x = cx - w / 2 + i * (size + gap);
      if (i < n) this.g.fillStyle(hexToInt(this.pal.warn), 1).fillRect(x, cy - size / 2, size, size);
      else this.g.lineStyle(2, hexToInt(this.pal.dim), 1).strokeRect(x + 1, cy - size / 2 + 1, size - 2, size - 2);
    }
  }

  render() {
    this.clear();
    if (this.view === 'calendar') this.renderCalendar();
    else if (this.view === 'result') this.renderResult();
    else this.renderToday();
  }

  renderToday() {
    const pal = this.pal;
    const c = Daily.challengeFor(this.date);
    const e = Daily.entry(this.date);
    this.header(`DAILY #${c.n}`, this.date);
    this.txt(180, 72, "TODAY'S GAME", '13px', pal.accent);
    this.txt(180, 102, c.gameName.toUpperCase(), '30px', pal.fg);
    this.g.lineStyle(2, hexToInt(pal.fg), 1).strokeRect(24, 130, 312, 74);
    this.txt(180, 148, `MODIFIER: ${c.mod.name.toUpperCase()}`, '15px', pal.warn);
    this.txt(180, 178, c.mod.desc, '12px', pal.text, { align: 'center', wordWrap: { width: 290 } });
    this.txt(180, 222, 'Same seed + rules for every player today.', '11px', pal.dim);
    const streak = Daily.currentStreak();
    if (!e) {
      this.txt(180, 262, 'ONE official attempt.', '16px', pal.text);
      this.txt(180, 284, 'Starting it uses it. Practice after.', '12px', pal.dim);
      this.txt(180, 330, '▶ PLAY', '26px', pal.fg);
      setSoftKeys('Play', 'Back');
    } else {
      const blocks = e.blocks ?? Daily.blocksFor(c.game, e.score);
      this.txt(180, 258, e.status === 'done' ? 'TODAY: DONE' : 'TODAY: IN PROGRESS', '14px', pal.accent);
      this.txt(180, 290, String(e.score), '32px', pal.fg);
      this.blocks(180, 322, blocks, 18);
      this.txt(180, 348, 'OK = practice (not counted)', '12px', pal.dim);
      setSoftKeys('Practice', 'Back');
    }
    this.txt(180, 384, `Streak ${streak} · Best ${Daily.bestStreak()} · Played ${Daily.state().days}`, '13px', pal.text);
    this.txt(180, 420, e ? '* share · ▶ calendar' : '▶ calendar', '13px', pal.dim);
    this.txt(180, 440, 'C back', '13px', pal.dim);
    this.status = this.txt(180, 462, '', '12px', pal.accent);
  }

  renderResult() {
    const pal = this.pal;
    const c = Daily.challengeFor(this.date);
    const e = Daily.entry(this.date);
    const score = e ? e.score : 0;
    const blocks = e ? (e.blocks ?? Daily.blocksFor(c.game, score)) : 0;
    this.header(`DAILY #${c.n} RESULT`);
    this.txt(180, 66, `${c.gameName} · ${c.mod.name}`, '15px', pal.accent);
    this.txt(180, 112, String(score), '48px', pal.fg);
    this.blocks(180, 156, blocks, 26);
    this.txt(180, 186, `${blocks}/5 of par ${Daily.PAR[c.game]}`, '12px', pal.dim);
    const streak = Daily.currentStreak();
    this.g.fillStyle(hexToInt(pal.panel), 1).fillRect(24, 206, 312, 56);
    this.txt(100, 222, 'STREAK', '12px', pal.dim);
    this.txt(100, 246, String(streak), '22px', pal.fg);
    this.txt(260, 222, 'BEST', '12px', pal.dim);
    this.txt(260, 246, String(Daily.bestStreak()), '22px', pal.fg);
    if (this.practiceScore !== null) {
      this.txt(180, 284, `Practice run: ${this.practiceScore} (not counted)`, '13px', pal.text);
    } else {
      this.txt(180, 284, 'Official result saved. See you tomorrow!', '12px', pal.text);
    }
    // share preview
    this.preview = this.txt(180, 324, Daily.shareText(this.date), '11px', pal.text, { align: 'center', wordWrap: { width: 330 }, backgroundColor: pal.panel, padding: { x: 6, y: 4 } });
    this.txt(180, 384, '* share (text + DAILY card)', '13px', pal.fg);
    this.txt(180, 408, 'OK practice · ▶ calendar', '13px', pal.dim);
    this.txt(180, 428, 'C menu', '13px', pal.dim);
    this.status = this.txt(180, 458, '', '12px', pal.accent);
    setSoftKeys('Share', 'Menu');
  }

  renderCalendar() {
    const pal = this.pal;
    const weeks = Daily.monthGrid(this.calYear, this.calMonth);
    this.header('DAILY HISTORY');
    this.txt(180, 64, `◀ ${MONTHS[this.calMonth]} ${this.calYear} ▶`, '16px', pal.fg);
    const CW = 46, CH = Math.min(46, Math.floor(300 / weeks.length)), X0 = 180 - (7 * CW) / 2, Y0 = 96;
    ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach((d, i) => this.txt(X0 + i * CW + CW / 2, Y0 - 10, d, '11px', pal.dim));
    this.cells = [];
    weeks.forEach((wk, r) => wk.forEach((cell, i) => {
      if (!cell) return;
      const x = X0 + i * CW + 2, y = Y0 + r * CH + 2, w = CW - 4, h = CH - 4;
      if (cell.played) {
        const alpha = 0.35 + 0.13 * cell.blocks;
        this.g.fillStyle(hexToInt(pal.fg), Math.min(1, alpha)).fillRect(x, y, w, h);
      } else {
        this.g.fillStyle(hexToInt(pal.panel), cell.future || cell.beforeLaunch ? 0.35 : 1).fillRect(x, y, w, h);
      }
      if (cell.today) this.g.lineStyle(2, hexToInt(pal.warn), 1).strokeRect(x - 1, y - 1, w + 2, h + 2);
      const fg = cell.played ? pal.bg : (cell.future || cell.beforeLaunch ? pal.dim : pal.text);
      this.txt(x + 5, y + 9, String(cell.day), '11px', fg, {}, 0);
      if (cell.played) this.txt(x + w / 2, y + h - 9, String(cell.blocks ? '▓'.repeat(Math.min(3, Math.ceil(cell.blocks / 2))) : '·'), '9px', pal.bg);
      this.cells.push(cell);
    }));
    const played = this.cells.filter((c) => c.played).length;
    const yb = Y0 + weeks.length * CH + 14;
    this.txt(180, yb, `${played} day${played === 1 ? '' : 's'} played this month`, '13px', pal.text);
    this.txt(180, yb + 22, `Streak ${Daily.currentStreak()} · Best ${Daily.bestStreak()}`, '13px', pal.accent);
    this.txt(180, 446, '◀▶ month · C back', '13px', pal.dim);
    setSoftKeys('Today', 'Back');
  }

  // ---- actions -------------------------------------------------------------

  primary() {
    if (this.view === 'calendar') { this.view = 'today'; this.date = Daily.today(); Sfx.menuSelect(); this.render(); return; }
    this.play();          // today: the official attempt (or practice); result: practice
  }

  play() {
    const run = Daily.startRun(Daily.today());
    Sfx.menuSelect();
    this.scene.start(run.scene, { daily: run.ctx });
  }

  horizontal(dir) {
    if (this.view === 'calendar') {
      this.calMonth += dir;
      if (this.calMonth < 0) { this.calMonth = 11; this.calYear -= 1; }
      if (this.calMonth > 11) { this.calMonth = 0; this.calYear += 1; }
      Sfx.menuMove();
      this.render();
      return;
    }
    if (dir > 0) {
      this.prevView = this.view;
      this.view = 'calendar';
      Sfx.menuMove();
      this.render();
    }
  }

  async share() {
    if (this.view === 'calendar' || this.busy) return;
    const e = Daily.entry(this.date);
    if (!e) { if (this.status) this.status.setText('Play today first!'); Sfx.back(); return; }
    this.busy = true;
    Sfx.play('shareSnap');
    const c = Daily.challengeFor(this.date);
    const text = Daily.shareText(this.date);
    if (this.status) this.status.setText('Sharing...');
    const card = await shareScore({
      gameId: c.game, gameName: c.gameName, score: e.score, best: bestOf(c.game),
      tag: `DAILY #${c.n}`, subline: `STREAK ${Daily.currentStreak()} - ${c.mod.name}`,
      perkLabel: `DAILY ${c.mod.name}`, format: 'square', text
    });
    let txt = { method: card.method === 'share' ? 'with-card' : 'skipped' };
    // when the image could not carry the text (download fallback), copy the text too
    if (card.method !== 'share') txt = await shareText(text);
    this.lastShare = { text, card, txt };
    window.__vpg.dailyLastShare = this.lastShare;
    this.busy = false;
    if (!this.sys || !this.sys.isActive() || !this.status) return;
    const msg = card.method === 'share' ? 'Shared!' : txt.method === 'clipboard' ? 'Text copied + card saved' : card.method === 'download' ? 'Card saved (PNG)' : 'Could not share';
    this.status.setText(msg);
  }

  back() {
    Sfx.back();
    if (this.view === 'calendar') { this.view = this.prevView || 'today'; this.render(); return; }
    this.scene.start('MenuScene', { item: 'daily' });
  }

  onTap(p) {
    if (this.view === 'calendar') { this.horizontal(p.x < 180 ? -1 : 1); return; }
    if (p.y > 300 && p.y < 360 && this.view === 'today') this.play();
    else if (p.y > 370 && p.y < 400 && this.view === 'result') this.share();
  }
}
