import { describe, expect, it } from 'vitest';
import { ALL_ROOM_DATA, RoomManager } from '../src/world/RoomManager';
import { DIRECTIONS } from '../src/world/roomTypes';
import { explore } from './reachability';

/**
 * Can the player actually get anywhere?
 *
 * The other room tests check that the data is well formed. These check that the
 * house is playable, by running the real movement model from every doorway.
 *
 * This exists because a room passed every structural check and was still
 * impossible: a ledge three rows up looks reachable, but if there is a ceiling
 * above your head the jump stops early and you never get there. Geometry alone
 * cannot tell you that. Simulating the jump can.
 *
 * Each entrance is checked on its own, not all of them together. A room that is
 * navigable when you drop into it through the ceiling can still be a one-way
 * trap when you walk in from the side, and that is exactly the bug that got
 * through the first time.
 */

const rooms = new RoomManager();

describe.each(ALL_ROOM_DATA.map((room) => [room.id, room] as const))('%s', (id, data) => {
  const room = rooms.get(id);
  const entrances = Object.keys(data.spawns);

  it.each(entrances)('is playable when entered via "%s"', (entrance) => {
    const found = explore(room, [entrance]);

    // Arriving must not be instantly fatal, or nothing is reachable at all.
    expect(found.spots.size, `nowhere to stand after entering via "${entrance}"`).toBeGreaterThan(
      0,
    );

    for (const dir of DIRECTIONS) {
      if (room.exit(dir) === undefined) continue;
      expect(
        found.exits.has(dir),
        `entering "${id}" via "${entrance}" leaves no way out through the ${dir} exit`,
      ).toBe(true);
    }

    for (const item of data.items ?? []) {
      expect(
        found.items.has(item.id),
        `"${item.id}" cannot be collected when entering "${id}" via "${entrance}"`,
      ).toBe(true);
    }

    expect(found.door, `the front door cannot be reached via "${entrance}"`).toBe(true);
  });
});

describe('the house', () => {
  it('lets every collectable be picked up somewhere', () => {
    const reachable = new Set<string>();
    for (const data of ALL_ROOM_DATA) {
      for (const id of explore(rooms.get(data.id)).items) reachable.add(id);
    }
    const all = ALL_ROOM_DATA.flatMap((room) => (room.items ?? []).map((item) => item.id));
    expect([...all].filter((id) => !reachable.has(id))).toEqual([]);
  });
});
