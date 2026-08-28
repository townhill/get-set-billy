import type Phaser from 'phaser';
import { GLYPH_ADVANCE, GLYPH_HEIGHT, LINE_HEIGHT, measureText } from '../assets/font';
import { PALETTE, type PaletteKey } from '../assets/palette';
import { paintText } from './pixels';

/**
 * A line (or block) of text in the project's own typeface, drawn into a canvas
 * texture and shown as a plain image.
 *
 * Each instance owns exactly one texture and repaints it in place, so a HUD
 * that changes sixty times a second does not leak sixty textures a second.
 */

let nextId = 0;

export interface PixelTextOptions {
  x: number;
  y: number;
  /** Widest line this label will ever need to show. */
  maxChars: number;
  /** How many lines of text this label reserves room for. */
  lines?: number;
  colour?: PaletteKey;
  scale?: number;
  /** 0 left, 0.5 centred, 1 right, applied about `x`. */
  originX?: number;
  depth?: number;
}

export class PixelText {
  readonly image: Phaser.GameObjects.Image;
  private texture: Phaser.Textures.CanvasTexture;
  private readonly key: string;
  private readonly scale: number;
  private colour: string;
  private current: string[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    options: PixelTextOptions,
  ) {
    this.scale = options.scale ?? 1;
    this.colour = PALETTE[options.colour ?? 'W'] ?? '#ffffff';
    this.key = `pixeltext-${nextId++}`;

    this.texture = this.makeTexture(
      options.maxChars * GLYPH_ADVANCE * this.scale,
      (options.lines ?? 1) * LINE_HEIGHT * this.scale,
    );

    this.image = scene.add.image(options.x, options.y, this.key).setOrigin(options.originX ?? 0, 0);
    if (options.depth !== undefined) this.image.setDepth(options.depth);
  }

  private makeTexture(width: number, height: number): Phaser.Textures.CanvasTexture {
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
    const texture = this.scene.textures.createCanvas(
      this.key,
      Math.max(1, Math.ceil(width)),
      Math.max(1, Math.ceil(height)),
    );
    if (!texture) throw new Error('Could not create a canvas texture for text');
    return texture;
  }

  /**
   * Grows the canvas if the new text needs more room than the label was created
   * with. Cheaper than getting the character counts right by hand every time,
   * and it means a long room name can never be silently chopped off.
   */
  private ensureCapacity(lines: readonly string[]): void {
    const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
    const width = longest * GLYPH_ADVANCE * this.scale;
    const height = lines.length * LINE_HEIGHT * this.scale;
    if (width <= this.texture.width && height <= this.texture.height) return;

    this.texture = this.makeTexture(
      Math.max(width, this.texture.width),
      Math.max(height, this.texture.height),
    );
    this.image.setTexture(this.key);
  }

  /** Replaces the contents. Accepts a single string or several lines. */
  setText(text: string | readonly string[]): this {
    const lines = typeof text === 'string' ? [text] : [...text];
    if (
      lines.length === this.current.length &&
      lines.every((line, index) => line === this.current[index])
    ) {
      return this;
    }
    this.ensureCapacity(lines);
    this.current = lines;
    this.repaint();
    return this;
  }

  setColour(colour: PaletteKey): this {
    const css = PALETTE[colour] ?? '#ffffff';
    if (css === this.colour) return this;
    this.colour = css;
    this.repaint();
    return this;
  }

  setVisible(visible: boolean): this {
    this.image.setVisible(visible);
    return this;
  }

  /** Width in pixels of the widest line currently shown. */
  get displayWidth(): number {
    return this.current.reduce((max, line) => Math.max(max, measureText(line, this.scale)), 0);
  }

  private repaint(): void {
    const ctx = this.texture.context;
    ctx.clearRect(0, 0, this.texture.width, this.texture.height);
    ctx.imageSmoothingEnabled = false;
    this.current.forEach((line, index) => {
      paintText(ctx, line, 0, index * LINE_HEIGHT * this.scale, this.colour, this.scale);
    });
    this.texture.refresh();
  }

  destroy(): void {
    this.image.destroy();
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
  }
}

/** Convenience: a centred label, positioned by the middle of its first line. */
export function centredText(
  scene: Phaser.Scene,
  text: string,
  centreX: number,
  y: number,
  colour: PaletteKey = 'W',
  scale = 1,
): PixelText {
  const label = new PixelText(scene, {
    x: centreX,
    y,
    maxChars: text.length,
    colour,
    scale,
    originX: 0.5,
  });
  label.setText(text);
  return label;
}

export const TEXT_LINE_HEIGHT = LINE_HEIGHT;
export const TEXT_GLYPH_HEIGHT = GLYPH_HEIGHT;
