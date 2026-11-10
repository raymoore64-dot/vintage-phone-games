import Phaser from 'phaser';
import { bindPhoneInput, setSoftKeys } from '../input/PhoneInput.js';
import { hexToInt } from '../skins/skins.js';
import { getSkin } from '../skins/SkinManager.js';
import { currentPerk } from '../skins/perks.js';
import * as Sfx from '../audio/Sfx.js';
import * as Music from '../audio/Music.js';
import * as Sms from '../phone/Sms.js';
import * as Secrets from '../phone/Secrets.js';
import * as Phone from '../phone/Phone.js';
import * as Eggs from '../phone/Eggs.js';
import * as Calls from '../phone/Calls.js';
import * as Wap from '../wap/Wap.js';
import * as Pet from '../pet/Pet.js';
import { drawPet } from '../pet/sprites.js';
import { BASE_GAMES } from '../games.js';
import * as Daily from '../daily/Daily.js';
import { isNative } from '../native/Native.js';

/*
 * Menu keys
 *   ▲▼ / 2 8   choose          OK / 5 / left soft   open
 *   1-6        play a game     7                    Messages
 *   8          Settings (sound, music, calls, code book, power off)
 *   ▲▼ also reach downloaded WAP games (•), Pocket Pet (♥),
 *   WAP Downloads (@) and Share score (»), which have no digit.
 *   *          enter a secret code (then 4 digits; C cancels)
 *   * *        T9 WORD mode: spell a word, one key press per letter
 *              (e.g. LOL = 5 6 5). Fires on a match; OK checks;
 *              C deletes a digit, C on an empty word closes.
 *   0          sound on/off    9                    music on/off
 *   right soft phone picker    (M / N also toggle sound / music anywhere)
 *   hold C     power off / on (keyboard: hold Esc or End)
 */

const T9_KEYS = { 2: 'abc', 3: 'def', 4: 'ghi', 5: 'jkl', 6: 'mno', 7: 'pqrs', 8: 'tuv', 9: 'wxyz', 0: '␣', 1: '.,' };

/** Menu rows, rebuilt on every visit so WAP downloads show up. */
export function buildMenuItems() {
  const games = BASE_GAMES.map((g, i) => ({
    id: g.id, name: g.name, scene: g.scene, bestKey: g.bestKey, game: g.id, key: String(i + 1), label: String(i + 1)
  }));
  const wap = Wap.menuGames().map((g) => ({
    id: g.game, name: g.name, scene: g.scene, bestKey: g.bestKey, game: g.game, key: null, label: '•', wap: true, isNew: g.isNew
  }));
  return [
    ...games,
    ...wap,
    { id: 'daily', name: 'Daily Challenge', scene: 'DailyScene', dailyHub: true, key: null, label: '!' },
    { id: 'pet', name: 'Pocket Pet', scene: 'PetScene', pet: true, key: null, label: '♥' },
    { id: 'wap', name: 'WAP Downloads', scene: 'WapScene', wapHub: true, key: null, label: '@' },
    { id: 'share', name: 'Share score', scene: 'ShareScene', share: true, key: null, label: '»' },
    { id: 'leaderboards', name: 'Leaderboards', scene: 'LeaderboardScene', boards: true, key: null, label: '≡' },
    { id: 'inbox', name: 'Messages', scene: 'InboxScene', inbox: true, key: '7', label: '7' },
    { id: 'settings', name: 'Settings', scene: 'SettingsScene', settings: true, key: '8', label: '8' }
  ];
}
const MOOD_WORD = { idle: 'Chill', blink: 'Chill', happy: 'Happy', eating: 'Eating', sleepy: 'Sleepy', grumpy: 'Grumpy', sick: 'Sick' };

const LIST_TOP = 60;
const ROW_H = 60;
const VISIBLE = 5;
const CODE_LEN = 4;

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  init(data) {
    this.startIndex = data && Number.isInteger(data.index) ? data.index : 0;
    this.startItem = data && data.item ? data.item : null;
  }

  create() {
    this.index = -1;
    this.scroll = 0;
    this.fromDigit = false;
    this.code = null;
    this.items = buildMenuItems();
    const ITEMS = this.items;
    const pal = getSkin().palette;
    const mono = (size, color) => ({ fontSize: size, color, fontFamily: 'monospace', fontStyle: 'bold' });
    this.mono = mono;

    this.cameras.main.setBackgroundColor(pal.bg);

    // Header bar
    this.add.rectangle(180, 22, 360, 44, hexToInt(pal.fg));
    this.add.text(16, 22, 'GAMES', mono('24px', pal.bg)).setOrigin(0, 0.5);
    this.counter = this.add.text(344, 22, '', mono('17px', pal.bg)).setOrigin(1, 0.5);

    this.upHint = this.add.text(180, 52, '▲ more', mono('12px', pal.accent)).setOrigin(0.5, 0.5).setAlpha(0);

    // List
    this.rows = ITEMS.map((item, i) => {
      const bg = this.add.rectangle(180, 0, 336, 52, hexToInt(pal.panel)).setInteractive({ useHandCursor: true });
      const num = this.add.text(30, 0, item.label, mono('21px', pal.fg)).setOrigin(0, 0.5);
      const label = this.add.text(60, 0, item.name, mono('17px', pal.text)).setOrigin(0, 0.5);
      const badge = this.add.text(334, 0, '', mono('14px', pal.warn)).setOrigin(1, 0.5);
      bg.on('pointerdown', () => {
        if (this.code) return;
        this.select(i);
        this.launch();
      });
      return { bg, num, label, badge };
    });

    this.downHint = this.add.text(180, 0, '▼ more', mono('12px', pal.accent)).setOrigin(0.5, 0.5).setAlpha(0);

    // Info + perk + footer (fits 360x480 with the HTML status bar above)
    this.info = this.add.text(180, 384, '', mono('16px', pal.accent)).setOrigin(0.5);
    this.perkLine = this.add.text(180, 404, '', {
      fontSize: '12px', color: pal.dim, fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.soundText = this.add.text(180, 424, '', mono('13px', pal.accent)).setOrigin(0.5);
    this.add.text(180, 444, '7 msgs · 8 setup · * code · ** word', mono('13px', pal.dim)).setOrigin(0.5);
    this.add.text(180, 463, '0 sound · 9 music · ▶ Phone', mono('13px', pal.dim)).setOrigin(0.5);

    this.toast = this.add.text(180, 330, '', {
      ...mono('16px', pal.bg), backgroundColor: pal.fg, padding: { x: 12, y: 7 }, align: 'center', wordWrap: { width: 300 }
    }).setOrigin(0.5).setAlpha(0).setDepth(50);

    this.buildCodePanel(pal);

    setSoftKeys('Select', 'Phone');
    bindPhoneInput(this, {
      up: () => this.onUp(),
      down: () => this.onDown(),
      ok: () => this.onLaunch(),
      softLeft: () => this.onLaunch(),
      softRight: () => {
        if (this.code) { this.closeCode(); return; }
        Sfx.menuSelect();
        this.scene.start('SkinScene');
      },
      back: () => { if (this.code) this.codeBack(); },
      digit: (d) => this.onDigit(d)
    });

    window.__vpg = window.__vpg || {};
    window.__vpg.menu = this;
    Music.enter('menu');
    Sms.onMenu();
    this.refreshSound();
    const unsubMute = Sfx.onMuteChange(() => this.refreshSound());
    const unsubMusic = Music.onMusicChange(() => this.refreshSound());
    const unsubSms = Sms.onChange(() => this.refreshBadges());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubMute();
      unsubMusic();
      unsubSms();
      if (window.__vpg && window.__vpg.menu === this) delete window.__vpg.menu;
    });

    this.perkLine.setText(`${getSkin().brand} perk: ${currentPerk().name}`);
    const fromItem = this.startItem ? ITEMS.findIndex((it) => it.id === this.startItem) : -1;
    this.select(fromItem >= 0 ? fromItem : Phaser.Math.Clamp(this.startIndex, 0, ITEMS.length - 1));

    // Pocket pet peeking out bottom-right
    this.peekG = this.add.graphics().setDepth(5);
    this.peekFrame = 0;
    this.peekZ = this.add.text(352, 368, '', mono('11px', pal.accent)).setOrigin(1, 0.5).setDepth(5);
    this.time.addEvent({ delay: 300, loop: true, callback: () => { this.peekFrame += 1; this.drawPeek(); } });
    const unsubPet = Pet.onPetChange(() => { this.drawPeek(); this.refreshBadges(); });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubPet);
    this.drawPeek();
  }

  drawPeek() {
    if (!this.peekG || !this.peekG.active) return;
    const pal = getSkin().palette;
    const s = Pet.state();
    const g = this.peekG;
    g.clear();
    const sel = this.items[this.index] && this.items[this.index].pet;
    let mood = s.mood;
    if (sel && mood === 'idle') mood = 'happy';
    if (mood === 'idle' && this.peekFrame % 12 === 0) mood = 'blink';
    const scale = 2;
    const rows = { 0: 12, 1: 11, 2: 14, 3: 17 }[s.stage];
    const cols = { 0: 10, 1: 12, 2: 14, 3: 16 }[s.stage];
    const bob = mood === 'sleepy' ? 0 : (this.peekFrame % 4 < 2 ? 0 : -1);
    const x = 354 - cols * scale;
    const y = 414 - rows * scale + bob;
    drawPet((rx, ry, rw, rh, c) => { g.fillStyle(hexToInt(c), 1); g.fillRect(rx, ry, rw, rh); },
      { stage: s.stage, mood, frame: this.peekFrame, scale, x, y, pal });
    this.peekZ.setPosition(354, y - 6).setText(mood === 'sleepy' ? ['z', 'zZ', 'zZz'][this.peekFrame % 3] : (mood === 'grumpy' || mood === 'sick') ? '!' : '');
    this.peekState = { stage: s.stage, mood, x, y };
  }

  // ---- Secret code entry ---------------------------------------------------

  buildCodePanel(pal) {
    const depth = 40;
    this.codeNodes = [
      this.add.rectangle(180, 240, 360, 480, 0x000000, 0.6).setDepth(depth),
      this.add.rectangle(180, 220, 290, 170, hexToInt(pal.panel)).setStrokeStyle(3, hexToInt(pal.fg)).setDepth(depth)
    ];
    this.codeTitle = this.add.text(180, 166, 'ENTER CODE', this.mono('20px', pal.warn)).setOrigin(0.5).setDepth(depth);
    this.codeText = this.add.text(180, 214, '', this.mono('34px', pal.fg)).setOrigin(0.5).setDepth(depth);
    this.codeHint = this.add.text(180, 268, 'digits · C cancel', {
      fontSize: '13px', color: pal.dim, fontFamily: 'monospace', fontStyle: 'bold', align: 'center', wordWrap: { width: 270 }
    }).setOrigin(0.5).setDepth(depth);
    this.codeNodes.push(this.codeTitle, this.codeText, this.codeHint);
    this.codeNodes.forEach((n) => n.setVisible(false));
  }

  openCode() {
    this.code = { digits: '', done: false };
    this.codeNodes.forEach((n) => n.setVisible(true));
    this.codeTitle.setText('ENTER CODE').setColor(getSkin().palette.warn);
    this.codeHint.setText('4 digits · * again = WORD\nC cancel');
    this.renderCode();
    setSoftKeys('', 'Cancel');
    Sfx.play('codeKey');
  }

  renderCode() {
    if (!this.code) return;
    const shown = this.code.digits.padEnd(CODE_LEN, '_').split('').join(' ');
    this.codeText.setText(`* ${shown}`);
  }

  closeCode() {
    this.code = null;
    this.codeNodes.forEach((n) => n.setVisible(false));
    setSoftKeys('Select', 'Phone');
    this.refreshBadges();
    this.perkLine.setText(`${getSkin().brand} perk: ${currentPerk().name}`);
  }

  // ---- T9 word mode (* then *) ----------------------------------------------

  openWord() {
    const pal = getSkin().palette;
    this.code.word = true;
    this.code.digits = '';
    this.codeTitle.setText('T9 WORD').setColor(pal.warn);
    Sfx.play('codeKey');
    this.renderWord();
  }

  renderWord(msg) {
    if (!this.code) return;
    const d = this.code.digits;
    this.codeText.setText(d ? d.split('').join(' ') : '_');
    if (msg) this.codeHint.setText(msg);
    else if (!d) this.codeHint.setText('spell a word, 1 press per letter\nOK check · C delete');
    else this.codeHint.setText(d.split('').map((k) => T9_KEYS[k] || '?').join(' '));
  }

  wordDigit(d) {
    if (!/^[0-9]$/.test(d)) return;
    if (this.code.digits.length >= Eggs.MAX_DIGITS + 2) return;
    this.code.digits += d;
    Sfx.play('codeKey');
    const egg = Eggs.match(this.code.digits);
    if (egg) {
      this.fireEgg(egg);
      return;
    }
    this.renderWord();
  }

  wordCheck() {
    if (!this.code || this.code.done || !this.code.word) return;
    const egg = Eggs.match(this.code.digits);
    if (egg) { this.fireEgg(egg); return; }
    if (!this.code.digits) return;
    Sfx.play('codeBad');
    this.cameras.main.shake(140, 0.008);
    this.code.digits = '';
    this.renderWord('No such word. Try again!');
  }

  fireEgg(egg) {
    const pal = getSkin().palette;
    this.code.done = true;
    const res = Eggs.trigger(egg.id);
    this.lastEggResult = res;
    this.codeText.setText(egg.word);
    this.codeTitle.setText(res.fresh ? 'NEW CODE FOUND!' : 'CODE BOOK').setColor(pal.fg);
    this.codeHint.setText(`${res.message}\nCode book ${res.found}/${res.total}`);
    Sfx.play('eggFound');
    if (res.fresh) Phone.toast(`★ Code book ${res.found}/${res.total}: ${egg.name}`);
    this.time.delayedCall(res.scene ? 1100 : 1800, () => {
      if (!this.code || !this.code.done) return;
      if (res.scene) {
        this.code = null;
        this.scene.start(res.scene);
        return;
      }
      this.closeCode();
    });
  }

  codeBack() {
    if (!this.code) return;
    if (this.code.word && !this.code.done && this.code.digits) {
      this.code.digits = this.code.digits.slice(0, -1);
      Sfx.play('codeKey');
      this.renderWord();
      return;
    }
    this.closeCode();
  }

  codeDigit(d) {
    if (!this.code || this.code.done) return;
    if (d === '*' && !this.code.word && this.code.digits === '') {
      this.openWord();
      return;
    }
    if (this.code.word) {
      this.wordDigit(d);
      return;
    }
    if (!/^[0-9]$/.test(d)) return;
    this.code.digits += d;
    Sfx.play('codeKey');
    this.renderCode();
    if (this.code.digits.length < CODE_LEN) return;
    this.code.done = true;
    const res = Secrets.tryCode(this.code.digits);
    this.lastCodeResult = res;
    const pal = getSkin().palette;
    this.codeTitle.setText(res.ok ? 'CODE ACCEPTED' : 'WRONG CODE').setColor(res.ok ? pal.fg : pal.danger);
    this.codeHint.setText(res.message);
    if (res.ok) {
      Sfx.play('codeOk');
      Eggs.markFound(`star:${this.code.digits}`);
      Phone.render(true);
    } else {
      Sfx.play('codeBad');
      this.cameras.main.shake(160, 0.01);
    }
    this.time.delayedCall(res.ok ? 1700 : 1000, () => { if (this.code && this.code.done) this.closeCode(); });
  }

  // ---- Input -----------------------------------------------------------------

  onDigit(d) {
    // Every digit marks itself so the 2/4/6/8/5 aliases that follow are ignored
    this.fromDigit = true;
    queueMicrotask(() => { this.fromDigit = false; });
    if (this.code) {
      this.codeDigit(d);
      return;
    }
    if (d === '*') {
      this.openCode();
      return;
    }
    if (d === '0') {
      Sfx.toggleMuteWithClick();
      this.refreshSound();
      return;
    }
    if (d === '9') {
      Music.toggle();
      this.refreshSound();
      return;
    }
    const i = this.items.findIndex((it) => it.key === d);
    if (i >= 0) {
      this.select(i);
      this.launch();
    }
  }

  onUp() {
    if (this.fromDigit) { this.fromDigit = false; return; }
    if (this.code) return;
    this.select(this.index - 1);
  }

  onDown() {
    if (this.fromDigit) { this.fromDigit = false; return; }
    if (this.code) return;
    this.select(this.index + 1);
  }

  onLaunch() {
    if (this.fromDigit) { this.fromDigit = false; return; }
    if (this.code) {
      if (this.code.word) this.wordCheck();
      return;
    }
    this.launch();
  }

  // ---- Drawing -------------------------------------------------------------

  refreshSound() {
    if (this.soundText && this.soundText.active) {
      this.soundText.setText(`${Sfx.soundLabel()}    ${Music.musicLabel()}`);
    }
  }

  refreshBadges() {
    if (!this.rows) return;
    const dare = Sms.getDare();
    const unread = Sms.unreadCount();
    this.rows.forEach((row, j) => {
      const item = this.items[j];
      let badge = '';
      if (item.inbox) badge = unread > 0 ? `${unread} new` : '';
      else if (item.settings) badge = `★${Eggs.foundCount()}/${Eggs.totalCount()}`;
      else if (item.wapHub) { const n = Wap.readyCount(); badge = n ? `${n} GET` : ''; }
      else if (item.pet) { const m = Pet.mood(); badge = m === 'grumpy' || m === 'sick' ? '!' : Pet.isAsleep() ? 'Zz' : ''; }
      else if (item.wap && item.isNew) badge = 'NEW';
      else if (item.dailyHub) { const k = Daily.currentStreak(); badge = Daily.attempted() ? (k > 1 ? `x${k}` : 'DONE') : 'PLAY'; }
      else if (dare && dare.today && !dare.done && dare.game === item.game) badge = 'DARE';
      row.badge.setText(badge);
    });
    this.updateInfo();
  }

  layoutRows() {
    const maxScroll = Math.max(0, this.items.length - VISIBLE);
    this.scroll = Phaser.Math.Clamp(this.scroll, 0, maxScroll);
    this.rows.forEach((row, j) => {
      const visible = j >= this.scroll && j < this.scroll + VISIBLE;
      const y = LIST_TOP + ROW_H / 2 + (j - this.scroll) * ROW_H;
      [row.bg, row.num, row.label, row.badge].forEach((n) => n.setY(y).setVisible(visible));
      row.bg.setActive(visible);
      if (visible) row.bg.setInteractive({ useHandCursor: true });
      else row.bg.disableInteractive();
    });
    this.upHint.setAlpha(this.scroll > 0 ? 1 : 0);
    this.downHint.setY(LIST_TOP + VISIBLE * ROW_H + 3);
    this.downHint.setAlpha(this.scroll < maxScroll ? 1 : 0);
  }

  keepInView(i) {
    if (i < this.scroll) this.scroll = i;
    if (i >= this.scroll + VISIBLE) this.scroll = i - VISIBLE + 1;
  }

  select(i) {
    const pal = getSkin().palette;
    const n = this.items.length;
    const next = (i + n) % n;
    const changed = next !== this.index;
    if (changed && this.index !== -1) Sfx.menuMove();
    this.index = next;
    this.keepInView(this.index);
    this.layoutRows();
    this.rows.forEach((row, j) => {
      const on = j === this.index;
      row.bg.setFillStyle(on ? hexToInt(pal.fg) : hexToInt(pal.panel));
      row.num.setColor(on ? pal.bg : pal.fg);
      row.label.setColor(on ? pal.bg : pal.text);
      row.badge.setColor(on ? pal.bg : pal.warn);
    });
    this.counter.setText(`${this.index + 1}/${n}`);
    this.refreshBadges();
    if (changed) this.drawPeek && this.peekG && this.drawPeek();
  }

  updateInfo() {
    const item = this.items[this.index];
    if (!item || !this.info) return;
    if (item.pet) {
      const p = Pet.state();
      this.info.setText(p.stage === 0 ? 'An egg! Play to hatch it' : `${p.name}: ${MOOD_WORD[p.mood] || 'Chill'} · Food ${Math.round(p.food)}%`);
      return;
    }
    if (item.wapHub) {
      const all = Wap.list();
      const ready = all.filter((c) => c.status === 'ready').length;
      const got = all.filter((c) => c.status === 'installed').length;
      this.info.setText(ready ? `${ready} ready to download!` : got ? `${got} downloaded · more soon` : 'Games over the air');
      return;
    }
    if (item.share) {
      this.info.setText('Make a score card PNG');
      return;
    }
    if (item.dailyHub) {
      const c = Daily.challengeFor(Daily.today());
      const e = Daily.entry();
      this.info.setText(e ? `#${c.n} done: ${e.score} · streak ${Daily.currentStreak()}` : `#${c.n}: ${c.gameName} · ${c.mod.name}`);
      return;
    }
    if (item.boards) {
      this.info.setText(isNative() ? 'Game Center leaderboards' : 'Your best scores');
      return;
    }
    if (item.inbox) {
      const n = Sms.list().length;
      const u = Sms.unreadCount();
      this.info.setText(n ? `${u} unread · ${n} total` : 'No messages yet');
      return;
    }
    if (item.settings) {
      this.info.setText(`${Calls.callsLabel()} · Codes ${Eggs.foundCount()}/${Eggs.totalCount()}`);
      return;
    }
    const best = Number(localStorage.getItem(item.bestKey) || 0);
    const dare = Sms.getDare();
    if (dare && dare.today && !dare.done && dare.game === item.game) {
      this.info.setText(`Best: ${best} · Dare: ${dare.target}`);
    } else {
      this.info.setText(`Best: ${best}`);
    }
  }

  launch() {
    const item = this.items[this.index];
    if (!item || !item.scene) return;
    if (item.wap) Wap.markPlayed(item.id);
    Sfx.menuSelect();
    // explicit data: a plain launch must never inherit a Daily run's seed
    this.scene.start(item.scene, { from: 'menu' });
  }

  showToast(msg) {
    this.tweens.killTweensOf(this.toast);
    this.toast.setText(msg).setAlpha(1);
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 1000, duration: 400 });
  }
}

export { buildMenuItems as MENU_ITEMS };
