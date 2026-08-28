import { ROOM_COLS, ROOM_ROWS } from '../src/config';
import { Room } from '../src/world/Room';
import type { RoomData } from '../src/world/roomTypes';
import type { TileGrid } from '../src/systems/CollisionSystem';
import { tileDef } from '../src/world/tiles';

/** Builds a TileGrid from a short ASCII sketch, for collision tests. */
export function grid(rows: string[]): TileGrid {
  const cols = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const at = (col: number, row: number): string => {
    if (row < 0 || row >= rows.length || col < 0 || col >= cols) return '.';
    return rows[row][col] ?? '.';
  };
  return {
    cols,
    rows: rows.length,
    solidAt: (col, row) => tileDef(at(col, row)).solid,
    platformAt: (col, row) => tileDef(at(col, row)).platform,
    hazardAt: (col, row) => tileDef(at(col, row)).hazard,
  };
}

/**
 * Builds a full-size Room from a sketch, padding it out to the standard
 * 32x20 with air and giving it a solid floor along the bottom.
 */
export function testRoom(sketch: string[], overrides: Partial<RoomData> = {}): Room {
  const tiles: string[] = [];
  for (let row = 0; row < ROOM_ROWS; row++) {
    const source = sketch[row] ?? '';
    tiles.push(source.padEnd(ROOM_COLS, '.').slice(0, ROOM_COLS));
  }
  const data: RoomData = {
    id: 'test-room',
    name: 'A Test Room',
    theme: 'hall',
    grid: { x: 0, y: 0 },
    exits: {},
    spawns: { start: { x: 8, y: 8 } },
    tiles,
    ...overrides,
  };
  return new Room(data);
}

/** A room that is nothing but a floor along the bottom row. */
export function flatRoom(overrides: Partial<RoomData> = {}): Room {
  const sketch = Array.from({ length: ROOM_ROWS }, (_, row) =>
    row === ROOM_ROWS - 1 ? '#'.repeat(ROOM_COLS) : '.'.repeat(ROOM_COLS),
  );
  return testRoom(sketch, overrides);
}
