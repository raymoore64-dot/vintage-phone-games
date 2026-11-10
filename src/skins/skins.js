/*
 * Phone skins for Vintage Phone Games.
 *
 * Every phone is an original, invented brand — no real manufacturer names
 * or logos. Each entry is a complete description of the HTML bezel (via CSS
 * custom properties on .phone) and of the LCD colour palette that game
 * scenes paint with.
 *
 *   unlockAt — lifetime points needed to use this phone. 0 = already unlocked.
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
    unlockAt: 0,
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
    unlockAt: 0,
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
    unlockAt: 0,
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
    unlockAt: 0,
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
  },
  // ------------------------------------------------------------------
  // 5. SOLARA Sunburst
  // A chunky late-90s "slider-ish" yellow-orange brick: wide body,
  // flatter top, black keys, and a muted green-grey LCD.
  // Unlocks at 500 lifetime points.
  // ------------------------------------------------------------------
  {
    id: 'solara-sunburst',
    name: 'Sunburst',
    brand: 'SOLARA',
    model: 'Sunburst',
    tagline: 'Chunky yellow brick · green-grey LCD',
    unlockAt: 500,
    css: {
      '--phone-width': '46',
      '--phone-pad-top': '2.2',
      '--phone-pad-side': '3.2',
      '--phone-pad-bottom': '2.6',
      '--phone-radius-tl': '3.5',
      '--phone-radius-tr': '3.5',
      '--phone-radius-br': '6',
      '--phone-radius-bl': '6',
      '--phone-bg': 'linear-gradient(180deg, #f6c44a 0%, #e89418 28%, #c05a0a 62%, #7a3208 100%)',
      '--phone-highlight': 'rgba(255, 240, 180, 0.4)',
      '--phone-inset-dark': 'rgba(80, 30, 0, 0.5)',
      '--phone-drop': 'rgba(60, 20, 0, 0.65)',
      '--phone-glow': 'rgba(240, 160, 20, 0.22)',
      '--phone-shine': 'linear-gradient(180deg, rgba(255,255,220,0.40) 0%, rgba(255,200,80,0.10) 24%, transparent 48%)',
      '--brand-color': '#3a1c00',
      '--brand-tracking': '0.7',
      '--brand-size': '1.9',
      '--speaker-width': '14',
      '--speaker-height': '0.9',
      '--speaker-bg': 'repeating-linear-gradient(90deg, #2a1400 0 calc(var(--u) * 0.6), #8a5a10 calc(var(--u) * 0.6) calc(var(--u) * 1))',
      '--screen-wrap-bg': '#2a1a08',
      '--screen-wrap-pad': '1.3',
      '--screen-wrap-radius': '1.2',
      '--lcd-bg': '#141a14',
      '--softbar-bg': '#141a14',
      '--softbar-border': '#2a3a28',
      '--softbar-fg': '#b0c8a8',
      '--key-fg': '#e8e8e8',
      '--key-bg': 'linear-gradient(#2a2a2a, #101010)',
      '--key-radius': '0.9',
      '--key-shadow': '#3a1c00',
      '--key-sub-fg': '#8a8a8a',
      '--call-bg': 'linear-gradient(#3d8f4a, #1e5a28)',
      '--end-bg': 'linear-gradient(#8a2020, #4a1010)',
      '--call-fg': '#e8ffe8',
      '--end-fg': '#ffd0d0',
      '--call-radius': '1.2',
      '--dpad-size': '15',
      '--dpad-radius': 'calc(var(--u) * 1.6)',
      '--dpad-bg': 'radial-gradient(circle at 40% 35%, #3a3a3a, #101010)',
      '--dir-fg': '#d0d0d0',
      '--dir-active': '#b0c8a8',
      '--ok-bg': 'linear-gradient(#3a3a3a, #181818)',
      '--ok-fg': '#f0f0f0',
      '--ok-active': '#b0c8a8',
      '--ok-size': '5.4'
    },
    palette: {
      bg: '#141a14',
      fg: '#b0c8a8',
      dim: '#5a6e58',
      accent: '#8aaa80',
      warn: '#e8c040',
      danger: '#e05050',
      text: '#e4f0dc',
      panel: '#1c241c'
    }
  },

  // ------------------------------------------------------------------
  // 6. MINTRA Minty
  // A soft pastel-mint candy-bar with white pill keys and a bright
  // teal LCD. Unlocks at 1500 lifetime points.
  // ------------------------------------------------------------------
  {
    id: 'mintra-minty',
    name: 'Minty',
    brand: 'MINTRA',
    model: 'Minty',
    tagline: 'Pastel mint shell · teal LCD',
    unlockAt: 1500,
    css: {
      '--phone-width': '44',
      '--phone-pad-top': '2.5',
      '--phone-pad-side': '2.6',
      '--phone-pad-bottom': '3',
      '--phone-radius-tl': '9',
      '--phone-radius-tr': '9',
      '--phone-radius-br': '11',
      '--phone-radius-bl': '11',
      '--phone-bg': 'linear-gradient(160deg, #e8fff4, #a8e0c8 42%, #68b898 78%, #3e8a70)',
      '--phone-highlight': 'rgba(255, 255, 255, 0.6)',
      '--phone-inset-dark': 'rgba(20, 60, 50, 0.28)',
      '--phone-drop': 'rgba(20, 50, 40, 0.45)',
      '--phone-glow': 'rgba(120, 220, 190, 0.28)',
      '--phone-shine': 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(220,255,240,0.16) 28%, transparent 50%)',
      '--brand-color': '#1a5a48',
      '--brand-tracking': '0.75',
      '--brand-size': '1.8',
      '--speaker-width': '9',
      '--speaker-height': '1',
      '--speaker-bg': 'repeating-linear-gradient(90deg, #1a4a3c 0 calc(var(--u) * 0.6), #8ac8b0 calc(var(--u) * 0.6) calc(var(--u) * 1))',
      '--screen-wrap-bg': '#1a3a32',
      '--screen-wrap-pad': '1.4',
      '--screen-wrap-radius': '2.8',
      '--lcd-bg': '#042018',
      '--softbar-bg': '#042018',
      '--softbar-border': '#145848',
      '--softbar-fg': '#2ee0c0',
      '--key-fg': '#1a3a30',
      '--key-bg': 'linear-gradient(#ffffff, #d8ece4)',
      '--key-radius': '2.5',
      '--key-shadow': '#3a6a58',
      '--key-sub-fg': '#4a7a6a',
      '--call-bg': 'linear-gradient(#4ccc88, #2a8a58)',
      '--end-bg': 'linear-gradient(#e87888, #a04050)',
      '--call-fg': '#f4fff8',
      '--end-fg': '#fff4f4',
      '--call-radius': '2.5',
      '--dpad-size': '15',
      '--dpad-radius': '50%',
      '--dpad-bg': 'radial-gradient(circle at 40% 35%, #ffffff, #90c8b4)',
      '--dir-fg': '#1a3a30',
      '--dir-active': '#0a7a60',
      '--ok-bg': 'linear-gradient(#ffffff, #b8dcc8)',
      '--ok-fg': '#1a3a30',
      '--ok-active': '#0a7a60',
      '--ok-size': '5.6'
    },
    palette: {
      bg: '#042018',
      fg: '#2ee0c0',
      dim: '#1a6a5c',
      accent: '#5ad4b8',
      warn: '#ffcc55',
      danger: '#ff5a7a',
      text: '#d8fff4',
      panel: '#0a2c24'
    }
  },

  // ------------------------------------------------------------------
  // 7. AURUM Executive
  // A slim matte-black / gunmetal business phone with gold keys and a
  // gold-amber LCD. Unlocks at 3500 lifetime points.
  // ------------------------------------------------------------------
  {
    id: 'aurum-executive',
    name: 'Executive',
    brand: 'AURUM',
    model: 'Executive',
    tagline: 'Gunmetal slim · gold keys · amber LCD',
    unlockAt: 3500,
    css: {
      '--phone-width': '40',
      '--phone-pad-top': '2.3',
      '--phone-pad-side': '1.6',
      '--phone-pad-bottom': '2.6',
      '--phone-radius-tl': '2.2',
      '--phone-radius-tr': '2.2',
      '--phone-radius-br': '2.4',
      '--phone-radius-bl': '2.4',
      '--phone-bg': 'linear-gradient(160deg, #3a3d42, #1c1e22 50%, #0c0d10)',
      '--phone-highlight': 'rgba(220, 200, 150, 0.12)',
      '--phone-inset-dark': 'rgba(0, 0, 0, 0.65)',
      '--phone-drop': 'rgba(0, 0, 0, 0.75)',
      '--phone-glow': 'rgba(200, 160, 60, 0.12)',
      '--phone-shine': 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(200,180,120,0.04) 26%, transparent 48%)',
      '--brand-color': '#d4b45a',
      '--brand-tracking': '0.9',
      '--brand-size': '1.6',
      '--speaker-width': '12',
      '--speaker-height': '0.7',
      '--speaker-bg': 'repeating-linear-gradient(90deg, #0a0a0a 0 calc(var(--u) * 0.6), #4a4430 calc(var(--u) * 0.6) calc(var(--u) * 1))',
      '--screen-wrap-bg': '#0a0a0c',
      '--screen-wrap-pad': '1.1',
      '--screen-wrap-radius': '0.8',
      '--lcd-bg': '#161208',
      '--softbar-bg': '#161208',
      '--softbar-border': '#4a3810',
      '--softbar-fg': '#f5c400',
      '--key-fg': '#2a1c08',
      '--key-bg': 'linear-gradient(#e8d48a, #b89440)',
      '--key-radius': '0.5',
      '--key-shadow': '#0a0a0a',
      '--key-sub-fg': '#6a5420',
      '--call-bg': 'linear-gradient(#3a8a58, #1a4a30)',
      '--end-bg': 'linear-gradient(#8a3030, #4a1010)',
      '--call-fg': '#f0ffe8',
      '--end-fg': '#ffd8d8',
      '--call-radius': '0.5',
      '--dpad-size': '14.5',
      '--dpad-radius': 'calc(var(--u) * 1.1)',
      '--dpad-bg': 'radial-gradient(circle at 40% 35%, #4a4e54, #16181c)',
      '--dir-fg': '#d4b45a',
      '--dir-active': '#f5c400',
      '--ok-bg': 'linear-gradient(#e8d48a, #a07830)',
      '--ok-fg': '#2a1c08',
      '--ok-active': '#6a4a08',
      '--ok-size': '5.2'
    },
    palette: {
      bg: '#161208',
      fg: '#f5c400',
      dim: '#8a7020',
      accent: '#c8a040',
      warn: '#ffee66',
      danger: '#ff4a4a',
      text: '#ffe9a0',
      panel: '#201808'
    }
  },

  // ------------------------------------------------------------------
  // 8. VOLTA Neon
  // A translucent teal / cyan jelly phone with magenta keys and a
  // pink-magenta LCD. Unlocks at 7000 lifetime points.
  // ------------------------------------------------------------------
  {
    id: 'volta-neon',
    name: 'Neon',
    brand: 'VOLTA',
    model: 'Neon',
    tagline: 'Translucent teal shell · magenta LCD',
    unlockAt: 7000,
    css: {
      '--phone-width': '45',
      '--phone-pad-top': '2.4',
      '--phone-pad-side': '2.8',
      '--phone-pad-bottom': '3',
      '--phone-radius-tl': '8',
      '--phone-radius-tr': '8',
      '--phone-radius-br': '10',
      '--phone-radius-bl': '10',
      '--phone-bg': 'linear-gradient(160deg, rgba(80, 240, 230, 0.92), rgba(20, 140, 150, 0.95) 50%, #044048)',
      '--phone-highlight': 'rgba(200, 255, 255, 0.4)',
      '--phone-inset-dark': 'rgba(0, 40, 50, 0.45)',
      '--phone-drop': 'rgba(0, 40, 50, 0.6)',
      '--phone-glow': 'rgba(40, 220, 220, 0.4)',
      '--phone-shine': 'linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(160,255,255,0.12) 30%, transparent 54%)',
      '--brand-color': '#ffd0f0',
      '--brand-tracking': '0.8',
      '--brand-size': '1.85',
      '--speaker-width': '9',
      '--speaker-height': '1',
      '--speaker-bg': 'repeating-linear-gradient(90deg, #042028 0 calc(var(--u) * 0.6), #208088 calc(var(--u) * 0.6) calc(var(--u) * 1))',
      '--screen-wrap-bg': '#140818',
      '--screen-wrap-pad': '1.4',
      '--screen-wrap-radius': '2.4',
      '--lcd-bg': '#180814',
      '--softbar-bg': '#180814',
      '--softbar-border': '#5a1848',
      '--softbar-fg': '#ff64c8',
      '--key-fg': '#fff0f8',
      '--key-bg': 'linear-gradient(#ff50b0, #a01860)',
      '--key-radius': '2.2',
      '--key-shadow': '#042028',
      '--key-sub-fg': '#ffb0d8',
      '--call-bg': 'linear-gradient(#30d0a0, #148060)',
      '--end-bg': 'linear-gradient(#ff3870, #8a1040)',
      '--call-fg': '#f0fff8',
      '--end-fg': '#ffe8f0',
      '--call-radius': '2.2',
      '--dpad-size': '15',
      '--dpad-radius': '50%',
      '--dpad-bg': 'radial-gradient(circle at 40% 35%, #40d8d8, #0a4850)',
      '--dir-fg': '#f0ffff',
      '--dir-active': '#ff64c8',
      '--ok-bg': 'linear-gradient(#ff70c0, #c02070)',
      '--ok-fg': '#fff8fc',
      '--ok-active': '#ffe0f0',
      '--ok-size': '5.6'
    },
    palette: {
      bg: '#180814',
      fg: '#ff64c8',
      dim: '#8a3068',
      accent: '#ff90d8',
      warn: '#ffd24a',
      danger: '#ff4060',
      text: '#ffd8f0',
      panel: '#241018'
    }
  },

  // ------------------------------------------------------------------
  // 9. PROTO Clear (secret)
  // A see-through engineering prototype: smoky clear plastic, visible
  // "circuit" glints, chrome keys and an icy white-cyan LCD. Hidden in
  // the picker until the SMS code *7283 is entered on the menu.
  // ------------------------------------------------------------------
  {
    id: 'proto-clear',
    name: 'Clear',
    brand: 'PROTO',
    model: 'Clear',
    tagline: 'Secret see-through prototype · ice LCD',
    unlockAt: 0,
    secret: 'proto',
    css: {
      '--phone-width': '44',
      '--phone-pad-top': '2.5',
      '--phone-pad-side': '3',
      '--phone-pad-bottom': '3',
      '--phone-radius-tl': '6',
      '--phone-radius-tr': '6',
      '--phone-radius-br': '8',
      '--phone-radius-bl': '8',
      '--phone-bg': 'repeating-linear-gradient(90deg, rgba(120, 255, 200, 0.06) 0 2px, transparent 2px 22px), repeating-linear-gradient(0deg, rgba(255, 210, 120, 0.06) 0 2px, transparent 2px 30px), linear-gradient(160deg, rgba(220, 235, 245, 0.42), rgba(120, 140, 160, 0.38) 55%, rgba(40, 50, 64, 0.7))',
      '--phone-highlight': 'rgba(255, 255, 255, 0.55)',
      '--phone-inset-dark': 'rgba(0, 10, 20, 0.35)',
      '--phone-drop': 'rgba(0, 0, 0, 0.6)',
      '--phone-glow': 'rgba(180, 240, 255, 0.35)',
      '--phone-shine': 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.12) 26%, transparent 50%)',
      '--brand-color': '#e8f8ff',
      '--brand-tracking': '1',
      '--brand-size': '1.7',
      '--speaker-width': '10',
      '--speaker-height': '1',
      '--speaker-bg': 'repeating-linear-gradient(90deg, #10161c 0 calc(var(--u) * 0.6), #8ea4b4 calc(var(--u) * 0.6) calc(var(--u) * 1))',
      '--screen-wrap-bg': 'rgba(10, 16, 22, 0.92)',
      '--screen-wrap-pad': '1.5',
      '--screen-wrap-radius': '2',
      '--lcd-bg': '#06121a',
      '--softbar-bg': '#06121a',
      '--softbar-border': '#1e4458',
      '--softbar-fg': '#bff4ff',
      '--key-fg': '#0c1820',
      '--key-bg': 'linear-gradient(#f4f8fb, #a8b6c2)',
      '--key-radius': '1.4',
      '--key-shadow': '#4a5864',
      '--key-sub-fg': '#3a4c5a',
      '--call-bg': 'linear-gradient(#8ef0c0, #3aa078)',
      '--end-bg': 'linear-gradient(#ff9aa8, #c04858)',
      '--call-fg': '#06241a',
      '--end-fg': '#2a060c',
      '--call-radius': '2',
      '--dpad-size': '15',
      '--dpad-radius': '50%',
      '--dpad-bg': 'radial-gradient(circle at 40% 35%, #f8fbff, #8c9aa8)',
      '--dir-fg': '#16242e',
      '--dir-active': '#00a0d0',
      '--ok-bg': 'linear-gradient(#ffffff, #b4c2ce)',
      '--ok-fg': '#0c1820',
      '--ok-active': '#00a0d0',
      '--ok-size': '5.6'
    },
    palette: {
      bg: '#06121a',
      fg: '#bff4ff',
      dim: '#4a7488',
      accent: '#7fd8f0',
      warn: '#ffe27a',
      danger: '#ff6a7a',
      text: '#e6fbff',
      panel: '#0e2230'
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
