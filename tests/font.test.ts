import { describe, expect, it } from 'vitest';
import { GLYPHS, GLYPH_HEIGHT, GLYPH_WIDTH, glyphRows, measureText } from '../src/assets/font';
import {
  ITEM_SPRITES,
  ENEMY_SPRITES,
  DOOR_ART,
  DOOR_HEIGHT,
  DOOR_WIDTH,
} from '../src/assets/sprites';
import {
  CONVEYOR_ART,
  CRUMBLE_ART,
  DECOR_ART,
  GATE_ART,
  HATCH_ART,
  LEDGE_ART,
  LEVER_ART,
  LIFT_ART,
  TELEPORT_ART,
  WALL_ART,
} from '../src/assets/tileArt';
import { TILE_SIZE } from '../src/config';

/**
 * The artwork is hand-typed, so these check the shape of it. A row with a
 * character too many is invisible in the source and very visible on screen.
 */

describe('the typeface', () => {
  it('draws every glyph on the same tiny grid', () => {
    for (const [char, encoded] of Object.entries(GLYPHS)) {
      const rows = encoded.split('/');
      expect(rows, `glyph "${char}" is the wrong height`).toHaveLength(GLYPH_HEIGHT);
      for (const row of rows) {
        expect(row, `glyph "${char}" has a bad row`).toHaveLength(GLYPH_WIDTH);
        expect(/^[01]+$/.test(row), `glyph "${char}" has a bad row`).toBe(true);
      }
    }
  });

  it('covers everything the game actually prints', () => {
    for (const char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:;!?\'"-_+=*/()[]<>%#@') {
      expect(Object.keys(GLYPHS)).toContain(char);
    }
  });

  it('folds lower case up rather than showing a blank', () => {
    expect(glyphRows('a')).toEqual(glyphRows('A'));
  });

  it('falls back to a blank for anything it has never met', () => {
    expect(glyphRows('é')).toEqual(glyphRows(' '));
  });

  it('measures a string the same way it draws one', () => {
    expect(measureText('')).toBe(0);
    expect(measureText('A')).toBe(GLYPH_WIDTH);
    expect(measureText('AB')).toBe(GLYPH_WIDTH + 6);
    expect(measureText('AB', 2)).toBe((GLYPH_WIDTH + 6) * 2);
  });

  it('fits a full line of text on the screen', () => {
    expect(measureText('X'.repeat(42))).toBeLessThanOrEqual(256);
  });
});

function checkArt(name: string, art: readonly string[], width: number, height: number): void {
  expect(art, `${name} is the wrong height`).toHaveLength(height);
  for (const row of art) expect(row, `${name} has a bad row: "${row}"`).toHaveLength(width);
}

describe('the artwork', () => {
  it('draws every tile at exactly one cell', () => {
    for (const [name, art] of Object.entries(WALL_ART)) checkArt(name, art, TILE_SIZE, TILE_SIZE);
    for (const [name, art] of Object.entries(LEDGE_ART)) checkArt(name, art, TILE_SIZE, TILE_SIZE);
    for (const [name, art] of Object.entries(DECOR_ART)) checkArt(name, art, TILE_SIZE, TILE_SIZE);
    CONVEYOR_ART.forEach((art, i) => checkArt(`conveyor ${i}`, art, TILE_SIZE, TILE_SIZE));
    CRUMBLE_ART.forEach((art, i) => checkArt(`crumble ${i}`, art, TILE_SIZE, TILE_SIZE));
    GATE_ART.forEach((art, i) => checkArt(`gate ${i}`, art, TILE_SIZE, TILE_SIZE));
    LIFT_ART.forEach((art, i) => checkArt(`lift ${i}`, art, TILE_SIZE, TILE_SIZE));
    LEVER_ART.forEach((art, i) => checkArt(`lever ${i}`, art, TILE_SIZE, TILE_SIZE));
    TELEPORT_ART.forEach((art, i) => checkArt(`teleport ${i}`, art, TILE_SIZE, TILE_SIZE));
    checkArt('hatch', HATCH_ART, TILE_SIZE, TILE_SIZE);
  });

  it('draws every collectable at exactly one cell', () => {
    for (const [name, art] of Object.entries(ITEM_SPRITES))
      checkArt(name, art, TILE_SIZE, TILE_SIZE);
  });

  it('gives every enemy frames that are all the same size', () => {
    for (const [name, def] of Object.entries(ENEMY_SPRITES)) {
      expect(def.frames.length, `${name} has no frames`).toBeGreaterThan(0);
      for (const frame of def.frames) checkArt(name, frame, def.width, def.height);
      expect(def.frameMs).toBeGreaterThan(0);
    }
  });

  it('draws the door at the size the collision box assumes', () => {
    checkArt('door', DOOR_ART, DOOR_WIDTH, DOOR_HEIGHT);
  });
});
