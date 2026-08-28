import Phaser from 'phaser';
import { GAME_WIDTH, PLAY_HEIGHT } from '../config';
import { PixelText } from '../render/PixelText';
import { formatDuration } from '../state/GameState';
import { audio } from '../systems/AudioSystem';
import { input } from '../systems/InputSystem';

export interface GameOverData {
  collected: number;
  total: number;
  elapsedMs: number;
  roomName: string;
}

/** Shown when the last life goes. The saved game survives, so Continue still works. */
export class GameOverScene extends Phaser.Scene {
  private ready = false;

  constructor() {
    super('GameOverScene');
  }

  create(data: GameOverData): void {
    this.cameras.main.setBackgroundColor('#000000');
    input.attach();
    this.ready = false;

    const heading = new PixelText(this, {
      x: GAME_WIDTH / 2,
      y: 34,
      maxChars: 9,
      originX: 0.5,
      colour: 'R',
      scale: 3,
    });
    heading.setText('YOU STOP');

    const body = new PixelText(this, {
      x: GAME_WIDTH / 2,
      y: 66,
      maxChars: 42,
      lines: 5,
      originX: 0.5,
      colour: 'W',
    });
    body.setText([
      'THE HOUSE HAS WON, FOR NOW.',
      '',
      `YOU GOT AS FAR AS ${data.roomName.toUpperCase()}`,
      `AND FOUND ${data.collected} OF ${data.total} THINGS`,
      `IN ${formatDuration(data.elapsedMs)}`,
    ]);

    const prompt = new PixelText(this, {
      x: GAME_WIDTH / 2,
      y: PLAY_HEIGHT + 6,
      maxChars: 42,
      lines: 2,
      originX: 0.5,
      colour: 'C',
    });
    prompt.setText(['SPACE OR ENTER TO RETURN TO THE TITLE', 'CONTINUE KEEPS WHAT YOU FOUND']);

    // Ignore whatever key was already down when we arrived.
    this.time.delayedCall(400, () => {
      this.ready = true;
    });
  }

  override update(): void {
    input.poll();
    if (this.ready && input.justPressed('confirm')) {
      audio.play('select');
      this.scene.start('TitleScene');
    }
    input.endFrame();
  }
}
