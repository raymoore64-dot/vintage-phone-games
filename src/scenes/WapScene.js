import Phaser from 'phaser';
import { bindPhoneInput, setSoftKeys } from '../input/PhoneInput.js';
import { hexToInt } from '../skins/skins.js';
import { getSkin } from '../skins/SkinManager.js';
import * as Sfx from '../audio/Sfx.js';
import * as Music from '../audio/Music.js';
import * as Phone from '../phone/Phone.js';
import * as Progress from '../progress/Progress.js';
import * as Sms from '../phone/Sms.js';
import * as Wap from '../wap/Wap.js';

/*
 * WAP Downloads — a fake late-90s mobile web portal.
 *   ▲▼ / 2 8  choose a cartridge     OK / 5  open / download / play
 *   C / right soft  back (cancels a download)
 * Download speed follows the signal bars: 0 bars stalls, 1 bar is weak.
 */

const KBPS = [0, 2.4, 4.8, 9.6, 14.4, 28.8];
const SPEEDUP = 8;          // so a 50 KB game takes seconds, not a minute
const TAGS = { soon: '[SOON]', locked: '[LOCKED]', ready: '[GET]', installed: '[OK]' };
const ROW_TOP = 74;
const ROW_H = 56;
const VISIBLE = 5;

export default class WapScene extends Phaser.Scene {
  constructor() {
    super('WapScene');
  }

  init(data) {
    this.startId = data && data.id ? data.id : null;
  }

  create() {
    const pal = getSkin().palette;
    this.pal = pal;
    this.mode = 'home';
    this.index = 0;
    this.scroll = 0;
    this.fromDigit = false;
    this.dl = null;
    this.cameras.main.setBackgroundColor(pal.bg);
    this.mono = (size, color, extra = {}) => ({ fontSize: size, color, fontFamily: 'monospace', fontStyle: 'bold', ...extra });

    // Browser chrome
    this.add.rectangle(180, 15, 360, 30, hexToInt(pal.fg));
    this.add.text(8, 15, 'WAP', this.mono('14px', pal.bg)).setOrigin(0, 0.5);
    this.url = this.add.text(48, 15, 'linicro.net/games', this.mono('13px', pal.bg)).setOrigin(0, 0.5);
    this.sig = this.add.text(352, 15, '', this.mono('13px', pal.bg)).setOrigin(1, 0.5);
    this.add.rectangle(180, 31, 360, 2, hexToInt(pal.dim));

    this.layer = this.add.container(0, 0);
    this.footer = this.add.text(180, 444, '', this.mono('13px', pal.dim, { align: 'center' })).setOrigin(0.5);
    this.footer2 = this.add.text(180, 463, '', this.mono('13px', pal.dim)).setOrigin(0.5);

    bindPhoneInput(this, {
      up: () => { if (!this.alias()) this.move(-1); },
      down: () => { if (!this.alias()) this.move(1); },
      ok: () => { if (!this.alias()) this.onOk(); },
      softLeft: () => this.onOk(),
      softRight: () => this.onBack(),
      back: () => this.onBack(),
      digit: (d) => {
        this.fromDigit = true;
        queueMicrotask(() => { this.fromDigit = false; });
        if (d === '2') this.move(-1);
        else if (d === '8') this.move(1);
        else if (d === '5') this.onOk();
      }
    });

    this.tickEvt = this.time.addEvent({ delay: 120, loop: true, callback: () => this.tick() });
    Music.enter('menu');
    Wap.onVisit();
    window.__vpg = window.__vpg || {};
    window.__vpg.wapScene = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (window.__vpg && window.__vpg.wapScene === this) delete window.__vpg.wapScene;
    });

    this.items = Wap.list();
    if (this.startId) {
      const i = this.items.findIndex((c) => c.id === this.startId);
      if (i >= 0) { this.index = i; this.showItem(); return; }
    }
    this.showHome();
  }

  alias() {
    if (this.fromDigit) { this.fromDigit = false; return true; }
    return false;
  }

  clear() {
    this.layer.removeAll(true);
  }

  t(x, y, str, size, color, extra) {
    const o = this.add.text(x, y, str, this.mono(size, color, extra));
    this.layer.add(o);
    return o;
  }

  // ---- home -------------------------------------------------------------------

  showHome() {
    const pal = this.pal;
    this.mode = 'home';
    this.clear();
    this.items = Wap.list();
    this.url.setText('linicro.net/games');
    this.t(180, 46, '** LINICRO GAMES DECK **', '15px', pal.warn).setOrigin(0.5);
    this.t(180, 63, `Points ${Progress.getTotal()} · Dares ${Sms.daresDone()}`, '12px', pal.accent).setOrigin(0.5);
    this.rows = this.items.map((c) => {
      const bg = this.add.rectangle(180, 0, 344, ROW_H - 6, hexToInt(pal.panel));
      const name = this.add.text(16, 0, c.name, this.mono('16px', pal.text));
      const line = this.add.rectangle(16, 0, name.width, 2, hexToInt(pal.fg)).setOrigin(0, 0.5);
      const tag = this.add.text(344, 0, TAGS[c.status], this.mono('13px', pal.warn)).setOrigin(1, 0);
      const sub = this.add.text(16, 0, this.subText(c), this.mono('12px', pal.dim));
      this.layer.add([bg, name, line, tag, sub]);
      return { bg, name, line, tag, sub, c };
    });
    this.upHint = this.t(352, 66, '', '12px', pal.accent).setOrigin(1, 0.5);
    this.downHint = this.t(180, ROW_TOP + VISIBLE * ROW_H + 4, '', '12px', pal.accent).setOrigin(0.5);
    this.t(180, 404, `${Wap.readyCount()} ready to download`, '13px', pal.accent).setOrigin(0.5);
    this.footer.setText('OK open · C back');
    this.footer2.setText('▲▼ choose · games over the air');
    setSoftKeys('Open', 'Back');
    this.select(this.index);
  }

  subText(c) {
    if (c.status === 'soon') return 'Coming soon';
    if (c.status === 'installed') return `Installed · ${c.sizeKb} KB`;
    if (c.status === 'ready') return `Ready! ${c.sizeKb} KB`;
    return c.reqLabel;
  }

  select(i) {
    if (!this.items.length) return;
    const n = this.items.length;
    const next = (i + n) % n;
    if (next !== this.index) Sfx.menuMove();
    this.index = next;
    if (this.index < this.scroll) this.scroll = this.index;
    if (this.index >= this.scroll + VISIBLE) this.scroll = this.index - VISIBLE + 1;
    const pal = this.pal;
    this.rows.forEach((r, j) => {
      const vis = j >= this.scroll && j < this.scroll + VISIBLE;
      const y = ROW_TOP + (j - this.scroll) * ROW_H;
      r.bg.setY(y + ROW_H / 2 - 2);
      r.name.setY(y + 4);
      r.line.setY(y + 23);
      r.tag.setY(y + 6);
      r.sub.setY(y + 28);
      [r.bg, r.name, r.line, r.tag, r.sub].forEach((o) => o.setVisible(vis));
      const on = j === this.index;
      r.bg.setFillStyle(on ? hexToInt(pal.fg) : hexToInt(pal.panel));
      r.name.setColor(on ? pal.bg : pal.text);
      r.line.setFillStyle(on ? hexToInt(pal.bg) : hexToInt(pal.fg));
      r.tag.setColor(on ? pal.bg : (r.c.status === 'ready' ? pal.warn : pal.dim));
      r.sub.setColor(on ? pal.bg : pal.dim);
    });
    this.upHint.setText(this.scroll > 0 ? '▲' : '');
    this.downHint.setText(this.scroll + VISIBLE < n ? '▼ more' : '');
  }

  move(d) {
    if (this.mode === 'home') this.select(this.index + d);
  }

  // ---- one cartridge page --------------------------------------------------------

  showItem() {
    const pal = this.pal;
    const c = Wap.list().find((x) => x.id === this.items[this.index].id) || this.items[this.index];
    this.cur = c;
    this.mode = 'item';
    this.clear();
    this.url.setText(`linicro.net/g/${c.id}`);
    this.t(180, 52, c.name, '22px', pal.fg).setOrigin(0.5);
    this.t(180, 80, `${c.sizeKb} KB · Java game`, '13px', pal.accent).setOrigin(0.5);
    this.t(180, 132, c.desc || '', '14px', pal.text, { align: 'center', wordWrap: { width: 320 } }).setOrigin(0.5);
    const r = c.req || {};
    const reqName = r.type === 'points' ? 'Points' : r.type === 'dares' ? 'Daily dares' : r.type === 'code' ? 'Secret code' : 'Free';
    this.t(24, 190, 'Requires:', '14px', pal.dim);
    this.t(24, 210, `${c.met ? '✔' : '✘'} ${reqName}`, '16px', c.met ? pal.fg : pal.danger);
    this.t(24, 232, c.reqLabel, '13px', pal.text, { wordWrap: { width: 312 } });
    let action = '';
    let note = '';
    if (c.status === 'soon') { action = '[ Coming soon ]'; note = 'This cartridge arrives in a future\nnetwork update. Check back!'; }
    else if (c.status === 'locked') { action = '[ Locked ]'; note = this.lockNote(c); }
    else if (c.status === 'ready') { action = '> Download now'; note = `Signal ${Phone.signalBars()}/5 · ${KBPS[Phone.signalBars()] || 0} kbps`; }
    else { action = '> Play now'; note = 'Installed in your Games menu.'; }
    this.action = this.t(180, 296, action, '20px', c.status === 'ready' || c.status === 'installed' ? pal.warn : pal.dim).setOrigin(0.5);
    if (c.status === 'ready' || c.status === 'installed') {
      const ul = this.add.rectangle(180, 309, this.action.width, 2, hexToInt(pal.warn));
      this.layer.add(ul);
    }
    this.t(180, 346, note, '13px', pal.accent, { align: 'center', wordWrap: { width: 320 } }).setOrigin(0.5);
    this.footer.setText(c.status === 'ready' ? 'OK download · C back' : c.status === 'installed' ? 'OK play · C back' : 'C back');
    this.footer2.setText('');
    setSoftKeys(c.status === 'ready' ? 'Get' : c.status === 'installed' ? 'Play' : '', 'Back');
  }

  lockNote(c) {
    const r = c.req || {};
    if (r.type === 'points') return `Earn ${Math.max(0, r.value - Progress.getTotal())} more points in any game.`;
    if (r.type === 'dares') return 'Beat the daily dares friends text you.';
    if (r.type === 'code') return 'Find the word, then on the menu\npress * * and type it. Check texts!';
    return '';
  }

  // ---- connect + download ---------------------------------------------------------

  startConnect() {
    const pal = this.pal;
    const c = this.cur;
    this.mode = 'connect';
    this.clear();
    this.url.setText(`linicro.net/g/${c.id}.jad`);
    this.t(180, 70, 'Connecting...', '22px', pal.fg).setOrigin(0.5);
    this.connectLines = ['Dialling gateway 10.0.0.1', 'Opening WAP session', 'Authorising handset', `GET /g/${c.id}.jar`];
    this.connectText = this.t(24, 120, '', '13px', pal.text, { lineSpacing: 6 });
    this.globe = this.add.graphics();
    this.layer.add(this.globe);
    this.connectAt = 0;
    this.connectStep = 0;
    this.footer.setText('C cancel');
    this.footer2.setText('');
    setSoftKeys('', 'Cancel');
    Sfx.play('wapConnect');
  }

  startDownload() {
    const pal = this.pal;
    const c = this.cur;
    this.mode = 'download';
    this.clear();
    this.t(180, 64, `Downloading`, '20px', pal.fg).setOrigin(0.5);
    this.t(180, 92, `${c.name}.jar`, '15px', pal.warn).setOrigin(0.5);
    const frame = this.add.rectangle(180, 210, 300, 30).setStrokeStyle(2, hexToInt(pal.fg));
    this.layer.add(frame);
    this.barG = this.add.graphics();
    this.layer.add(this.barG);
    this.pctText = this.t(180, 250, '0%', '22px', pal.fg).setOrigin(0.5);
    this.rateText = this.t(180, 290, '', '14px', pal.accent).setOrigin(0.5);
    this.warnText = this.t(180, 320, '', '14px', pal.danger).setOrigin(0.5);
    this.t(180, 370, 'Please do not switch off\nyour phone.', '13px', pal.dim, { align: 'center' }).setOrigin(0.5);
    this.dl = { kb: 0, size: c.sizeKb, rate: 0, lastTick: 0, ticks: 0, stalled: 0 };
    this.footer.setText('C cancel');
    setSoftKeys('', 'Cancel');
  }

  finishDownload() {
    const pal = this.pal;
    const c = this.cur;
    this.mode = 'done';
    this.dl = null;
    Wap.completeDownload(c.id);
    this.clear();
    this.t(180, 110, 'Download', '26px', pal.fg).setOrigin(0.5);
    this.t(180, 142, 'complete!', '26px', pal.fg).setOrigin(0.5);
    this.t(180, 196, `${c.name} saved to Games`, '14px', pal.warn).setOrigin(0.5);
    const g = this.add.graphics();
    g.fillStyle(hexToInt(pal.fg), 1);
    // pixel tick
    [[0, 3], [1, 4], [2, 5], [3, 4], [4, 3], [5, 2], [6, 1], [7, 0]].forEach(([x, y]) => g.fillRect(150 + x * 8, 236 + y * 8, 8, 8));
    this.layer.add(g);
    this.t(180, 330, 'OK play now · C back', '15px', pal.accent).setOrigin(0.5);
    this.footer.setText('A text from the network is on its way');
    this.footer2.setText('');
    setSoftKeys('Play', 'Back');
    Sfx.play('wapDone');
    Phone.buzz();
  }

  tick() {
    const bars = Phone.signalBars();
    this.sig.setText(`${'▮'.repeat(bars)}${'▯'.repeat(5 - bars)}`);
    if (this.mode === 'connect') {
      this.connectAt += 120;
      const step = Math.min(this.connectLines.length, Math.floor(this.connectAt / 450));
      const dots = '.'.repeat(1 + Math.floor(this.connectAt / 200) % 3);
      const lines = this.connectLines.slice(0, step + 1).map((l, i) => (i < step ? `${l}... OK` : `${l}${dots}`));
      this.connectText.setText(lines.slice(0, this.connectLines.length).join('\n'));
      const a = this.connectAt / 300;
      this.globe.clear();
      this.globe.lineStyle(3, hexToInt(this.pal.fg), 1);
      this.globe.strokeCircle(180, 300, 34);
      this.globe.strokeEllipse(180, 300, 68 * Math.abs(Math.cos(a)), 68);
      this.globe.lineBetween(146, 300, 214, 300);
      if (this.connectAt >= 450 * this.connectLines.length + 300) this.startDownload();
      return;
    }
    if (this.mode === 'download' && this.dl) {
      const dl = this.dl;
      const dt = 0.12;
      let kbps = KBPS[bars] || 0;
      let warn = '';
      if (bars <= 0) warn = 'No signal! Waiting...';
      else if (bars === 1) {
        warn = 'Weak signal... stalling';
        if (Math.random() < 0.4) kbps = 0;
      }
      kbps *= 0.75 + Math.random() * 0.5;
      dl.rate = kbps;
      dl.kb = Math.min(dl.size, dl.kb + (kbps / 8) * dt * SPEEDUP * Wap.downloadSpeed());
      const pct = Math.floor((dl.kb / dl.size) * 100);
      const segs = Math.floor((dl.kb / dl.size) * 14);
      this.barG.clear();
      this.barG.fillStyle(hexToInt(this.pal.fg), 1);
      for (let i = 0; i < segs; i++) this.barG.fillRect(35 + i * 20.7, 199, 17, 22);
      if (Math.floor(pct / 10) > (dl.lastTen || 0)) { dl.lastTen = Math.floor(pct / 10); Sfx.play('wapTick'); }
      this.pctText.setText(`${pct}%`);
      this.rateText.setText(`${kbps.toFixed(1)} kbps · ${Math.floor(dl.kb)}/${dl.size} KB`);
      this.warnText.setText(warn);
      if (dl.kb >= dl.size) this.finishDownload();
    }
  }

  // ---- input -------------------------------------------------------------------------

  onOk() {
    if (this.mode === 'home') {
      if (!this.items.length) return;
      Sfx.menuSelect();
      this.showItem();
      return;
    }
    if (this.mode === 'item') {
      const c = this.cur;
      if (c.status === 'ready') { Sfx.menuSelect(); this.startConnect(); return; }
      if (c.status === 'installed') { this.play(c); return; }
      Sfx.play('codeBad');
      this.cameras.main.shake(120, 0.006);
      return;
    }
    if (this.mode === 'done') this.play(this.cur);
  }

  play(c) {
    if (!this.scene.manager.keys[c.scene]) return;
    Wap.markPlayed(c.id);
    Sfx.menuSelect();
    this.scene.start(c.scene);
  }

  onBack() {
    if (this.mode === 'home') {
      Sfx.menuSelect();
      this.scene.start('MenuScene', { item: 'wap' });
      return;
    }
    if (this.mode === 'connect' || this.mode === 'download') {
      this.dl = null;
      Sfx.play('wapFail');
      Phone.toast('Download cancelled');
      this.showItem();
      return;
    }
    Sfx.menuSelect();
    this.showHome();
  }
}
