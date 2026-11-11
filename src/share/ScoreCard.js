/*
 * Share score card: a PNG drawn entirely client-side with canvas 2D.
 *   story  1080x1920 (Instagram / TikTok Stories)
 *   square 1080x1080
 * Shows the current phone shell (its CSS colours turned into canvas
 * fills, plus its wear & tear), the LCD with game name, score / best and
 * perk in a pixel font, the pocket pet, 'LINICRO' (with the subtitle
 * 'vintage phone games') and 'by Studio Linicro'.
 *
 * Pixel font: text is drawn tiny on an offscreen canvas, thresholded and
 * blown up cell by cell, so it looks like LCD pixels without any font
 * files.
 *
 * shareImage() is the single place that hands the PNG to the OS.
 */

import { getSkin } from '../skins/SkinManager.js';
import { perkFor } from '../skins/perks.js';
import * as Wear from '../phone/Wear.js';
import * as Pet from '../pet/Pet.js';
import { drawPet } from '../pet/sprites.js';
import { glyph, textWidth, GLYPH_W, GLYPH_H, ADVANCE } from './pixelFont.js';
import { isNative, shareFile } from '../native/Native.js';

export const FORMATS = {
  story: { w: 1080, h: 1920 },
  square: { w: 1080, h: 1080 }
};

// ---- helpers ------------------------------------------------------------------

function hexes(str) {
  return String(str || '').match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || [];
}

function fillFrom(ctx, css, x, y, w, h, fallback) {
  const cols = hexes(css);
  if (cols.length >= 2) {
    const g = ctx.createLinearGradient(x, y, x + w * 0.6, y + h);
    cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c));
    return g;
  }
  return cols[0] || fallback;
}

function rr(ctx, x, y, w, h, r) {
  const [tl, tr, br, bl] = Array.isArray(r) ? r : [r, r, r, r];
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

/**
 * Draw text as chunky LCD pixels using the 5x7 font. cell = size of one
 * font pixel. maxW (optional) shrinks the cell so the text fits.
 * Returns the drawn width.
 */
export function pixelText(ctx, text, x, y, cell, color, align = 'center', maxW = 0) {
  const str = String(text);
  let c = cell;
  if (maxW && textWidth(str) * c > maxW) c = maxW / textWidth(str);
  const W = textWidth(str) * c;
  const sx = align === 'center' ? x - W / 2 : align === 'right' ? x - W : x;
  ctx.fillStyle = color;
  const inset = c > 4 ? c * 0.1 : 0;
  for (let i = 0; i < str.length; i++) {
    const rows = glyph(str[i]);
    const gx = sx + i * ADVANCE * c;
    for (let j = 0; j < GLYPH_H; j++) {
      const row = rows[j];
      for (let k = 0; k < GLYPH_W; k++) {
        if (row[k] === '#') ctx.fillRect(gx + k * c + inset / 2, y + j * c + inset / 2, c - inset, c - inset);
      }
    }
  }
  return W;
}

function v(skin, name, fallback) {
  const n = parseFloat(skin.css[name]);
  return Number.isFinite(n) ? n : fallback;
}

// ---- the phone ------------------------------------------------------------------

function layout(skin) {
  const pt = v(skin, '--phone-pad-top', 2.5);
  const pb = v(skin, '--phone-pad-bottom', 3);
  const sp = v(skin, '--speaker-height', 1);
  const br = v(skin, '--brand-size', 1.8);
  const wp = v(skin, '--screen-wrap-pad', 1.5);
  const gap = 1.6;
  const screenH = 2.8 + 48 + 3.6;
  const ctrl = Math.max(15, v(skin, '--dpad-size', 15));
  const keypad = 4 * 4.6 + 3 * 1.2;
  const h = pt + sp + gap + br + gap + (screenH + 2 * wp) + gap + ctrl + gap + keypad + pb;
  return { pt, pb, sp, br, wp, gap, screenH, ctrl, keypad, h, w: v(skin, '--phone-width', 44) };
}

export function phoneHeightFor(width, skin = getSkin()) {
  const L = layout(skin);
  return width / L.w * L.h;
}

function drawPhone(ctx, x0, y0, width, info) {
  const skin = info.skin;
  const pal = skin.palette;
  const css = skin.css;
  const L = layout(skin);
  const u = width / L.w;
  const H = L.h * u;
  const W = width;
  const radii = ['--phone-radius-tl', '--phone-radius-tr', '--phone-radius-br', '--phone-radius-bl'].map((k) => Math.min(v(skin, k, 7) * u, W / 2));

  // drop shadow + body
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 6 * u;
  ctx.shadowOffsetY = 2 * u;
  rr(ctx, x0, y0, W, H, radii);
  ctx.fillStyle = fillFrom(ctx, css['--phone-bg'], x0, y0, W, H, '#333');
  ctx.fill();
  ctx.restore();
  rr(ctx, x0, y0, W, H, radii);
  const shine = ctx.createLinearGradient(0, y0, 0, y0 + H * 0.5);
  shine.addColorStop(0, 'rgba(255,255,255,0.12)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fill();

  // wear on the shell
  const wear = info.wear;
  const marks = new Set(wear.marks);
  const h = wear.hash;
  ctx.save();
  rr(ctx, x0, y0, W, H, radii);
  ctx.clip();
  ctx.lineCap = 'round';
  if (marks.has('scuffs')) {
    const spots = [[2 + (h % 3), 34 + (h % 9)], [93 - ((h >> 3) % 3), 58 + ((h >> 5) % 10)], [6 + ((h >> 7) % 5), 93 - ((h >> 9) % 3)], [88 - ((h >> 11) % 6), 3 + ((h >> 13) % 3)]];
    spots.forEach(([px, py], i) => {
      const sx = x0 + W * px / 100;
      const sy = y0 + H * py / 100;
      ctx.save();
      ctx.translate(sx + u, sy + 1.5 * u);
      ctx.rotate((((h >> i) % 50) - 25) * Math.PI / 180);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = Math.max(2, u * 0.25);
      [[-0.6, -1, 0, -0.4], [-0.4, 0, 0.6, 0.3], [-0.8, 0.8, -0.2, 1.4], [0.2, -0.9, 0.6, -0.7]].forEach(([a, b, c, d]) => {
        ctx.beginPath(); ctx.moveTo(a * u, b * u); ctx.lineTo(c * u, d * u); ctx.stroke();
      });
      ctx.restore();
    });
  }
  if (marks.has('scratch')) {
    const sy = y0 + H * (2 + (h % 3)) / 100;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = Math.max(2, u * 0.22);
    ctx.beginPath();
    ctx.moveTo(x0 + W * 0.6, sy);
    ctx.bezierCurveTo(x0 + W * 0.72, sy + 0.4 * u, x0 + W * 0.84, sy + 1.2 * u, x0 + W * 0.96, sy + 2 * u);
    ctx.stroke();
  }
  ctx.restore();

  let y = y0 + L.pt * u;
  // speaker
  const spW = v(skin, '--speaker-width', 10) * u;
  ctx.fillStyle = '#0a0b0d';
  rr(ctx, x0 + (W - spW) / 2, y, spW, Math.max(L.sp, 0.8) * u, (L.sp * u) / 2);
  ctx.fill();
  y += L.sp * u + L.gap * u;
  // brand
  ctx.fillStyle = css['--brand-color'] || pal.fg;
  ctx.font = `bold ${L.br * u}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const brand = skin.brand.split('').join(String.fromCharCode(8202));
  ctx.fillText(brand, x0 + W / 2, y - 0.6 * u);
  y += L.br * u + L.gap * u;

  // screen
  const sw = 36 * u;
  const wx = x0 + (W - sw) / 2 - L.wp * u;
  const ww = sw + 2 * L.wp * u;
  const wh = L.screenH * u + 2 * L.wp * u;
  ctx.fillStyle = hexes(css['--screen-wrap-bg'])[0] || '#0b0c0e';
  rr(ctx, wx, y, ww, wh, v(skin, '--screen-wrap-radius', 2) * u);
  ctx.fill();
  const sx = wx + L.wp * u;
  const sy = y + L.wp * u;
  // status bar
  const sbBg = hexes(css['--softbar-bg'])[0] || pal.bg;
  const sbFg = hexes(css['--softbar-fg'])[0] || pal.fg;
  ctx.fillStyle = sbBg;
  ctx.fillRect(sx, sy, sw, 2.8 * u);
  ctx.fillStyle = sbFg;
  for (let i = 0; i < 5; i++) ctx.fillRect(sx + (0.9 + i * 0.45) * u, sy + (2.1 - i * 0.3) * u, 0.3 * u, (0.4 + i * 0.3) * u);
  ctx.fillRect(sx + sw - 3.4 * u, sy + 0.8 * u, 2.4 * u, 1.2 * u);
  ctx.fillStyle = sbBg;
  ctx.fillRect(sx + sw - 3.3 * u, sy + 0.9 * u, 2.2 * u, 1.0 * u);
  ctx.fillStyle = sbFg;
  ctx.fillRect(sx + sw - 3.2 * u, sy + 1.0 * u, 2.0 * u, 0.8 * u);
  ctx.font = `bold ${1.5 * u}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(info.clock, sx + sw / 2 + 4 * u, sy + 0.65 * u);

  // LCD (logical 360 x 480)
  const lx = sx;
  const ly = sy + 2.8 * u;
  const k = sw / 360;
  ctx.fillStyle = pal.bg;
  ctx.fillRect(lx, ly, sw, 48 * u);
  drawLcd(ctx, lx, ly, k, info);
  // scanlines
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let j = 0; j < 48 * u; j += Math.max(3, k * 3)) ctx.fillRect(lx, ly + j, sw, Math.max(1, k));
  // soft bar
  const sby = ly + 48 * u;
  ctx.fillStyle = sbBg;
  ctx.fillRect(sx, sby, sw, 3.6 * u);
  ctx.fillStyle = sbFg;
  ctx.font = `bold ${1.9 * u}px "Courier New", monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('Retry', sx + u, sby + 1.8 * u);
  ctx.textAlign = 'right';
  ctx.fillText('Share', sx + sw - u, sby + 1.8 * u);
  ctx.textBaseline = 'top';

  // glass wear
  if (marks.has('crack')) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = Math.max(2, u * 0.22);
    const cx = sx;
    const cy = sby + 3.6 * u;
    const s = 8 * u / 40;
    const path = (pts) => { ctx.beginPath(); pts.forEach(([a, b], i) => (i ? ctx.lineTo(cx + a * s, cy - (40 - b) * s) : ctx.moveTo(cx + a * s, cy - (40 - b) * s))); ctx.stroke(); };
    path([[0, 40], [9, 29], [14, 31], [21, 20], [27, 21], [40, 4]]);
    path([[9, 29], [5, 22]]); path([[14, 31], [18, 40]]); path([[21, 20], [17, 12]]); path([[27, 21], [33, 30]]); path([[21, 20], [30, 14]]);
    ctx.restore();
  }
  if (marks.has('pixel')) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const px = sx + sw * (58 + (h % 30)) / 100;
    const py = sy + L.screenH * u * (38 + ((h >> 4) % 34)) / 100;
    ctx.fillRect(px, py, 0.5 * u, 0.5 * u);
  }

  y += wh + L.gap * u;

  // controls row
  const keyBg = (name, fb) => fillFrom(ctx, css[name], 0, y, W, L.ctrl * u, fb);
  const cy0 = y;
  const dpad = v(skin, '--dpad-size', 15) * u;
  const dcx = x0 + W / 2;
  const dcy = cy0 + L.ctrl * u / 2;
  ctx.fillStyle = fillFrom(ctx, css['--dpad-bg'], dcx - dpad / 2, dcy - dpad / 2, dpad, dpad, '#444');
  ctx.beginPath(); ctx.arc(dcx, dcy, dpad / 2, 0, Math.PI * 2); ctx.fill();
  const okS = v(skin, '--ok-size', 5.6) * u;
  ctx.fillStyle = fillFrom(ctx, css['--ok-bg'], dcx - okS / 2, dcy - okS / 2, okS, okS, '#555');
  ctx.beginPath(); ctx.arc(dcx, dcy, okS / 2, 0, Math.PI * 2); ctx.fill();
  if (marks.has('keys')) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(dcx, dcy, okS / 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = hexes(css['--ok-fg'])[0] || '#ddd';
  ctx.font = `bold ${1.7 * u}px "Courier New", monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('OK', dcx, dcy);
  ctx.fillStyle = hexes(css['--dir-fg'])[0] || '#aaa';
  ctx.font = `${2 * u}px sans-serif`;
  [['▲', 0, -1], ['▼', 0, 1], ['◀', -1, 0], ['▶', 1, 0]].forEach(([t, a, b]) => ctx.fillText(t, dcx + a * (dpad / 2 - 2.4 * u), dcy + b * (dpad / 2 - 2.4 * u)));
  const colW = (W - dpad) / 2;
  [[x0 + colW / 2 + v(skin, '--phone-pad-side', 3) * u * 0.4, '--call-bg', '✆', '--call-fg'], [x0 + W - colW / 2 - v(skin, '--phone-pad-side', 3) * u * 0.4, '--end-bg', 'C', '--end-fg']].forEach(([cx, bg, label, fg]) => {
    ctx.fillStyle = keyBg('--key-bg', '#444');
    rr(ctx, cx - 4.5 * u, cy0 + 0.8 * u, 9 * u, 3.6 * u, v(skin, '--key-radius', 1.2) * u); ctx.fill();
    ctx.fillStyle = keyBg(bg, '#555');
    rr(ctx, cx - 4 * u, cy0 + L.ctrl * u - 5.6 * u, 8 * u, 4.4 * u, v(skin, '--call-radius', 2.2) * u); ctx.fill();
    ctx.fillStyle = hexes(css[fg])[0] || '#eee';
    ctx.font = `bold ${2.2 * u}px "Courier New", monospace`;
    ctx.fillText(label, cx, cy0 + L.ctrl * u - 3.4 * u);
  });
  y += L.ctrl * u + L.gap * u;

  // keypad
  const padX = x0 + v(skin, '--phone-pad-side', 3) * u + u;
  const padW = W - 2 * (v(skin, '--phone-pad-side', 3) * u + u);
  const kw = (padW - 2 * 1.6 * u) / 3;
  const labels = [['1', '.,'], ['2', 'abc'], ['3', 'def'], ['4', 'ghi'], ['5', 'jkl'], ['6', 'mno'], ['7', 'pqrs'], ['8', 'tuv'], ['9', 'wxyz'], ['*', ''], ['0', '␣'], ['#', '']];
  labels.forEach(([d, sub], i) => {
    const kx = padX + (i % 3) * (kw + 1.6 * u);
    const ky = y + Math.floor(i / 3) * (4.6 * u + 1.2 * u);
    ctx.fillStyle = hexes(css['--key-shadow'])[0] || '#111';
    rr(ctx, kx, ky + 0.5 * u, kw, 4.6 * u, v(skin, '--key-radius', 1.2) * u); ctx.fill();
    ctx.fillStyle = fillFrom(ctx, css['--key-bg'], kx, ky, kw, 4.6 * u, '#444');
    rr(ctx, kx, ky, kw, 4.6 * u, v(skin, '--key-radius', 1.2) * u); ctx.fill();
    if (marks.has('keys')) {
      ctx.fillStyle = d === '5' || d === '2' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)';
      rr(ctx, kx + kw * 0.25, ky + 0.8 * u, kw * 0.5, 2.6 * u, 1.3 * u); ctx.fill();
    }
    ctx.fillStyle = hexes(css['--key-fg'])[0] || '#ddd';
    ctx.font = `bold ${2.4 * u}px "Courier New", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(d, kx + kw / 2 - (sub ? 1.2 * u : 0), ky + 2.3 * u);
    if (sub) {
      ctx.fillStyle = marks.has('keys') ? 'rgba(140,140,140,0.5)' : (hexes(css['--key-sub-fg'])[0] || '#999');
      ctx.font = `${1.2 * u}px "Courier New", monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(sub, kx + kw / 2 + 0.2 * u, ky + 2.5 * u);
    }
  });
  return { w: W, h: H };
}

/** The LCD contents in 360x480 logical px, scaled by k. */
function drawLcd(ctx, x, y, k, info) {
  const pal = info.skin.palette;
  const P = (n) => n * k;
  ctx.fillStyle = pal.fg;
  ctx.fillRect(x, y, P(360), P(56));
  const head = info.tag ? `${info.tag} ${info.gameName}` : info.gameName;
  pixelText(ctx, head.toUpperCase(), x + P(180), y + P(14), P(4), pal.bg, 'center', P(336));
  pixelText(ctx, 'SCORE', x + P(180), y + P(84), P(3.4), pal.accent);
  const digits = String(info.score);
  pixelText(ctx, digits, x + P(180), y + P(124), P(13), pal.fg, 'center', P(330));
  pixelText(ctx, `BEST ${info.best}`, x + P(180), y + P(234), P(3.6), pal.text, 'center', P(330));
  if (info.newBest) pixelText(ctx, 'NEW BEST!', x + P(180), y + P(276), P(4), pal.warn);
  // perk card
  ctx.strokeStyle = pal.fg;
  ctx.lineWidth = Math.max(1, P(2));
  ctx.strokeRect(x + P(16), y + P(324), P(328), P(50));
  pixelText(ctx, `PERK: ${info.perk.toUpperCase()}`, x + P(180), y + P(338), P(3), pal.warn, 'center', P(310));
  // pet + phone name
  const pet = info.pet;
  const rect = (rx, ry, rw, rh, c) => { ctx.fillStyle = c; ctx.fillRect(rx, ry, rw, rh); };
  drawPet(rect, { stage: pet.stage, mood: pet.mood === 'sleepy' ? 'sleepy' : 'happy', frame: 0, scale: P(5), x: x + P(24), y: y + P(390), pal });
  pixelText(ctx, pet.name, x + P(130), y + P(398), P(3.4), pal.text, 'left');
  pixelText(ctx, `${info.skin.brand} ${info.skin.model || info.skin.name}`.toUpperCase(), x + P(130), y + P(436), P(2.4), pal.accent, 'left', P(220));
}

// ---- cards ----------------------------------------------------------------------

function background(ctx, w, h, pal) {
  const g = ctx.createRadialGradient(w / 2, h * 0.35, 50, w / 2, h * 0.45, h * 0.8);
  g.addColorStop(0, '#2c2c2c');
  g.addColorStop(1, '#070707');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w / 2, h * 0.5, 10, w / 2, h * 0.5, w * 0.6);
  glow.addColorStop(0, `${pal.fg}33`);
  glow.addColorStop(1, `${pal.fg}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

export function cardInfo(opts = {}) {
  const skin = opts.skin || getSkin();
  const pet = Pet.state();
  const d = new Date();
  return {
    skin,
    gameName: opts.gameName || 'Snake',
    gameId: opts.gameId || 'snake',
    score: Math.max(0, Math.floor(Number(opts.score) || 0)),
    best: Math.max(0, Math.floor(Number(opts.best) || 0)),
    newBest: !!opts.newBest,
    tag: opts.tag ? String(opts.tag).toUpperCase() : '',
    perk: opts.perkLabel || perkFor(skin.id).name,
    wear: Wear.marksFor(skin.id),
    pet: { stage: pet.stage, mood: pet.mood, name: pet.name },
    clock: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  };
}

/** Render a score card. Returns an HTMLCanvasElement. */
export function renderScoreCard(opts = {}) {
  const fmt = FORMATS[opts.format] || FORMATS.story;
  const info = cardInfo(opts);
  const pal = info.skin.palette;
  const c = document.createElement('canvas');
  c.width = fmt.w;
  c.height = fmt.h;
  const ctx = c.getContext('2d');
  background(ctx, fmt.w, fmt.h, pal);

  if (opts.format === 'square') {
    const ph = 980;
    const pw = ph / phoneHeightFor(100, info.skin) * 100;
    drawPhone(ctx, 70, 50, pw, info);
    const cx = 70 + pw + (1080 - 70 - pw) / 2;
    const colW = 1080 - 70 - pw - 60;
    pixelText(ctx, 'LINICRO', cx, 150, 13, pal.fg, 'center', colW);
    pixelText(ctx, 'VINTAGE PHONE GAMES', cx, 280, 4, '#bbbbbb', 'center', colW);
    pixelText(ctx, info.gameName.toUpperCase(), cx, 470, 6, pal.warn, 'center', colW);
    pixelText(ctx, String(info.score), cx, 540, 14, '#ffffff', 'center', colW);
    if (info.tag) {
      pixelText(ctx, info.tag, cx, 700, 6, pal.accent, 'center', colW);
      if (opts.subline) pixelText(ctx, String(opts.subline).toUpperCase(), cx, 760, 4, pal.text, 'center', colW);
    } else {
      pixelText(ctx, 'CAN YOU', cx, 700, 6, pal.accent);
      pixelText(ctx, 'BEAT IT?', cx, 760, 6, pal.accent);
    }
    pixelText(ctx, 'BY STUDIO LINICRO', cx, 950, 4, '#bbbbbb', 'center', colW);
  } else {
    pixelText(ctx, 'LINICRO', 540, 36, 12, pal.fg, 'center', 980);
    pixelText(ctx, 'VINTAGE PHONE GAMES', 540, 132, 4, '#bbbbbb', 'center', 980);
    if (info.tag) pixelText(ctx, info.tag, 540, 172, 5, pal.warn, 'center', 980);
    const pw = 560;
    const ph = phoneHeightFor(pw, info.skin);
    const top = 220;
    drawPhone(ctx, (1080 - pw) / 2, top, pw, info);
    const fy = top + ph + 60;
    pixelText(ctx, info.tag && opts.subline ? String(opts.subline).toUpperCase() : `CAN YOU BEAT ${info.score}?`, 540, fy, 7, pal.warn, 'center', 980);
    pixelText(ctx, 'BY STUDIO LINICRO', 540, Math.min(1920 - 110, fy + 100), 5, '#bbbbbb');
  }
  return c;
}

export function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    if (canvas.toBlob) canvas.toBlob((b) => resolve(b), 'image/png');
    else resolve(null);
  });
}

/**
 * Hand a PNG to the OS share sheet, or download it.
 * Native (iOS app): the PNG is written to the cache with @capacitor/filesystem
 * and handed to the share sheet with @capacitor/share (see native/Native.js).
 * Web: Web Share API with the file, else a PNG download.
 * Returns { method: 'share' | 'download' | 'cancelled' | 'failed' }.
 */
export async function shareImage(canvas, { filename = 'linicro.png', title = 'Linicro', text = '' } = {}) {
  const blob = await canvasToBlob(canvas);
  if (!blob) return { method: 'failed' };
  lastBlob = blob;
  if (isNative()) {
    const res = await shareFile(blob, { filename, title, text });
    if (res) return res;
  }
  try {
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title, text });
      return { method: 'share', bytes: blob.size };
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return { method: 'cancelled' };
    // fall through to download
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return { method: 'download', bytes: blob.size };
  } catch {
    return { method: 'failed' };
  }
}

let lastBlob = null;

export function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** One call: render + share. */
export async function shareScore(opts = {}) {
  const canvas = renderScoreCard(opts);
  const name = `linicro-${opts.tag ? `${slug(opts.tag)}-` : ''}${slug(opts.gameName || 'score')}-${Math.floor(Number(opts.score) || 0)}-${opts.format || 'story'}.png`;
  const res = await shareImage(canvas, {
    filename: name,
    title: 'Linicro',
    text: opts.text || `I scored ${Math.floor(Number(opts.score) || 0)} in ${opts.gameName || 'a game'} on Linicro. Can you beat it?`
  });
  lastShare = { ...res, filename: name, w: canvas.width, h: canvas.height };
  return lastShare;
}

let lastShare = null;

export function publishShare() {
  window.__vpg = window.__vpg || {};
  window.__vpg.share = {
    render: (opts) => renderScoreCard(opts).toDataURL('image/png'),
    share: shareScore,
    last: () => lastShare,
    lastBytes: () => (lastBlob ? lastBlob.size : 0)
  };
}

export default { renderScoreCard, shareImage, shareScore, pixelText, publishShare, FORMATS };
