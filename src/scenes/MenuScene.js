import Phaser from 'phaser';
import { bindPhoneInput, setSoftKeys } from '../input/PhoneInput.js';
import { hexToInt } from '../skins/skins.js';
import { getSkin } from '../skins/SkinManager.js';
import * as Sfx from '../audio/Sfx.js';

const GAMES = [
  { name: 'Snake: Trail', scene: 'SnakeScene', bestKey: 'vpg.snake.best' },
  { name: 'Bounce: Flip', scene: 'BounceScene', bestKey: 'vpg.bounce.best' },
  { name: 'Space Impact: Echo', scene: 'ImpactScene', bestKey: 'vpg.impact.best' },
  { name: 'Bricks: Chain', scene: 'BricksScene', bestKey: 'vpg.bricks.best' },
  { name: 'Blocks: Quake', scene: 'BlocksScene', bestKey: 'vpg.blocks.best' },
  { name: 'Simon: Reverse', scene: 'SimonScene', bestKey: 'vpg.simon.best' }
];

const LIST_TOP = 76;
const ROW_H = 64;
const VISIBLE = 4;

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    this.index = 0;
    this.scroll = 0;
    this.fromDigit = false;
    const pal = getSkin().palette;
    const mono = (size, color) => ({ fontSize: size, color, fontFamily: 'monospace', fontStyle: 'bold' });

    this.cameras.main.setBackgroundColor(pal.bg);

    // Header bar
    this.add.rectangle(180, 26, 360, 52, hexToInt(pal.fg));
    this.add.text(16, 26, 'GAMES', mono('26px', pal.bg)).setOrigin(0, 0.5);
    this.counter = this.add.text(344, 26, '', mono('18px', pal.bg)).setOrigin(1, 0.5);

    this.upHint = this.add.text(180, 62, '▲ more', {
      fontSize: '14px', color: pal.accent, fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5).setAlpha(0);

    // Game list
    this.rows = GAMES.map((game, i) => {
      const bg = this.add.rectangle(180, 0, 336, 56, hexToInt(pal.panel)).setInteractive({ useHandCursor: true });
      const num = this.add.text(30, 0, String(i + 1), mono('22px', pal.fg)).setOrigin(0, 0.5);
      const label = this.add.text(62, 0, game.name, mono('18px', pal.text)).setOrigin(0, 0.5);
      bg.on('pointerdown', () => {
        this.select(i);
        this.launch();
      });
      return { bg, num, label };
    });

    this.downHint = this.add.text(180, 340, '▼ more', {
      fontSize: '14px', color: pal.accent, fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5).setAlpha(0);

    // Best score / info line — stays below the list so it never covers a row
    this.info = this.add.text(180, 368, '', mono('18px', pal.accent)).setOrigin(0.5);

    this.toast = this.add.text(180, 408, '', {
      ...mono('18px', pal.bg), backgroundColor: pal.fg, padding: { x: 14, y: 8 }
    }).setOrigin(0.5).setAlpha(0);

    this.add.text(180, 452, '▲▼ choose  •  OK play  •  1-6  •  0 sound', mono('13px', pal.dim)).setOrigin(0.5);
    this.soundText = this.add.text(180, 418, Sfx.soundLabel(), mono('16px', pal.accent)).setOrigin(0.5);

    setSoftKeys('Select', 'Phone');
    bindPhoneInput(this, {
      up: () => this.onUp(),
      down: () => this.onDown(),
      ok: () => this.onLaunch(),
      softLeft: () => this.onLaunch(),
      softRight: () => {
        Sfx.menuSelect();
        this.scene.start('SkinScene');
      },
      digit: (d) => {
        if (d === '0') {
          Sfx.toggleMuteWithClick();
          this.refreshSound();
          return;
        }
        this.fromDigit = true;
        const i = Number(d) - 1;
        if (i >= 0 && i < GAMES.length) {
          this.select(i);
          this.launch();
        }
        queueMicrotask(() => { this.fromDigit = false; });
      }
    });

    window.__vpg = window.__vpg || {};
    window.__vpg.menu = this;
    this.refreshSound();
    const unsubMute = Sfx.onMuteChange(() => this.refreshSound());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubMute();
      if (window.__vpg && window.__vpg.menu === this) delete window.__vpg.menu;
    });

    this.select(0);
  }

  refreshSound() {
    if (this.soundText && this.soundText.active) {
      this.soundText.setText(Sfx.soundLabel());
    }
  }

  onUp() {
    if (this.fromDigit) { this.fromDigit = false; return; }
    this.select(this.index - 1);
  }

  onDown() {
    if (this.fromDigit) { this.fromDigit = false; return; }
    this.select(this.index + 1);
  }

  onLaunch() {
    if (this.fromDigit) { this.fromDigit = false; return; }
    this.launch();
  }

  layoutRows() {
    const pal = getSkin().palette;
    const maxScroll = Math.max(0, GAMES.length - VISIBLE);
    this.scroll = Phaser.Math.Clamp(this.scroll, 0, maxScroll);
    this.rows.forEach((row, j) => {
      const visible = j >= this.scroll && j < this.scroll + VISIBLE;
      const y = LIST_TOP + ROW_H / 2 + (j - this.scroll) * ROW_H;
      row.bg.setY(y).setVisible(visible).setActive(visible);
      row.num.setY(y).setVisible(visible);
      row.label.setY(y).setVisible(visible);
      if (visible) row.bg.setInteractive({ useHandCursor: true });
      else row.bg.disableInteractive();
    });
    this.upHint.setAlpha(this.scroll > 0 ? 1 : 0);
    this.downHint.setY(LIST_TOP + VISIBLE * ROW_H + 2);
    this.downHint.setAlpha(this.scroll < maxScroll ? 1 : 0);
    this.upHint.setColor(pal.accent);
    this.downHint.setColor(pal.accent);
  }

  keepInView(i) {
    if (i < this.scroll) this.scroll = i;
    if (i >= this.scroll + VISIBLE) this.scroll = i - VISIBLE + 1;
  }

  select(i) {
    const pal = getSkin().palette;
    const next = (i + GAMES.length) % GAMES.length;
    const changed = next !== this.index;
    this.index = next;
    if (changed) Sfx.menuMove();
    this.keepInView(this.index);
    this.layoutRows();
    this.rows.forEach((row, j) => {
      const on = j === this.index;
      const playable = !!GAMES[j].scene;
      row.bg.setFillStyle(on ? hexToInt(pal.fg) : hexToInt(pal.panel));
      row.num.setColor(on ? pal.bg : pal.fg);
      row.label.setColor(on ? pal.bg : playable ? pal.text : pal.dim);
    });
    this.counter.setText(`${this.index + 1}/${GAMES.length}`);

    const game = GAMES[this.index];
    if (game.bestKey) {
      const best = Number(localStorage.getItem(game.bestKey) || 0);
      this.info.setText(`Best: ${best}`);
    } else {
      this.info.setText(game.scene ? '' : 'Coming soon');
    }
  }

  launch() {
    const game = GAMES[this.index];
    if (game.scene) {
      Sfx.menuSelect();
      this.scene.start(game.scene);
    } else {
      this.showToast('Coming soon!');
    }
  }

  showToast(msg) {
    this.tweens.killTweensOf(this.toast);
    this.toast.setText(msg).setAlpha(1);
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 800, duration: 400 });
  }
}
