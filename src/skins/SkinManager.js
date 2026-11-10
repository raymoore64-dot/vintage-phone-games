import Phaser from 'phaser';
import SKINS, { DEFAULT_SKIN_ID, getSkinById, skinIndex } from './skins.js';

export const STORAGE_KEY = 'vpg.skin';

const bus = new Phaser.Events.EventEmitter();

function readStoredId() {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    if (id && SKINS.some((s) => s.id === id)) return id;
  } catch {
    // private mode / blocked storage — fall through to the default
  }
  return DEFAULT_SKIN_ID;
}

function writeStoredId(id) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

class SkinManager {
  constructor() {
    this._id = readStoredId();
  }

  getSkin() {
    return getSkinById(this._id);
  }

  getId() {
    return this._id;
  }

  /**
   * Apply a skin to the HTML bezel. When persist is true (the default for
   * setSkin / next / prev) the choice is saved to localStorage. The phone
   * picker uses previewSkin() so you can cycle without saving until OK.
   */
  setSkin(id, { persist = true } = {}) {
    const skin = getSkinById(id);
    this._id = skin.id;
    if (persist) writeStoredId(skin.id);
    this.applySkin();
    bus.emit('change', skin);
    return skin;
  }

  previewSkin(id) {
    return this.setSkin(id, { persist: false });
  }

  nextSkin({ persist = true } = {}) {
    const i = (skinIndex(this._id) + 1) % SKINS.length;
    return this.setSkin(SKINS[i].id, { persist });
  }

  prevSkin({ persist = true } = {}) {
    const i = (skinIndex(this._id) - 1 + SKINS.length) % SKINS.length;
    return this.setSkin(SKINS[i].id, { persist });
  }

  /** Paint the current skin onto the .phone element (CSS vars + brand + data-skin). */
  applySkin() {
    const skin = this.getSkin();
    const el = document.querySelector('.phone');
    if (!el) return skin;

    el.setAttribute('data-skin', skin.id);

    // Drop leftover custom properties from a previous skin, then set this one.
    for (const name of [...el.style]) {
      if (name.startsWith('--')) el.style.removeProperty(name);
    }
    Object.entries(skin.css).forEach(([k, v]) => el.style.setProperty(k, String(v)));

    const brand = el.querySelector('.brand');
    if (brand) brand.textContent = skin.brand;

    return skin;
  }

  onChange(fn, context) {
    bus.on('change', fn, context);
  }

  offChange(fn, context) {
    bus.off('change', fn, context);
  }
}

const manager = new SkinManager();

export function getSkin() {
  return manager.getSkin();
}

export function setSkin(id, opts) {
  return manager.setSkin(id, opts);
}

export function previewSkin(id) {
  return manager.previewSkin(id);
}

export function nextSkin(opts) {
  return manager.nextSkin(opts);
}

export function prevSkin(opts) {
  return manager.prevSkin(opts);
}

export function applySkin() {
  return manager.applySkin();
}

export { manager as skinManager, bus as skinEvents };
export default manager;
