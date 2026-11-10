import Phaser from 'phaser';
import { bindPhoneInput, setSoftKeys } from '../input/PhoneInput.js';
import { hexToInt } from '../skins/skins.js';
import { getSkin } from '../skins/SkinManager.js';
import { currentPerk } from '../skins/perks.js';
import * as Sfx from '../audio/Sfx.js';
import * as Music from '../audio/Music.js';
import * as Sms from '../phone/Sms.js';
import * as Secrets from '../phone/Secrets.js';
import * as Phone from '../phone/Phone.js';

/*
 * Menu keys
 *   ▲▼ / 2 8   choose          OK / 5 / left soft   open
 *   1-6        play a game     7                    Messages
 *   *          enter a secret code (then 4 digits; C cancels)
 *   0          sound on/off    9                    music on/off
 *   right soft phone picker    (M / N also toggle sound / music anywhere)
 */

const ITEMS = [
  { name: 'Snake: Trail', scene: 'SnakeScene', bestKey: 'vpg.snake.best', game: 'snake' },
  { name: 'Bounce: Flip', scene: 'BounceScene', bestKey: 'vpg.bounce.best', game: 'bounce' },
  { name: 'Space Impact: Echo', scene: 'ImpactScene', bestKey: 'vpg.impact.best', game: 'impact' },
  { name: 'Bricks: Chain', scene: 'BricksScene', bestKey: 'vpg.bricks.best', game: 'bricks' },
  { name: 'Blocks: Quake', scene: 'BlocksScene', bestKey: 'vpg.blocks.best', game: 'blocks' },
  { name: 'Simon: Reverse', scene: 'SimonScene', bestKey: 'vpg.simon.best', game: 'simon' },
  { name: 'Messages', scene: 'InboxScene', inbox: true }
];
const INBOX_INDEX = ITEMS.length - 1;

const LIST_TOP = 60;
const ROW_H = 60;
const VISIBLE = 5;
const CODE_LEN = 4;

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  init(data) {
    this.startIndex = data && Number.isInteger(data.index) ? data.index : 0;
  }

  create() {
    this.index = -1;
    this.scroll = 0;
    this.fromDigit = false;
    this.code = null;
    const pal = getSkin().palette;
    const mono = (size, color) => ({ fontSize: size, color, fontFamily: 'monospace', fontStyle: 'bold' });
    this.mono = mono;

    this.cameras.main.setBackgroundColor(pal.bg);

    // Header bar
    this.add.rectangle(180, 22, 360, 44, hexToInt(pal.fg));
    this.add.text(16, 22, 'GAMES', mono('24px', pal.bg)).setOrigin(0, 0.5);
    this.counter = this.add.text(344, 22, '', mono('17px', pal.bg)).setOrigin(1, 0.5);

    this.upHint = this.add.text(180, 52, '▲ more', mono('12px', pal.accent)).setOrigin(0.5, 0.5).setAlpha(0);

    // List
    this.rows = ITEMS.map((item, i) => {
      const bg = this.add.rectangle(180, 0, 336, 52, hexToInt(pal.panel)).setInteractive({ useHandCursor: true });
      const num = this.add.text(30, 0, String(i + 1), mono('21px', pal.fg)).setOrigin(0, 0.5);
      const label = this.add.text(60, 0, item.name, mono('17px', pal.text)).setOrigin(0, 0.5);
      const badge = this.add.text(334, 0, '', mono('14px', pal.warn)).setOrigin(1, 0.5);
      bg.on('pointerdown', () => {
        if (this.code) return;
        this.select(i);
        this.launch();
      });
      return { bg, num, label, badge };
    });

    this.downHint = this.add.text(180, 0, '▼ more', mono('12px', pal.accent)).setOrigin(0.5, 0.5).setAlpha(0);

    // Info + perk + footer (fits 360x480 with the HTML status bar above)
    this.info = this.add.text(180, 384, '', mono('16px', pal.accent)).setOrigin(0.5);
    this.perkLine = this.add.text(180, 404, '', {
      fontSize: '12px', color: pal.dim, fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.soundText = this.add.text(180, 424, '', mono('13px', pal.accent)).setOrigin(0.5);
    this.add.text(180, 444, '1-6 play · 7 msgs · * code', mono('13px', pal.dim)).setOrigin(0.5);
    this.add.text(180, 463, '0 sound · 9 music · ▶ Phone', mono('13px', pal.dim)).setOrigin(0.5);

    this.toast = this.add.text(180, 330, '', {
      ...mono('16px', pal.bg), backgroundColor: pal.fg, padding: { x: 12, y: 7 }, align: 'center', wordWrap: { width: 300 }
    }).setOrigin(0.5).setAlpha(0).setDepth(50);

    this.buildCodePanel(pal);

    setSoftKeys('Select', 'Phone');
    bindPhoneInput(this, {
      up: () => this.onUp(),
      down: () => this.onDown(),
      ok: () => this.onLaunch(),
      softLeft: () => this.onLaunch(),
      softRight: () => {
        if (this.code) { this.closeCode(); return; }
        Sfx.menuSelect();
        this.scene.start('SkinScene');
      },
      back: () => { if (this.code) this.closeCode(); },
      digit: (d) => this.onDigit(d)
    });

    window.__vpg = window.__vpg || {};
    window.__vpg.menu = this;
    Music.enter('menu');
    Sms.onMenu();
    this.refreshSound();
    const unsubMute = Sfx.onMuteChange(() => this.refreshSound());
    const unsubMusic = Music.onMusicChange(() => this.refreshSound());
    const unsubSms = Sms.onChange(() => this.refreshBadges());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubMute();
      unsubMusic();
      unsubSms();
      if (window.__vpg && window.__vpg.menu === this) delete window.__vpg.menu;
    });

    this.perkLine.setText(`${getSkin().brand} perk: ${currentPerk().name}`);
    this.select(Phaser.Math.Clamp(this.startIndex, 0, ITEMS.length - 1));
  }

  // ---- Secret code entry ---------------------------------------------------

  buildCodePanel(pal) {
    const depth = 40;
    this.codeNodes = [
      this.add.rectangle(180, 240, 360, 480, 0x000000, 0.6).setDepth(depth),
      this.add.rectangle(180, 220, 290, 170, hexToInt(pal.panel)).setStrokeStyle(3, hexToInt(pal.fg)).setDepth(depth)
    ];
    this.codeTitle = this.add.text(180, 166, 'ENTER CODE', this.mono('20px', pal.warn)).setOrigin(0.5).setDepth(depth);
    this.codeText = this.add.text(180, 214, '', this.mono('34px', pal.fg)).setOrigin(0.5).setDepth(depth);
    this.codeHint = this.add.text(180, 268, 'digits · C cancel', {
      fontSize: '13px', color: pal.dim, fontFamily: 'monospace', fontStyle: 'bold', align: 'center', wordWrap: { width: 270 }
    }).setOrigin(0.5).setDepth(depth);
    this.codeNodes.push(this.codeTitle, this.codeText, this.codeHint);
    this.codeNodes.forEach((n) => n.setVisible(false));
  }

  openCode() {
    this.code = { digits: '', done: false };
    this.codeNodes.forEach((n) => n.setVisible(true));
    this.codeTitle.setText('ENTER CODE').setColor(getSkin().palette.warn);
    this.codeHint.setText('digits · C cancel');
    this.renderCode();
    setSoftKeys('', 'Cancel');
    Sfx.play('codeKey');
  }

  renderCode() {
    if (!this.code) return;
    const shown = this.code.digits.padEnd(CODE_LEN, '_').split('').join(' ');
    this.codeText.setText(`* ${shown}`);
  }

  closeCode() {
    this.code = null;
    this.codeNodes.forEach((n) => n.setVisible(false));
    setSoftKeys('Select', 'Phone');
    this.refreshBadges();
    this.perkLine.setText(`${getSkin().brand} perk: ${currentPerk().name}`);
  }

  codeDigit(d) {
    if (!this.code || this.code.done) return;
    if (!/^[0-9]$/.test(d)) return;
    this.code.digits += d;
    Sfx.play('codeKey');
    this.renderCode();
    if (this.code.digits.length < CODE_LEN) return;
    this.code.done = true;
    const res = Secrets.tryCode(this.code.digits);
    this.lastCodeResult = res;
    const pal = getSkin().palette;
    this.codeTitle.setText(res.ok ? 'CODE ACCEPTED' : 'WRONG CODE').setColor(res.ok ? pal.fg : pal.danger);
    this.codeHint.setText(res.message);
    if (res.ok) {
      Sfx.play('codeOk');
      Phone.render(true);
    } else {
      Sfx.play('codeBad');
      this.cameras.main.shake(160, 0.01);
    }
    this.time.delayedCall(res.ok ? 1700 : 1000, () => { if (this.code && this.code.done) this.closeCode(); });
  }

  // ---- Input -----------------------------------------------------------------

  onDigit(d) {
    // Every digit marks itself so the 2/4/6/8/5 aliases that follow are ignored
    this.fromDigit = true;
    queueMicrotask(() => { this.fromDigit = false; });
    if (this.code) {
      this.codeDigit(d);
      return;
    }
    if (d === '*') {
      this.openCode();
      return;
    }
    if (d === '0') {
      Sfx.toggleMuteWithClick();
      this.refreshSound();
      return;
    }
    if (d === '9') {
      Music.toggle();
      this.refreshSound();
      return;
    }
    const i = Number(d) - 1;
    if (i >= 0 && i < ITEMS.length) {
      this.select(i);
      this.launch();
    }
  }

  onUp() {
    if (this.fromDigit) { this.fromDigit = false; return; }
    if (this.code) return;
    this.select(this.index - 1);
  }

  onDown() {
    if (this.fromDigit) { this.fromDigit = false; return; }
    if (this.code) return;
    this.select(this.index + 1);
  }

  onLaunch() {
    if (this.fromDigit) { this.fromDigit = false; return; }
    if (this.code) return;
    this.launch();
  }

  // ---- Drawing -------------------------------------------------------------

  refreshSound() {
    if (this.soundText && this.soundText.active) {
      this.soundText.setText(`${Sfx.soundLabel()}    ${Music.musicLabel()}`);
    }
  }

  refreshBadges() {
    if (!this.rows) return;
    const dare = Sms.getDare();
    const unread = Sms.unreadCount();
    this.rows.forEach((row, j) => {
      const item = ITEMS[j];
      let badge = '';
      if (item.inbox) badge = unread > 0 ? `${unread} new` : '';
      else if (dare && dare.today && !dare.done && dare.game === item.game) badge = 'DARE';
      row.badge.setText(badge);
    });
    this.updateInfo();
  }

  layoutRows() {
    const maxScroll = Math.max(0, ITEMS.length - VISIBLE);
    this.scroll = Phaser.Math.Clamp(this.scroll, 0, maxScroll);
    this.rows.forEach((row, j) => {
      const visible = j >= this.scroll && j < this.scroll + VISIBLE;
      const y = LIST_TOP + ROW_H / 2 + (j - this.scroll) * ROW_H;
      [row.bg, row.num, row.label, row.badge].forEach((n) => n.setY(y).setVisible(visible));
      row.bg.setActive(visible);
      if (visible) row.bg.setInteractive({ useHandCursor: true });
      else row.bg.disableInteractive();
    });
    this.upHint.setAlpha(this.scroll > 0 ? 1 : 0);
    this.downHint.setY(LIST_TOP + VISIBLE * ROW_H + 3);
    this.downHint.setAlpha(this.scroll < maxScroll ? 1 : 0);
  }

  keepInView(i) {
    if (i < this.scroll) this.scroll = i;
    if (i >= this.scroll + VISIBLE) this.scroll = i - VISIBLE + 1;
  }

  select(i) {
    const pal = getSkin().palette;
    const next = (i + ITEMS.length) % ITEMS.length;
    const changed = next !== this.index;
    if (changed && this.index !== -1) Sfx.menuMove();
    this.index = next;
    this.keepInView(this.index);
    this.layoutRows();
    this.rows.forEach((row, j) => {
      const on = j === this.index;
      row.bg.setFillStyle(on ? hexToInt(pal.fg) : hexToInt(pal.panel));
      row.num.setColor(on ? pal.bg : pal.fg);
      row.label.setColor(on ? pal.bg : pal.text);
      row.badge.setColor(on ? pal.bg : pal.warn);
    });
    this.counter.setText(`${this.index + 1}/${ITEMS.length}`);
    this.refreshBadges();
  }

  updateInfo() {
    const item = ITEMS[this.index];
    if (!item || !this.info) return;
    if (item.inbox) {
      const n = Sms.list().length;
      const u = Sms.unreadCount();
      this.info.setText(n ? `${u} unread · ${n} total` : 'No messages yet');
      return;
    }
    const best = Number(localStorage.getItem(item.bestKey) || 0);
    const dare = Sms.getDare();
    if (dare && dare.today && !dare.done && dare.game === item.game) {
      this.info.setText(`Best: ${best} · Dare: ${dare.target}`);
    } else {
      this.info.setText(`Best: ${best}`);
    }
  }

  launch() {
    const item = ITEMS[this.index];
    if (!item || !item.scene) return;
    Sfx.menuSelect();
    this.scene.start(item.scene);
  }

  showToast(msg) {
    this.tweens.killTweensOf(this.toast);
    this.toast.setText(msg).setAlpha(1);
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 1000, duration: 400 });
  }
}

export { ITEMS as MENU_ITEMS, INBOX_INDEX };
