/*
 * Pocket pet pixel art, generated in code (no image files). The same data
 * is drawn by Phaser Graphics (Pet screen, menu peek) and by canvas 2D
 * (share card), so drawing goes through a plain rect(x, y, w, h, colour)
 * callback.
 *
 * Stages: 0 egg, 1 baby, 2 kid, 3 adult. Moods: idle, blink, happy,
 * eating, sleepy, grumpy, sick. Colours come from the skin palette:
 * outline fg, body accent (dim when sick), face bg, extras warn.
 */

const SHAPES = [
  { w: 10, h: 12, cx: 5, cy: 6.2, rx: 4.6, ry: 5.6 },                 // egg
  { w: 12, h: 11, cx: 6, cy: 6, rx: 5.7, ry: 4.9, eyes: [4, 7], ey: 5, my: 7 },   // baby
  { w: 14, h: 14, cx: 7, cy: 8, rx: 6.5, ry: 5.5, eyes: [5, 8], ey: 7, my: 9, ears: true },
  { w: 16, h: 17, cx: 8, cy: 8.7, rx: 7.4, ry: 6.1, eyes: [5, 10], ey: 8, my: 11, ears: true, antenna: true, feet: true }
];

const cache = new Map();

/** Grid of chars: '#' outline, '+' body, '*' extra, ' ' empty. */
export function bodyGrid(stage) {
  const s = Math.max(0, Math.min(3, stage | 0));
  if (cache.has(s)) return cache.get(s);
  const sh = SHAPES[s];
  const g = Array.from({ length: sh.h }, () => Array(sh.w).fill(' '));
  const inside = (x, y) => {
    if (x < 0 || y < 0 || x >= sh.w || y >= sh.h) return false;
    const dx = (x + 0.5 - sh.cx) / sh.rx;
    const dy = (y + 0.5 - sh.cy) / sh.ry;
    return dx * dx + dy * dy <= 1;
  };
  for (let y = 0; y < sh.h; y++) {
    for (let x = 0; x < sh.w; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      g[y][x] = edge ? '#' : '+';
    }
  }
  const put = (x, y, c) => { if (y >= 0 && y < sh.h && x >= 0 && x < sh.w) g[y][x] = c; };
  if (s === 0) {
    put(3, 4, '*'); put(6, 6, '*'); put(4, 8, '*'); put(7, 3, '*');
  }
  if (sh.ears) {
    const top = Math.round(sh.cy - sh.ry);
    [[2, 0], [sh.w - 3, 0]].forEach(([x]) => {
      put(x, top - 1, '#'); put(x, top, '#'); put(x + (x < sh.w / 2 ? 1 : -1), top, '#');
    });
  }
  if (sh.antenna) {
    const mid = Math.floor(sh.w / 2);
    put(mid, 0, '*'); put(mid, 1, '#'); put(mid, 2, '#');
  }
  if (sh.feet) {
    const y = sh.h - 1;
    [3, 4, sh.w - 5, sh.w - 4].forEach((x) => put(x, y, '#'));
  }
  const rows = g.map((r) => r.join(''));
  cache.set(s, rows);
  return rows;
}

export function petSize(stage) {
  const sh = SHAPES[Math.max(0, Math.min(3, stage | 0))];
  return { w: sh.w, h: sh.h };
}

/** Face pixels for a mood: [{x, y, c}] where c is 'face' | 'extra'. */
function face(stage, mood, frame) {
  const sh = SHAPES[stage];
  if (!sh.eyes) return [];
  const [l, r] = sh.eyes;
  const ey = sh.ey;
  const my = sh.my;
  const mx = Math.floor(sh.w / 2) - 1;
  const px = [];
  const f = (x, y, c = 'face') => px.push({ x, y, c });
  const eyes = (shape) => [l, r].forEach((x) => {
    if (shape === 'dot') { f(x, ey); f(x, ey - 1); }
    else if (shape === 'line') { f(x - 1, ey); f(x, ey); }
    else if (shape === 'happy') { f(x - 1, ey); f(x, ey - 1); f(x + 1, ey); }
    else if (shape === 'x') { f(x - 1, ey - 1); f(x + 1, ey - 1); f(x, ey); f(x - 1, ey + 1); f(x + 1, ey + 1); }
  });
  switch (mood) {
    case 'happy':
      eyes('happy');
      f(mx - 1, my); f(mx, my + 1); f(mx + 1, my + 1); f(mx + 2, my);
      f(l - 2, my - 1, 'extra'); f(r + 2, my - 1, 'extra');
      break;
    case 'eating':
      eyes('line');
      if (frame % 2) { f(mx, my); f(mx + 1, my); f(mx, my + 1); f(mx + 1, my + 1); }
      else { f(mx, my); f(mx + 1, my); }
      break;
    case 'sleepy':
      eyes('line');
      f(mx, my); f(mx + 1, my);
      break;
    case 'grumpy':
      eyes('dot');
      f(l - 1, ey - 2); f(r + 1, ey - 2);
      f(mx - 1, my + 1); f(mx, my); f(mx + 1, my); f(mx + 2, my + 1);
      break;
    case 'sick':
      eyes('x');
      f(mx, my + 1); f(mx + 1, my + 1);
      break;
    case 'blink':
      eyes('line');
      f(mx, my); f(mx + 1, my);
      break;
    default:
      eyes('dot');
      f(mx, my); f(mx + 1, my);
  }
  return px;
}

/**
 * Draw the pet. rect(x, y, w, h, cssColour). Returns { w, h } in screen px.
 * opts: { stage, mood, frame, scale, x, y, pal }
 */
export function drawPet(rect, opts) {
  const stage = Math.max(0, Math.min(3, opts.stage | 0));
  const s = opts.scale || 4;
  const pal = opts.pal;
  const mood = opts.mood || 'idle';
  const frame = opts.frame || 0;
  const rows = bodyGrid(stage);
  const body = mood === 'sick' ? pal.dim : pal.accent;
  let ox = opts.x || 0;
  const oy = opts.y || 0;
  if (stage === 0 && mood !== 'sleepy') ox += [0, 1, 0, -1][frame % 4] * s * 0.5;  // egg wobble
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === ' ') continue;
      rect(ox + x * s, oy + y * s, s, s, c === '#' ? pal.fg : c === '*' ? pal.warn : body);
    }
  });
  face(stage, mood, frame).forEach((p) => {
    rect(ox + p.x * s, oy + p.y * s, s, s, p.c === 'extra' ? pal.warn : pal.bg);
  });
  return { w: rows[0].length * s, h: rows.length * s };
}

/** A small 5x4 heart for happy moments. */
export function drawHeart(rect, x, y, s, colour) {
  ['.#.#.', '#####', '.###.', '..#..'].forEach((row, j) => {
    for (let i = 0; i < 5; i++) if (row[i] === '#') rect(x + i * s, y + j * s, s, s, colour);
  });
}

export default { bodyGrid, petSize, drawPet, drawHeart };
