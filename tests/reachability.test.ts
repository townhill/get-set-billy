import { describe, expect, it } from 'vitest';
import { ALL_ROOM_DATA, RoomManager } from '../src/world/RoomManager';
import { DIRECTIONS } from '../src/world/roomTypes';
import { CLUMSY_TUNING, explore, type Reachability } from './reachability';

/**
 * Can the player actually get anywhere?
 *
 * The other room tests check that the data is well formed. These check that the
 * house is playable, by running the real movement model from every doorway.
 *
 * This exists because rooms passed every structural check and were still
 * impossible. Geometry alone cannot tell you that a ledge three rows up is out
 * of reach because there is a ceiling above your head. Simulating the jump can.
 *
 * Two things it took a second attempt to get right:
 *
 *   - Each entrance is checked on its own, not all of them pooled. A room that
 *     is navigable when you drop into it through the ceiling can still be a
 *     one-way trap when you walk in from the side.
 *   - Every room is checked twice, the second time for a player who jumps and
 *     walks slightly less far. A route that only exists at full ability, from
 *     one launch pixel, for one frame, is not a route anybody can follow.
 */

const rooms = new RoomManager();

/**
 * How long one room, from one doorway, is allowed to take.
 *
 * Generous on purpose. Exploring a room costs what its geometry costs, and a
 * big room with a lift in it is explored four times over, once from each
 * quarter of the lift's cycle. The default five seconds is a limit the house
 * grows into rather than a bug, and a test that sits on that line fails on a
 * busy machine and passes on a quiet one, which is worse than a slow test.
 */
const ROOM_TIMEOUT_MS = 30000;

describe.each(ALL_ROOM_DATA.map((room) => [room.id, room] as const))('%s', (id, data) => {
  const room = rooms.get(id);
  const entrances = Object.keys(data.spawns);

  function check(found: Reachability, entrance: string, who: string): void {
    const via = `${who} entering "${id}" via "${entrance}"`;

    // Arriving must not be instantly fatal, or nothing is reachable at all.
    expect(found.spots.size, `${via} has nowhere to stand`).toBeGreaterThan(0);

    for (const dir of DIRECTIONS) {
      if (room.exit(dir) === undefined) continue;
      expect(found.exits.has(dir), `${via} cannot get out through the ${dir} exit`).toBe(true);
    }

    for (const item of data.items ?? []) {
      expect(found.items.has(item.id), `${via} cannot collect "${item.id}"`).toBe(true);
    }

    // Both ends of every cupboard have to be somewhere you could already get
    // to, or coming out of one would be more dangerous than walking in.
    for (const pad of data.teleports ?? []) {
      expect(found.teleports.has(pad.id), `${via} cannot reach the cupboard "${pad.id}"`).toBe(
        true,
      );
    }

    expect(found.door, `${via} cannot reach the front door`).toBe(true);
  }

  it.each(entrances)(
    'is playable when entered via "%s"',
    (entrance) => {
      check(explore(room, [entrance]), entrance, 'a player at full ability');
    },
    ROOM_TIMEOUT_MS,
  );

  it.each(entrances)(
    'leaves room for error when entered via "%s"',
    (entrance) => {
      check(explore(room, [entrance], CLUMSY_TUNING), entrance, 'a clumsy player');
    },
    ROOM_TIMEOUT_MS,
  );
});

/** Every room from every doorway, in one test, so this is the slowest of the lot. */
const HOUSE_TIMEOUT_MS = 60000;

describe('the house', () => {
  it(
    'lets every collectable be picked up somewhere',
    () => {
      const reachable = new Set<string>();
      for (const data of ALL_ROOM_DATA) {
        for (const id of explore(rooms.get(data.id)).items) reachable.add(id);
      }
      const all = ALL_ROOM_DATA.flatMap((room) => (room.items ?? []).map((item) => item.id));
      expect([...all].filter((id) => !reachable.has(id))).toEqual([]);
    },
    HOUSE_TIMEOUT_MS,
  );
});
