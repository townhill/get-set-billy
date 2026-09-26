import { paletteColour } from '../assets/palette';
import { GLYPH_ADVANCE, LINE_HEIGHT, glyphRows } from '../assets/font';

/**
 * Low-level pixel plotting onto a 2D canvas.
 *
 * Everything visible in the game is painted through these helpers, one logical
 * pixel at a time, which is why nothing in the project depends on an image file.
 */

/** Maps a single art character to a CSS colour, or null for "leave transparent". */
export type ColourResolver = (ch: string) => string | null;

/** Art is a rectangular block of single-character pixels. */
export type Art = readonly string[];

/** Resolves art characters straight through the shared palette. */
export const paletteResolver: ColourResolver = (ch) => paletteColour(ch);

/**
 * Builds a resolver that first consults a local override map (used by room
 * themes, which paint the same tile shapes in different colours) and otherwise
 * falls back to the palette.
 */
export function themedResolver(overrides: Readonly<Record<string, string>>): ColourResolver {
  return (ch) => {
    const local = overrides[ch];
    if (local !== undefined) return paletteColour(local) ?? local;
    return paletteColour(ch);
  };
}

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/** Paints a block of art at (ox, oy), one filled rectangle per logical pixel. */
export function paintArt(
  ctx: CanvasRenderingContext2D,
  art: Art,
  ox: number,
  oy: number,
  resolve: ColourResolver = paletteResolver,
  scale = 1,
): void {
  for (let row = 0; row < art.length; row++) {
    const line = art[row];
    for (let col = 0; col < line.length; col++) {
      const colour = resolve(line[col]);
      if (colour === null) continue;
      ctx.fillStyle = colour;
      ctx.fillRect(ox + col * scale, oy + row * scale, scale, scale);
    }
  }
}

/**
 * Fills a whole rectangle from a function of each pixel's position.
 *
 * Written straight into a fresh ImageData rather than one fillRect per pixel,
 * because a backdrop is forty thousand pixels and a room change should not
 * stutter. Fresh rather than read back from the canvas, because reading a
 * canvas back is the slow part. Pixels the function returns null for get
 * `fallback`, so this is always the first thing painted.
 */
export function paintField(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colourAt: (x: number, y: number) => string | null,
  fallback: string,
): void {
  const image = ctx.createImageData(width, height);
  const data = image.data;
  const rgb = new Map<string, [number, number, number]>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const css = colourAt(x, y) ?? fallback;
      let channels = rgb.get(css);
      if (channels === undefined) {
        const value = parseInt(css.slice(1), 16);
        channels = [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
        rgb.set(css, channels);
      }
      const at = (y * width + x) * 4;
      data[at] = channels[0];
      data[at + 1] = channels[1];
      data[at + 2] = channels[2];
      data[at + 3] = 0xff;
    }
  }
  ctx.putImageData(image, 0, 0);
}

/**
 * A solid silhouette of a canvas: every pixel that is not transparent, in one
 * colour. Used for the shadows things cast on the wall behind them.
 */
export function silhouetteOf(source: HTMLCanvasElement, colour = '#000000'): HTMLCanvasElement {
  const canvas = createCanvas(source.width, source.height);
  const ctx = context2d(canvas);
  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Renders a block of art into a brand new canvas sized to fit it. */
export function artToCanvas(
  art: Art,
  resolve: ColourResolver = paletteResolver,
  scale = 1,
): HTMLCanvasElement {
  const height = art.length;
  const width = art.reduce((max, row) => Math.max(max, row.length), 0);
  const canvas = createCanvas(width * scale, height * scale);
  paintArt(context2d(canvas), art, 0, 0, resolve, scale);
  return canvas;
}

/** Draws a single line of text in the project's own 5x7 typeface. */
export function paintText(
  ctx: CanvasRenderingContext2D,
  text: string,
  ox: number,
  oy: number,
  colour: string,
  scale = 1,
): void {
  ctx.fillStyle = colour;
  for (let i = 0; i < text.length; i++) {
    const rows = glyphRows(text[i]);
    const gx = ox + i * GLYPH_ADVANCE * scale;
    for (let row = 0; row < rows.length; row++) {
      const bits = rows[row];
      for (let col = 0; col < bits.length; col++) {
        if (bits[col] === '1') {
          ctx.fillRect(gx + col * scale, oy + row * scale, scale, scale);
        }
      }
    }
  }
}

/** Draws several lines of text, advancing by the font's line height. */
export function paintLines(
  ctx: CanvasRenderingContext2D,
  lines: readonly string[],
  ox: number,
  oy: number,
  colour: string,
  scale = 1,
): void {
  lines.forEach((line, i) => {
    paintText(ctx, line, ox, oy + i * LINE_HEIGHT * scale, colour, scale);
  });
}
