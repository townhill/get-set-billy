import { describe, expect, it } from 'vitest';
import { WORLD } from '../src/config';
import {
  ALL_ROOM_DATA,
  KEY_ITEMS,
  RoomManager,
  TOTAL_ITEMS,
  keysHeld,
} from '../src/world/RoomManager';
import { OPPOSITE, type Direction } from '../src/world/roomTypes';
import type { LockColour } from '../src/world/tiles';
import { CLUMSY_TUNING, explore, type Reachability } from './reachability';
import type { PlayerTuning } from '../src/objects/Player';
import { DEFAULT_TUNING } from '../src/objects/Player';

/**
 * Can the house still be finished?
 *
 * The other reachability tests ask whether a room is navigable, with every gate
 * treated as open. That is a question about geometry, and it stays a question
 * about geometry on purpose. Locks add a different question, which no amount of
 * per-room checking can answer: whether the keys are laid out so that the whole
 * house can actually be worked through, in some order, starting from nothing.
 *
 * Getting that wrong is the classic dead end — the iron key sitting behind the
 * iron gate — and it would leave every existing test perfectly happy.
 *
 * The answer is a fixpoint. Explore the house with the keys you have; take
 * everything you can reach; if that got you a new key, go round again. Keys are
 * never spent, so the set only grows and the loop always terminates.
 */

const rooms = new RoomManager();

/**
 * Exploring a room is the expensive part of the whole suite, and this file asks
 * for the same room over and over: once per sweep of the house, and again when
 * checking it for dead ends.
 *
 * Two things make that affordable. Results are cached, and a room with no gates
 * in it is cached without the key set at all — its geometry cannot depend on
 * what the player is carrying, so one exploration answers for every stage of
 * the game. Only the seven gated rooms are ever explored more than once.
 */
const cache = new Map<string, Reachability>();

/**
 * How long simulating the whole house, twice over, is allowed to take.
 *
 * The slowest test in the suite by a distance, and slower again with every room
 * added to it. Generous on purpose, for the same reason the per-room limits in
 * `reachability.test.ts` are: a test that sits on its own time limit fails on a
 * busy machine and passes on a quiet one, which is worse than a slow test.
 */
const HOUSE_TIMEOUT_MS = 120000;

function explored(
  roomId: string,
  entrance: string,
  keys: Set<LockColour>,
  tuning: PlayerTuning,
): Reachability {
  const room = rooms.get(roomId);
  const gated = room.locks.size > 0;
  const held = gated ? [...keys].sort().join('+') : 'ungated';
  const who = tuning === DEFAULT_TUNING ? 'able' : 'clumsy';
  const cacheKey = `${roomId}/${entrance}/${held}/${who}`;
  const hit = cache.get(cacheKey);
  if (hit !== undefined) return hit;
  const found = explore(room, [entrance], tuning, keys);
  cache.set(cacheKey, found);
  return found;
}

/** Each tuning's play-through is worked out once and shared by every test. */
const playThroughs = new Map<PlayerTuning, { keys: Set<LockColour>; sweeps: Sweep[] }>();

/** One entrance to one room: the state a player is actually ever in. */
interface Visit {
  room: string;
  /** The edge they came in through, which is also the spawn they arrive at. */
  entrance: Direction | 'start';
}

interface Sweep {
  /** Every (room, entrance) a player holding `keys` can reach from the start. */
  visits: Visit[];
  /** Every collectable they can pick up along the way. */
  items: Set<string>;
  /** Whether they can touch the front door. */
  door: boolean;
}

/**
 * Walks the house with a fixed set of keys, room by room, entrance by entrance.
 *
 * Each room is explored from the specific doorway the player arrives at, which
 * is the same distinction the per-room tests make: a route that exists when you
 * drop in through the ceiling may not exist when you walk in from the side.
 */
function sweep(keys: Set<LockColour>, tuning: PlayerTuning): Sweep {
  const start: Visit = { room: WORLD.startRoom, entrance: 'start' };
  const seen = new Set<string>([`${start.room}/${start.entrance}`]);
  const queue: Visit[] = [start];
  const visits: Visit[] = [];
  const items = new Set<string>();
  let door = false;

  while (queue.length > 0) {
    const visit = queue.shift() as Visit;
    visits.push(visit);

    const room = rooms.get(visit.room);
    const found = explored(visit.room, visit.entrance, keys, tuning);

    for (const id of found.items) items.add(id);
    if (room.data.door !== undefined && found.door) door = true;

    for (const dir of found.exits) {
      const next = room.exit(dir);
      if (next === undefined) continue;
      const key = `${next}/${OPPOSITE[dir]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ room: next, entrance: OPPOSITE[dir] });
    }
  }

  return { visits, items, door };
}

/** Sweeps repeatedly, picking up keys, until nothing new turns up. */
function playThrough(tuning: PlayerTuning): { keys: Set<LockColour>; sweeps: Sweep[] } {
  const memo = playThroughs.get(tuning);
  if (memo !== undefined) return memo;

  let keys = new Set<LockColour>();
  const sweeps: Sweep[] = [];

  for (;;) {
    const result = sweep(keys, tuning);
    sweeps.push(result);
    const next = keysHeld(result.items);
    if (next.size === keys.size) {
      const done = { keys, sweeps };
      playThroughs.set(tuning, done);
      return done;
    }
    keys = next;
  }
}

describe('working through the house', () => {
  const { keys, sweeps } = playThrough(DEFAULT_TUNING);
  const final = sweeps[sweeps.length - 1];

  it('finds every key', () => {
    const needed = new Set(KEY_ITEMS.values());
    expect([...needed].filter((lock) => !keys.has(lock))).toEqual([]);
  });

  it('collects all of them, starting from nothing', () => {
    const missing = ALL_ROOM_DATA.flatMap((room) => (room.items ?? []).map((item) => item.id))
      .filter((id) => !final.items.has(id))
      .sort();
    expect(missing, 'unreachable however many keys you find').toEqual([]);
    expect(final.items.size).toBe(TOTAL_ITEMS);
  });

  it('gets to the front door once it has', () => {
    expect(final.door).toBe(true);
  });

  it('needs more than one trip round, or the gates are doing nothing', () => {
    expect(sweeps.length).toBeGreaterThan(1);
  });

  it('reaches every room in the end', () => {
    const reached = new Set(final.visits.map((visit) => visit.room));
    const unreached = ALL_ROOM_DATA.map((room) => room.id)
      .filter((id) => !reached.has(id))
      .sort();
    expect(unreached).toEqual([]);
  });
});

/**
 * The other half of the problem, and the nastier one.
 *
 * A house can be perfectly finishable and still contain a room you can walk
 * into and never walk out of — a gate on the wrong side of the doorway you
 * arrived through. Dying does not help, because a death puts you back at the
 * same entrance, so a player in that position has nothing left to do.
 *
 * So: every room the player can reach, at every stage of the game, has to let
 * them leave the way they came in.
 */
describe('no way in without a way out', () => {
  it.each([
    ['a player at full ability', DEFAULT_TUNING],
    ['a clumsy player', CLUMSY_TUNING],
  ])(
    'always lets %s turn round and leave',
    (_who, tuning) => {
      const { sweeps } = playThrough(tuning);
      const stranded: string[] = [];

      let keys = new Set<LockColour>();
      for (const stage of sweeps) {
        for (const visit of stage.visits) {
          if (visit.entrance === 'start') continue;
          const found = explored(visit.room, visit.entrance, keys, tuning);
          if (!found.exits.has(visit.entrance)) {
            stranded.push(`${visit.room} entered via "${visit.entrance}" with keys [${[...keys]}]`);
          }
        }
        keys = keysHeld(stage.items);
      }

      expect(stranded).toEqual([]);
    },
    HOUSE_TIMEOUT_MS,
  );
});
