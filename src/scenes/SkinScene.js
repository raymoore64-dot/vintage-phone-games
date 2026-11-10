import Phaser from 'phaser';
import { bindPhoneInput, setSoftKeys } from '../input/PhoneInput.js';
import SKINS, { hexToInt } from '../skins/skins.js';
import { getSkin, previewSkin, setSkin } from '../skins/SkinManager.js';
import { getTotal, isUnlocked, unlockAtOf } from '../progress/Progress.js';
import * as Sfx from '../audio/Sfx.js';
import * as Music from '../audio/Music.js';
import { perkFor } from '../skins/perks.js';

/** Phones shown in the picker: secret phones stay hidden until unlocked. */
export function visibleSkins() {
  return SKINS.filter((s) => !s.secret || isUnlocked(s));
}

export default class SkinScene extends Phaser.Scene {
  constructor() {
    super('SkinScene');
  }

  create() {
    // Remember the saved phone so Back can undo a live preview.
    this.savedId = getSkin().id;
    this.list = visibleSkins();
    this.viewIndex = Math.max(0, this.list.findIndex((s) => s.id === this.savedId));
    this.fromDigit = false;
    this.toast = null;
    Music.enter('menu');
    this.draw();

    setSoftKeys('Select', 'Back');
    bindPhoneInput(this, {
      left: () => this.onCycle(-1),
      right: () => this.onCycle(1),
      ok: () => this.onConfirm(),
      softLeft: () => this.onConfirm(),
      softRight: () => this.cancel(),
      back: () => this.cancel(),
      digit: (d) => {
        if (d === '9') {
          Music.toggle();
          return;
        }
        if (d === '0') {
          Sfx.toggleMuteWithClick();
          return;
        }
        this.fromDigit = true;
        const i = Number(d) - 1;
        if (i >= 0 && i < this.list.length) this.showIndex(i);
        queueMicrotask(() => { this.fromDigit = false; });
      }
    });

    window.__vpg = window.__vpg || {};
    window.__vpg.skins = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (window.__vpg && window.__vpg.skins === this) delete window.__vpg.skins;
    });
  }

  onCycle(dir) {
    if (this.fromDigit) {
      this.fromDigit = false;
      return;
    }
    this.showIndex(this.viewIndex + dir);
  }

  onConfirm() {
    if (this.fromDigit) {
      this.fromDigit = false;
      return;
    }
    this.confirm();
  }

  showIndex(i) {
    const n = this.list.length;
    const next = ((i % n) + n) % n;
    if (next !== this.viewIndex) Sfx.menuMove();
    this.viewIndex = next;
    const skin = this.list[this.viewIndex];
    if (isUnlocked(skin)) {
      previewSkin(skin.id);
    } else {
      // Keep the bezel on the last unlocked / saved phone
      previewSkin(this.savedId);
    }
    this.draw();
  }

  confirm() {
    const skin = this.list[this.viewIndex];
    if (!isUnlocked(skin)) {
      this.showToast(`Unlocks at ${unlockAtOf(skin)} pts`);
      return;
    }
    Sfx.menuSelect();
    setSkin(skin.id);
    this.scene.start('MenuScene');
  }

  cancel() {
    Sfx.back();
    setSkin(this.savedId);
    this.scene.start('MenuScene');
  }

  showToast(msg) {
    if (this.toast && this.toast.active) {
      this.tweens.killTweensOf(this.toast);
      this.toast.destroy();
    }
    const pal = getSkin().palette;
    this.toast = this.add.text(180, 250, msg, {
      fontSize: '16px',
      color: pal.bg,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      backgroundColor: pal.warn,
      padding: { x: 12, y: 6 }
    }).setOrigin(0.5);
    this.tweens.add({
      targets: this.toast, alpha: 0, delay: 900, duration: 350,
      onComplete: () => { if (this.toast) this.toast.destroy(); }
    });
  }

  draw() {
    const viewed = this.list[this.viewIndex];
    const unlocked = isUnlocked(viewed);
    // Canvas colours come from the *visible bezel* skin (never a locked one)
    const pal = getSkin().palette;
    const i = this.viewIndex;
    const total = getTotal();
    const mono = (size, color) => ({
      fontSize: size, color, fontFamily: 'monospace', fontStyle: 'bold'
    });

    this.children.removeAll(true);
    this.toast = null;
    this.cameras.main.setBackgroundColor(pal.bg);

    // Header
    this.add.rectangle(180, 26, 360, 52, hexToInt(pal.fg));
    this.add.text(16, 26, 'PHONES', mono('26px', pal.bg)).setOrigin(0, 0.5);
    this.add.text(344, 26, `${i + 1}/${this.list.length}`, mono('18px', pal.bg)).setOrigin(1, 0.5);

    this.add.text(180, 64, `Total: ${total} pts`, {
      fontSize: '14px', color: pal.accent, fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5, 0);

    // Name + brand (shown even when locked)
    this.add.text(180, 110, viewed.name.toUpperCase(), {
      ...mono('30px', unlocked ? pal.fg : pal.dim), align: 'center'
    }).setOrigin(0.5);

    this.add.text(180, 148, viewed.brand, {
      fontSize: '18px',
      color: unlocked ? pal.accent : pal.dim,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5);

    this.add.text(180, 174, viewed.tagline, {
      fontSize: '13px',
      color: pal.dim,
      fontFamily: 'monospace',
      align: 'center',
      wordWrap: { width: 320 }
    }).setOrigin(0.5);

    if (unlocked) {
      const swatches = [viewed.palette.bg, viewed.palette.fg, viewed.palette.accent, viewed.palette.warn, viewed.palette.danger, viewed.palette.text];
      const totalW = swatches.length * 36 + (swatches.length - 1) * 8;
      const startX = 180 - totalW / 2 + 18;
      this.add.rectangle(180, 230, totalW + 24, 56, hexToInt(pal.panel))
        .setStrokeStyle(1, hexToInt(pal.dim), 0.8);
      swatches.forEach((color, n) => {
        const x = startX + n * 44;
        const rect = this.add.rectangle(x, 230, 36, 36, hexToInt(color));
        rect.setStrokeStyle(2, hexToInt(pal.fg), 0.7);
      });
    } else {
      this.drawLockedSilhouette(pal, viewed);
    }

    this.drawPerk(pal, viewed, unlocked);

    // Hints
    this.add.text(180, 382, '◀  change phone  ▶', mono('16px', pal.accent)).setOrigin(0.5);
    this.add.text(180, 410, unlocked ? 'OK select   ·   C back' : 'Locked   ·   C back', mono('14px', pal.dim)).setOrigin(0.5);
    this.add.text(180, 436, `or press 1–${Math.min(8, this.list.length)}`, mono('13px', pal.dim)).setOrigin(0.5);
  }

  /** Perk card: every phone changes how the games play. */
  drawPerk(pal, viewed, unlocked) {
    const perk = perkFor(viewed.id);
    this.perkShown = perk.id;
    this.add.rectangle(180, 320, 328, 64, hexToInt(pal.panel))
      .setStrokeStyle(2, hexToInt(unlocked ? pal.fg : pal.dim), 0.9);
    this.add.text(180, 302, `PERK · ${perk.name.toUpperCase()}`, {
      fontSize: '17px', color: unlocked ? pal.warn : pal.dim, fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(180, 330, perk.desc, {
      fontSize: '12px', color: unlocked ? pal.text : pal.dim, fontFamily: 'monospace',
      align: 'center', wordWrap: { width: 312 }, lineSpacing: 2
    }).setOrigin(0.5);
  }

  drawLockedSilhouette(pal, viewed) {
    const g = this.add.graphics();
    // Dimmed phone silhouette
    g.fillStyle(hexToInt(pal.panel), 1);
    g.fillRoundedRect(138, 194, 84, 70, 10);
    g.lineStyle(2, hexToInt(pal.dim), 0.9);
    g.strokeRoundedRect(138, 194, 84, 70, 10);
    g.fillStyle(hexToInt(pal.bg), 1);
    g.fillRoundedRect(148, 202, 64, 34, 4);
    // Key dots
    g.fillStyle(hexToInt(pal.dim), 0.7);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        g.fillCircle(162 + c * 18, 244 + r * 9, 3);
      }
    }
    // Lock body + shackle
    const lx = 180;
    const ly = 216;
    g.lineStyle(4, hexToInt(pal.warn), 1);
    g.beginPath();
    g.arc(lx, ly - 2, 10, Math.PI, 0, false);
    g.strokePath();
    g.fillStyle(hexToInt(pal.warn), 1);
    g.fillRoundedRect(lx - 14, ly - 2, 28, 22, 3);
    g.fillStyle(hexToInt(pal.bg), 1);
    g.fillCircle(lx, ly + 6, 3);

    const at = unlockAtOf(viewed);
    this.add.text(180, 276, `LOCKED · ${at} pts`, {
      fontSize: '14px', color: pal.warn, fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5);
  }
}
