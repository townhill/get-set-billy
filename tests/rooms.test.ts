import { describe, expect, it } from 'vitest';
import { FIXED_STEP_MS, PLAYER, ROOM_COLS, ROOM_ROWS, TILE_SIZE, WORLD } from '../src/config';
import { Player } from '../src/objects/Player';
import { ALL_ITEM_IDS, ALL_ROOM_DATA, RoomManager, TOTAL_ITEMS } from '../src/world/RoomManager';
import { DIRECTIONS, OPPOSITE, type Direction, validateRoomShape } from '../src/world/roomTypes';
import { isKnownTile, tileDef } from '../src/world/tiles';
import { THEMES } from '../src/assets/themes';
import { ENEMY_SPRITES, ITEM_SPRITES } from '../src/assets/sprites';
import { enemyBox } from '../src/objects/Enemy';
import { boxesOverlap, insetBox, overlapsHazard } from '../src/systems/CollisionSystem';

/**
 * These tests are the contract for adding a room to the house.
 *
 * Everything a new JSON file has to get right is checked here, so a broken
 * room fails the build rather than stranding a player somewhere.
 */

const rooms = new RoomManager();

describe('the house as a whole', () => {
  it('has at least ten rooms', () => {
    expect(rooms.size).toBeGreaterThanOrEqual(10);
  });

  it('passes its own validator with nothing to report', () => {
    expect(rooms.validate()).toEqual([]);
  });

  it('starts somewhere that exists', () => {
    expect(rooms.has(WORLD.startRoom)).toBe(true);
  });

  it('has exactly one front door', () => {
    const withDoors = ALL_ROOM_DATA.filter((room) => room.door !== undefined);
    expect(withDoors).toHaveLength(1);
  });

  it('has something to collect, and every id is unique', () => {
    expect(TOTAL_ITEMS).toBeGreaterThan(0);
    expect(new Set(ALL_ITEM_IDS).size).toBe(TOTAL_ITEMS);
  });

  it('gives every room a unique id and a unique name', () => {
    const ids = ALL_ROOM_DATA.map((room) => room.id);
    const names = ALL_ROOM_DATA.map((room) => room.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it('can be walked from the start room to every other room', () => {
    const seen = new Set<string>([WORLD.startRoom]);
    const queue: string[] = [WORLD.startRoom];
    while (queue.length > 0) {
      const id = queue.shift() as string;
      for (const dir of DIRECTIONS) {
        const next = rooms.get(id).exit(dir);
        if (next !== undefined && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    expect([...seen].sort()).toEqual(rooms.ids.sort());
  });

  it('places every room in its own cell on the map', () => {
    const cells = ALL_ROOM_DATA.map((room) => `${room.grid.x},${room.grid.y}`);
    expect(new Set(cells).size).toBe(cells.length);
  });
});

describe('room traversal', () => {
  it("leaves a tile of jump margin between the billiard room's lower platforms", () => {
    const room = rooms.get('billiard-room');
    const lowerPlatforms = [...room.data.tiles[16].matchAll(/=+/g)].map((match) => ({
      left: (match.index ?? 0) * TILE_SIZE,
      right: ((match.index ?? 0) + match[0].length) * TILE_SIZE,
    }));

    expect(lowerPlatforms).toHaveLength(2);

    const gap = lowerPlatforms[1].left - lowerPlatforms[0].right;
    const sameHeightJumpRange = PLAYER.walkSpeed * ((2 * PLAYER.jumpVelocity) / PLAYER.gravity);

    expect(gap).toBeLessThanOrEqual(sameHeightJumpRange - TILE_SIZE);

    const player = new Player();
    const stepSeconds = FIXED_STEP_MS / 1000;
    player.placeAt(120, 112);
    player.step({ left: false, right: false, jump: false }, stepSeconds, room);
    expect(player.onGround).toBe(true);

    let crossed = false;
    for (let frame = 0; frame < 60; frame++) {
      const result = player.step({ left: false, right: true, jump: true }, stepSeconds, room);
      if (result.landed) {
        crossed = player.x > lowerPlatforms[0].right && player.y <= 112;
        break;
      }
    }

    expect(crossed).toBe(true);
  });

  it("keeps the attic mouse away from the lower entrance", () => {
    const room = rooms.get('hat-attic');
    const spawn = room.data.spawns.down;
    const mouse = room.data.enemies?.find((enemy) => enemy.id === 'attic-mouse');

    expect(spawn).toBeDefined();
    expect(mouse).toBeDefined();
    if (!spawn || !mouse) return;

    const playerBox = insetBox(
      { x: spawn.x, y: spawn.y, width: PLAYER.width, height: PLAYER.height },
      PLAYER.hazardInset,
    );
    const sprite = ENEMY_SPRITES[mouse.sprite];

    for (let frame = 0; frame <= 120; frame++) {
      const seconds = (frame * FIXED_STEP_MS) / 1000;
      const mouseBox = insetBox(enemyBox(mouse, seconds, sprite), 1);
      expect(
        boxesOverlap(playerBox, mouseBox),
        `attic mouse reaches the lower spawn after ${seconds.toFixed(2)}s`,
      ).toBe(false);
    }
  });
});

describe.each(ALL_ROOM_DATA.map((room) => [room.id, room] as const))('%s', (id, data) => {
  const room = rooms.get(id);

  it('is well formed', () => {
    expect(validateRoomShape(data)).toEqual([]);
  });

  it(`is exactly ${ROOM_COLS} by ${ROOM_ROWS} cells of known tiles`, () => {
    expect(data.tiles).toHaveLength(ROOM_ROWS);
    for (const row of data.tiles) {
      expect(row).toHaveLength(ROOM_COLS);
      for (const ch of row) expect(isKnownTile(ch)).toBe(true);
    }
  });

  it('uses a theme that exists', () => {
    expect(Object.keys(THEMES)).toContain(data.theme);
  });

  it('only asks for sprites that have been drawn', () => {
    for (const enemy of data.enemies ?? []) {
      expect(Object.keys(ENEMY_SPRITES)).toContain(enemy.sprite);
    }
    for (const item of data.items ?? []) {
      expect(Object.keys(ITEM_SPRITES)).toContain(item.sprite);
    }
  });

  it('seals every edge it has no exit through', () => {
    const edges: Record<Direction, string[]> = {
      left: data.tiles.map((row) => row[0]),
      right: data.tiles.map((row) => row[ROOM_COLS - 1]),
      up: [...data.tiles[0]],
      down: [...data.tiles[ROOM_ROWS - 1]],
    };

    for (const dir of DIRECTIONS) {
      // A one-way platform still stops you falling, but never stops you rising.
      const blocks = (ch: string) =>
        dir === 'down' ? tileDef(ch).solid || tileDef(ch).platform : tileDef(ch).solid;
      const open = edges[dir].filter((ch) => !blocks(ch));

      if (data.exits[dir] === undefined) {
        expect(open, `${id} leaks through its ${dir} edge`).toHaveLength(0);
      } else {
        expect(open.length, `${id} has a ${dir} exit but no way through it`).toBeGreaterThan(0);
      }
    }
  });

  it('has a matching exit back from every neighbour', () => {
    for (const dir of DIRECTIONS) {
      const target = data.exits[dir];
      if (target === undefined) continue;
      expect(rooms.has(target)).toBe(true);
      expect(rooms.get(target).exit(OPPOSITE[dir])).toBe(id);
    }
  });

  it('agrees with the map grid about where its neighbours are', () => {
    const delta: Record<Direction, [number, number]> = {
      left: [-1, 0],
      right: [1, 0],
      up: [0, -1],
      down: [0, 1],
    };
    for (const dir of DIRECTIONS) {
      const target = data.exits[dir];
      if (target === undefined) continue;
      const other = rooms.get(target).data;
      const [dx, dy] = delta[dir];
      expect({ x: other.grid.x, y: other.grid.y }).toEqual({
        x: data.grid.x + dx,
        y: data.grid.y + dy,
      });
    }
  });

  it('lines its floor holes up with the ceiling holes below', () => {
    const below = data.exits.down;
    if (below === undefined) return;
    const holeHere = [...data.tiles[ROOM_ROWS - 1]]
      .map((ch, index) => (tileDef(ch).solid || tileDef(ch).platform ? -1 : index))
      .filter((index) => index >= 0);
    const holeThere = [...rooms.get(below).data.tiles[0]]
      .map((ch, index) => (tileDef(ch).solid ? -1 : index))
      .filter((index) => index >= 0);
    expect(holeHere).toEqual(holeThere);
  });

  it('puts every spawn point somewhere survivable', () => {
    for (const [key, point] of Object.entries(data.spawns)) {
      const box = { x: point.x, y: point.y, width: PLAYER.width, height: PLAYER.height };

      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x + PLAYER.width).toBeLessThanOrEqual(ROOM_COLS * TILE_SIZE);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y + PLAYER.height).toBeLessThanOrEqual(ROOM_ROWS * TILE_SIZE);

      for (
        let col = Math.floor(box.x / TILE_SIZE);
        col <= (box.x + box.width - 1) / TILE_SIZE;
        col++
      ) {
        for (
          let row = Math.floor(box.y / TILE_SIZE);
          row <= (box.y + box.height - 1) / TILE_SIZE;
          row++
        ) {
          expect(room.solidAt(col, row), `${id} spawn "${key}" is inside a wall`).toBe(false);
        }
      }
      expect(overlapsHazard(box, room), `${id} spawn "${key}" is in a hazard`).toBe(false);
    }
  });

  it('leaves every collectable somewhere it can actually be picked up', () => {
    for (const item of data.items ?? []) {
      const box = { x: item.x, y: item.y, width: TILE_SIZE, height: TILE_SIZE };
      expect(item.x % 1).toBe(0);
      expect(item.y % 1).toBe(0);
      expect(item.x + TILE_SIZE).toBeLessThanOrEqual(ROOM_COLS * TILE_SIZE);
      expect(item.y + TILE_SIZE).toBeLessThanOrEqual(ROOM_ROWS * TILE_SIZE);

      const col = item.x / TILE_SIZE;
      const row = item.y / TILE_SIZE;
      expect(room.solidAt(col, row), `${item.id} is buried in a wall`).toBe(false);
      expect(overlapsHazard(box, room), `${item.id} is inside a hazard`).toBe(false);
    }
  });

  it('keeps its enemies inside the room', () => {
    for (const enemy of data.enemies ?? []) {
      const sprite = ENEMY_SPRITES[enemy.sprite];
      const bounds = { minX: 0, minY: 0, maxX: ROOM_COLS * TILE_SIZE, maxY: ROOM_ROWS * TILE_SIZE };
      const ends: { x: number; y: number }[] = [];

      switch (enemy.type) {
        case 'patrol-h':
          ends.push({ x: enemy.from, y: enemy.y }, { x: enemy.to, y: enemy.y });
          break;
        case 'patrol-v':
          ends.push({ x: enemy.x, y: enemy.from }, { x: enemy.x, y: enemy.to });
          break;
        case 'circle':
          ends.push(
            {
              x: enemy.cx - enemy.radius - sprite.width / 2,
              y: enemy.cy - enemy.radius - sprite.height / 2,
            },
            {
              x: enemy.cx + enemy.radius - sprite.width / 2,
              y: enemy.cy + enemy.radius - sprite.height / 2,
            },
          );
          break;
        case 'pendulum':
          ends.push(
            { x: enemy.cx - enemy.length - sprite.width / 2, y: enemy.cy - sprite.height / 2 },
            {
              x: enemy.cx + enemy.length - sprite.width / 2,
              y: enemy.cy + enemy.length - sprite.height / 2,
            },
          );
          break;
        case 'static':
          ends.push({ x: enemy.x, y: enemy.y });
          break;
      }

      for (const end of ends) {
        expect(end.x, `${enemy.id} goes off the left`).toBeGreaterThanOrEqual(bounds.minX);
        expect(end.y, `${enemy.id} goes off the top`).toBeGreaterThanOrEqual(bounds.minY);
        expect(end.x + sprite.width, `${enemy.id} goes off the right`).toBeLessThanOrEqual(
          bounds.maxX,
        );
        expect(end.y + sprite.height, `${enemy.id} goes off the bottom`).toBeLessThanOrEqual(
          bounds.maxY,
        );
      }
    }
  });
});
