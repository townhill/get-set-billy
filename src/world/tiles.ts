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

/**
 * The four kinds of key in the house, and therefore the four kinds of gate.
 *
 * A key is never spent and never dropped: picking one up opens every gate of
 * that colour, everywhere, for good. That removes the whole class of dead end
 * where a player uses a key on the wrong door and strands themselves.
 */
export const LOCK_COLOURS = ['brass', 'silver', 'iron', 'copper'] as const;

export type LockColour = (typeof LOCK_COLOURS)[number];

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
  /** The key that opens this cell, or null if it is not a gate. */
  lock: LockColour | null;
  /** Touching this cell flips the room's switch. */
  lever: boolean;
  /**
   * A hatch: a ledge that is only there while the room's switch is in this
   * position. Null for everything that is not a hatch.
   *
   * A ledge rather than a wall, deliberately. A hatch can then never wall a
   * player in, and can never block a climb that was working before, because a
   * one-way platform does not stop anything moving upwards.
   */
  shutter: boolean | null;
}

const EMPTY: Omit<TileDef, 'char' | 'name'> = {
  solid: false,
  platform: false,
  hazard: null,
  conveyor: 0,
  crumbles: false,
  lock: null,
  lever: false,
  shutter: null,
};

/** A gate: solid until you hold its key, and plain air the moment you do. */
const gate = (char: string, lock: LockColour): TileDef => ({
  char,
  name: `${lock} gate`,
  ...EMPTY,
  solid: true,
  lock,
});

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
  B: gate('B', 'brass'),
  S: gate('S', 'silver'),
  I: gate('I', 'iron'),
  C: gate('C', 'copper'),
  '!': { char: '!', name: 'lever', ...EMPTY, lever: true },
  '[': { char: '[', name: 'hatch (shut at first)', ...EMPTY, platform: true, shutter: false },
  ']': { char: ']', name: 'hatch (open at first)', ...EMPTY, platform: true, shutter: true },
};

export const AIR = TILES['.'];

export function tileDef(char: string): TileDef {
  return TILES[char] ?? AIR;
}

/** The key a cell needs, or null if it is not a gate. */
export function lockColour(char: string): LockColour | null {
  return tileDef(char).lock;
}

/** True when a cell is a shutter that is solid with the switch in this position. */
export function shutterFor(char: string): boolean | null {
  return tileDef(char).shutter;
}

export function isLever(char: string): boolean {
  return tileDef(char).lever;
}

/** The tile character for each gate colour, for tests and documentation. */
export const GATE_CHARS: Readonly<Record<LockColour, string>> = Object.fromEntries(
  LOCK_COLOURS.map((lock) => [
    lock,
    Object.values(TILES).find((tile) => tile.lock === lock)?.char ?? '?',
  ]),
) as Record<LockColour, string>;

export function isKnownTile(char: string): boolean {
  return Object.hasOwn(TILES, char);
}

/** Every legal character, handy for validation and documentation. */
export const TILE_CHARS: readonly string[] = Object.keys(TILES);
