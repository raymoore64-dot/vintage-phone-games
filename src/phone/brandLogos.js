/*
 * Boot logos for the invented phone brands. Original abstract marks drawn
 * as inline SVG (no external assets, no real-world logos). Each mark uses
 * currentColor plus the CSS vars --pfg / --pacc / --pwarn that Power.js
 * sets from the skin palette, and is animated by phone-extras.css via the
 * brand class (.b-linicro, .b-purplex, ...).
 */

const LOGOS = {
  // Two hooked arcs reaching for each other and locking: a "handshake"
  linicro: `
    <svg viewBox="0 0 120 60" class="mark">
      <path class="hl" d="M58 30 C58 16 46 10 34 10 C20 10 12 20 12 30 C12 40 20 50 34 50 C42 50 48 46 52 40" />
      <path class="hr" d="M62 30 C62 44 74 50 86 50 C100 50 108 40 108 30 C108 20 100 10 86 10 C78 10 72 14 68 20" />
      <circle class="dot" cx="60" cy="30" r="4" />
    </svg>`,
  // A little bunch of grapes popping in one by one
  purplex: `
    <svg viewBox="0 0 120 70" class="mark">
      <path class="stem" d="M60 4 C60 10 64 12 68 12" />
      <circle class="g g1" cx="48" cy="20" r="8" /><circle class="g g2" cx="64" cy="20" r="8" /><circle class="g g3" cx="80" cy="20" r="8" />
      <circle class="g g4" cx="56" cy="34" r="8" /><circle class="g g5" cx="72" cy="34" r="8" />
      <circle class="g g6" cx="64" cy="48" r="8" />
    </svg>`,
  // An ice crystal drawing itself
  glacio: `
    <svg viewBox="0 0 120 80" class="mark">
      <g class="flake">
        <path d="M60 6 V74 M30 23 L90 57 M30 57 L90 23" />
        <path d="M52 14 L60 22 L68 14 M52 66 L60 58 L68 66" />
        <path d="M33 33 L42 30 L39 21 M87 47 L78 50 L81 59" />
        <path d="M33 47 L42 50 L39 59 M87 33 L78 30 L81 21" />
      </g>
    </svg>`,
  // A faceted gem that spins into place
  rubytel: `
    <svg viewBox="0 0 120 70" class="mark">
      <g class="gem">
        <path class="facet" d="M40 22 L52 8 H68 L80 22 L60 62 Z" />
        <path class="cut" d="M40 22 H80 M52 8 L60 22 L68 8 M60 22 V62 M52 22 L60 62 L68 22" />
      </g>
    </svg>`,
  // The sun rising over a horizon, rays turning
  solara: `
    <svg viewBox="0 0 120 70" class="mark">
      <g class="rays"><path d="M60 8 V0 M60 8 M38 16 L32 10 M82 16 L88 10 M28 36 H20 M92 36 H100" /></g>
      <circle class="sun" cx="60" cy="40" r="16" />
      <rect class="horizon" x="16" y="52" width="88" height="4" />
    </svg>`,
  // A mint leaf swaying, with fizzy bubbles
  mintra: `
    <svg viewBox="0 0 120 70" class="mark">
      <path class="leaf" d="M60 64 C32 52 30 22 60 6 C90 22 88 52 60 64 Z" />
      <path class="vein" d="M60 62 V14 M60 40 L48 30 M60 30 L72 22 M60 50 L72 42" />
      <circle class="bub b1" cx="92" cy="50" r="3" /><circle class="bub b2" cx="98" cy="36" r="2" /><circle class="bub b3" cx="26" cy="44" r="2.5" />
    </svg>`,
  // A monogram ring with a light sweep, very posh
  aurum: `
    <svg viewBox="0 0 120 70" class="mark">
      <circle class="ring" cx="60" cy="35" r="28" />
      <path class="mono" d="M46 52 L60 16 L74 52 M51 40 H69" />
      <rect class="sweep" x="20" y="0" width="10" height="70" />
    </svg>`,
  // A bolt that flickers on like a neon tube
  volta: `
    <svg viewBox="0 0 120 70" class="mark">
      <path class="bolt" d="M66 4 L40 40 H58 L50 66 L82 26 H64 Z" />
    </svg>`,
  // A wireframe cube that glitches in
  proto: `
    <svg viewBox="0 0 120 70" class="mark">
      <g class="cube">
        <path d="M42 22 H74 V54 H42 Z" />
        <path d="M52 12 H84 V44 H74 M42 22 L52 12 M74 22 L84 12 M74 54 L84 44" />
        <path class="hid" d="M52 12 V44 H74 M42 54 L52 44" />
      </g>
    </svg>`
};

const TAGLINES = {
  linicro: 'Built like a brick.',
  purplex: 'Life in purple',
  glacio: 'Stay cool',
  rubytel: 'Hot line',
  solara: 'Always sunny',
  mintra: 'Fresh calls',
  aurum: 'Executive class',
  volta: 'Charged up',
  proto: 'NOT FOR SALE · LAB 7'
};

export function brandKey(skin) {
  const b = String((skin && skin.brand) || 'LINICRO').toLowerCase();
  return LOGOS[b] ? b : 'linicro';
}

export function logoSvg(skin) {
  return LOGOS[brandKey(skin)];
}

export function tagline(skin) {
  return TAGLINES[brandKey(skin)] || '';
}

export default { brandKey, logoSvg, tagline };
