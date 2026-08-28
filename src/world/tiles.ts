/**
 * The complete vocabulary of the house.
 *
 * A room's geometry is 20 lines of 32 characters, and every character is one of
 * the tiles below. Keeping this table small is deliberate: a room should be
 * readable as text, and a new room should be authorable without touching code.
 *
 * This module is pure data and pure functions, so the level-design invariants
 * can be unit tested without a browser.
 */

/** A rectangle in tile-local pixel coordinates (0,0 is the tile's top-left). */
export interface HazardRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TileDef {
  /** The character used in room data. */
  char: string;
  /** Human name, shown by the debug overlay. */
  name: string;
  /** Blocks movement from every direction. */
  solid: boolean;
  /** Blocks downward movement only: you can jump up through it. */
  platform: boolean;
  /** Kills on contact within this sub-rectangle of the cell, or null if harmless. */
  hazard: HazardRect | null;
  /** -1 pushes left, +1 pushes right, 0 does not push. */
  conveyor: -1 | 0 | 1;
  /** Collapses shortly after being stood on. */
  crumbles: boolean;
}

const EMPTY: Omit<TileDef, 'char' | 'name'> = {
  solid: false,
  platform: false,
  hazard: null,
  conveyor: 0,
  crumbles: false,
};

export const TILES: Readonly<Record<string, TileDef>> = {
  '.': { char: '.', name: 'air', ...EMPTY },
  ',': { char: ',', name: 'decoration', ...EMPTY },
  ':': { char: ':', name: 'decoration two', ...EMPTY },
  '#': { char: '#', name: 'wall', ...EMPTY, solid: true },
  '=': { char: '=', name: 'ledge', ...EMPTY, platform: true },
  '%': { char: '%', name: 'crumbling ledge', ...EMPTY, platform: true, crumbles: true },
  '<': { char: '<', name: 'conveyor (left)', ...EMPTY, platform: true, conveyor: -1 },
  '>': { char: '>', name: 'conveyor (right)', ...EMPTY, platform: true, conveyor: 1 },
  '^': { char: '^', name: 'spikes', ...EMPTY, hazard: { x: 0, y: 3, w: 8, h: 5 } },
  v: { char: 'v', name: 'ceiling spikes', ...EMPTY, hazard: { x: 0, y: 0, w: 8, h: 5 } },
  '~': { char: '~', name: 'something wet', ...EMPTY, hazard: { x: 0, y: 1, w: 8, h: 7 } },
  '*': { char: '*', name: 'unpleasantness', ...EMPTY, hazard: { x: 1, y: 1, w: 6, h: 6 } },
};

export const AIR = TILES['.'];

export function tileDef(char: string): TileDef {
  return TILES[char] ?? AIR;
}

export function isKnownTile(char: string): boolean {
  return Object.hasOwn(TILES, char);
}

/** Every legal character, handy for validation and documentation. */
export const TILE_CHARS: readonly string[] = Object.keys(TILES);
