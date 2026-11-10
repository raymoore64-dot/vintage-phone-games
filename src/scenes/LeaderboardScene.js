import Phaser from 'phaser';
import { bindPhoneInput, setSoftKeys } from '../input/PhoneInput.js';
import { hexToInt } from '../skins/skins.js';
import { getSkin } from '../skins/SkinManager.js';
import * as Sfx from '../audio/Sfx.js';
import * as Music from '../audio/Music.js';
import { bestOf } from '../games.js';
import * as Progress from '../progress/Progress.js';
import * as Wap from '../wap/Wap.js';
import * as Daily from '../daily/Daily.js';
import { isNative } from '../native/Native.js';
import * as GameCenter from '../native/GameCenter.js';
import { LEADERBOARDS, ACHIEVEMENTS, GAME_IDS } from '../native/gcIds.js';

/*
 * Leaderboards (menu "≡").
 *   iOS app: OK opens Game Center on the selected board (or all boards).
 *   Web: local bests for every game, the best Daily score and lifetime
 *   points. ▶ / 6 switches to Achievements, ◀ / 4 back to Scores.
 *   ▲▼ / 2 8 choose · C back
 */

const ROW_H = 27;
const TOP = 54;

export default class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super('LeaderboardScene');
  }

  init(data) {
    this.tab = data && data.tab === 'achievements' ? 'achievements' : 'scores';
  }

  create() {
    const pal = getSkin().palette;
    this.pal = pal;
    this.index = 0;
    this.fromDigit = false;
    this.native = isNative();
    this.mono = (size, color, extra = {}) => ({ fontSize: size, color, fontFamily: 'monospace', fontStyle: 'bold', ...extra });
    this.cameras.main.setBackgroundColor(pal.bg);
    this.layer = this.add.container(0, 0);
    GameCenter.checkAchievements();

    bindPhoneInput(this, {
      up: () => { if (!this.alias()) this.move(-1); },
      down: () => { if (!this.alias()) this.move(1); },
      left: () => { if (!this.alias()) this.setTab('scores'); },
      right: () => { if (!this.alias()) this.setTab('achievements'); },
      ok: () => { if (!this.alias()) this.open(); },
      softLeft: () => this.open(),
      softRight: () => this.back(),
      back: () => this.back(),
      digit: (d) => {
        this.fromDigit = true;
        queueMicrotask(() => { this.fromDigit = false; });
        if (d === '2') this.move(-1);
        else if (d === '8') this.move(1);
        else if (d === '4') this.setTab('scores');
        else if (d === '6') this.setTab('achievements');
        else if (d === '5') this.open();
      }
    });
    this.input.on('pointerup', (p) => {
      if (p.y < 44) { this.setTab(p.x < 180 ? 'scores' : 'achievements'); return; }
      const i = Math.floor((p.y - TOP) / ROW_H);
      if (this.tab === 'scores' && i >= 0 && i < this.rows().length) { this.index = i; this.render(); this.open(); }
    });
    Music.enter('menu');
    window.__vpg = window.__vpg || {};
    window.__vpg.boards = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { if (window.__vpg.boards === this) delete window.__vpg.boards; });
    this.render();
  }

  alias() {
    if (this.fromDigit) { this.fromDigit = false; return true; }
    return false;
  }

  rows() {
    const installed = new Set(Wap.menuGames().map((g) => g.game));
    const games = GAME_IDS.map((id) => {
      const lb = LEADERBOARDS[id];
      const wap = !!Wap.get(id);
      return { key: id, name: lb.name, value: bestOf(id), locked: wap && !installed.has(id) };
    });
    const hist = Object.values(Daily.history()).filter((h) => h.status === 'done');
    const bestDaily = hist.reduce((m, h) => Math.max(m, h.score || 0), 0);
    return [
      ...games,
      { key: 'daily', name: 'Daily (best day)', value: bestDaily },
      { key: 'total', name: 'Lifetime points', value: Progress.getTotal() }
    ];
  }

  render() {
    this.layer.removeAll(true);
    const pal = this.pal;
    const g = this.add.graphics();
    this.layer.add(g);
    const add = (o) => { this.layer.add(o); return o; };
    g.fillStyle(hexToInt(pal.fg), 1).fillRect(0, 0, 360, 44);
    add(this.add.text(12, 22, this.tab === 'scores' ? 'LEADERBOARDS' : 'ACHIEVEMENTS', this.mono('20px', pal.bg)).setOrigin(0, 0.5));
    add(this.add.text(348, 22, this.tab === 'scores' ? 'Awards ▶' : '◀ Scores', this.mono('12px', pal.bg)).setOrigin(1, 0.5));

    if (this.tab === 'scores') {
      const rows = this.rows();
      this.index = Phaser.Math.Clamp(this.index, 0, rows.length - 1);
      rows.forEach((r, i) => {
        const y = TOP + i * ROW_H + ROW_H / 2;
        const on = i === this.index;
        g.fillStyle(hexToInt(on ? pal.fg : pal.panel), 1).fillRect(10, y - ROW_H / 2 + 2, 340, ROW_H - 4);
        if (i === 10) g.fillStyle(hexToInt(pal.accent), 1).fillRect(10, y - ROW_H / 2 - 1, 340, 1);
        const col = on ? pal.bg : (r.locked ? pal.dim : pal.text);
        add(this.add.text(18, y, r.name, this.mono('13px', col)).setOrigin(0, 0.5));
        add(this.add.text(342, y, r.locked ? 'WAP' : String(r.value), this.mono('14px', on ? pal.bg : pal.warn)).setOrigin(1, 0.5));
      });
      const foot = this.native
        ? (GameCenter.isAuthenticated() ? 'OK: open in Game Center' : 'OK: sign in to Game Center')
        : 'Your device bests · Game Center in the iOS app';
      add(this.add.text(180, 388, foot, this.mono('12px', pal.accent)).setOrigin(0.5));
      const earned = Object.keys(GameCenter.earned()).length;
      add(this.add.text(180, 410, `Achievements ${earned}/${ACHIEVEMENTS.length} · ▶ to view`, this.mono('12px', pal.text)).setOrigin(0.5));
      add(this.add.text(180, 440, '▲▼ choose · C back', this.mono('12px', pal.dim)).setOrigin(0.5));
      this.status = add(this.add.text(180, 462, '', this.mono('12px', pal.warn)).setOrigin(0.5));
      setSoftKeys(this.native ? 'Open' : '', 'Back');
    } else {
      const earned = GameCenter.earned();
      ACHIEVEMENTS.forEach((a, i) => {
        const y = 58 + i * 25;
        const got = !!earned[a.key];
        const name = !got && a.hidden ? '??? (secret)' : a.name;
        g.fillStyle(hexToInt(got ? pal.fg : pal.panel), 1).fillRect(10, y - 11, 22, 22);
        add(this.add.text(21, y, got ? '★' : '·', this.mono('13px', got ? pal.bg : pal.dim)).setOrigin(0.5));
        add(this.add.text(40, y - 5, name, this.mono('12px', got ? pal.fg : pal.text)).setOrigin(0, 0.5));
        add(this.add.text(40, y + 6, !got && a.hidden ? 'Keep exploring...' : a.desc, this.mono('9px', pal.dim)).setOrigin(0, 0.5));
        add(this.add.text(350, y, `${a.points}`, this.mono('11px', pal.warn)).setOrigin(1, 0.5));
      });
      add(this.add.text(180, 444, `${Object.keys(earned).length}/${ACHIEVEMENTS.length} earned · ◀ scores · C back`, this.mono('11px', pal.dim)).setOrigin(0.5));
      this.status = add(this.add.text(180, 464, this.native ? 'OK: Game Center' : '', this.mono('11px', pal.accent)).setOrigin(0.5));
      setSoftKeys(this.native ? 'Open' : '', 'Back');
    }
  }

  move(d) {
    if (this.tab !== 'scores') return;
    const n = this.rows().length;
    this.index = (this.index + d + n) % n;
    Sfx.menuMove();
    this.render();
  }

  setTab(tab) {
    if (tab === this.tab) return;
    this.tab = tab;
    Sfx.menuMove();
    this.render();
  }

  async open() {
    const row = this.tab === 'scores' ? this.rows()[this.index] : null;
    if (!this.native) {
      if (this.status) this.status.setText('Game Center opens in the iPhone app');
      Sfx.back();
      return { shown: false };
    }
    Sfx.menuSelect();
    const res = await GameCenter.showLeaderboard(row ? row.key : undefined);
    if (this.sys && this.sys.isActive() && this.status && !res.shown) this.status.setText('Game Center unavailable');
    return res;
  }

  back() {
    Sfx.back();
    this.scene.start('MenuScene', { item: 'leaderboards' });
  }
}
