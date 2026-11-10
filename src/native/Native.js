/*
 * Platform layer. Everything that differs between the browser and the
 * Capacitor iOS shell goes through here, so game code never imports a
 * Capacitor plugin directly.
 *
 *   isNative()            true inside the iOS app (Capacitor native platform)
 *   platform()            'ios' | 'android' | 'web'
 *   initNative()          once at boot: status bar hidden, splash hidden,
 *                         app pause/resume -> existing blur/focus handling,
 *                         hardware back button swallowed (no-op)
 *   shareFile(blob, ...)  PNG -> Filesystem cache -> native share sheet
 *   shareText(text)       native share sheet with text only
 *
 * All wrappers resolve quietly on web and never throw.
 */

import { Capacitor } from '@capacitor/core';

let inited = false;
const log = [];

function note(kind, detail) {
  log.push({ kind, detail, at: Date.now() });
  if (log.length > 60) log.shift();
}

export function isNative() {
  try { return !!(Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()); } catch { return false; }
}

export function platform() {
  try { return Capacitor.getPlatform(); } catch { return 'web'; }
}

export function hasPlugin(name) {
  try { return isNative() && Capacitor.isPluginAvailable(name); } catch { return false; }
}

async function statusBarHide() {
  if (!hasPlugin('StatusBar')) return false;
  const { StatusBar } = await import('@capacitor/status-bar');
  await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
  await StatusBar.hide();
  return true;
}

async function splashHide() {
  if (!hasPlugin('SplashScreen')) return false;
  const { SplashScreen } = await import('@capacitor/splash-screen');
  await SplashScreen.hide({ fadeOutDuration: 250 });
  return true;
}

/**
 * App lifecycle -> the web events the game already handles:
 * 'pause' (home button / app switcher) fires blur + pagehide so the running
 * game auto-pauses, music stops, and battery / wear are saved; 'resume'
 * fires focus so music can come back (the pause overlay stays up).
 */
export function onAppPause() {
  note('app', 'pause');
  try { window.dispatchEvent(new Event('blur')); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event('pagehide')); } catch { /* ignore */ }
}

export function onAppResume() {
  note('app', 'resume');
  try { window.dispatchEvent(new Event('focus')); } catch { /* ignore */ }
}

async function appListeners() {
  if (!hasPlugin('App')) return false;
  const { App } = await import('@capacitor/app');
  await App.addListener('pause', onAppPause);
  await App.addListener('resume', onAppResume);
  // iOS has no back button; on other platforms swallow it (the red C key is "back").
  await App.addListener('backButton', () => note('app', 'back (ignored)'));
  return true;
}

export async function initNative() {
  if (inited) return;
  inited = true;
  document.documentElement.classList.toggle('native', isNative());
  document.documentElement.classList.add(`platform-${platform()}`);
  // iOS Safari / WKWebView pinch-zoom and double-tap zoom off (viewport meta alone is ignored on iOS)
  const stop = (e) => e.preventDefault();
  document.addEventListener('gesturestart', stop, { passive: false });
  document.addEventListener('gesturechange', stop, { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd < 300 && e.cancelable && !(e.target && e.target.closest && e.target.closest('[data-key]'))) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
  publish();
  if (!isNative()) return;
  await Promise.all([
    statusBarHide().catch((e) => note('error', `statusbar ${e}`)),
    appListeners().catch((e) => note('error', `app ${e}`))
  ]);
  setTimeout(() => splashHide().catch((e) => note('error', `splash ${e}`)), 300);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Native share of a PNG blob. Returns { method } or null when not native. */
export async function shareFile(blob, { filename = 'vintage-phone-games.png', title = 'Vintage Phone Games', text = '' } = {}) {
  if (!isNative() || !blob) return null;
  try {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'), import('@capacitor/share')
    ]);
    const data = await blobToBase64(blob);
    const written = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
    await Share.share({ title, text, files: [written.uri], dialogTitle: title });
    note('share', filename);
    return { method: 'share', bytes: blob.size };
  } catch (err) {
    const msg = String((err && err.message) || err);
    note('error', `share ${msg}`);
    return { method: /cancel/i.test(msg) ? 'cancelled' : 'failed' };
  }
}

/**
 * Share plain text: native share sheet, then the Web Share API, then the
 * clipboard. Returns { method: 'share' | 'clipboard' | 'cancelled' | 'failed' }.
 */
export async function shareText(text, { title = 'Vintage Phone Games' } = {}) {
  if (isNative()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text });
      return { method: 'share' };
    } catch (err) {
      if (/cancel/i.test(String(err && err.message))) return { method: 'cancelled' };
    }
  }
  try {
    if (navigator.share) {
      await navigator.share({ title, text });
      return { method: 'share' };
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return { method: 'cancelled' };
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return { method: 'clipboard' };
    }
  } catch { /* blocked */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand && document.execCommand('copy');
    ta.remove();
    if (ok) return { method: 'clipboard' };
  } catch { /* ignore */ }
  return { method: 'failed' };
}

function publish() {
  window.__vpg = window.__vpg || {};
  window.__vpg.native = {
    isNative, platform, hasPlugin, log: () => log.slice(),
    pause: onAppPause, resume: onAppResume, shareText
  };
}

export default { isNative, platform, hasPlugin, initNative, shareFile, shareText, onAppPause, onAppResume };
