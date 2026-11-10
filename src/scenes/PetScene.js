import Phaser from 'phaser';
import { bindPhoneInput, setSoftKeys } from '../input/PhoneInput.js';
import { hexToInt } from '../skins/skins.js';
import { getSkin } from '../skins/SkinManager.js';
import * as Sfx from '../audio/Sfx.js';
import * as Music from '../audio/Music.js';
import * as Pet from '../pet/Pet.js';
import { drawPet, drawHeart, petSize } from '../pet/sprites.js';

/*
 * Pocket pet screen.
 *   OK / 5        pet it (+fun)            ▲ / 2   "which paw?" game, then ◀ / ▶ (4 / 6)
 *   *             rename (multi-tap: 2 = A B C ..., 0 = space, 1 = -,
 *                 OK saves, C deletes, C on empty cancels)
 *   C / right soft back to the menu
 */

const T9 = { 1: '-', 2: 'ABC', 3: 'DEF', 4: 'GHI', 5: 'JKL', 6: 'MNO', 7: 'PQRS', 8: 'TUV', 9: 'WXYZ', 0: ' ' };
const TAP_MS = 900;
const PET_BOTTOM = 214;

export default class PetScene extends Phaser.Scene {
  constructor() {
    super('PetScene');
  }

  create() {
    const pal = getSkin().palette;
    this.pal = pal;
    this.frame = 0;
    this.fromDigit = false;
    this.rename = null;
    this.fx = [];      // { kind, born }
    this.msgUntil = 0;
    const mono = (size, color, extra = {}) => ({ fontSize: size, color, fontFamily: 'monospace', fontStyle: 'bold', ...extra });
    this.mono = mono;
    this.cameras.main.setBackgroundColor(pal.bg);

    this.add.rectangle(180, 22, 360, 44, hexToInt(pal.fg));
    this.title = this.add.text(16, 22, '', mono('22px', pal.bg)).setOrigin(0, 0.5);
    this.stageText = this.add.text(344, 22, '', mono('15px', pal.bg)).setOrigin(1, 0.5);

    this.g = this.add.graphics();
    this.fxG = this.add.graphics();
    this.zzz = this.add.text(268, 80, '', mono('20px', pal.accent));
    this.moodLine = this.add.text(180, 236, '', mono('16px', pal.warn)).setOrigin(0.5);

    this.bars = ['food', 'fun', 'energy'].map((k, i) => {
      const y = 268 + i * 28;
      this.add.text(20, y, k.toUpperCase(), mono('14px', pal.text)).setOrigin(0, 0.5);
      this.add.rectangle(200, y, 204, 16).setStrokeStyle(2, hexToInt(pal.fg));
      const fill = this.add.rectangle(100, y, 0, 10, hexToInt(pal.fg)).setOrigin(0, 0.5);
      const pct = this.add.text(344, y, '', mono('13px', pal.accent)).setOrigin(1, 0.5);
      return { k, fill, pct };
    });
    this.dayLine = this.add.text(180, 354, '', mono('13px', pal.accent)).setOrigin(0.5);
    this.statLine = this.add.text(180, 374, '', mono('12px', pal.dim)).setOrigin(0.5);
    this.hint1 = this.add.text(180, 424, '', mono('13px', pal.dim)).setOrigin(0.5);
    this.hint2 = this.add.text(180, 444, '', mono('13px', pal.dim)).setOrigin(0.5);
    this.hint3 = this.add.text(180, 463, 'Points from games = food', mono('12px', pal.dim)).setOrigin(0.5);

    this.buildRename();

    bindPhoneInput(this, {
      ok: () => { if (!this.alias()) this.onOk(); },
      softLeft: () => this.onOk(),
      up: () => { if (!this.alias()) this.onUp(); },
      left: () => { if (!this.alias()) this.onSide('left'); },
      right: () => { if (!this.alias()) this.onSide('right'); },
      down: () => { this.alias(); },
      back: () => this.onBack(),
      softRight: () => this.onBack(),
      digit: (d) => this.onDigit(d)
    });

    this.time.addEvent({ delay: 250, loop: true, callback: () => { this.frame += 1; this.draw(); } });
    const unsub = Pet.onPetChange(() => this.refresh());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsub();
      Pet.cancelGuess();
      if (window.__vpg && window.__vpg.petScene === this) delete window.__vpg.petScene;
    });
    window.__vpg = window.__vpg || {};
    window.__vpg.petScene = this;
    Music.enter('menu');
    const m = Pet.mood();
    if (m === 'grumpy' || m === 'sick') Sfx.play('petGrumpy');
    else if (m === 'eating') Sfx.play('petEat');
    else Sfx.play('petBlip');
    this.refresh();
  }

  alias() {
    if (this.fromDigit) { this.fromDigit = false; return true; }
    return false;
  }

  // ---- drawing --------------------------------------------------------------

  rect(g) {
    return (x, y, w, h, css) => { g.fillStyle(hexToInt(css), 1); g.fillRect(x, y, w, h); };
  }

  refresh() {
    const s = Pet.state();
    this.title.setText(s.name);
    this.stageText.setText(Pet.STAGES[s.stage]);
    this.bars.forEach((b) => {
      const v = Math.round(s[b.k]);
      b.fill.width = Math.max(0, Math.round(196 * v / 100));
      b.fill.setFillStyle(hexToInt(v < 25 ? this.pal.danger : this.pal.fg));
      b.pct.setText(`${v}%`);
    });
    const next = s.next ? ` · ${s.next.name} in ${s.next.inDays}d` : ' · fully grown';
    this.dayLine.setText(`Days played ${s.days}${next}`);
    this.statLine.setText(`Meals ${s.meals} · Pets ${s.pets} · Paw wins ${s.wins}`);
    if (this.time.now > this.msgUntil && !Pet.guessing()) this.moodLine.setText(Pet.moodText());
    if (!this.rename) {
      this.hint1.setText(Pet.guessing() ? '◀ 4  or  6 ▶  pick a paw' : 'OK pet · ▲ paw game · * rename');
      this.hint2.setText('C back');
      setSoftKeys(Pet.guessing() ? '' : 'Pet', 'Back');
    }
    this.draw();
  }

  say(msg, ms = 1400) {
    if (!msg) return;
    this.moodLine.setText(msg);
    this.msgUntil = this.time.now + ms;
  }

  draw() {
    const s = Pet.state();
    if (this.msgUntil && this.time.now > this.msgUntil && !Pet.guessing()) {
      this.msgUntil = 0;
      this.moodLine.setText(Pet.moodText());
    }
    const pal = this.pal;
    const g = this.g;
    g.clear();
    let mood = s.mood;
    if (mood === 'idle' && this.frame % 16 === 0) mood = 'blink';
    const size = petSize(s.stage);
    const scale = s.stage >= 2 ? 8 : 9;
    const w = size.w * scale;
    const h = size.h * scale;
    const bob = (mood === 'sleepy' || mood === 'sick') ? 0 : (this.frame % 4 < 2 ? 0 : -scale / 2);
    const hop = mood === 'happy' ? -Math.abs(Math.sin(this.frame * 0.9)) * 10 : 0;
    const x = 180 - w / 2;
    const y = PET_BOTTOM - h + bob + hop;
    // floor shadow
    g.fillStyle(hexToInt(pal.dim), 0.6);
    g.fillRect(180 - w * 0.35, PET_BOTTOM + 4, w * 0.7, 4);
    drawPet(this.rect(g), { stage: s.stage, mood, frame: this.frame, scale, x, y, pal });
    this.petBox = { x, y, w, h };

    // effects
    const fx = this.fxG;
    fx.clear();
    const r = this.rect(fx);
    if (mood === 'happy') {
      drawHeart(r, x - 26, y + 6 - (this.frame % 4) * 3, 4, pal.danger);
      drawHeart(r, x + w + 6, y + 18 - ((this.frame + 2) % 4) * 3, 4, pal.danger);
    }
    if (mood === 'eating') {
      const k = this.frame % 3;
      r(x + w + 4 - k * 8, y + h * 0.55, 6, 6, pal.warn);
      if (k < 2) r(x + w + 16 - k * 8, y + h * 0.5, 4, 4, pal.warn);
    }
    if (mood === 'grumpy' || mood === 'sick') {
      const k = this.frame % 3;
      r(x + w * 0.2, y - 10 - k * 6, 6, 6, pal.dim);
      r(x + w * 0.75, y - 14 - ((k + 1) % 3) * 6, 6, 6, pal.dim);
    }
    if (Pet.guessing()) {
      r(x - 44, y + h * 0.4, 22, 18, pal.accent);
      r(x + w + 22, y + h * 0.4, 22, 18, pal.accent);
      r(x - 40, y + h * 0.4 - 6, 4, 6, pal.accent); r(x - 33, y + h * 0.4 - 7, 4, 7, pal.accent); r(x - 26, y + h * 0.4 - 6, 4, 6, pal.accent);
      r(x + w + 26, y + h * 0.4 - 6, 4, 6, pal.accent); r(x + w + 33, y + h * 0.4 - 7, 4, 7, pal.accent); r(x + w + 40, y + h * 0.4 - 6, 4, 6, pal.accent);
    }
    this.zzz.setPosition(x + w + 4, y - 14);
    this.zzz.setText(mood === 'sleepy' ? ['z', 'zZ', 'zZz', 'zZ'][this.frame % 4] : '');
  }

  // ---- interactions ------------------------------------------------------------

  onOk() {
    if (this.rename) { this.saveRename(); return; }
    if (Pet.guessing()) return;
    const res = Pet.pet();
    if (res.ok) this.say('Purr! ♥');
    else if (res.msg) this.say(res.msg);
    if (!res.ok && (Pet.mood() === 'grumpy' || Pet.mood() === 'sick')) Sfx.play('petGrumpy');
    this.lastAction = res;
    this.refresh();
  }

  onUp() {
    if (this.rename || Pet.guessing()) return;
    const res = Pet.startGuess();
    this.say(res.msg, res.ok ? 60000 : 1400);
    this.refresh();
  }

  onSide(side) {
    if (this.rename || !Pet.guessing()) return;
    const res = Pet.chooseGuess(side);
    this.lastGuess = res;
    this.msgUntil = 0;
    this.say(res.win ? 'Yes! That paw! +10 fun' : `Nope, it was ${res.side}! +2 fun`, 1800);
    this.refresh();
  }

  onBack() {
    if (this.rename) { this.renameBack(); return; }
    if (Pet.guessing()) { Pet.cancelGuess(); this.msgUntil = 0; this.refresh(); return; }
    Sfx.menuSelect();
    this.scene.start('MenuScene', { item: 'pet' });
  }

  onDigit(d) {
    this.fromDigit = true;
    queueMicrotask(() => { this.fromDigit = false; });
    if (this.rename) { this.renameDigit(d); return; }
    if (d === '*') { this.openRename(); return; }
    if (d === '5') this.onOk();
    else if (d === '2') this.onUp();
    else if (d === '4') this.onSide('left');
    else if (d === '6') this.onSide('right');
  }

  // ---- rename (multi-tap) ----------------------------------------------------

  buildRename() {
    const pal = this.pal;
    const depth = 30;
    this.renameNodes = [
      this.add.rectangle(180, 240, 360, 480, 0x000000, 0.6).setDepth(depth),
      this.add.rectangle(180, 220, 300, 180, hexToInt(pal.panel)).setStrokeStyle(3, hexToInt(pal.fg)).setDepth(depth),
      this.add.text(180, 152, 'NAME YOUR PET', this.mono('18px', pal.warn)).setOrigin(0.5).setDepth(depth)
    ];
    this.renameText = this.add.text(180, 204, '', this.mono('30px', pal.fg)).setOrigin(0.5).setDepth(depth);
    this.renameHint = this.add.text(180, 262, '', this.mono('12px', pal.dim, { align: 'center' })).setOrigin(0.5).setDepth(depth);
    this.renameNodes.push(this.renameText, this.renameHint);
    this.renameNodes.forEach((n) => n.setVisible(false));
  }

  openRename() {
    if (Pet.guessing()) Pet.cancelGuess();
    this.rename = { text: Pet.name(), key: null, idx: 0, at: 0 };
    this.renameNodes.forEach((n) => n.setVisible(true));
    this.hint1.setText('');
    this.hint2.setText('');
    setSoftKeys('Save', 'Del');
    Sfx.play('codeKey');
    this.renderRename();
  }

  commitPending() {
    const r = this.rename;
    if (r && r.key !== null) {
      r.text = (r.text + T9[r.key][r.idx]).slice(0, 8);
      r.key = null;
    }
  }

  renameDigit(d) {
    const r = this.rename;
    if (!T9[d]) return;
    const now = this.time.now;
    if (r.key === d && now - r.at < TAP_MS && T9[d].length > 1) {
      r.idx = (r.idx + 1) % T9[d].length;
    } else {
      this.commitPending();
      if (r.text.length >= 8) { Sfx.play('codeBad'); this.renderRename(); return; }
      r.key = d;
      r.idx = 0;
    }
    r.at = now;
    Sfx.play('codeKey');
    this.renderRename();
  }

  renderRename() {
    const r = this.rename;
    if (!r) return;
    const pending = r.key !== null ? T9[r.key][r.idx] : '';
    const shown = (r.text + pending).replace(/ /g, '·');
    this.renameText.setText(shown.length < 8 && !pending ? `${shown}_` : shown);
    let keyHint = '2=ABC 3=DEF ... 0=space 1=-';
    if (r.key === '0') keyHint = '0: space';
    else if (r.key !== null) keyHint = `${r.key}: ${T9[r.key].split('').join(' ')}`;
    this.renameHint.setText(`${keyHint}\ntap again to cycle · max 8\nOK save · C delete`);
  }

  renameBack() {
    const r = this.rename;
    if (r.key !== null) r.key = null;
    else if (r.text.length) r.text = r.text.slice(0, -1);
    else { this.closeRename(); return; }
    Sfx.play('codeKey');
    this.renderRename();
  }

  saveRename() {
    this.commitPending();
    const name = Pet.rename(this.rename.text);
    this.closeRename();
    Sfx.play('petHappy');
    this.say(`Hi, I'm ${name}!`, 1800);
  }

  closeRename() {
    this.rename = null;
    this.renameNodes.forEach((n) => n.setVisible(false));
    this.refresh();
  }
}
