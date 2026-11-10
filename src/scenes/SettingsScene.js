import Phaser from 'phaser';
import { bindPhoneInput, setSoftKeys } from '../input/PhoneInput.js';
import { hexToInt } from '../skins/skins.js';
import { getSkin } from '../skins/SkinManager.js';
import * as Sfx from '../audio/Sfx.js';
import * as Music from '../audio/Music.js';
import * as Calls from '../phone/Calls.js';
import * as Eggs from '../phone/Eggs.js';
import * as Power from '../phone/Power.js';

/*
 * Settings (menu 8)
 *   ▲▼ / 2 8 choose · OK / 5 / left soft change · 1-5 jump + change
 *   C / right soft back to the menu
 * Rows: Sound, Music, Calls (fake incoming calls on/off), Code book,
 * Power off (same as holding the red C key / Esc / End).
 */

const MENU_SETTINGS_INDEX = 7;
const ROWS = ['sound', 'music', 'calls', 'codebook', 'power'];
const TOP = 66;
const ROW_H = 56;

export default class SettingsScene extends Phaser.Scene {
  constructor() {
    super('SettingsScene');
  }

  init(data) {
    this.index = data && Number.isInteger(data.index) ? data.index : 0;
  }

  create() {
    const pal = getSkin().palette;
    this.pal = pal;
    this.fromDigit = false;
    const mono = (size, color) => ({ fontSize: size, color, fontFamily: 'monospace', fontStyle: 'bold' });
    this.cameras.main.setBackgroundColor(pal.bg);
    this.add.rectangle(180, 22, 360, 44, hexToInt(pal.fg));
    this.add.text(16, 22, 'SETTINGS', mono('24px', pal.bg)).setOrigin(0, 0.5);

    this.rows = ROWS.map((id, i) => {
      const y = TOP + i * ROW_H + ROW_H / 2;
      const bg = this.add.rectangle(180, y, 336, 48, hexToInt(pal.panel)).setInteractive({ useHandCursor: true });
      const num = this.add.text(30, y, String(i + 1), mono('20px', pal.fg)).setOrigin(0, 0.5);
      const label = this.add.text(60, y, '', mono('17px', pal.text)).setOrigin(0, 0.5);
      const value = this.add.text(334, y, '', mono('15px', pal.warn)).setOrigin(1, 0.5);
      bg.on('pointerdown', () => { this.select(i); this.activate(); });
      return { id, bg, num, label, value };
    });

    this.note = this.add.text(180, 374, '', {
      ...mono('13px', pal.accent), align: 'center', wordWrap: { width: 320 }
    }).setOrigin(0.5);
    this.add.text(180, 440, '▲▼ choose · OK change · C back', mono('13px', pal.dim)).setOrigin(0.5);
    this.add.text(180, 462, 'Hold C / Esc / End = power', mono('13px', pal.dim)).setOrigin(0.5);

    setSoftKeys('Change', 'Back');
    bindPhoneInput(this, {
      up: () => { if (!this.skipAlias()) this.select(this.index - 1); },
      down: () => { if (!this.skipAlias()) this.select(this.index + 1); },
      ok: () => { if (!this.skipAlias()) this.activate(); },
      softLeft: () => this.activate(),
      softRight: () => this.back(),
      back: () => this.back(),
      digit: (d) => {
        this.fromDigit = true;
        queueMicrotask(() => { this.fromDigit = false; });
        const i = Number(d) - 1;
        if (i >= 0 && i < ROWS.length) {
          this.select(i);
          this.activate();
        }
      }
    });

    Music.enter('menu');
    const u1 = Sfx.onMuteChange(() => this.refresh());
    const u2 = Music.onMusicChange(() => this.refresh());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { u1(); u2(); if (window.__vpg && window.__vpg.settings === this) delete window.__vpg.settings; });
    window.__vpg = window.__vpg || {};
    window.__vpg.settings = this;
    this.select(Phaser.Math.Clamp(this.index, 0, ROWS.length - 1), true);
  }

  skipAlias() {
    if (this.fromDigit) { this.fromDigit = false; return true; }
    return false;
  }

  values() {
    return {
      sound: ['Sound', Sfx.isMuted() ? 'Off' : 'On', 'Effects. M toggles anywhere.'],
      music: ['Music', Music.isMusicEnabled() ? 'On' : 'Off', 'Chiptune loops. N toggles anywhere.'],
      calls: ['Calls', Calls.callsEnabled() ? 'On' : 'Off', 'Friends (and The Bank) sometimes ring mid-game. Answer for a bonus.'],
      codebook: ['Code book', `${Eggs.foundCount()}/${Eggs.totalCount()}`, 'Secret words: on the menu press * * then spell a word.'],
      power: ['Power off', '', 'Or hold the red C key (Esc / End).']
    };
  }

  refresh() {
    if (!this.rows) return;
    const v = this.values();
    this.rows.forEach((r, j) => {
      const on = j === this.index;
      r.label.setText(v[r.id][0]);
      r.value.setText(v[r.id][1]);
      r.bg.setFillStyle(on ? hexToInt(this.pal.fg) : hexToInt(this.pal.panel));
      r.num.setColor(on ? this.pal.bg : this.pal.fg);
      r.label.setColor(on ? this.pal.bg : this.pal.text);
      r.value.setColor(on ? this.pal.bg : this.pal.warn);
    });
    this.note.setText(v[ROWS[this.index]][2]);
  }

  select(i, quiet = false) {
    const next = (i + ROWS.length) % ROWS.length;
    if (next !== this.index && !quiet) Sfx.menuMove();
    this.index = next;
    this.refresh();
  }

  activate() {
    const id = ROWS[this.index];
    if (id === 'sound') Sfx.toggleMuteWithClick();
    else if (id === 'music') { Music.toggle(); Sfx.menuSelect(); }
    else if (id === 'calls') { Calls.toggleCalls(); Sfx.menuSelect(); }
    else if (id === 'codebook') { Sfx.menuSelect(); this.scene.start('CodeBookScene', { from: 'settings' }); return; }
    else if (id === 'power') { Power.powerOff(); return; }
    this.refresh();
  }

  back() {
    Sfx.back();
    this.scene.start('MenuScene', { index: MENU_SETTINGS_INDEX });
  }
}
