import Phaser from 'phaser';
import { bindPhoneInput, setSoftKeys } from '../input/PhoneInput.js';
import { hexToInt } from '../skins/skins.js';
import { getSkin } from '../skins/SkinManager.js';
import * as Sfx from '../audio/Sfx.js';
import * as Music from '../audio/Music.js';
import * as Eggs from '../phone/Eggs.js';
import * as Phone from '../phone/Phone.js';

/*
 * Code book: every T9 word egg and *-code, found or ???.
 *   ▲▼ choose · OK use a found word again · C / right soft back
 * Opened from Settings (menu 8) or the Messages inbox (press *).
 */

const TOP = 54;
const ROW_H = 44;
const VISIBLE = 8;

export default class CodeBookScene extends Phaser.Scene {
  constructor() {
    super('CodeBookScene');
  }

  init(data) {
    this.from = (data && data.from) || 'menu';
  }

  create() {
    this.index = 0;
    this.scroll = 0;
    this.fromDigit = false;
    Music.enter('menu');
    setSoftKeys('Use', 'Back');
    bindPhoneInput(this, {
      up: () => { if (!this.skip()) this.move(-1); },
      down: () => { if (!this.skip()) this.move(1); },
      ok: () => { if (!this.skip()) this.use(); },
      softLeft: () => this.use(),
      softRight: () => this.back(),
      back: () => this.back(),
      digit: (d) => {
        this.fromDigit = true;
        queueMicrotask(() => { this.fromDigit = false; });
        if (d === '0') Sfx.toggleMuteWithClick();
        else if (d === '9') Music.toggle();
      }
    });
    window.__vpg = window.__vpg || {};
    window.__vpg.codebook = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (window.__vpg && window.__vpg.codebook === this) delete window.__vpg.codebook;
    });
    this.draw();
  }

  skip() {
    if (this.fromDigit) { this.fromDigit = false; return true; }
    return false;
  }

  move(dir) {
    const n = Eggs.entries().length;
    const next = Phaser.Math.Clamp(this.index + dir, 0, n - 1);
    if (next !== this.index) Sfx.menuMove();
    this.index = next;
    if (this.index < this.scroll) this.scroll = this.index;
    if (this.index >= this.scroll + VISIBLE) this.scroll = this.index - VISIBLE + 1;
    this.draw();
  }

  use() {
    const e = Eggs.entries()[this.index];
    if (!e || !e.found) { Sfx.play('codeBad'); return; }
    if (e.secret) { Phone.toast(`Type ${e.word} on the menu`); return; }
    const res = Eggs.trigger(e.id);
    Sfx.play('eggFound');
    if (res && res.message) Phone.toast(res.message);
    if (res && res.scene) { this.scene.start(res.scene); return; }
    this.draw();
  }

  back() {
    Sfx.back();
    if (this.from === 'inbox') this.scene.start('InboxScene');
    else if (this.from === 'settings') this.scene.start('SettingsScene', { index: 3 });
    else this.scene.start('MenuScene');
  }

  draw() {
    const pal = getSkin().palette;
    const mono = (size, color) => ({ fontSize: size, color, fontFamily: 'monospace', fontStyle: 'bold' });
    const list = Eggs.entries();
    this.children.removeAll(true);
    this.cameras.main.setBackgroundColor(pal.bg);
    this.add.rectangle(180, 22, 360, 44, hexToInt(pal.fg));
    this.add.text(16, 22, 'CODE BOOK', mono('24px', pal.bg)).setOrigin(0, 0.5);
    this.add.text(344, 22, `${Eggs.foundCount()}/${Eggs.totalCount()}`, mono('18px', pal.bg)).setOrigin(1, 0.5);

    list.slice(this.scroll, this.scroll + VISIBLE).forEach((e, k) => {
      const j = this.scroll + k;
      const y = TOP + k * ROW_H + ROW_H / 2;
      const on = j === this.index;
      const bg = this.add.rectangle(180, y, 340, ROW_H - 4, hexToInt(on ? pal.fg : pal.panel));
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.index = j; this.use(); });
      const word = e.found ? e.word : e.word.replace(/[^*]/g, '?');
      const digits = e.found ? e.digits : e.digits.replace(/[^*]/g, '?');
      this.add.text(18, y - 9, word, mono('16px', on ? pal.bg : (e.found ? pal.fg : pal.dim))).setOrigin(0, 0.5);
      this.add.text(342, y - 9, digits, mono('14px', on ? pal.bg : (e.found ? pal.warn : pal.dim))).setOrigin(1, 0.5);
      const status = e.found ? `${e.name}${e.on ? ' · ON' : ''} — ${e.desc}` : '???';
      this.add.text(18, y + 10, status, {
        fontSize: '11px', color: on ? pal.bg : (e.found ? pal.text : pal.dim), fontFamily: 'monospace',
        fixedWidth: 326
      }).setOrigin(0, 0.5);
    });

    this.add.text(180, 420, 'Find words: menu * * then spell', mono('13px', pal.accent)).setOrigin(0.5);
    this.add.text(180, 440, '2abc 3def 4ghi 5jkl 6mno', mono('12px', pal.dim)).setOrigin(0.5);
    this.add.text(180, 458, '7pqrs 8tuv 9wxyz · e.g. 565', mono('12px', pal.dim)).setOrigin(0.5);
  }
}
