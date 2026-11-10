import Phaser from 'phaser';
import { initPhoneInput } from './input/PhoneInput.js';
import { initSfx } from './audio/Sfx.js';
import { applySkin, getSkin } from './skins/SkinManager.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import SnakeScene from './scenes/SnakeScene.js';
import BounceScene from './scenes/BounceScene.js';
import ImpactScene from './scenes/ImpactScene.js';
import BricksScene from './scenes/BricksScene.js';
import BlocksScene from './scenes/BlocksScene.js';
import SimonScene from './scenes/SimonScene.js';
import SkinScene from './scenes/SkinScene.js';

// Wire up the on-screen keypad and the physical keyboard
initPhoneInput();
initSfx();

// Paint the saved phone skin onto the HTML bezel before the canvas starts
applySkin();

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 360,
  height: 480,           // 3:4 phone screen; the soft-key bar sits below it in HTML
  backgroundColor: getSkin().palette.bg,
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [
    BootScene, MenuScene,
    SnakeScene, BounceScene, ImpactScene,
    BricksScene, BlocksScene, SimonScene,
    SkinScene
  ],
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  },
  // We use our own WebAudio helper, unlocked after a user gesture.
  // Disable Phaser's sound manager so it does not create an AudioContext
  // on boot (which would break autoplay policies on iOS).
  audio: { noAudio: true }
};

const game = new Phaser.Game(config);
window.__vpgGame = game;
export default game;
