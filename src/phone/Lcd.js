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
 */

let game = null;
let ghostCanvas = null;
let ghostCtx = null;
let ghostOn = false;
let ghostFrames = 0;

const GHOST_KEEP = 0.62;   // how much of the old frame survives each draw

function screenEl() {
  return document.querySelector('.screen');
}

function onPostRender() {
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

export function state() {
  const el = screenEl();
  return {
    ghost: ghostOn,
    ghostFrames,
    ghostVisible: !!(ghostCanvas && ghostCanvas.classList.contains('on')),
    sunlight: !!(el && el.classList.contains('lcd-sun')),
    dim: !!(el && el.classList.contains('lcd-dim')),
    glitching: !!(el && el.classList.contains('lcd-glitch'))
  };
}

export default { initLcd, setGhost, setSunlight, setDim, glitch, state };
