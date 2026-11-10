/*
 * Phone skins for Vintage Phone Games.
 *
 * Every phone is an original, invented brand — no real manufacturer names
 * or logos. Each entry is a complete description of the HTML bezel (via CSS
 * custom properties on .phone) and of the LCD colour palette that game
 * scenes paint with.
 *
 *   unlock  — reserved for future progression. true means already unlocked.
 */

export const DEFAULT_SKIN_ID = 'linicro-1000';

export const SKINS = [
  // ------------------------------------------------------------------
  // 1. LINICRO 1000 "Graphite Brick"
  // The original look: a chunky late-90s charcoal brick with a classic
  // green monochrome LCD, rounded-square keys and a circular D-pad.
  // ------------------------------------------------------------------
  {
    id: 'linicro-1000',
    name: 'Graphite Brick',
    brand: 'LINICRO',
    model: '1000',
    tagline: 'Chunky charcoal brick · green LCD',
    unlock: true,
    css: {
      '--phone-width': '44',
      '--phone-pad-top': '2.5',
      '--phone-pad-side': '3',
      '--phone-pad-bottom': '3',
      '--phone-radius-tl': '7',
      '--phone-radius-tr': '7',
      '--phone-radius-br': '9',
      '--phone-radius-bl': '9',
      '--phone-bg': 'linear-gradient(160deg, #3b4250, #1e222a 60%, #15181e)',
      '--phone-highlight': 'rgba(255, 255, 255, 0.15)',
      '--phone-inset-dark': 'rgba(0, 0, 0, 0.5)',
      '--phone-drop': 'rgba(0, 0, 0, 0.7)',
      '--phone-glow': 'transparent',
      '--phone-shine': 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 28%, transparent 50%)',
      '--brand-color': '#9aa4b2',
      '--brand-tracking': '0.6',
      '--brand-size': '1.8',
      '--speaker-width': '10',
      '--speaker-height': '1',
      '--speaker-bg': 'repeating-linear-gradient(90deg, #0a0b0d 0 calc(var(--u) * 0.6), #2a2f38 calc(var(--u) * 0.6) calc(var(--u) * 1))',
      '--screen-wrap-bg': '#0b0c0e',
      '--screen-wrap-pad': '1.5',
      '--screen-wrap-radius': '2',
      '--lcd-bg': '#0d1a12',
      '--softbar-bg': '#0d1a12',
      '--softbar-border': '#1d3a28',
      '--softbar-fg': '#00ff88',
      '--key-fg': '#d8dee8',
      '--key-bg': 'linear-gradient(#4b5363, #2c323d)',
      '--key-radius': '1.2',
      '--key-shadow': '#12151a',
      '--key-sub-fg': '#8c96a5',
      '--call-bg': 'linear-gradient(#3f8f55, #24603a)',
      '--end-bg': 'linear-gradient(#a8443f, #6e2724)',
      '--call-fg': '#e8ffe8',
      '--end-fg': '#f0d8d8',
      '--call-radius': '2.2',
      '--dpad-size': '15',
      '--dpad-radius': '50%',
      '--dpad-bg': 'radial-gradient(circle at 40% 35%, #4a5262, #232831)',
      '--dir-fg': '#aab3c0',
      '--dir-active': '#00ff88',
      '--ok-bg': 'linear-gradient(#5a6375, #333a46)',
      '--ok-fg': '#d8dee8',
      '--ok-active': '#00ff88',
      '--ok-size': '5.6'
    },
    palette: {
      bg: '#0d1a12',
      fg: '#00ff88',
      dim: '#557766',
      accent: '#88aa99',
      warn: '#ffcc33',
      danger: '#ff4444',
      text: '#e8ffe8',
      panel: '#16241b'
    }
  },

  // ------------------------------------------------------------------
  // 2. PURPLEX Grape
  // A translucent jelly-purple shell, very rounded, with pill keys and
  // a warm amber / orange LCD — like a see-through candy bar.
  // ------------------------------------------------------------------
  {
    id: 'purplex-grape',
    name: 'Grape',
    brand: 'PURPLEX',
    model: 'Grape',
    tagline: 'Translucent purple shell · amber LCD',
    unlock: true,
    css: {
      '--phone-width': '46',
      '--phone-pad-top': '2.5',
      '--phone-pad-side': '3',
      '--phone-pad-bottom': '3',
      '--phone-radius-tl': '12',
      '--phone-radius-tr': '12',
      '--phone-radius-br': '13',
      '--phone-radius-bl': '13',
      '--phone-bg': 'linear-gradient(160deg, rgba(176, 110, 214, 0.94), rgba(92, 36, 140, 0.96) 55%, #2a1048)',
      '--phone-highlight': 'rgba(255, 220, 255, 0.35)',
      '--phone-inset-dark': 'rgba(40, 0, 60, 0.45)',
      '--phone-drop': 'rgba(40, 0, 60, 0.65)',
      '--phone-glow': 'rgba(160, 80, 200, 0.35)',
      '--phone-shine': 'linear-gradient(180deg, rgba(255,255,255,0.34) 0%, rgba(255,200,255,0.10) 30%, transparent 52%)',
      '--brand-color': '#f0d8ff',
      '--brand-tracking': '0.7',
      '--brand-size': '1.8',
      '--speaker-width': '9',
      '--speaker-height': '1',
      '--speaker-bg': 'repeating-linear-gradient(90deg, #1a0820 0 calc(var(--u) * 0.6), #6a3a80 calc(var(--u) * 0.6) calc(var(--u) * 1))',
      '--screen-wrap-bg': '#1a0c18',
      '--screen-wrap-pad': '1.5',
      '--screen-wrap-radius': '3',
      '--lcd-bg': '#1a1008',
      '--softbar-bg': '#1a1008',
      '--softbar-border': '#4a2a10',
      '--softbar-fg': '#ffb020',
      '--key-fg': '#f8e8ff',
      '--key-bg': 'linear-gradient(#9a68c0, #5a3480)',
      '--key-radius': '2.6',
      '--key-shadow': '#2a1040',
      '--key-sub-fg': '#d0b0e8',
      '--call-bg': 'linear-gradient(#5cbf70, #2e7a40)',
      '--end-bg': 'linear-gradient(#d06070, #8a2838)',
      '--call-fg': '#f8fff8',
      '--end-fg': '#fff0f4',
      '--call-radius': '2.6',
      '--dpad-size': '15',
      '--dpad-radius': '50%',
      '--dpad-bg': 'radial-gradient(circle at 40% 35%, #b078d0, #4a2068)',
      '--dir-fg': '#f0d8ff',
      '--dir-active': '#ffb020',
      '--ok-bg': 'linear-gradient(#c090e0, #6a3890)',
      '--ok-fg': '#fff8ff',
      '--ok-active': '#ffb020',
      '--ok-size': '5.6'
    },
    palette: {
      bg: '#1a1008',
      fg: '#ffb020',
      dim: '#8a5a20',
      accent: '#cc8844',
      warn: '#ffe066',
      danger: '#ff3a5a',
      text: '#ffe8c0',
      panel: '#2a1a0a'
    }
  },

  // ------------------------------------------------------------------
  // 3. GLACIO Ice
  // A slim silver / ice-blue candy-bar. Flatter corners, squared-off
  // keys, a rounded-square D-pad and a cool blue backlight LCD.
  // ------------------------------------------------------------------
  {
    id: 'glacio-ice',
    name: 'Ice',
    brand: 'GLACIO',
    model: 'Ice',
    tagline: 'Silver candy-bar · blue backlight',
    unlock: true,
    css: {
      '--phone-width': '42',
      '--phone-pad-top': '2.4',
      '--phone-pad-side': '1.8',
      '--phone-pad-bottom': '2.8',
      '--phone-radius-tl': '4',
      '--phone-radius-tr': '4',
      '--phone-radius-br': '5',
      '--phone-radius-bl': '5',
      '--phone-bg': 'linear-gradient(160deg, #e8eef4, #9aa6b4 42%, #6a7684 78%, #4a5460)',
      '--phone-highlight': 'rgba(255, 255, 255, 0.55)',
      '--phone-inset-dark': 'rgba(40, 50, 60, 0.35)',
      '--phone-drop': 'rgba(20, 30, 40, 0.55)',
      '--phone-glow': 'rgba(160, 200, 230, 0.25)',
      '--phone-shine': 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.12) 26%, transparent 48%)',
      '--brand-color': '#1e3a58',
      '--brand-tracking': '0.85',
      '--brand-size': '1.7',
      '--speaker-width': '11',
      '--speaker-height': '0.8',
      '--speaker-bg': 'repeating-linear-gradient(90deg, #2a3340 0 calc(var(--u) * 0.6), #8a96a4 calc(var(--u) * 0.6) calc(var(--u) * 1))',
      '--screen-wrap-bg': '#3a4650',
      '--screen-wrap-pad': '1.2',
      '--screen-wrap-radius': '1.2',
      '--lcd-bg': '#071018',
      '--softbar-bg': '#071018',
      '--softbar-border': '#1a3a50',
      '--softbar-fg': '#5ad0ff',
      '--key-fg': '#e8eef4',
      '--key-bg': 'linear-gradient(#4a5564, #2a3340)',
      '--key-radius': '0.7',
      '--key-shadow': '#3a4450',
      '--key-sub-fg': '#9aa8b8',
      '--call-bg': 'linear-gradient(#3cb88a, #1e6e54)',
      '--end-bg': 'linear-gradient(#d05660, #7a2830)',
      '--call-fg': '#f0fff8',
      '--end-fg': '#fff0f0',
      '--call-radius': '0.8',
      '--dpad-size': '15',
      '--dpad-radius': 'calc(var(--u) * 2)',
      '--dpad-bg': 'radial-gradient(circle at 40% 35%, #c0c8d0, #5a6570)',
      '--dir-fg': '#1e2a38',
      '--dir-active': '#0a70a8',
      '--ok-bg': 'linear-gradient(#d8dee8, #8a96a4)',
      '--ok-fg': '#1e2a38',
      '--ok-active': '#0a70a8',
      '--ok-size': '5.4'
    },
    palette: {
      bg: '#071018',
      fg: '#5ad0ff',
      dim: '#3a6a80',
      accent: '#88aacc',
      warn: '#ffcc55',
      danger: '#ff4a6a',
      text: '#e0f4ff',
      panel: '#102030'
    }
  },

  // ------------------------------------------------------------------
  // 4. RUBYTEL Cherry
  // A slimmer, very rounded red pebble-phone with cream pill keys and
  // a warm yellow-green LCD — like a cherry drop with a lime screen.
  // ------------------------------------------------------------------
  {
    id: 'rubytel-cherry',
    name: 'Cherry',
    brand: 'RUBYTEL',
    model: 'Cherry',
    tagline: 'Curved cherry-red shell · lime LCD',
    unlock: true,
    css: {
      '--phone-width': '43',
      '--phone-pad-top': '2.5',
      '--phone-pad-side': '2.4',
      '--phone-pad-bottom': '3',
      '--phone-radius-tl': '10',
      '--phone-radius-tr': '10',
      '--phone-radius-br': '14',
      '--phone-radius-bl': '14',
      '--phone-bg': 'linear-gradient(160deg, #d04048, #8a1820 55%, #4e1014)',
      '--phone-highlight': 'rgba(255, 200, 190, 0.28)',
      '--phone-inset-dark': 'rgba(40, 0, 0, 0.45)',
      '--phone-drop': 'rgba(40, 0, 0, 0.6)',
      '--phone-glow': 'rgba(180, 30, 40, 0.25)',
      '--phone-shine': 'linear-gradient(180deg, rgba(255,230,220,0.28) 0%, rgba(255,180,170,0.08) 28%, transparent 52%)',
      '--brand-color': '#f4e0b0',
      '--brand-tracking': '0.55',
      '--brand-size': '1.8',
      '--speaker-width': '8',
      '--speaker-height': '1',
      '--speaker-bg': 'repeating-linear-gradient(90deg, #2a0808 0 calc(var(--u) * 0.6), #8a3030 calc(var(--u) * 0.6) calc(var(--u) * 1))',
      '--screen-wrap-bg': '#2a0c0c',
      '--screen-wrap-pad': '1.4',
      '--screen-wrap-radius': '2.5',
      '--lcd-bg': '#161a06',
      '--softbar-bg': '#161a06',
      '--softbar-border': '#3a4210',
      '--softbar-fg': '#d4e014',
      '--key-fg': '#3a1810',
      '--key-bg': 'linear-gradient(#f0e4cc, #c8b090)',
      '--key-radius': '2.4',
      '--key-shadow': '#4a1010',
      '--key-sub-fg': '#7a5040',
      '--call-bg': 'linear-gradient(#5cb870, #2a7040)',
      '--end-bg': 'linear-gradient(#6a1820, #3a080c)',
      '--call-fg': '#f4ffc8',
      '--end-fg': '#f4e0b0',
      '--call-radius': '2.4',
      '--dpad-size': '15',
      '--dpad-radius': '50%',
      '--dpad-bg': 'radial-gradient(circle at 40% 35%, #f0d8c8, #a04848)',
      '--dir-fg': '#3a1810',
      '--dir-active': '#d4e014',
      '--ok-bg': 'linear-gradient(#f8eed8, #c09070)',
      '--ok-fg': '#3a1810',
      '--ok-active': '#6a0008',
      '--ok-size': '5.6'
    },
    palette: {
      bg: '#161a06',
      fg: '#d4e014',
      dim: '#6a7820',
      accent: '#a0b050',
      warn: '#ff8a30',
      danger: '#ff3355',
      text: '#f4ffc8',
      panel: '#1e240c'
    }
  }
];

export default SKINS;

export function getSkinById(id) {
  return SKINS.find((s) => s.id === id) || SKINS[0];
}

export function skinIndex(id) {
  const i = SKINS.findIndex((s) => s.id === id);
  return i < 0 ? 0 : i;
}

/** '#00ff88' or '00ff88' → 0x00ff88 */
export function hexToInt(hex) {
  return parseInt(String(hex).replace('#', ''), 16);
}

/** Darken (factor < 1) or lighten (factor > 1) a hex colour. Returns an int. */
export function shadeHex(hex, factor) {
  const n = hexToInt(hex);
  const ch = (c) => Math.min(255, Math.max(0, Math.round(c * factor)));
  return (ch((n >> 16) & 255) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255);
}
