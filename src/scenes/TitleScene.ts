import Phaser from 'phaser';
import { GAME_WIDTH, PLAY_HEIGHT, TILE_SIZE } from '../config';
import { DECOR_ART, LEDGE_ART } from '../assets/tileArt';
import { GLYPH_ADVANCE } from '../assets/font';
import { backdropFor } from '../assets/backdrops';
import { PixelText } from '../render/PixelText';
import { keys } from '../render/textures';
import { artToCanvas, context2d, createCanvas, paintField, themedResolver } from '../render/pixels';
import { PALETTE, type PaletteKey } from '../assets/palette';
import { audio } from '../systems/AudioSystem';
import { input, keyLabel } from '../systems/InputSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { TOTAL_ITEMS } from '../world/RoomManager';
import { type GameStateSnapshot, formatDuration } from '../state/GameState';

/**
 * Title screen, menu and instructions, with a small unexplained procession
 * along the bottom.
 */

const FLOOR_KEY = 'title-floor';
const SKY_KEY = 'title-sky';
const STAR_KEY = 'title-star';
const FLOOR_Y = 132;
const MENU_Y = 88;
const MENU_STEP = 10;
/** Under the floor, where the procession cannot walk through it. */
const BEST_Y = FLOOR_Y + 14;

/** A few stars over the house, which come and go. Positions in logical pixels. */
const STARS: readonly { x: number; y: number; every: number }[] = [
  { x: 14, y: 10, every: 2.3 },
  { x: 232, y: 6, every: 3.1 },
  { x: 36, y: 50, every: 2.7 },
  { x: 214, y: 44, every: 1.9 },
  { x: 8, y: 80, every: 3.7 },
  { x: 240, y: 76, every: 2.9 },
];

/** One word of the title, drawn a letter at a time so the letters can move. */
interface TitleWord {
  letters: { face: PixelText; shadow: PixelText; x: number }[];
  y: number;
  colour: PaletteKey;
}

/** Big letters are this many times the size of the ordinary ones. */
const TITLE_SCALE = 3;

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
  private words: TitleWord[] = [];
  /** The gentler-flashing setting, which also keeps the glint off the title. */
  private gentle = false;
  private stars: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('TitleScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#000000');
    input.attach();
    this.saved = SaveSystem.load();
    this.gentle = SaveSystem.loadSettings().reducedFlashing;
    this.elapsed = 0;
    this.tunePlayed = false;
    this.selected = 0;

    this.drawSky();
    this.drawTitle();
    this.drawFloor();
    this.buildMenu();
    this.drawInstructions();

    this.walker = this.add.image(40, FLOOR_Y - 16, keys.player('walk', 1, 0)).setOrigin(0, 0);
    this.chaser = this.add.image(8, FLOOR_Y - 8, keys.enemy('bowler', 0, 1)).setOrigin(0, 0);
  }

  /** A night sky down to the floor the procession walks along, and a few stars in it. */
  private drawSky(): void {
    if (!this.textures.exists(SKY_KEY)) {
      const canvas = createCanvas(GAME_WIDTH, FLOOR_Y);
      const sky = backdropFor('sky');
      const inks: Record<string, string | null> = { '1': PALETTE.n, '2': PALETTE.a, '.': null };
      // Stretched to fit, so it lightens towards the floor rather than stopping short of it.
      const stretch = PLAY_HEIGHT / FLOOR_Y;
      paintField(
        context2d(canvas),
        GAME_WIDTH,
        FLOOR_Y,
        (x, y) => inks[sky(x, Math.floor(y * stretch))] ?? null,
        '#000000',
      );
      this.textures.addCanvas(SKY_KEY, canvas);
    }
    if (!this.textures.exists(STAR_KEY)) {
      this.textures.addCanvas(
        STAR_KEY,
        artToCanvas(DECOR_ART.star, themedResolver({ '1': '#ffe040' })),
      );
    }
    this.add.image(0, 0, SKY_KEY).setOrigin(0, 0);
    this.stars = STARS.map((star) => this.add.image(star.x, star.y, STAR_KEY).setOrigin(0, 0));
  }

  /**
   * THE PECULIAR HOUSE, in three lines: a small THE, then the two big words a
   * letter at a time, each with a drop shadow, so that they can bob.
   */
  private buildWord(text: string, y: number, colour: PaletteKey, shade: PaletteKey): TitleWord {
    const advance = GLYPH_ADVANCE * TITLE_SCALE;
    const width = text.length * advance - TITLE_SCALE;
    const left = Math.round(GAME_WIDTH / 2 - width / 2);
    const letters = [...text].map((char, index) => {
      const x = left + index * advance;
      const letter = (ink: PaletteKey): PixelText =>
        new PixelText(this, { x, y, maxChars: 1, colour: ink, scale: TITLE_SCALE }).setText(char);
      const shadow = letter(shade);
      return { face: letter(colour), shadow, x };
    });
    return { letters, y, colour };
  }

  private drawTitle(): void {
    const the = new PixelText(this, {
      x: GAME_WIDTH / 2,
      y: 4,
      maxChars: 3,
      originX: 0.5,
      colour: 'C',
      scale: 2,
      outline: true,
    });
    the.setText('THE');

    this.words = [this.buildWord('PECULIAR', 19, 'Y', 'r'), this.buildWord('HOUSE', 42, 'M', 'm')];

    const tagline = new PixelText(this, {
      x: GAME_WIDTH / 2,
      y: 67,
      maxChars: 40,
      lines: 2,
      originX: 0.5,
      colour: 'W',
      outline: true,
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
    this.options.push({
      label: 'CONTROLS',
      action: () => {
        audio.play('select');
        this.scene.start('OptionsScene');
      },
    });

    // A time to beat, once there is one. Nothing at all before that: an empty
    // scoreboard on a game nobody has finished is just a reproach.
    const best = SaveSystem.bestRun();
    if (best !== null) {
      const label = new PixelText(this, {
        x: GAME_WIDTH / 2,
        y: BEST_Y,
        maxChars: 34,
        originX: 0.5,
        colour: 'Y',
      });
      label.setText(`BEST ESCAPE  ${formatDuration(best.elapsedMs)}  ${best.deaths} MISHAPS`);
    }

    this.menuLabels = this.options.map((option, index) => {
      const label = new PixelText(this, {
        x: GAME_WIDTH / 2,
        y: MENU_Y + index * MENU_STEP,
        maxChars: option.label.length + 4,
        originX: 0.5,
        colour: 'W',
      });
      label.setText(option.label);
      return label;
    });
  }

  private drawInstructions(): void {
    // Read from the live bindings rather than written out, so the title screen
    // cannot end up telling somebody to press a key they have moved.
    const walk = [input.keysFor('left')[0], input.keysFor('right')[0]].map(keyLabel).join('/');
    const jump = keyLabel(input.keysFor('jump')[0]);
    const restart = keyLabel(input.keysFor('restartRoom')[0]);

    const controls = new PixelText(this, {
      x: GAME_WIDTH / 2,
      y: PLAY_HEIGHT - 2,
      maxChars: 40,
      lines: 4,
      originX: 0.5,
      colour: 'G',
    });
    controls.setText([
      `${walk} TO WALK, ${jump} TO JUMP`,
      `${restart} GIVES UP ON A ROOM, AND COSTS A LIFE`,
      'ESC MAP  M SOUND  F GENTLER FLASHING',
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
    this.animateTitle();
    input.endFrame();
  }

  /**
   * The big letters bob in a slow wave, a glint runs along them every few
   * seconds, and the stars come and go. Nothing flashes quickly: this is the
   * screen people leave running.
   */
  private animateTitle(): void {
    const seconds = this.elapsed / 1000;
    let offset = 0;
    for (const word of this.words) {
      // One letter in the word catches the light at a time, then none for a while.
      const glintAt = Math.floor(((seconds * 9) % 36) - offset);
      word.letters.forEach((letter, index) => {
        const lift = Math.round(Math.sin(seconds * 2.4 - (index + offset) * 0.55) * 1.5);
        const y = word.y + lift;
        letter.face.image.setY(y);
        letter.shadow.image.setPosition(letter.x + 2, y + 2);
        letter.face.setColour(index === glintAt && !this.gentle ? 'W' : word.colour);
      });
      offset += word.letters.length;
    }

    STARS.forEach((star, index) => {
      this.stars[index]?.setVisible((seconds / star.every) % 1 < 0.8);
    });
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
