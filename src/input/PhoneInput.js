import Phaser from 'phaser';

/*
 * One input bus for the whole phone.
 * The on-screen buttons and the physical keyboard both feed it, and every
 * scene listens to the same actions:
 *   up, down, left, right, ok, softLeft, softRight, back, digit (with '0'-'9', '*', '#')
 * Like old Nokias, keypad 2/4/6/8 also act as up/left/right/down and 5 acts as OK.
 */

const bus = new Phaser.Events.EventEmitter();

const DIGIT_ALIASES = { 2: 'up', 4: 'left', 6: 'right', 8: 'down', 5: 'ok' };

const KEYBOARD = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  Enter: 'ok', ' ': 'ok',
  q: 'softLeft', Q: 'softLeft',
  e: 'softRight', E: 'softRight',
  Escape: 'back', Backspace: 'back'
};

// Holding these keys down shouldn't fire them over and over
const NO_REPEAT = new Set(['ok', 'softLeft', 'softRight', 'back']);

const digitId = (d) => (d === '*' ? 'star' : d === '#' ? 'hash' : `d${d}`);

let initialized = false;
let softCache = { left: null, right: null };

// Light up the on-screen button that matches a press (keyboard included)
function flash(id) {
  const el = document.querySelector(`[data-key="${id}"]`);
  if (!el) return;
  el.classList.add('pressed');
  clearTimeout(el._flashTimer);
  el._flashTimer = setTimeout(() => el.classList.remove('pressed'), 130);
}

export function press(action, digit) {
  if (action === 'digit') {
    flash(digitId(digit));
    bus.emit('digit', digit);
    const alias = DIGIT_ALIASES[digit];
    if (alias) bus.emit(alias);
    return;
  }
  flash(action);
  bus.emit(action);
}

export function initPhoneInput() {
  if (initialized) return;
  initialized = true;

  document.querySelectorAll('[data-key]').forEach((el) => {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const d = el.dataset.digit;
      if (d !== undefined) press('digit', d);
      else press(el.dataset.key);
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[0-9*#]$/.test(e.key)) {
      if (!e.repeat) press('digit', e.key);
    } else if (KEYBOARD[e.key]) {
      const action = KEYBOARD[e.key];
      if (!(e.repeat && NO_REPEAT.has(action))) press(action);
    } else {
      return;
    }
    e.preventDefault();
  });
}

// Set the labels shown above the two soft keys
export function setSoftKeys(left = '', right = '') {
  if (softCache.left !== left) {
    const el = document.getElementById('soft-left');
    if (el) el.textContent = left;
    softCache.left = left;
  }
  if (softCache.right !== right) {
    const el = document.getElementById('soft-right');
    if (el) el.textContent = right;
    softCache.right = right;
  }
}

/*
 * Listen to phone actions from a scene. Handlers are removed automatically
 * when the scene shuts down (scene.start / scene.restart), so nothing leaks.
 *   bindPhoneInput(this, { up: () => ..., ok: () => ..., digit: (d) => ... });
 */
export function bindPhoneInput(scene, handlers) {
  const entries = Object.entries(handlers);
  entries.forEach(([evt, fn]) => bus.on(evt, fn, scene));
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    entries.forEach(([evt, fn]) => bus.off(evt, fn, scene));
  });
}
