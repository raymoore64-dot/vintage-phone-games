import Phaser from 'phaser';
import './styles/phone-extras.css';
import { initPhoneInput } from './input/PhoneInput.js';
import { initSfx } from './audio/Sfx.js';
import { initMusic } from './audio/Music.js';
import { applySkin, getSkin, setSkin } from './skins/SkinManager.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import SnakeScene from './scenes/SnakeScene.js';
import BounceScene from './scenes/BounceScene.js';
import ImpactScene from './scenes/ImpactScene.js';
import BricksScene from './scenes/BricksScene.js';
import BlocksScene from './scenes/BlocksScene.js';
import SimonScene from './scenes/SimonScene.js';
import SkinScene from './scenes/SkinScene.js';
import InboxScene from './scenes/InboxScene.js';
import SettingsScene from './scenes/SettingsScene.js';
import CodeBookScene from './scenes/CodeBookScene.js';
import CreditsScene from './scenes/CreditsScene.js';
import { initPower } from './phone/Power.js';
import { initCalls } from './phone/Calls.js';
import { initWear } from './phone/Wear.js';
import { publishEggs } from './phone/Eggs.js';
import { initPhone } from './phone/Phone.js';
import { initLcd } from './phone/Lcd.js';
import { initSms } from './phone/Sms.js';
import { publishPerks } from './skins/perks.js';

// Wire up the on-screen keypad and the physical keyboard
initPhoneInput();
initSfx();
initMusic();

// Paint the saved phone skin onto the HTML bezel before the canvas starts
applySkin();

// Living phone: SMS inbox state (welcome texts, daily dare) and perk debug
initSms();
publishPerks();

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
    SkinScene, InboxScene,
    SettingsScene, CodeBookScene, CreditsScene
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

// Battery / signal / clock status bar + LCD effects ride on the game loop
initPhone(game);
initLcd(game);
// Batch A: power key + boot, fake calls, wear & tear, T9 code book
initPower(game);
initCalls();
initWear();
publishEggs();
window.__vpg = window.__vpg || {};
window.__vpg.setSkin = (id) => setSkin(id).id;
export default game;
