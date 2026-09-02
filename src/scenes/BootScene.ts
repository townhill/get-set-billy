import Phaser from 'phaser';
import { buildAllTextures } from '../render/textures';
import { audio } from '../systems/AudioSystem';
import { input } from '../systems/InputSystem';

/**
 * Draws every sprite in the game into a texture, then gets out of the way.
 *
 * There is nothing to download, so this takes a few milliseconds and there is
 * no loading bar to speak of.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    buildAllTextures(this);
    audio.init();
    input.loadBindings();
    input.attach();

    document.getElementById('loading')?.remove();

    this.scene.start('TitleScene');
  }
}
