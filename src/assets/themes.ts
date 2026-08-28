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
} satisfies Partial<ThemeDef>;

export const THEMES: Readonly<Record<string, ThemeDef>> = {
  hall: {
    ...base,
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
};

export const DEFAULT_THEME = THEMES.hall;

export function themeFor(name: string): ThemeDef {
  return THEMES[name] ?? DEFAULT_THEME;
}
