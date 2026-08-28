/**
 * A deliberately tiny palette, in the spirit of an 8-bit home computer:
 * eight hues, each in a normal and a bright version, plus black.
 *
 * These are our own colour values, chosen to look right on a modern display
 * rather than to reproduce any particular machine's output.
 *
 * Art throughout the project is written as strings of these single-character
 * keys, so a sprite is readable as text in the source file.
 */
export const PALETTE = {
  '.': null, // transparent
  k: '#000000', // black
  b: '#0026c4', // blue
  r: '#c40026', // red
  m: '#c400c4', // magenta
  g: '#00a626', // green
  c: '#00b0c4', // cyan
  y: '#c4a600', // yellow (dim: a mustard, very of-the-period)
  w: '#b8b8b8', // white (dim: grey)
  K: '#181818', // "bright" black: near-black, useful for shading
  B: '#3050ff', // bright blue
  R: '#ff3040', // bright red
  M: '#ff50ff', // bright magenta
  G: '#40e050', // bright green
  C: '#40e8ff', // bright cyan
  Y: '#ffe040', // bright yellow
  W: '#ffffff', // bright white
} as const;

export type PaletteKey = keyof typeof PALETTE;

/** The colours items flash through while waiting to be picked up. */
export const ITEM_FLASH_COLOURS: PaletteKey[] = ['Y', 'C', 'M', 'G', 'W', 'R'];

/** Colour used to draw the HUD panel's chrome. */
export const HUD_INK: PaletteKey = 'W';

export function paletteColour(key: string): string | null {
  return (PALETTE as Record<string, string | null>)[key] ?? null;
}

/** Convert a palette key to a 0xRRGGBB number, for Phaser tints and camera colours. */
export function paletteHex(key: PaletteKey): number {
  const css = PALETTE[key];
  return css === null ? 0x000000 : parseInt(css.slice(1), 16);
}
