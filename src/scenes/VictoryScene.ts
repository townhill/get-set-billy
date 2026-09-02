import Phaser from 'phaser';
import { GAME_WIDTH, PLAY_HEIGHT } from '../config';
import { PixelText } from '../render/PixelText';
import { keys } from '../render/textures';
import { formatDuration } from '../state/GameState';
import { audio } from '../systems/AudioSystem';
import type { RunRecord } from '../systems/SaveSystem';
import { input } from '../systems/InputSystem';

/** A few of the things you carried out with you, bobbing about in celebration. */
const SOUVENIRS = ['teacup', 'key', 'crown', 'bell', 'umbrella', 'pocketwatch', 'jar', 'boot'];
const SOUVENIR_Y = 138;

export interface VictoryData {
  collected: number;
  total: number;
  elapsedMs: number;
  deaths: number;
  livesLeft: number;
  /** True when this run was faster than every one before it. */
  isBest?: boolean;
  /** The fastest run so far, which on a first finish is this one. */
  best?: RunRecord | null;
}

/** The end. Such as it is. */
export class VictoryScene extends Phaser.Scene {
  private ready = false;
  private elapsed = 0;
  private confetti: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('VictoryScene');
  }

  create(data: VictoryData): void {
    this.cameras.main.setBackgroundColor('#000000');
    input.attach();
    this.ready = false;
    this.elapsed = 0;

    const heading = new PixelText(this, {
      x: GAME_WIDTH / 2,
      y: 22,
      maxChars: 7,
      originX: 0.5,
      colour: 'Y',
      scale: 3,
    });
    heading.setText('YOU ARE');

    const heading2 = new PixelText(this, {
      x: GAME_WIDTH / 2,
      y: 46,
      maxChars: 7,
      originX: 0.5,
      colour: 'G',
      scale: 3,
    });
    heading2.setText('OUTSIDE');

    const body = new PixelText(this, {
      x: GAME_WIDTH / 2,
      y: 78,
      maxChars: 42,
      lines: 6,
      originX: 0.5,
      colour: 'W',
    });
    const best = data.best ?? null;
    const footer =
      data.isBest === true
        ? 'A NEW BEST. NOBODY IS MORE SURPRISED.'
        : best === null
          ? ''
          : `BEST SO FAR ${formatDuration(best.elapsedMs)}`;

    body.setText([
      'THE DOOR CLOSES BEHIND YOU. IT SOUNDS',
      'ALMOST DISAPPOINTED.',
      '',
      `ALL ${data.collected} OF ${data.total} THINGS IN ${formatDuration(data.elapsedMs)}`,
      `${data.deaths} MISHAPS, ${data.livesLeft} LIVES TO SPARE`,
      footer,
    ]);

    const prompt = new PixelText(this, {
      x: GAME_WIDTH / 2,
      y: PLAY_HEIGHT + 8,
      maxChars: 42,
      originX: 0.5,
      colour: 'C',
    });
    prompt.setText('SPACE OR ENTER TO GO BACK IN');

    // A modest celebration: the things you found, drifting about.
    this.confetti = SOUVENIRS.map((sprite, index) =>
      this.add.image(20 + index * 31, SOUVENIR_Y, keys.item(sprite, index % 6)).setOrigin(0.5, 0.5),
    );

    this.time.delayedCall(600, () => {
      this.ready = true;
    });
  }

  override update(_time: number, delta: number): void {
    input.poll();
    this.elapsed += delta;

    const seconds = this.elapsed / 1000;
    this.confetti.forEach((image, index) => {
      image.setY(SOUVENIR_Y + Math.sin(seconds * 2 + index * 0.7) * 5);
      image.setTexture(keys.item(SOUVENIRS[index], Math.floor(seconds * 8 + index) % 6));
    });

    if (this.ready && input.justPressed('confirm')) {
      audio.play('select');
      this.scene.start('TitleScene');
    }
    input.endFrame();
  }
}
