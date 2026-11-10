import Phaser from 'phaser';
import { bindPhoneInput, setSoftKeys } from '../input/PhoneInput.js';
import { hexToInt } from '../skins/skins.js';
import { getSkin } from '../skins/SkinManager.js';

const GAMES = [
  { name: 'Snake: Trail', scene: 'SnakeScene', bestKey: 'vpg.snake.best' },
  { name: 'Bounce: Flip', scene: 'BounceScene', bestKey: 'vpg.bounce.best' },
  { name: 'Space Impact: Echo', scene: 'ImpactScene', bestKey: 'vpg.impact.best' }
];

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    this.index = 0;
    const pal = getSkin().palette;
    const mono = (size, color) => ({ fontSize: size, color, fontFamily: 'monospace', fontStyle: 'bold' });

    this.cameras.main.setBackgroundColor(pal.bg);

    // Header bar
    this.add.rectangle(180, 26, 360, 52, hexToInt(pal.fg));
    this.add.text(16, 26, 'GAMES', mono('26px', pal.bg)).setOrigin(0, 0.5);
    this.counter = this.add.text(344, 26, '', mono('18px', pal.bg)).setOrigin(1, 0.5);

    // Game list
    this.rows = GAMES.map((game, i) => {
      const y = 100 + i * 64;
      const bg = this.add.rectangle(180, y, 336, 52, hexToInt(pal.panel)).setInteractive({ useHandCursor: true });
      const num = this.add.text(30, y, String(i + 1), mono('24px', pal.fg)).setOrigin(0, 0.5);
      const label = this.add.text(66, y, game.name, mono('22px', pal.text))
        .setOrigin(0, 0.5);
      bg.on('pointerdown', () => {
        this.select(i);
        this.launch();
      });
      return { bg, num, label };
    });

    // Best score / info line
    this.info = this.add.text(180, 330, '', mono('18px', pal.accent)).setOrigin(0.5);

    // Toast for "coming soon"
    this.toast = this.add.text(180, 400, '', {
      ...mono('20px', pal.bg), backgroundColor: pal.fg, padding: { x: 14, y: 8 }
    }).setOrigin(0.5).setAlpha(0);

    this.add.text(180, 460, '▲▼ choose  •  OK play', mono('14px', pal.dim)).setOrigin(0.5);

    setSoftKeys('Select', 'Phone');
    bindPhoneInput(this, {
      up: () => this.select(this.index - 1),
      down: () => this.select(this.index + 1),
      ok: () => this.launch(),
      softLeft: () => this.launch(),
      softRight: () => this.scene.start('SkinScene'),
      digit: (d) => {
        const i = Number(d) - 1;
        if (i >= 0 && i < GAMES.length) {
          this.select(i);
          this.launch();
        }
      }
    });

    this.select(0);
  }

  select(i) {
    const pal = getSkin().palette;
    this.index = (i + GAMES.length) % GAMES.length;
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
