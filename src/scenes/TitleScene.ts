import Phaser from 'phaser';
import { GAME_WIDTH, PLAY_HEIGHT, TILE_SIZE } from '../config';
import { LEDGE_ART } from '../assets/tileArt';
import { PixelText } from '../render/PixelText';
import { keys } from '../render/textures';
import { artToCanvas, themedResolver } from '../render/pixels';
import { PALETTE } from '../assets/palette';
import { audio } from '../systems/AudioSystem';
import { input } from '../systems/InputSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { TOTAL_ITEMS } from '../world/RoomManager';
import type { GameStateSnapshot } from '../state/GameState';

/**
 * Title screen, menu and instructions, with a small unexplained procession
 * along the bottom.
 */

const FLOOR_KEY = 'title-floor';
const FLOOR_Y = 132;
const MENU_Y = 92;

export class TitleScene extends Phaser.Scene {
  private saved: GameStateSnapshot | null = null;
  private options: { label: string; action: () => void }[] = [];
  private selected = 0;
  private menuLabels: PixelText[] = [];
  private muteLabel!: PixelText;
  private walker!: Phaser.GameObjects.Image;
  private chaser!: Phaser.GameObjects.Image;
  private elapsed = 0;
  private tunePlayed = false;

  constructor() {
    super('TitleScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#000000');
    input.attach();
    this.saved = SaveSystem.load();
    this.elapsed = 0;
    this.tunePlayed = false;
    this.selected = 0;

    this.drawTitle();
    this.drawFloor();
    this.buildMenu();
    this.drawInstructions();

    this.walker = this.add.image(40, FLOOR_Y - 16, keys.player('walk', 1, 0)).setOrigin(0, 0);
    this.chaser = this.add.image(8, FLOOR_Y - 8, keys.enemy('bowler', 0, 1)).setOrigin(0, 0);
  }

  private drawTitle(): void {
    const big = new PixelText(this, {
      x: GAME_WIDTH / 2,
      y: 14,
      maxChars: 8,
      originX: 0.5,
      colour: 'Y',
      scale: 3,
    });
    big.setText('PECULIAR');

    const small = new PixelText(this, {
      x: GAME_WIDTH / 2,
      y: 40,
      maxChars: 12,
      originX: 0.5,
      colour: 'C',
      scale: 2,
    });
    small.setText('THE HOUSE');

    const tagline = new PixelText(this, {
      x: GAME_WIDTH / 2,
      y: 62,
      maxChars: 40,
      lines: 2,
      originX: 0.5,
      colour: 'W',
    });
    tagline.setText([
      `${TOTAL_ITEMS} THINGS ARE MISSING. SO ARE YOU.`,
      'FIND THEM ALL, THEN FIND THE FRONT DOOR.',
    ]);

    this.muteLabel = new PixelText(this, {
      x: GAME_WIDTH - 3,
      y: 3,
      maxChars: 8,
      originX: 1,
      colour: 'R',
    });
  }

  private drawFloor(): void {
    if (!this.textures.exists(FLOOR_KEY)) {
      const ink = themedResolver({ '1': PALETTE.Y ?? '#ffe040', '2': PALETTE.y ?? '#c4a600' });
      this.textures.addCanvas(FLOOR_KEY, artToCanvas(LEDGE_ART.beam, ink));
    }
    for (let col = 0; col < GAME_WIDTH / TILE_SIZE; col++) {
      this.add.image(col * TILE_SIZE, FLOOR_Y, FLOOR_KEY).setOrigin(0, 0);
    }
  }

  private buildMenu(): void {
    this.options = [];
    if (this.saved) {
      const snapshot = this.saved;
      this.options.push({
        label: `CONTINUE  (${snapshot.collectedItems.length}/${TOTAL_ITEMS}, ${snapshot.lives} LIVES)`,
        action: () => this.startGame(snapshot),
      });
    }
    this.options.push({ label: 'NEW GAME', action: () => this.startGame(undefined) });

    this.menuLabels = this.options.map((option, index) => {
      const label = new PixelText(this, {
        x: GAME_WIDTH / 2,
        y: MENU_Y + index * 11,
        maxChars: option.label.length + 4,
        originX: 0.5,
        colour: 'W',
      });
      label.setText(option.label);
      return label;
    });
  }

  private drawInstructions(): void {
    const controls = new PixelText(this, {
      x: GAME_WIDTH / 2,
      y: PLAY_HEIGHT - 2,
      maxChars: 40,
      lines: 4,
      originX: 0.5,
      colour: 'G',
    });
    controls.setText([
      'ARROWS OR A/D TO WALK   SPACE/UP TO JUMP',
      'R RESTARTS A ROOM (AND COSTS YOU A LIFE)',
      'ESC PAUSES   M FOR SOUND   PADS WELCOME',
      'UP/DOWN TO CHOOSE, SPACE OR ENTER TO GO',
    ]);
  }

  override update(_time: number, delta: number): void {
    input.poll();
    this.elapsed += delta;

    if (this.options.length > 1) {
      if (input.justPressed('menuUp')) this.move(-1);
      if (input.justPressed('menuDown')) this.move(1);
    }

    if (input.justPressed('mute')) {
      audio.unlock();
      audio.toggleMute();
    }
    this.muteLabel.setText(audio.muted ? 'SOUND OFF' : '');

    if (input.justPressed('confirm')) {
      audio.unlock();
      audio.play('select');
      this.options[this.selected]?.action();
      input.endFrame();
      return;
    }

    // The tune waits for a keypress, because browsers insist on it.
    if (!this.tunePlayed && (input.justPressed('menuUp') || input.justPressed('menuDown'))) {
      audio.unlock();
      audio.playTitleTune();
      this.tunePlayed = true;
    }

    this.menuLabels.forEach((label, index) => {
      const active = index === this.selected;
      label.setText(active ? `> ${this.options[index].label} <` : this.options[index].label);
      label.setColour(active ? 'Y' : 'W');
    });

    this.animateProcession();
    input.endFrame();
  }

  private move(step: number): void {
    const count = this.options.length;
    this.selected = (this.selected + step + count) % count;
    audio.play('select');
  }

  private animateProcession(): void {
    const seconds = this.elapsed / 1000;
    const span = GAME_WIDTH + 40;
    const walkerX = ((seconds * 42) % span) - 24;
    const chaserX = ((seconds * 42 - 34 + span) % span) - 24;

    this.walker.setPosition(Math.round(walkerX), FLOOR_Y - 16);
    this.walker.setTexture(keys.player('walk', 1, Math.floor(seconds * 11) % 4));
    this.chaser.setPosition(Math.round(chaserX), FLOOR_Y - 8);
    this.chaser.setTexture(keys.enemy('bowler', Math.floor(seconds * 7) % 2, 1));
  }

  private startGame(snapshot: GameStateSnapshot | undefined): void {
    if (!snapshot) SaveSystem.clear();
    this.scene.start('GameScene', { snapshot });
  }
}
