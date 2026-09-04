import type { PaletteKey } from './palette';

/**
 * A theme is the colour scheme and tile-shape choice for one kind of room.
 *
 * Rooms name a theme rather than listing colours, so a new room gets a coherent
 * look for free, and so the whole house can be recoloured from one table.
 */
export interface ThemeDef {
  /** Key into WALL_ART. */
  wall: string;
  wallInk: PaletteKey;
  wallShade: PaletteKey;

  /** Key into LEDGE_ART. */
  ledge: string;
  ledgeInk: PaletteKey;
  ledgeShade: PaletteKey;

  /** Art and ink for the ',' and ':' decoration cells. */
  decor: string;
  decorInk: PaletteKey;
  decorTwo: string;
  decorTwoInk: PaletteKey;

  /** Room background, and the inks used for hazards and conveyors. */
  background: PaletteKey;
  hazardInk: PaletteKey;
  liquidInk: PaletteKey;
  liquidShade: PaletteKey;
  conveyorInk: PaletteKey;
  conveyorShade: PaletteKey;
  crumbleInk: PaletteKey;
  crumbleShade: PaletteKey;

  /**
   * Three notes, played on the way in.
   *
   * A theme is what a room is like, and what a room is like includes what it
   * sounds like when the door shuts behind you. Semitones relative to a middle
   * A, so the table stays readable as music rather than as frequencies.
   */
  sting: readonly [number, number, number];
}

const base = {
  background: 'k',
  hazardInk: 'W',
  liquidInk: 'b',
  liquidShade: 'C',
  conveyorInk: 'w',
  conveyorShade: 'K',
  crumbleInk: 'y',
  crumbleShade: 'r',
  sting: [0, 4, 7],
} satisfies Partial<ThemeDef>;

export const THEMES: Readonly<Record<string, ThemeDef>> = {
  hall: {
    ...base,
    sting: [0, 4, 7],
    wall: 'panel',
    wallInk: 'r',
    wallShade: 'y',
    ledge: 'beam',
    ledgeInk: 'Y',
    ledgeShade: 'y',
    decor: 'portrait',
    decorInk: 'Y',
    decorTwo: 'sconce',
    decorTwoInk: 'Y',
  },
  library: {
    ...base,
    sting: [0, 3, 7],
    wall: 'shelving',
    wallInk: 'y',
    wallShade: 'r',
    ledge: 'shelf',
    ledgeInk: 'Y',
    ledgeShade: 'r',
    decor: 'cobweb',
    decorInk: 'w',
    decorTwo: 'bottle',
    decorTwoInk: 'G',
  },
  attic: {
    ...base,
    sting: [0, 5, 12],
    wall: 'plank',
    wallInk: 'y',
    wallShade: 'K',
    ledge: 'beam',
    ledgeInk: 'w',
    ledgeShade: 'K',
    decor: 'cobweb',
    decorInk: 'W',
    decorTwo: 'crack',
    decorTwoInk: 'w',
  },
  boiler: {
    ...base,
    sting: [-12, -8, -5],
    wall: 'riveted',
    wallInk: 'r',
    wallShade: 'K',
    ledge: 'pipe',
    ledgeInk: 'R',
    ledgeShade: 'y',
    decor: 'ducting',
    decorInk: 'Y',
    decorTwo: 'gear',
    decorTwoInk: 'R',
    liquidInk: 'r',
    liquidShade: 'Y',
    conveyorInk: 'y',
    conveyorShade: 'r',
  },
  conservatory: {
    ...base,
    sting: [2, 7, 11],
    wall: 'glazing',
    wallInk: 'c',
    wallShade: 'C',
    ledge: 'rail',
    ledgeInk: 'G',
    ledgeShade: 'g',
    // Deliberately not a plant: the ferns in here move, and a decoration that
    // looks like an enemy is just a trap you cannot see coming.
    decor: 'window',
    decorInk: 'C',
    decorTwo: 'star',
    decorTwoInk: 'W',
  },
  clock: {
    ...base,
    sting: [0, 6, 12],
    wall: 'panel',
    wallInk: 'y',
    wallShade: 'K',
    ledge: 'beam',
    ledgeInk: 'Y',
    ledgeShade: 'y',
    decor: 'clockface',
    decorInk: 'W',
    decorTwo: 'gear',
    decorTwoInk: 'Y',
  },
  corridor: {
    ...base,
    sting: [0, 2, 4],
    wall: 'brick',
    wallInk: 'b',
    wallShade: 'K',
    ledge: 'ledge',
    ledgeInk: 'C',
    ledgeShade: 'b',
    decor: 'sconce',
    decorInk: 'Y',
    decorTwo: 'crack',
    decorTwoInk: 'w',
  },
  laboratory: {
    ...base,
    sting: [1, 6, 10],
    wall: 'riveted',
    wallInk: 'm',
    wallShade: 'K',
    ledge: 'rail',
    ledgeInk: 'C',
    ledgeShade: 'b',
    decor: 'bottle',
    decorInk: 'G',
    decorTwo: 'gear',
    decorTwoInk: 'M',
    liquidInk: 'm',
    liquidShade: 'M',
    conveyorInk: 'c',
    conveyorShade: 'b',
  },
  roof: {
    ...base,
    sting: [7, 12, 16],
    wall: 'stone',
    wallInk: 'b',
    wallShade: 'K',
    ledge: 'ledge',
    ledgeInk: 'w',
    ledgeShade: 'b',
    decor: 'star',
    decorInk: 'Y',
    decorTwo: 'moon',
    decorTwoInk: 'W',
  },
  cellar: {
    ...base,
    sting: [-12, -9, -5],
    wall: 'rubble',
    wallInk: 'g',
    wallShade: 'K',
    ledge: 'ledge',
    ledgeInk: 'w',
    ledgeShade: 'g',
    decor: 'bottle',
    decorInk: 'R',
    decorTwo: 'cobweb',
    decorTwoInk: 'w',
    liquidInk: 'm',
    liquidShade: 'M',
  },
  gallery: {
    ...base,
    sting: [0, 4, 9],
    wall: 'panel',
    wallInk: 'm',
    wallShade: 'K',
    ledge: 'beam',
    ledgeInk: 'Y',
    ledgeShade: 'm',
    decor: 'portrait',
    decorInk: 'W',
    decorTwo: 'sconce',
    decorTwoInk: 'Y',
  },
  kitchen: {
    ...base,
    sting: [0, 5, 9],
    wall: 'chequer',
    wallInk: 'w',
    wallShade: 'c',
    ledge: 'shelf',
    ledgeInk: 'W',
    ledgeShade: 'c',
    decor: 'bottle',
    decorInk: 'C',
    decorTwo: 'window',
    decorTwoInk: 'W',
    conveyorInk: 'W',
    conveyorShade: 'c',
  },
  billiards: {
    ...base,
    sting: [-5, 0, 4],
    wall: 'panel',
    wallInk: 'g',
    wallShade: 'K',
    ledge: 'beam',
    ledgeInk: 'y',
    ledgeShade: 'g',
    decor: 'portrait',
    decorInk: 'G',
    decorTwo: 'sconce',
    decorTwoInk: 'Y',
  },
  landing: {
    ...base,
    sting: [0, 3, 5],
    wall: 'plank',
    wallInk: 'c',
    wallShade: 'K',
    ledge: 'beam',
    ledgeInk: 'Y',
    ledgeShade: 'c',
    decor: 'portrait',
    decorInk: 'C',
    decorTwo: 'cobweb',
    decorTwoInk: 'w',
  },
  chimney: {
    ...base,
    sting: [7, 11, 14],
    wall: 'brick',
    wallInk: 'r',
    wallShade: 'K',
    ledge: 'ledge',
    ledgeInk: 'w',
    ledgeShade: 'r',
    decor: 'moon',
    decorInk: 'W',
    decorTwo: 'star',
    decorTwoInk: 'Y',
  },
  scullery: {
    ...base,
    sting: [-5, 0, 5],
    wall: 'chequer',
    wallInk: 'c',
    wallShade: 'b',
    ledge: 'shelf',
    ledgeInk: 'W',
    ledgeShade: 'b',
    decor: 'bottle',
    decorInk: 'C',
    decorTwo: 'ducting',
    decorTwoInk: 'w',
    liquidInk: 'c',
    liquidShade: 'C',
    conveyorInk: 'W',
    conveyorShade: 'b',
  },
  organ: {
    ...base,
    sting: [0, 7, 12],
    wall: 'panel',
    wallInk: 'y',
    wallShade: 'r',
    // The ledges are the pipes, which is the whole joke of the room.
    ledge: 'pipe',
    ledgeInk: 'W',
    ledgeShade: 'w',
    decor: 'sconce',
    decorInk: 'Y',
    decorTwo: 'portrait',
    decorTwoInk: 'M',
  },
  bathroom: {
    ...base,
    sting: [4, 9, 12],
    wall: 'chequer',
    wallInk: 'w',
    wallShade: 'C',
    ledge: 'rail',
    ledgeInk: 'C',
    ledgeShade: 'w',
    decor: 'window',
    decorInk: 'W',
    decorTwo: 'crack',
    decorTwoInk: 'c',
    liquidInk: 'c',
    liquidShade: 'C',
  },
  aviary: {
    ...base,
    sting: [5, 9, 14],
    wall: 'glazing',
    wallInk: 'g',
    wallShade: 'G',
    // The one room where a plant is safe to draw: everything that moves in
    // here is plainly a bird.
    decor: 'plant',
    decorInk: 'G',
    ledge: 'rail',
    ledgeInk: 'Y',
    ledgeShade: 'g',
    decorTwo: 'star',
    decorTwoInk: 'C',
  },
};

export const DEFAULT_THEME = THEMES.hall;

export function themeFor(name: string): ThemeDef {
  return THEMES[name] ?? DEFAULT_THEME;
}
