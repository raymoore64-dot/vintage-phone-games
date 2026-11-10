/*
 * LCD screen effects, done on the HTML side so every scene gets them for
 * free and nothing in the game logic changes:
 *
 *   setGhost(on)     — PURPLEX "Ghosting": a 2D overlay canvas keeps a
 *                      slowly-fading copy of past frames and is blended on
 *                      top with `lighten`, so bright things leave a soft
 *                      trail. One drawImage per frame at 360x480.
 *   setSunlight(on)  — SOLARA "Sunlight": a gentle contrast / saturation lift.
 *   setDim(on)       — battery empty: the backlight dims.
 *   glitch()         — VOLTA "Glitch": a 450 ms jitter + colour shift.
 *
 * T9 code-book eggs (one run each, see Eggs.js):
 *   setDisco(on)     — DISCO: the LCD cycles through colours.
 *   setFlip(on)      — FLIP: the picture is upside down (controls are not).
 *   setFat(on)       — PIXEL: a 120x160 copy of each frame is drawn on top,
 *                      scaled up with nearest-neighbour: 3x3 fat pixels.
 */

let game = null;
let ghostCanvas = null;
let ghostCtx = null;
let ghostOn = false;
let ghostFrames = 0;

let fatCanvas = null;
let fatCtx = null;
let fatOn = false;
let fatFrames = 0;

const GHOST_KEEP = 0.62;   // how much of the old frame survives each draw

function screenEl() {
  return document.querySelector('.screen');
}

function onPostRender() {
  if (fatOn && fatCtx && game && game.canvas) {
    try {
      fatCtx.imageSmoothingEnabled = true;
      fatCtx.drawImage(game.canvas, 0, 0, fatCanvas.width, fatCanvas.height);
      fatFrames += 1;
    } catch {
      // skip
    }
  }
  if (!ghostOn || !ghostCtx || !game || !game.canvas) return;
  ghostFrames += 1;
  try {
    // Fade what's there, then lay the new frame in at low weight: the
    // overlay becomes a lagging average of recent frames.
    ghostCtx.globalCompositeOperation = 'source-over';
    ghostCtx.globalAlpha = 1 - GHOST_KEEP;
    ghostCtx.drawImage(game.canvas, 0, 0, ghostCanvas.width, ghostCanvas.height);
  } catch {
    // reading the canvas can fail on very old browsers; just skip
  }
}

export function initLcd(g) {
  game = g;
  const container = document.getElementById('game-container');
  if (container && !ghostCanvas) {
    ghostCanvas = document.createElement('canvas');
    ghostCanvas.className = 'lcd-ghost';
    ghostCanvas.width = 360;
    ghostCanvas.height = 480;
    ghostCanvas.setAttribute('aria-hidden', 'true');
    container.appendChild(ghostCanvas);
    ghostCtx = ghostCanvas.getContext('2d');
  }
  if (container && !fatCanvas) {
    fatCanvas = document.createElement('canvas');
    fatCanvas.className = 'lcd-fat';
    fatCanvas.width = 120;
    fatCanvas.height = 160;
    fatCanvas.setAttribute('aria-hidden', 'true');
    container.appendChild(fatCanvas);
    fatCtx = fatCanvas.getContext('2d');
  }
  if (game && game.events) game.events.on('postrender', onPostRender);
  window.__vpg = window.__vpg || {};
  window.__vpg.lcd = { state };
}

export function setGhost(on) {
  const next = !!on;
  if (next === ghostOn) return;
  ghostOn = next;
  ghostFrames = 0;
  if (ghostCtx) ghostCtx.clearRect(0, 0, ghostCanvas.width, ghostCanvas.height);
  if (ghostCanvas) ghostCanvas.classList.toggle('on', ghostOn);
}

export function setSunlight(on) {
  const el = screenEl();
  if (el) el.classList.toggle('lcd-sun', !!on);
}

export function setDim(on) {
  const el = screenEl();
  if (el) el.classList.toggle('lcd-dim', !!on);
}

export function glitch() {
  const el = screenEl();
  if (!el) return;
  el.classList.remove('lcd-glitch');
  // force reflow so the animation restarts
  void el.offsetWidth;
  el.classList.add('lcd-glitch');
  clearTimeout(el._glitchTimer);
  el._glitchTimer = setTimeout(() => el.classList.remove('lcd-glitch'), 460);
}

export function setDisco(on) {
  const el = screenEl();
  if (el) el.classList.toggle('egg-disco', !!on);
}

export function setFlip(on) {
  const el = screenEl();
  if (el) el.classList.toggle('egg-flip', !!on);
}

export function setFat(on) {
  fatOn = !!on;
  fatFrames = 0;
  if (fatCtx) fatCtx.clearRect(0, 0, fatCanvas.width, fatCanvas.height);
  if (fatCanvas) fatCanvas.classList.toggle('on', fatOn);
}

export function state() {
  const el = screenEl();
  return {
    disco: !!(el && el.classList.contains('egg-disco')),
    flip: !!(el && el.classList.contains('egg-flip')),
    fat: fatOn,
    fatFrames,
    ghost: ghostOn,
    ghostFrames,
    ghostVisible: !!(ghostCanvas && ghostCanvas.classList.contains('on')),
    sunlight: !!(el && el.classList.contains('lcd-sun')),
    dim: !!(el && el.classList.contains('lcd-dim')),
    glitching: !!(el && el.classList.contains('lcd-glitch'))
  };
}

export default { initLcd, setGhost, setSunlight, setDim, glitch, setDisco, setFlip, setFat, state };
