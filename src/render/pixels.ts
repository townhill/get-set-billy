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
