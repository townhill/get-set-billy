import { FIXED_STEP_MS, PLAYER, TILE_SIZE } from '../src/config';
import { DEFAULT_TUNING, Player, type PlayerInput, type PlayerTuning } from '../src/objects/Player';
import { boxesOverlap, insetBox, type Box } from '../src/systems/CollisionSystem';
import type { Room } from '../src/world/Room';
import type { Direction } from '../src/world/roomTypes';
import { LOCK_COLOURS, type LockColour } from '../src/world/tiles';

/**
 * Works out what a player can actually reach in a room, by running the real
 * movement model rather than reasoning about the geometry.
 *
 * Reasoning about it is exactly how this went wrong in the first place: a ledge
 * three rows up looks reachable, and is, unless there is a ceiling above your
 * head that stops the jump early. Only simulating the jump catches that.
 *
 * The model is deliberately optimistic - it ignores enemies, and every attempt
 * starts with the crumbling floors intact - so anything it calls unreachable is
 * unreachable for certain, and there are no flaky failures.
 *
 * Optimism cuts both ways, though. Simulating a perfect player proves only that
 * a route exists, not that anyone could follow it: a landing that works from one
 * launch pixel, for one frame, counts as "reachable" and is not. So the tests
 * also run the house for a CLUMSY player, who jumps and walks slightly less far.
 * Anything that survives that has real margin in it.
 */

/** Every key in the house, for the checks that are about geometry, not gating. */
export const ALL_KEYS: readonly LockColour[] = LOCK_COLOURS;

/** A player who is a few per cent worse at everything. */
export const CLUMSY_TUNING: PlayerTuning = {
  walkSpeed: DEFAULT_TUNING.walkSpeed * 0.95,
  jumpVelocity: DEFAULT_TUNING.jumpVelocity * 0.95,
  gravity: DEFAULT_TUNING.gravity,
};

const STEP = FIXED_STEP_MS / 1000;

/** Positions are rounded to this many pixels when deciding if a spot is new. */
const SPOT_GRID = 2;

/** Long enough for a full jump arc, or a walk from one side of a room to the other. */
const MAX_STEPS = 200;

/** A safety net; no sane room comes close. */
const MAX_SPOTS = 20000;

/** Standing still, walking, and jumping in each of the three directions. */
const MOVES: readonly PlayerInput[] = [
  { left: false, right: false, jump: true },
  { left: true, right: false, jump: true },
  { left: false, right: true, jump: true },
  { left: true, right: false, jump: false },
  { left: false, right: true, jump: false },
];

interface Spot {
  x: number;
  y: number;
  /**
   * The room's switch, as it stood when the player was standing here.
   *
   * Part of the spot, not a detail of it: reaching a ledge with the shutters
   * one way is a different situation from reaching it with them the other, and
   * treating the two as the same lets the solver stitch together a route out of
   * halves that never existed at the same moment.
   */
  on: boolean;
}

const spotKey = (x: number, y: number, on: boolean): string =>
  `${Math.round(x / SPOT_GRID) * SPOT_GRID},${Math.round(y)},${on ? 1 : 0}`;

export interface Reachability {
  /** Every place the player can stand, as "x,y" keys. */
  spots: Set<string>;
  /** Ids of the collectables that can actually be picked up. */
  items: Set<string>;
  /** The exits that can actually be used. */
  exits: Set<Direction>;
  /** Ids of the teleport cupboards that can actually be stepped into. */
  teleports: Set<string>;
  /** Whether the front door can be touched, if this room has one. */
  door: boolean;
}

interface Attempt {
  landings: Spot[];
  items: string[];
  teleports: string[];
  exit: Direction | null;
}

/** Teleports are checked exactly like collectables: can you get to it at all? */
function teleportBoxes(room: Room): { id: string; box: Box }[] {
  return (room.data.teleports ?? []).map((pad) => ({
    id: pad.id,
    box: { x: pad.x, y: pad.y, width: TILE_SIZE, height: TILE_SIZE },
  }));
}

function itemBoxes(room: Room): { id: string; box: Box }[] {
  return (room.data.items ?? []).map((item) => ({
    id: item.id,
    box: { x: item.x, y: item.y, width: TILE_SIZE, height: TILE_SIZE },
  }));
}

/**
 * Runs one attempt from a standing start and reports where the player could get
 * to, what they touched on the way, and whether they left the room.
 */
function attempt(
  room: Room,
  from: Spot,
  input: PlayerInput,
  targets: { id: string; box: Box }[],
  tuning: PlayerTuning,
  startMs: number,
): Attempt {
  room.reset(startMs);
  room.setSwitch(from.on);

  const player = new Player(tuning);
  player.placeAt(from.x, from.y);

  const landings: Spot[] = [];
  const touched: string[] = [];
  const reachedPads: string[] = [];
  const seen = new Set<string>();
  const pads = teleportBoxes(room);

  const note = (): void => {
    const hitbox = insetBox(player.box, PLAYER.hazardInset);
    for (const target of targets) {
      if (!seen.has(target.id) && boxesOverlap(hitbox, target.box)) {
        seen.add(target.id);
        touched.push(target.id);
      }
    }
    for (const pad of pads) {
      if (!seen.has(pad.id) && boxesOverlap(hitbox, pad.box)) {
        seen.add(pad.id);
        reachedPads.push(pad.id);
      }
    }
    if (player.onGround) landings.push({ x: player.x, y: player.y, on: room.switchState });
  };

  // placeAt treats the jump button as already held, so the first step releases it.
  player.step({ ...input, jump: false }, STEP, room);
  note();

  for (let i = 0; i < MAX_STEPS; i++) {
    const result = player.step(input, STEP, room);
    note();
    if (result.leftRoom !== null) {
      return { landings, items: touched, teleports: reachedPads, exit: result.leftRoom };
    }
    if (result.died !== null) {
      return { landings, items: touched, teleports: reachedPads, exit: null };
    }
  }

  return { landings, items: touched, teleports: reachedPads, exit: null };
}

/** Drops the player from a spawn point and returns where they come to rest. */
function settle(room: Room, spawn: Spot, tuning: PlayerTuning, startMs: number): Spot[] {
  const landings: Spot[] = [];
  for (const input of [
    { left: false, right: false, jump: false },
    { left: true, right: false, jump: false },
    { left: false, right: true, jump: false },
  ]) {
    room.reset(startMs);
    room.setSwitch(spawn.on);
    const player = new Player(tuning);
    player.placeAt(spawn.x, spawn.y);
    for (let i = 0; i < MAX_STEPS; i++) {
      const result = player.step(input, STEP, room);
      if (result.died !== null || result.leftRoom !== null) break;
      if (player.onGround) landings.push({ x: player.x, y: player.y, on: room.switchState });
    }
  }
  return landings;
}

/**
 * Explores a room and reports what a player can reach.
 *
 * `from` names which spawn points to start at. Checking each entrance
 * separately matters: a room can be perfectly navigable when you drop into it
 * through the ceiling and a one-way trap when you walk in from the side.
 */
function exploreOnce(
  room: Room,
  from: readonly string[] | undefined,
  tuning: PlayerTuning,
  keys: Iterable<LockColour>,
  startMs: number,
): Reachability {
  // Gates are geometry as far as the solver is concerned: an unlocked one is
  // simply air, so which keys the player holds has to be settled up front.
  room.setKeys(keys);

  const targets = itemBoxes(room);
  const found: Reachability = {
    spots: new Set(),
    items: new Set(),
    exits: new Set(),
    teleports: new Set(),
    door: room.data.door === undefined,
  };

  const door = room.data.door;
  const doorBox: Box | null = door ? { x: door.x, y: door.y, width: 16, height: 24 } : null;

  const queue: Spot[] = [];
  const push = (spot: Spot): void => {
    const key = spotKey(spot.x, spot.y, spot.on);
    if (found.spots.has(key) || found.spots.size >= MAX_SPOTS) return;
    found.spots.add(key);
    queue.push(spot);
  };

  const starts = Object.entries(room.data.spawns).filter(
    ([key]) => from === undefined || from.includes(key),
  );
  for (const [, spawn] of starts) {
    // A room always starts with its switch off; the player arrives before they
    // have had any chance to touch anything.
    for (const landing of settle(room, { ...spawn, on: false }, tuning, startMs)) push(landing);
  }

  while (queue.length > 0) {
    const from = queue.shift() as Spot;

    if (doorBox && !found.door) {
      // The door is 24 tall and stands on the floor, so standing next to it counts.
      const box: Box = { x: from.x, y: from.y, width: PLAYER.width, height: PLAYER.height };
      if (boxesOverlap(box, doorBox)) found.door = true;
    }

    for (const input of MOVES) {
      const result = attempt(room, from, input, targets, tuning, startMs);
      for (const id of result.items) found.items.add(id);
      for (const id of result.teleports) found.teleports.add(id);
      if (result.exit !== null) found.exits.add(result.exit);
      for (const landing of result.landings) push(landing);
    }
  }

  if (doorBox && !found.door) {
    for (const key of found.spots) {
      const [x, y] = key.split(',').map(Number);
      const box: Box = { x, y, width: PLAYER.width, height: PLAYER.height };
      if (boxesOverlap(box, doorBox)) {
        found.door = true;
        break;
      }
    }
  }

  return found;
}

/** How many moments through a lift's cycle a room with lifts is explored from. */
const LIFT_ARRIVALS = 4;

/**
 * Explores a room and reports what a player can reach.
 *
 * `from` names which spawn points to start at. Checking each entrance
 * separately matters: a room can be perfectly navigable when you drop into it
 * through the ceiling and a one-way trap when you walk in from the side.
 *
 * A room with lifts in it is explored several times over, from evenly spaced
 * moments in the lift's cycle, and only what every one of them can reach counts.
 * Without that the solver would answer for a player who arrives at exactly the
 * right instant, which is not a route, it is a coincidence — and the whole point
 * of this file is to refuse to call a coincidence a route.
 */
export function explore(
  room: Room,
  from?: readonly string[],
  tuning: PlayerTuning = DEFAULT_TUNING,
  keys: Iterable<LockColour> = ALL_KEYS,
): Reachability {
  const cycle = room.liftCycle;
  if (cycle === 0) return exploreOnce(room, from, tuning, keys, 0);

  const runs = Array.from({ length: LIFT_ARRIVALS }, (_, i) =>
    exploreOnce(room, from, tuning, keys, (cycle * 1000 * i) / LIFT_ARRIVALS),
  );

  const everywhere = <T>(pick: (run: Reachability) => Set<T>): Set<T> =>
    new Set([...pick(runs[0])].filter((value) => runs.every((run) => pick(run).has(value))));

  return {
    // Somewhere to stand is a union: any of them proves the arrival is survivable.
    spots: new Set(runs.flatMap((run) => [...run.spots])),
    items: everywhere((run) => run.items),
    exits: everywhere((run) => run.exits),
    teleports: everywhere((run) => run.teleports),
    door: runs.every((run) => run.door),
  };
}
