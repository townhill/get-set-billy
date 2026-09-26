import { describe, expect, it } from 'vitest';
import { PLAY_HEIGHT, PLAY_WIDTH } from '../src/config';
import { BACKDROPS, BACKDROP_NAMES, backdropFor } from '../src/assets/backdrops';
import {
  DEEP_SHADES,
  ITEM_FLASH_COLOURS,
  LOCK_INKS,
  PALETTE,
  isDeepShade,
} from '../src/assets/palette';
import { THEMES } from '../src/assets/themes';
import * as sprites from '../src/assets/sprites';
import * as tileArt from '../src/assets/tileArt';
import { brightInk } from '../src/render/textures';
import { progressWidth } from '../src/ui/Hud';
import {
  ALL_OBITUARIES,
  ENEMY_OBITUARIES,
  HAZARD_OBITUARIES,
  obituary,
} from '../src/state/obituaries';
import { GLYPHS } from '../src/assets/font';
import { TILES } from '../src/world/tiles';

/**
 * The deep shades let every room have a back wall. They are only safe to use
 * because nothing in front of that wall is ever drawn in one — these tests are
 * what keeps that true.
 */

/** Every string anywhere inside a value: art rows, mostly. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) strings(item, out);
  else if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) strings(item, out);
  }
  return out;
}

const channels = (css: string): number[] => {
  const value = parseInt(css.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
};

describe('the deep shades', () => {
  it('are all in the palette, and all dark', () => {
    for (const key of DEEP_SHADES) {
      const css = PALETTE[key];
      expect(css, key).not.toBeNull();
      expect(
        Math.max(...channels(css as string)),
        `${key} is too bright for a back wall`,
      ).toBeLessThanOrEqual(0x40);
    }
  });

  it('are never an ink for anything in the foreground of a theme', () => {
    for (const [name, theme] of Object.entries(THEMES)) {
      for (const [field, value] of Object.entries(theme)) {
        if (field.startsWith('backdrop') || typeof value !== 'string') continue;
        expect(isDeepShade(value), `${name}.${field} is a backdrop shade`).toBe(false);
      }
    }
  });

  it('are never drawn into a sprite or a tile', () => {
    const art = [...strings(Object.values(sprites)), ...strings(Object.values(tileArt))];
    for (const row of art) {
      for (const key of DEEP_SHADES)
        expect(row.includes(key), `"${row}" uses "${key}"`).toBe(false);
    }
  });

  it('are never what a collectable, a key or a gate is drawn in', () => {
    for (const key of ITEM_FLASH_COLOURS) expect(isDeepShade(key)).toBe(false);
    for (const inks of Object.values(LOCK_INKS)) {
      for (const key of inks) expect(isDeepShade(key)).toBe(false);
    }
  });
});

describe('the backdrops', () => {
  it('are named by every theme, and every name is one that exists', () => {
    for (const [name, theme] of Object.entries(THEMES)) {
      expect(BACKDROP_NAMES, `${name} has an unknown backdrop`).toContain(theme.backdrop);
      expect(isDeepShade(theme.backdropInk), `${name} backdrop ink`).toBe(true);
      expect(isDeepShade(theme.backdropShade), `${name} backdrop shade`).toBe(true);
    }
  });

  it.each(Object.keys(BACKDROPS))('%s answers for every pixel, and draws something', (name) => {
    const backdrop = backdropFor(name);
    const seen = new Set<string>();
    for (let y = 0; y < PLAY_HEIGHT; y++) {
      for (let x = 0; x < PLAY_WIDTH; x++) seen.add(backdrop(x, y));
    }
    for (const value of seen) expect(['1', '2', '.']).toContain(value);
    expect(seen.has('1'), `${name} is blank`).toBe(true);
  });

  it('are the same every time they are painted', () => {
    for (const name of BACKDROP_NAMES) {
      const backdrop = backdropFor(name);
      for (const [x, y] of [
        [0, 0],
        [17, 93],
        [255, 159],
      ]) {
        expect(backdrop(x, y)).toBe(backdrop(x, y));
      }
    }
  });

  it('fall back to plain black for a name nobody has drawn', () => {
    expect(backdropFor('no-such-wallpaper')(10, 10)).toBe('.');
  });
});

describe('the lit top of a wall', () => {
  it('uses the bright version of a dim colour, and leaves a bright one alone', () => {
    expect(brightInk('r')).toBe('R');
    expect(brightInk('y')).toBe('Y');
    expect(brightInk('W')).toBe('W');
    expect(brightInk('k')).toBe('K');
  });
});

describe('the progress line in the status panel', () => {
  it('is empty with nothing found and full with everything', () => {
    expect(progressWidth(0, 37, 256)).toBe(0);
    expect(progressWidth(37, 37, 256)).toBe(256);
  });

  it('never looks finished while something is still missing', () => {
    expect(progressWidth(36, 37, 256)).toBeLessThan(256);
    expect(progressWidth(255, 256, 256)).toBeLessThan(256);
  });

  it('copes with a house that has nothing in it', () => {
    expect(progressWidth(0, 0, 256)).toBe(0);
  });
});

describe('obituaries', () => {
  it('have a line for every resident of the house', () => {
    for (const name of Object.keys(sprites.ENEMY_SPRITES)) {
      expect(ENEMY_OBITUARIES[name], `nothing to say about ${name}`).toBeDefined();
    }
  });

  it('have a line for every tile that can kill', () => {
    for (const tile of Object.values(TILES)) {
      if (tile.hazard === null) continue;
      expect(HAZARD_OBITUARIES[tile.char], `nothing to say about ${tile.name}`).toBeDefined();
    }
  });

  it('all fit the status panel, in letters the typeface has', () => {
    for (const line of ALL_OBITUARIES) {
      expect(line.length, line).toBeLessThanOrEqual(42);
      for (const char of line)
        expect(Object.keys(GLYPHS), `"${char}" in "${line}"`).toContain(char);
    }
  });

  it('say something even about a death nobody wrote a line for', () => {
    expect(obituary({ kind: 'enemy', sprite: 'unheard-of' })).toBeTruthy();
    expect(obituary({ kind: 'hazard', tile: null })).toBeTruthy();
  });
});
