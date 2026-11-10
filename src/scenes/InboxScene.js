import Phaser from 'phaser';
import { bindPhoneInput, setSoftKeys } from '../input/PhoneInput.js';
import { hexToInt } from '../skins/skins.js';
import { getSkin } from '../skins/SkinManager.js';
import * as Sfx from '../audio/Sfx.js';
import * as Music from '../audio/Music.js';
import * as Sms from '../phone/Sms.js';
import { GAME_INFO } from '../phone/messages.js';

/*
 * Retro SMS inbox.
 *   List:  ▲▼ choose · OK / left soft open · C / right soft back to menu
 *   Read:  ▲▼ scroll long texts · ◀▶ previous / next text
 *          OK on an open dare = play that game now · C back to the list
 *   0 sound · 9 music (same as the menu) · * code book
 */

const LIST_TOP = 52;
const ROW_H = 62;
const VISIBLE = 6;
const BODY_TOP = 86;
const BODY_BOTTOM = 384;

export default class InboxScene extends Phaser.Scene {
  constructor() {
    super('InboxScene');
  }

  create() {
    this.mode = 'list';
    this.index = 0;
    this.scroll = 0;
    this.bodyScroll = 0;
    this.openId = null;
    Music.enter('menu');

    bindPhoneInput(this, {
      up: () => this.onMove(-1),
      down: () => this.onMove(1),
      left: () => { if (this.mode === 'read') this.step(-1); },
      right: () => { if (this.mode === 'read') this.step(1); },
      ok: () => this.onOk(),
      softLeft: () => this.onOk(),
      softRight: () => this.onBack(),
      back: () => this.onBack(),
      digit: (d) => {
        if (d === '0') Sfx.toggleMuteWithClick();
        else if (d === '9') Music.toggle();
        else if (d === '*') { Sfx.menuSelect(); this.scene.start('CodeBookScene', { from: 'inbox' }); }
      }
    });

    const unsub = Sms.onChange(() => {
      if (this.mode === 'list') this.draw();
    });
    window.__vpg = window.__vpg || {};
    window.__vpg.inbox = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsub();
      if (window.__vpg && window.__vpg.inbox === this) delete window.__vpg.inbox;
    });

    this.draw();
  }

  messages() {
    return Sms.list();
  }

  // ---- Input -----------------------------------------------------------------

  onMove(dir) {
    if (this.mode === 'list') {
      const n = this.messages().length;
      if (!n) return;
      const next = Phaser.Math.Clamp(this.index + dir, 0, n - 1);
      if (next !== this.index) Sfx.menuMove();
      this.index = next;
      if (this.index < this.scroll) this.scroll = this.index;
      if (this.index >= this.scroll + VISIBLE) this.scroll = this.index - VISIBLE + 1;
      this.draw();
    } else {
      const max = this.maxBodyScroll || 0;
      const next = Phaser.Math.Clamp(this.bodyScroll + dir * 46, 0, max);
      if (next !== this.bodyScroll) Sfx.menuMove();
      this.bodyScroll = next;
      this.layoutBody();
    }
  }

  step(dir) {
    const list = this.messages();
    if (!list.length) return;
    const next = Phaser.Math.Clamp(this.index + dir, 0, list.length - 1);
    if (next === this.index) return;
    Sfx.menuMove();
    this.index = next;
    this.open(list[this.index]);
  }

  onOk() {
    const list = this.messages();
    if (this.mode === 'list') {
      if (!list.length) return;
      Sfx.menuSelect();
      this.open(list[this.index]);
      return;
    }
    const msg = Sms.get(this.openId);
    if (msg && msg.dare && Sms.dareStatus(msg) === 'open') {
      const info = GAME_INFO[msg.dare.game];
      if (info) {
        Sfx.menuSelect();
        this.scene.start(info.scene);
        return;
      }
    }
    this.onBack();
  }

  onBack() {
    Sfx.back();
    if (this.mode === 'read') {
      this.mode = 'list';
      this.openId = null;
      this.draw();
      return;
    }
    this.scene.start('MenuScene', { item: 'inbox' });
  }

  open(msg) {
    if (!msg) return;
    this.mode = 'read';
    this.openId = msg.id;
    this.bodyScroll = 0;
    Sms.markRead(msg.id);
    this.draw();
  }

  // ---- Drawing -------------------------------------------------------------

  draw() {
    this.children.removeAll(true);
    if (this.bodyMask) {
      this.bodyMask.destroy();
      this.bodyMask = null;
    }
    const pal = getSkin().palette;
    this.cameras.main.setBackgroundColor(pal.bg);
    if (this.mode === 'read') this.drawRead(pal);
    else this.drawList(pal);
  }

  header(pal, title, right) {
    this.add.rectangle(180, 22, 360, 44, hexToInt(pal.fg));
    this.add.text(16, 22, title, {
      fontSize: '22px', color: pal.bg, fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0, 0.5);
    if (right) {
      this.add.text(344, 22, right, {
        fontSize: '14px', color: pal.bg, fontFamily: 'monospace', fontStyle: 'bold'
      }).setOrigin(1, 0.5);
    }
  }

  envelope(x, y, pal, unread, on) {
    const g = this.add.graphics();
    const col = hexToInt(on ? pal.bg : unread ? pal.warn : pal.dim);
    if (unread) {
      g.fillStyle(col, 1);
      g.fillRect(x - 9, y - 6, 18, 12);
      g.lineStyle(2, hexToInt(on ? pal.fg : pal.panel), 1);
    } else {
      g.lineStyle(2, col, 1);
      g.strokeRect(x - 9, y - 6, 18, 12);
    }
    g.beginPath();
    g.moveTo(x - 9, y - 6);
    g.lineTo(x, y + 1);
    g.lineTo(x + 9, y - 6);
    g.strokePath();
  }

  drawList(pal) {
    const list = this.messages();
    const unread = Sms.unreadCount();
    this.index = Phaser.Math.Clamp(this.index, 0, Math.max(0, list.length - 1));
    this.header(pal, 'MESSAGES', list.length ? `${this.index + 1}/${list.length}` : '0/0');
    setSoftKeys(list.length ? 'Open' : '', 'Back');

    if (!list.length) {
      this.add.text(180, 200, 'No messages', {
        fontSize: '20px', color: pal.dim, fontFamily: 'monospace', fontStyle: 'bold'
      }).setOrigin(0.5);
      this.add.text(180, 232, 'Play a game - ur mates will txt', {
        fontSize: '13px', color: pal.dim, fontFamily: 'monospace'
      }).setOrigin(0.5);
    }

    const maxScroll = Math.max(0, list.length - VISIBLE);
    this.scroll = Phaser.Math.Clamp(this.scroll, 0, maxScroll);
    this.rowsDrawn = [];
    for (let j = this.scroll; j < Math.min(list.length, this.scroll + VISIBLE); j++) {
      const m = list[j];
      const on = j === this.index;
      const y = LIST_TOP + ROW_H / 2 + (j - this.scroll) * ROW_H;
      const bg = this.add.rectangle(180, y, 340, ROW_H - 6, hexToInt(on ? pal.fg : pal.panel)).setInteractive({ useHandCursor: true });
      const idx = j;
      bg.on('pointerdown', () => {
        this.index = idx;
        this.open(this.messages()[idx]);
      });
      this.envelope(26, y - 9, pal, !m.read, on);
      this.add.text(46, y - 10, m.from, {
        fontSize: '16px', color: on ? pal.bg : m.read ? pal.text : pal.warn, fontFamily: 'monospace', fontStyle: 'bold'
      }).setOrigin(0, 0.5);
      this.add.text(342, y - 10, Sms.formatTime(m.t), {
        fontSize: '12px', color: on ? pal.bg : pal.dim, fontFamily: 'monospace'
      }).setOrigin(1, 0.5);
      let tag = '';
      if (m.dare) {
        const ds = Sms.dareStatus(m);
        tag = ds === 'done' ? '[DARE ✓] ' : ds === 'open' ? '[DARE] ' : '[DARE x] ';
      } else if (m.code) {
        tag = '[CODE] ';
      } else if (m.missed) {
        tag = '[MISSED] ';
      }
      const raw = tag + m.text;
      const preview = raw.length > 36 ? `${raw.slice(0, 35)}…` : raw;
      this.add.text(18, y + 12, preview, {
        fontSize: '13px', color: on ? pal.bg : pal.accent, fontFamily: 'monospace'
      }).setOrigin(0, 0.5);
      this.rowsDrawn.push(m.id);
    }

    if (this.scroll > 0) {
      this.add.text(352, LIST_TOP + 2, '▲', { fontSize: '12px', color: pal.accent, fontFamily: 'monospace' }).setOrigin(1, 0);
    }
    if (this.scroll < maxScroll) {
      this.add.text(352, LIST_TOP + VISIBLE * ROW_H - 14, '▼', { fontSize: '12px', color: pal.accent, fontFamily: 'monospace' }).setOrigin(1, 0);
    }

    this.add.text(180, 440, `${unread ? `${unread} unread` : 'All read'} · * code book`, {
      fontSize: '13px', color: pal.accent, fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(180, 462, '▲▼ choose · OK read · C back', {
      fontSize: '13px', color: pal.dim, fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  drawRead(pal) {
    const msg = Sms.get(this.openId);
    if (!msg) {
      this.mode = 'list';
      this.drawList(pal);
      return;
    }
    const list = this.messages();
    this.header(pal, msg.from, `${this.index + 1}/${list.length}`);
    this.add.text(16, 58, `${msg.number || ''}`, {
      fontSize: '12px', color: pal.dim, fontFamily: 'monospace'
    }).setOrigin(0, 0.5);
    this.add.text(344, 58, Sms.formatTime(msg.t), {
      fontSize: '12px', color: pal.dim, fontFamily: 'monospace'
    }).setOrigin(1, 0.5);
    this.add.rectangle(180, 72, 328, 1, hexToInt(pal.dim));

    this.body = this.add.text(18, BODY_TOP, msg.text, {
      fontSize: '18px', color: pal.text, fontFamily: 'monospace', fontStyle: 'bold',
      wordWrap: { width: 324, useAdvancedWrap: true }, lineSpacing: 7
    });
    const shape = this.make.graphics({ add: false });
    shape.fillStyle(0xffffff, 1);
    shape.fillRect(0, BODY_TOP - 6, 360, BODY_BOTTOM - BODY_TOP + 6);
    this.bodyMask = shape;
    this.body.setMask(shape.createGeometryMask());
    this.maxBodyScroll = Math.max(0, this.body.height - (BODY_BOTTOM - BODY_TOP));
    this.bodyScroll = Phaser.Math.Clamp(this.bodyScroll, 0, this.maxBodyScroll);
    this.scrollHint = this.add.text(352, BODY_BOTTOM - 14, '▼', { fontSize: '12px', color: pal.accent, fontFamily: 'monospace' }).setOrigin(1, 0);
    this.scrollHintUp = this.add.text(352, BODY_TOP - 6, '▲', { fontSize: '12px', color: pal.accent, fontFamily: 'monospace' }).setOrigin(1, 0);
    this.layoutBody();

    // Footer: dare / code details
    let info = '';
    let infoColor = pal.accent;
    let hint = '▲▼ scroll · ◀▶ next · C back';
    let left = 'Back';
    if (msg.dare) {
      const status = Sms.dareStatus(msg);
      const name = GAME_INFO[msg.dare.game]?.name || msg.dare.game;
      if (status === 'done') {
        info = `DARE DONE ✓  ${msg.dare.target}+ in ${name}`;
        infoColor = pal.fg;
      } else if (status === 'open') {
        info = `DARE: ${msg.dare.target}+ in ${name} today\nReward: +${msg.dare.bonus} pts`;
        infoColor = pal.warn;
        hint = 'OK play now · ◀▶ next · C back';
        left = 'Play';
      } else {
        info = `Dare expired: ${msg.dare.target} in ${name}`;
        infoColor = pal.dim;
      }
    } else if (msg.code) {
      info = 'Secret code! On the menu press *\nthen type the 4 digits';
      infoColor = pal.warn;
    }
    if (info) {
      this.add.rectangle(180, 412, 340, 42, hexToInt(pal.panel)).setStrokeStyle(1, hexToInt(pal.dim));
      this.add.text(180, 412, info, {
        fontSize: '13px', color: infoColor, fontFamily: 'monospace', fontStyle: 'bold', align: 'center', lineSpacing: 3
      }).setOrigin(0.5);
    }
    this.add.text(180, 462, hint, {
      fontSize: '13px', color: pal.dim, fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5);
    setSoftKeys(left, 'Back');
  }

  layoutBody() {
    if (!this.body || !this.body.active) return;
    this.body.setY(BODY_TOP - this.bodyScroll);
    if (this.scrollHint) this.scrollHint.setVisible(this.bodyScroll < this.maxBodyScroll);
    if (this.scrollHintUp) this.scrollHintUp.setVisible(this.bodyScroll > 0);
  }
}
