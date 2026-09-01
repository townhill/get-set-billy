import { describe, expect, it } from 'vitest';
import { PLAY_HEIGHT, PLAY_WIDTH } from '../src/config';
import { mapLayout } from '../src/ui/MapOverlay';
import { ALL_ROOM_DATA } from '../src/world/RoomManager';

/**
 * The map draws itself from the `grid` position every room already carries, so
 * the only thing here that can go wrong is the arithmetic — and it goes wrong
 * silently, by drawing a room off the edge of a 256x160 screen where nobody
 * will ever see it.
 *
 * These tests are about that, and about the fact that the house is expected to
 * grow: adding a room past the current edge of the map has to move the whole
 * grid rather than push one cell into the wall.
 */

describe('the map', () => {
  const cells = mapLayout(ALL_ROOM_DATA);

  it('gives every room a cell', () => {
    expect(cells).toHaveLength(ALL_ROOM_DATA.length);
    expect(new Set(cells.map((cell) => cell.id)).size).toBe(ALL_ROOM_DATA.length);
  });

  it('fits on the screen', () => {
    for (const cell of cells) {
      expect(cell.x, `${cell.id} runs off the left`).toBeGreaterThanOrEqual(0);
      expect(cell.y, `${cell.id} runs off the top`).toBeGreaterThanOrEqual(0);
      expect(cell.x + cell.width, `${cell.id} runs off the right`).toBeLessThanOrEqual(PLAY_WIDTH);
      expect(cell.y + cell.height, `${cell.id} runs off the bottom`).toBeLessThanOrEqual(
        PLAY_HEIGHT,
      );
    }
  });

  it('never overlaps two rooms', () => {
    const seen = new Set<string>();
    for (const cell of cells) {
      const key = `${cell.x},${cell.y}`;
      expect(seen.has(key), `${cell.id} is drawn on top of another room`).toBe(false);
      seen.add(key);
    }
  });

  it('keeps the shape of the house', () => {
    const byId = new Map(cells.map((cell) => [cell.id, cell]));
    for (const room of ALL_ROOM_DATA) {
      const here = byId.get(room.id);
      const right = room.exits.right === undefined ? undefined : byId.get(room.exits.right);
      const below = room.exits.down === undefined ? undefined : byId.get(room.exits.down);
      if (here && right) {
        expect(right.x, `${room.id} is not left of ${room.exits.right}`).toBeGreaterThan(here.x);
        expect(right.y).toBe(here.y);
      }
      if (here && below) {
        expect(below.y, `${room.id} is not above ${room.exits.down}`).toBeGreaterThan(here.y);
        expect(below.x).toBe(here.x);
      }
    }
  });

  it('recentres rather than overflowing when the house grows', () => {
    const grown = [
      ...ALL_ROOM_DATA.map((room) => ({ id: room.id, grid: room.grid })),
      { id: 'a-new-wing', grid: { x: -1, y: 0 } },
    ];
    const after = mapLayout(grown);
    for (const cell of after) {
      expect(cell.x, `${cell.id} runs off the left`).toBeGreaterThanOrEqual(0);
      expect(cell.x + cell.width, `${cell.id} runs off the right`).toBeLessThanOrEqual(PLAY_WIDTH);
    }
    // Everything shifted right to make room, rather than the new room going negative.
    const hall = after.find((cell) => cell.id === 'entrance-hall');
    const before = cells.find((cell) => cell.id === 'entrance-hall');
    expect(hall?.x).not.toBe(before?.x);
  });

  it('copes with no rooms at all', () => {
    expect(mapLayout([])).toEqual([]);
  });
});
