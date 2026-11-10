import Phaser from 'phaser';
import { initPhoneInput } from './input/PhoneInput.js';
import { applySkin, getSkin } from './skins/SkinManager.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import SnakeScene from './scenes/SnakeScene.js';
import SkinScene from './scenes/SkinScene.js';

// Wire up the on-screen keypad and the physical keyboard
initPhoneInput();

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
  scene: [BootScene, MenuScene, SnakeScene, SkinScene],
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  }
};

new Phaser.Game(config);
