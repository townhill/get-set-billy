import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, isDebugEnabled } from './config';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';
import { VictoryScene } from './scenes/VictoryScene';

/**
 * Boots the game at a logical 256x192 and scales it up by a whole number of
 * pixels, so every pixel on screen is a perfect square of pixels. Anything
 * other than an integer multiple makes this sort of art look like a photocopy.
 */

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#000000',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  banner: false,
  disableContextMenu: true,
  // Centring is handled by the flexbox in index.html; letting Phaser do it too
  // adds its margins on top and pushes the canvas off centre.
  scale: {
    mode: Phaser.Scale.NONE,
  },
  scene: [BootScene, TitleScene, GameScene, GameOverScene, VictoryScene],
});

function fitToWindow(): void {
  const available = {
    width: window.innerWidth,
    height: window.innerHeight,
  };
  const zoom = Math.max(
    1,
    Math.floor(Math.min(available.width / GAME_WIDTH, available.height / GAME_HEIGHT)),
  );
  game.scale.setZoom(zoom);
  game.scale.refresh();
}

window.addEventListener('resize', fitToWindow);
window.addEventListener('orientationchange', fitToWindow);
game.events.once(Phaser.Core.Events.READY, fitToWindow);
fitToWindow();

if (isDebugEnabled()) {
  (globalThis as { peculiarHouse?: Phaser.Game }).peculiarHouse = game;
}
