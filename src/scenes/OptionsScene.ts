import Phaser from 'phaser';
import { GAME_WIDTH, PLAY_HEIGHT } from '../config';
import { PixelText } from '../render/PixelText';
import { audio } from '../systems/AudioSystem';
import { ACTION_NAMES, BINDABLE, type Bindable, input, keyLabel } from '../systems/InputSystem';
import { SaveSystem } from '../systems/SaveSystem';

/**
 * The options screen: which key does what, and the two settings worth having.
 *
 * The keys that work this screen are not themselves rebindable, which is what
 * makes the whole thing safe — there is no arrangement of bindings that can
 * leave a player unable to get back here and put it right. There is a reset as
 * well, but only as a convenience rather than as the escape hatch.
 */

const TOP = 26;
const ROW_HEIGHT = 11;

type Row =
  | { kind: 'binding'; action: Bindable }
  | { kind: 'sound' }
  | { kind: 'flashing' }
  | { kind: 'reset' }
  | { kind: 'back' };

const ROWS: Row[] = [
  ...BINDABLE.map((action) => ({ kind: 'binding', action }) as Row),
  { kind: 'sound' },
  { kind: 'flashing' },
  { kind: 'reset' },
  { kind: 'back' },
];

export class OptionsScene extends Phaser.Scene {
  private selected = 0;
  /** The row waiting for a key, or null when simply browsing. */
  private capturing: Bindable | null = null;
  private labels: PixelText[] = [];
  private hint!: PixelText;

  constructor() {
    super('OptionsScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#000000');
    input.attach();
    this.selected = 0;
    this.capturing = null;

    const heading = new PixelText(this, {
      x: GAME_WIDTH / 2,
      y: 8,
      maxChars: 12,
      originX: 0.5,
      colour: 'Y',
      scale: 2,
    });
    heading.setText('CONTROLS');

    this.labels = ROWS.map(
      (_row, index) =>
        new PixelText(this, {
          x: 6,
          y: TOP + index * ROW_HEIGHT,
          maxChars: 41,
          colour: 'W',
        }),
    );

    this.hint = new PixelText(this, {
      x: GAME_WIDTH / 2,
      y: PLAY_HEIGHT + 10,
      maxChars: 42,
      lines: 2,
      originX: 0.5,
      colour: 'C',
    });

    this.redraw();
  }

  private label(row: Row, index: number): string {
    const chosen = index === this.selected;
    const marker = chosen ? '>' : ' ';

    switch (row.kind) {
      case 'binding': {
        const waiting = this.capturing === row.action;
        const value = waiting
          ? 'PRESS A KEY'
          : input.keysFor(row.action).map(keyLabel).join('/').slice(0, 14);
        const name = ACTION_NAMES[row.action];
        return `${marker}${name.padEnd(24, '.')}${value}`;
      }
      case 'sound':
        return `${marker}${'SOUND'.padEnd(24, '.')}${audio.muted ? 'OFF' : 'ON'}`;
      case 'flashing': {
        const gentle = SaveSystem.loadSettings().reducedFlashing;
        return `${marker}${'FLASHING'.padEnd(24, '.')}${gentle ? 'GENTLE' : 'FULL'}`;
      }
      case 'reset':
        return `${marker}PUT EVERY KEY BACK`;
      case 'back':
        return `${marker}BACK`;
    }
  }

  private redraw(): void {
    ROWS.forEach((row, index) => {
      const chosen = index === this.selected;
      this.labels[index]
        .setText(this.label(row, index))
        .setColour(this.capturing !== null && chosen ? 'Y' : chosen ? 'G' : 'W');
    });

    this.hint.setText(
      this.capturing !== null
        ? ['PRESS THE KEY YOU WANT.', 'ESC TO LEAVE IT ALONE.']
        : ['UP/DOWN TO CHOOSE, SPACE OR ENTER', 'ESC TO GO BACK'],
    );
  }

  override update(): void {
    input.poll();

    if (this.capturing !== null) {
      this.captureKey();
      input.endFrame();
      return;
    }

    if (input.justPressed('menuUp')) this.move(-1);
    if (input.justPressed('menuDown')) this.move(1);
    if (input.justPressed('confirm')) this.choose();
    if (input.justPressed('pause')) this.leave();

    input.endFrame();
  }

  /**
   * Takes the next key pressed as the new binding.
   *
   * Escape backs out instead, because a player who has changed their mind
   * half-way through needs a way out that is not "bind it to Escape".
   */
  private captureKey(): void {
    const code = input.takeLastPressed();
    if (code === null) return;

    if (code !== 'Escape') {
      input.setBinding(this.capturing as Bindable, code);
      audio.play('select');
    }
    this.capturing = null;
    this.redraw();
  }

  private move(by: number): void {
    this.selected = (this.selected + by + ROWS.length) % ROWS.length;
    audio.play('select');
    this.redraw();
  }

  private choose(): void {
    const row = ROWS[this.selected];
    switch (row.kind) {
      case 'binding':
        this.capturing = row.action;
        // Whatever was pressed to get here must not be captured as the answer.
        input.takeLastPressed();
        break;
      case 'sound':
        audio.toggleMute();
        break;
      case 'flashing': {
        const gentle = !SaveSystem.loadSettings().reducedFlashing;
        SaveSystem.saveSettings({ reducedFlashing: gentle });
        audio.play('select');
        break;
      }
      case 'reset':
        input.resetBindings();
        audio.play('select');
        break;
      case 'back':
        this.leave();
        return;
    }
    this.redraw();
  }

  private leave(): void {
    audio.play('select');
    this.scene.start('TitleScene');
  }
}
