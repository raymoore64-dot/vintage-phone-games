import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Add any shared assets later (phone frames, fonts, etc.)
  }

  create() {
    this.scene.start('MenuScene');
  }
}
