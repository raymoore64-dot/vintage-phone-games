import Phaser from 'phaser';
import { bindPhoneInput, setSoftKeys } from '../input/PhoneInput.js';
import { getSkin } from '../skins/SkinManager.js';
import * as Sfx from '../audio/Sfx.js';
import * as Music from '../audio/Music.js';

/*
 * Retro rolling credits (T9 egg: CREDITS = 2733487).
 * OK / C / any soft key returns to the menu. Rolls once, then returns.
 */

const LINES = [
  ['Linicro', 'h1'], ['', ''],
  ['vintage phone games', 'sub'], ['', ''],
  ['a Studio Linicro production', 'sub'], ['', ''], ['', ''],
  ['SNAKE WRANGLER', 'role'], ['Dex', 'name'], ['', ''],
  ['CATERING', 'role'], ['Mum', 'name'], ['(tea is in the microwave)', 'sub'], ['', ''],
  ['GOSSIP CONSULTANT', 'role'], ['Kaz', 'name'], ['', ''],
  ['PROTOTYPE SECURITY', 'role'], ['Unknown', 'name'], ['', ''],
  ['INTEREST RATES', 'role'], ['The Bank', 'name'], ['', ''],
  ['RINGTONES', 'role'], ['composed on a keypad', 'name'], ['', ''],
  ['PIXELS', 'role'], ['all 172,800 of them', 'name'], ['', ''], ['', ''],
  ['No phones were dropped', 'sub'], ['in a toilet during development.', 'sub'], ['Ok. One.', 'sub'], ['', ''], ['', ''],
  ['THANKS FOR PLAYING!', 'h2'], ['', ''], ['OK = menu', 'sub']
];

export default class CreditsScene extends Phaser.Scene {
  constructor() {
    super('CreditsScene');
  }

  create() {
    const pal = getSkin().palette;
    this.cameras.main.setBackgroundColor(pal.bg);
    const styles = {
      h1: { fontSize: '32px', color: pal.fg },
      h2: { fontSize: '22px', color: pal.warn },
      role: { fontSize: '13px', color: pal.dim },
      name: { fontSize: '19px', color: pal.text },
      sub: { fontSize: '13px', color: pal.accent },
      '': { fontSize: '12px', color: pal.dim }
    };
    let y = 0;
    this.roll = this.add.container(0, 500);
    LINES.forEach(([text, kind]) => {
      const st = styles[kind] || styles[''];
      const t = this.add.text(180, y, text, { ...st, fontFamily: 'monospace', fontStyle: 'bold', align: 'center' }).setOrigin(0.5, 0);
      this.roll.add(t);
      y += parseInt(st.fontSize, 10) + 10;
    });
    this.rollHeight = y;
    this.tweens.add({
      targets: this.roll,
      y: 240 - y,
      duration: y * 22,
      ease: 'Linear',
      onComplete: () => this.time.delayedCall(1500, () => this.leave())
    });
    Music.enter('menu');
    Sfx.play('eggFound');
    setSoftKeys('', 'Menu');
    const leave = () => this.leave();
    bindPhoneInput(this, { ok: leave, softLeft: leave, softRight: leave, back: leave });
    window.__vpg = window.__vpg || {};
    window.__vpg.credits = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (window.__vpg && window.__vpg.credits === this) delete window.__vpg.credits;
    });
  }

  leave() {
    if (this.leaving) return;
    this.leaving = true;
    Sfx.back();
    this.scene.start('MenuScene');
  }
}
