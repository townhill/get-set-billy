import type Phaser from 'phaser';
import { GAME_WIDTH, HUD_HEIGHT, PLAY_HEIGHT } from '../config';
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
const MAX_LIFE_ICONS = 6;
/** Each lock gets a fixed slot, so a key never moves once you have it. */
const KEY_ICON_X = 156;
const KEY_ICON_GAP = 8;
const keyIconKey = (lock: LockColour): string => `hud-key-${lock}`;
const PANEL_TOP = PLAY_HEIGHT;
const NAME_Y = PANEL_TOP + 5;
const STATS_Y = PANEL_TOP + 18;

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
  private accent: PaletteKey = 'W';

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
    this.chrome.fillStyle(0x000000, 1);
    this.chrome.fillRect(0, PANEL_TOP, GAME_WIDTH, HUD_HEIGHT);
    this.chrome.fillStyle(0x40e8ff, 1);
    this.chrome.fillRect(0, PANEL_TOP, GAME_WIDTH, 1);
    this.chrome.fillRect(0, PANEL_TOP + 14, GAME_WIDTH, 1);

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
        .image(96 + i * 10, STATS_Y - 1, LIFE_ICON_KEY)
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

  /** Replaces the room name with a temporary line, for the given number of ms. */
  say(message: string, durationMs = 1500, colour: PaletteKey = 'Y'): void {
    this.message = message;
    this.messageMs = durationMs;
    this.messageColour = colour;
  }

  update(model: HudModel, deltaMs: number): void {
    if (this.messageMs > 0) {
      this.messageMs -= deltaMs;
      if (this.messageMs <= 0) this.message = null;
    }

    if (this.accent !== model.accent) {
      this.accent = model.accent;
      const rgb = paletteColour(model.accent) ?? '#ffffff';
      this.chrome.clear();
      this.chrome.fillStyle(0x000000, 1);
      this.chrome.fillRect(0, PANEL_TOP, GAME_WIDTH, HUD_HEIGHT);
      this.chrome.fillStyle(parseInt(rgb.slice(1), 16), 1);
      this.chrome.fillRect(0, PANEL_TOP, GAME_WIDTH, 1);
      this.chrome.fillRect(0, PANEL_TOP + 14, GAME_WIDTH, 1);
    }

    if (this.message !== null) {
      this.nameLabel.setText(this.message).setColour(this.messageColour);
    } else {
      this.nameLabel.setText(model.roomName.toUpperCase()).setColour(model.accent);
    }

    const collected = String(model.collected).padStart(2, '0');
    const total = String(model.total).padStart(2, '0');
    this.itemsLabel.setText(`ITEMS ${collected}/${total}`);
    this.timeLabel.setText(`TIME ${formatDuration(model.elapsedMs)}`);
    this.muteLabel.setText(model.muted ? 'MUTE' : '');

    this.lifeIcons.forEach((icon, index) => icon.setVisible(index < model.lives));
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
