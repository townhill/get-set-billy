import type Phaser from 'phaser';
import { GAME_WIDTH, HUD_HEIGHT, PLAY_HEIGHT, WORLD } from '../config';
import { LOCK_INKS, type PaletteKey, paletteColour } from '../assets/palette';
import { ITEM_SPRITES, LIFE_ICON } from '../assets/sprites';
import { PixelText } from '../render/PixelText';
import { artToCanvas, themedResolver } from '../render/pixels';
import { formatDuration } from '../state/GameState';
import { LOCK_COLOURS, type LockColour } from '../world/tiles';

/**
 * The status panel along the bottom of the screen.
 *
 * Shows where you are, what you have, how many lives are left and how long you
 * have been wandering about. It also doubles as the place the house talks back
 * to you, via a temporary message that replaces the room name.
 */

const LIFE_ICON_KEY = 'hud-life-icon';
const MAX_LIFE_ICONS = WORLD.maxLives;
/** Heads sit a pixel apart: the art is seven wide in an eight-wide cell. */
const LIFE_ICON_X = 82;
const LIFE_ICON_GAP = 8;
/** How long the item counter lights up after something is found, in milliseconds. */
const COUNTER_FLASH_MS = 450;
/** How long a newly earned life blinks in the panel, in milliseconds. */
const NEW_LIFE_BLINK_MS = 1400;
/** Each lock gets a fixed slot, so a key never moves once you have it. */
const KEY_ICON_X = 156;
const KEY_ICON_GAP = 8;
const keyIconKey = (lock: LockColour): string => `hud-key-${lock}`;
const PANEL_TOP = PLAY_HEIGHT;
const NAME_Y = PANEL_TOP + 5;
const STATS_Y = PANEL_TOP + 18;
/** The line between the two rows of the panel, which fills up as things are found. */
const PROGRESS_Y = PANEL_TOP + 14;

/**
 * How many pixels of the progress line are filled, for so many things found.
 *
 * Rounded down, so the line is only ever full when everything really has been
 * found, and never looks finished one short.
 */
export function progressWidth(collected: number, total: number, width: number): number {
  if (total <= 0) return 0;
  const fraction = Math.min(1, Math.max(0, collected / total));
  return fraction >= 1 ? width : Math.min(width - 1, Math.floor(fraction * width));
}

export interface HudModel {
  roomName: string;
  collected: number;
  total: number;
  lives: number;
  elapsedMs: number;
  muted: boolean;
  /** Which gate colours the player can open. */
  keys: ReadonlySet<LockColour>;
  /** Ink used for the room name, so the panel picks up each room's colour. */
  accent: PaletteKey;
}

export class Hud {
  private readonly chrome: Phaser.GameObjects.Graphics;
  private readonly nameLabel: PixelText;
  private readonly itemsLabel: PixelText;
  private readonly timeLabel: PixelText;
  private readonly muteLabel: PixelText;
  private readonly lifeIcons: Phaser.GameObjects.Image[] = [];
  private readonly keyIcons = new Map<LockColour, Phaser.GameObjects.Image>();

  private messageMs = 0;
  private message: string | null = null;
  private messageColour: PaletteKey = 'Y';
  /** Lines waiting for the current one to finish. */
  private queue: { message: string; durationMs: number; colour: PaletteKey }[] = [];
  /** What the chrome was last drawn for, so it is only redrawn when that changes. */
  private drawn = { accent: '' as string, filled: -1 };
  private lastCollected = -1;
  private counterFlashMs = 0;
  private lastLives = -1;
  private newLifeBlinkMs = 0;

  constructor(private readonly scene: Phaser.Scene) {
    if (!scene.textures.exists(LIFE_ICON_KEY)) {
      scene.textures.addCanvas(LIFE_ICON_KEY, artToCanvas(LIFE_ICON, themedResolver({})));
    }

    for (const lock of LOCK_COLOURS) {
      if (scene.textures.exists(keyIconKey(lock))) continue;
      const ink = paletteColour(LOCK_INKS[lock][0]) ?? '#ffffff';
      scene.textures.addCanvas(
        keyIconKey(lock),
        artToCanvas(ITEM_SPRITES.key, themedResolver({ '1': ink })),
      );
    }

    this.chrome = scene.add.graphics().setDepth(90);
    this.drawChrome('C', 0);

    this.nameLabel = new PixelText(scene, {
      x: GAME_WIDTH / 2,
      y: NAME_Y,
      maxChars: 42,
      originX: 0.5,
      colour: 'W',
      depth: 92,
    });

    this.itemsLabel = new PixelText(scene, {
      x: 4,
      y: STATS_Y,
      maxChars: 12,
      colour: 'Y',
      depth: 92,
    });

    this.timeLabel = new PixelText(scene, {
      x: GAME_WIDTH - 4,
      y: STATS_Y,
      maxChars: 10,
      originX: 1,
      colour: 'C',
      depth: 92,
    });

    this.muteLabel = new PixelText(scene, {
      x: GAME_WIDTH - 4,
      y: NAME_Y,
      maxChars: 6,
      originX: 1,
      colour: 'R',
      depth: 93,
    });

    for (let i = 0; i < MAX_LIFE_ICONS; i++) {
      const icon = scene.add
        .image(LIFE_ICON_X + i * LIFE_ICON_GAP, STATS_Y - 1, LIFE_ICON_KEY)
        .setOrigin(0, 0)
        .setDepth(92)
        .setVisible(false);
      this.lifeIcons.push(icon);
    }

    LOCK_COLOURS.forEach((lock, index) => {
      const icon = scene.add
        .image(KEY_ICON_X + index * KEY_ICON_GAP, STATS_Y - 1, keyIconKey(lock))
        .setOrigin(0, 0)
        .setDepth(92)
        .setVisible(false);
      this.keyIcons.set(lock, icon);
    });
  }

  /**
   * Replaces the room name with a temporary line, for the given number of ms.
   * Anything already waiting its turn is dropped: this is the news now.
   */
  say(message: string, durationMs = 1500, colour: PaletteKey = 'Y'): void {
    this.queue = [];
    this.message = message;
    this.messageMs = durationMs;
    this.messageColour = colour;
  }

  /**
   * Shows a line once the current one has had its say, or straight away if
   * nothing is showing. For news that should not tread on other news.
   */
  sayNext(message: string, durationMs = 1500, colour: PaletteKey = 'Y'): void {
    if (this.message === null) {
      this.say(message, durationMs, colour);
      return;
    }
    this.queue.push({ message, durationMs, colour });
  }

  /**
   * The panel's rules: a line along the top in the room's colour, and one
   * between the rows that doubles as a progress bar — thin for what is still
   * missing, thick for what has been found.
   */
  private drawChrome(accent: PaletteKey, filled: number): void {
    if (this.drawn.accent === accent && this.drawn.filled === filled) return;
    this.drawn = { accent, filled };
    const ink = parseInt((paletteColour(accent) ?? '#ffffff').slice(1), 16);
    this.chrome.clear();
    this.chrome.fillStyle(0x000000, 1);
    this.chrome.fillRect(0, PANEL_TOP, GAME_WIDTH, HUD_HEIGHT);
    this.chrome.fillStyle(ink, 1);
    this.chrome.fillRect(0, PANEL_TOP, GAME_WIDTH, 1);
    this.chrome.fillRect(0, PROGRESS_Y, GAME_WIDTH, 1);
    if (filled > 0) this.chrome.fillRect(0, PROGRESS_Y - 1, filled, 3);
  }

  update(model: HudModel, deltaMs: number): void {
    if (this.messageMs > 0) {
      this.messageMs -= deltaMs;
      if (this.messageMs <= 0) {
        this.message = null;
        const next = this.queue.shift();
        if (next !== undefined) {
          this.message = next.message;
          this.messageMs = next.durationMs;
          this.messageColour = next.colour;
        }
      }
    }

    this.drawChrome(model.accent, progressWidth(model.collected, model.total, GAME_WIDTH));

    // Light the counter up when it goes up, but not on the first frame of a
    // room, when "going up" only means "was never drawn before".
    if (this.lastCollected >= 0 && model.collected > this.lastCollected) {
      this.counterFlashMs = COUNTER_FLASH_MS;
    }
    this.lastCollected = model.collected;
    this.counterFlashMs = Math.max(0, this.counterFlashMs - deltaMs);

    if (this.lastLives >= 0 && model.lives > this.lastLives) {
      this.newLifeBlinkMs = NEW_LIFE_BLINK_MS;
    }
    this.lastLives = model.lives;
    this.newLifeBlinkMs = Math.max(0, this.newLifeBlinkMs - deltaMs);

    if (this.message !== null) {
      this.nameLabel.setText(this.message).setColour(this.messageColour);
    } else {
      this.nameLabel.setText(model.roomName.toUpperCase()).setColour(model.accent);
    }

    const collected = String(model.collected).padStart(2, '0');
    const total = String(model.total).padStart(2, '0');
    this.itemsLabel.setText(`ITEMS ${collected}/${total}`);
    this.itemsLabel.setColour(this.counterFlashMs > 0 ? 'W' : 'Y');
    this.timeLabel.setText(`TIME ${formatDuration(model.elapsedMs)}`);
    this.muteLabel.setText(model.muted ? 'MUTE' : '');

    const newest = model.lives - 1;
    const blinkOff = this.newLifeBlinkMs > 0 && Math.floor(this.newLifeBlinkMs / 120) % 2 === 0;
    this.lifeIcons.forEach((icon, index) =>
      icon.setVisible(index < model.lives && !(index === newest && blinkOff)),
    );
    for (const [lock, icon] of this.keyIcons) icon.setVisible(model.keys.has(lock));
  }

  destroy(): void {
    this.chrome.destroy();
    this.nameLabel.destroy();
    this.itemsLabel.destroy();
    this.timeLabel.destroy();
    this.muteLabel.destroy();
    for (const icon of this.lifeIcons) icon.destroy();
    for (const icon of this.keyIcons.values()) icon.destroy();
    this.keyIcons.clear();
    if (this.scene.textures.exists(LIFE_ICON_KEY)) this.scene.textures.remove(LIFE_ICON_KEY);
    for (const lock of LOCK_COLOURS) {
      if (this.scene.textures.exists(keyIconKey(lock)))
        this.scene.textures.remove(keyIconKey(lock));
    }
  }
}
