import Phaser from 'phaser';
import { bindPhoneInput, setSoftKeys } from '../input/PhoneInput.js';
import { hexToInt } from '../skins/skins.js';
import { getSkin } from '../skins/SkinManager.js';
import * as Sfx from '../audio/Sfx.js';
import * as Music from '../audio/Music.js';
import { BASE_GAMES } from '../games.js';
import * as Wap from '../wap/Wap.js';
import { renderScoreCard, shareScore } from '../share/ScoreCard.js';

/*
 * Share score: preview and share a score card for any game's best.
 *   ◀ ▶ / 4 6   choose game      ▲ ▼ / 2 8   Story 1080x1920 / Square 1080x1080
 *   OK / 5      share (share sheet, or downloads the PNG)
 *   C           back
 */

const TEX = 'vpg-share-preview';

export default class ShareScene extends Phaser.Scene {
  constructor() {
    super('ShareScene');
  }

  init(data) {
    this.startGame = data && data.gameId ? data.gameId : null;
    this.from = data && data.from ? data.from : 'menu';
  }

  create() {
    const pal = getSkin().palette;
    this.pal = pal;
    this.fromDigit = false;
    this.busy = false;
    const mono = (size, color) => ({ fontSize: size, color, fontFamily: 'monospace', fontStyle: 'bold' });
    this.cameras.main.setBackgroundColor(pal.bg);
    this.add.rectangle(180, 22, 360, 44, hexToInt(pal.fg));
    this.add.text(16, 22, 'SHARE SCORE', mono('22px', pal.bg)).setOrigin(0, 0.5);
    this.fmtText = this.add.text(344, 22, '', mono('14px', pal.bg)).setOrigin(1, 0.5);

    this.games = [
      ...BASE_GAMES.map((g) => ({ id: g.id, name: g.name, bestKey: g.bestKey })),
      ...Wap.menuGames().map((g) => ({ id: g.game, name: g.name, bestKey: g.bestKey }))
    ];
    const start = this.games.findIndex((g) => g.id === this.startGame);
    this.gi = start >= 0 ? start : this.bestIndex();
    this.format = 'story';

    this.frame = null;
    this.preview = null;
    this.gameText = this.add.text(180, 378, '', mono('16px', pal.fg)).setOrigin(0.5);
    this.bestText = this.add.text(180, 400, '', mono('13px', pal.accent)).setOrigin(0.5);
    this.add.text(180, 424, 'OK share · ▲▼ size', mono('13px', pal.dim)).setOrigin(0.5);
    this.add.text(180, 444, '◀▶ game · C back', mono('13px', pal.dim)).setOrigin(0.5);
    this.status = this.add.text(180, 463, 'Shares a PNG (or saves it)', mono('12px', pal.dim)).setOrigin(0.5);

    setSoftKeys('Share', 'Back');
    bindPhoneInput(this, {
      left: () => { if (!this.alias()) this.pick(-1); },
      right: () => { if (!this.alias()) this.pick(1); },
      up: () => { if (!this.alias()) this.toggle(); },
      down: () => { if (!this.alias()) this.toggle(); },
      ok: () => { if (!this.alias()) this.share(); },
      softLeft: () => this.share(),
      softRight: () => this.back(),
      back: () => this.back(),
      digit: (d) => {
        this.fromDigit = true;
        queueMicrotask(() => { this.fromDigit = false; });
        if (d === '4') this.pick(-1);
        else if (d === '6') this.pick(1);
        else if (d === '2' || d === '8') this.toggle();
        else if (d === '5') this.share();
      }
    });
    Music.enter('menu');
    window.__vpg = window.__vpg || {};
    window.__vpg.shareScene = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.textures.exists(TEX)) this.textures.remove(TEX);
      if (window.__vpg && window.__vpg.shareScene === this) delete window.__vpg.shareScene;
    });
    this.redraw();
  }

  alias() {
    if (this.fromDigit) { this.fromDigit = false; return true; }
    return false;
  }

  bestIndex() {
    let bi = 0;
    let bv = -1;
    this.games.forEach((g, i) => {
      const v = Number(localStorage.getItem(g.bestKey) || 0);
      if (v > bv) { bv = v; bi = i; }
    });
    return bi;
  }

  current() {
    const g = this.games[this.gi];
    const best = Number(localStorage.getItem(g.bestKey) || 0) || 0;
    return { gameId: g.id, gameName: g.name, score: best, best, format: this.format };
  }

  redraw() {
    const c = this.current();
    const canvas = renderScoreCard(c);
    if (this.preview) { this.preview.destroy(); this.preview = null; }
    if (this.textures.exists(TEX)) this.textures.remove(TEX);
    this.textures.addCanvas(TEX, canvas);
    const maxH = 300;
    const maxW = 300;
    const s = Math.min(maxW / canvas.width, maxH / canvas.height);
    this.preview = this.add.image(180, 206, TEX).setScale(s);
    if (this.frame) this.frame.destroy();
    this.frame = this.add.rectangle(180, 206, canvas.width * s + 6, canvas.height * s + 6).setStrokeStyle(2, hexToInt(this.pal.dim));
    this.gameText.setText(`◀ ${c.gameName} ▶`);
    this.bestText.setText(`Best ${c.best} · ${this.format === 'story' ? 'Story 1080x1920' : 'Square 1080x1080'}`);
    this.fmtText.setText(`${this.gi + 1}/${this.games.length}`);
  }

  pick(d) {
    if (this.busy) return;
    this.gi = (this.gi + d + this.games.length) % this.games.length;
    Sfx.menuMove();
    this.redraw();
  }

  toggle() {
    if (this.busy) return;
    this.format = this.format === 'story' ? 'square' : 'story';
    Sfx.menuMove();
    this.redraw();
  }

  async share() {
    if (this.busy) return;
    this.busy = true;
    Sfx.play('shareSnap');
    this.status.setText('Preparing PNG...');
    const res = await shareScore(this.current());
    this.lastResult = res;
    this.busy = false;
    if (!this.sys || !this.sys.isActive()) return;
    const msg = { share: 'Shared!', download: `Saved ${res.filename}`, cancelled: 'Share cancelled', failed: 'Could not share' }[res.method] || '';
    this.status.setText(msg.length > 44 ? `${msg.slice(0, 43)}…` : msg);
  }

  back() {
    Sfx.menuSelect();
    this.scene.start('MenuScene', { item: 'share' });
  }
}
