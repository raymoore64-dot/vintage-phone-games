import Phaser from 'phaser';
import { bindPhoneInput, setSoftKeys } from '../input/PhoneInput.js';
import SKINS, { hexToInt, skinIndex } from '../skins/skins.js';
import { getSkin, previewSkin, setSkin } from '../skins/SkinManager.js';

export default class SkinScene extends Phaser.Scene {
  constructor() {
    super('SkinScene');
  }

  create() {
    // Remember the saved phone so Back can undo a live preview.
    this.savedId = getSkin().id;
    this.draw();

    setSoftKeys('Select', 'Back');
    bindPhoneInput(this, {
      left: () => this.cycle(-1),
      right: () => this.cycle(1),
      ok: () => this.confirm(),
      softLeft: () => this.confirm(),
      softRight: () => this.cancel(),
      back: () => this.cancel(),
      digit: (d) => {
        const i = Number(d) - 1;
        if (i >= 0 && i < SKINS.length) this.show(SKINS[i].id);
      }
    });
  }

  cycle(dir) {
    const i = (skinIndex(getSkin().id) + dir + SKINS.length) % SKINS.length;
    this.show(SKINS[i].id);
  }

  show(id) {
    previewSkin(id);
    this.draw();
  }

  confirm() {
    setSkin(getSkin().id);
    this.scene.start('MenuScene');
  }

  cancel() {
    setSkin(this.savedId);
    this.scene.start('MenuScene');
  }

  draw() {
    const skin = getSkin();
    const pal = skin.palette;
    const i = skinIndex(skin.id);
    const mono = (size, color) => ({
      fontSize: size, color, fontFamily: 'monospace', fontStyle: 'bold'
    });

    this.children.removeAll(true);
    this.cameras.main.setBackgroundColor(pal.bg);

    // Header
    this.add.rectangle(180, 26, 360, 52, hexToInt(pal.fg));
    this.add.text(16, 26, 'PHONES', mono('26px', pal.bg)).setOrigin(0, 0.5);
    this.add.text(344, 26, `${i + 1}/${SKINS.length}`, mono('18px', pal.bg)).setOrigin(1, 0.5);

    // Name + brand
    this.add.text(180, 130, skin.name.toUpperCase(), {
      ...mono('32px', pal.fg), align: 'center'
    }).setOrigin(0.5);

    this.add.text(180, 172, skin.brand, {
      fontSize: '20px',
      color: pal.accent,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5);

    this.add.text(180, 206, skin.tagline, {
      fontSize: '14px',
      color: pal.dim,
      fontFamily: 'monospace',
      align: 'center'
    }).setOrigin(0.5);

    // Palette preview swatches (panel behind so the LCD-bg chip stays visible)
    const swatches = [pal.bg, pal.fg, pal.accent, pal.warn, pal.danger, pal.text];
    const totalW = swatches.length * 36 + (swatches.length - 1) * 8;
    const startX = 180 - totalW / 2 + 18;
    this.add.rectangle(180, 268, totalW + 24, 56, hexToInt(pal.panel))
      .setStrokeStyle(1, hexToInt(pal.dim), 0.8);
    swatches.forEach((color, n) => {
      const x = startX + n * 44;
      const rect = this.add.rectangle(x, 268, 36, 36, hexToInt(color));
      rect.setStrokeStyle(2, hexToInt(pal.fg), 0.7);
    });

    // Hints
    this.add.text(180, 360, '◀  change phone  ▶', mono('18px', pal.accent)).setOrigin(0.5);
    this.add.text(180, 400, 'OK select   ·   C back', mono('14px', pal.dim)).setOrigin(0.5);
    this.add.text(180, 440, 'or press 1–4', mono('13px', pal.dim)).setOrigin(0.5);
  }
}
