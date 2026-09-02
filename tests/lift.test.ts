import { describe, expect, it } from 'vitest';
import { FIXED_STEP_MS, ROOM_COLS, ROOM_ROWS, WORLD } from '../src/config';
import { liftBox, liftPeriod } from '../src/objects/Lift';
import { Player } from '../src/objects/Player';
import type { LiftDef } from '../src/world/roomTypes';
import type { Room } from '../src/world/Room';
import { testRoom } from './helpers';

/**
 * Lifts are the first thing in the game that moves and can be stood on.
 *
 * Everything about them is arranged so that the awkward cases simply cannot
 * happen: a lift is a one-way platform, never a solid, so it can never crush
 * anybody; and where it is depends only on the room clock, so it resets with
 * the room and stays as learnable as an enemy.
 *
 * What is left to get right is the carrying, and that is what most of this is.
 */

const STEP = FIXED_STEP_MS / 1000;
const IDLE = { left: false, right: false, jump: false };

/** A lift that rises 40px, then comes back down, over four seconds. */
const riser: LiftDef = {
  id: 'riser',
  points: [
    { x: 40, y: 100 },
    { x: 40, y: 60 },
  ],
  speed: 20,
  width: 24,
};

function room(lifts: LiftDef[], sketch?: string[]): Room {
  const floor = sketch ?? [
    ...Array.from({ length: ROOM_ROWS - 1 }, () => '.'.repeat(ROOM_COLS)),
    '#'.repeat(ROOM_COLS),
  ];
  const built = testRoom(floor, { lifts });
  built.reset();
  return built;
}

/** Drops the player from above a lift and steps until they come to rest on it. */
function landOn(target: Room, player: Player, x: number, y: number, limit = 240): void {
  player.placeAt(x, y);
  for (let i = 0; i < limit; i++) {
    player.step(IDLE, STEP, target);
    if (player.onGround) return;
  }
  throw new Error('the player never landed on anything');
}

/**
 * Puts the player straight onto a lift's starting position.
 *
 * Dropping them from a height only works for a lift that moves vertically: one
 * travelling sideways has slid out from under the landing spot by the time they
 * arrive, which is correct behaviour and a useless way to set up a test.
 */
function standOn(target: Room, player: Player, def: LiftDef, offset = 4): void {
  const start = liftBox(def, 0);
  player.placeAt(start.x + offset, start.y - 16);
  player.step(IDLE, STEP, target);
}

/** Top of the floor along the bottom row, and the y a player standing on it has. */
const FLOOR_TOP = (ROOM_ROWS - 1) * 8;
const STANDING_Y = FLOOR_TOP - 16;

describe('where a lift is', () => {
  it('starts on its first point', () => {
    expect(liftBox(riser, 0)).toEqual({ x: 40, y: 100, width: 24, height: WORLD.liftHeight });
  });

  it('goes there and back in the time its speed implies', () => {
    // 40 up and 40 down at 20 px/s.
    expect(liftPeriod(riser)).toBeCloseTo(4);
    expect(liftBox(riser, 1).y).toBeCloseTo(80);
    expect(liftBox(riser, 2).y).toBeCloseTo(60);
    expect(liftBox(riser, 3).y).toBeCloseTo(80);
    expect(liftBox(riser, 4).y).toBeCloseTo(100);
  });

  it('is the same at the same moment, every time', () => {
    for (const t of [0, 0.37, 2.5, 91.25]) {
      expect(liftBox(riser, t)).toEqual(liftBox(riser, t));
    }
  });

  it('is shifted along its cycle by the phase', () => {
    const shifted: LiftDef = { ...riser, phase: 0.5 };
    expect(liftBox(shifted, 0).y).toBeCloseTo(liftBox(riser, 2).y);
  });

  it('snaps back to the start when the room resets', () => {
    const target = room([riser]);
    const player = new Player();
    for (let i = 0; i < 60; i++) player.step(IDLE, STEP, target);
    expect(target.liftBoxes[0].y).toBeLessThan(100);

    target.reset();
    expect(target.liftBoxes[0].y).toBe(100);
    expect(target.seconds).toBe(0);
  });
});

describe('standing on a lift', () => {
  it('lands on it, rather than falling through', () => {
    const target = room([riser]);
    const player = new Player();
    landOn(target, player, 44, 40);

    expect(player.onGround).toBe(true);
    expect(player.ridingLift).toBe(0);
    // Feet on the lift's top edge, wherever it has got to by now.
    expect(player.y + 16).toBeCloseTo(target.liftBoxes[0].y, 0);
  });

  it('is carried upward with it', () => {
    const target = room([riser]);
    const player = new Player();
    landOn(target, player, 44, 40);

    const startedAt = player.y;
    for (let i = 0; i < 30; i++) player.step(IDLE, STEP, target);

    expect(player.y).toBeLessThan(startedAt);
    expect(player.onGround).toBe(true);
    expect(player.y + 16).toBeCloseTo(target.liftBoxes[0].y, 0);
  });

  it('rides it back down again', () => {
    const target = room([riser]);
    const player = new Player();
    landOn(target, player, 44, 40);

    // Past the top of the climb and well into the descent.
    for (let i = 0; i < 150; i++) player.step(IDLE, STEP, target);

    expect(player.onGround).toBe(true);
    expect(player.y + 16).toBeCloseTo(target.liftBoxes[0].y, 0);
  });

  it('is carried sideways with it', () => {
    const slider: LiftDef = {
      id: 'slider',
      points: [
        { x: 40, y: 100 },
        { x: 120, y: 100 },
      ],
      speed: 40,
      width: 24,
    };
    const target = room([slider]);
    const player = new Player();
    standOn(target, player, slider);
    expect(player.ridingLift).toBe(0);

    const startedAt = player.x;
    // Wherever on the lift they happened to land, that is where they stay.
    const offset = player.x - target.liftBoxes[0].x;
    for (let i = 0; i < 60; i++) player.step(IDLE, STEP, target);

    expect(player.x).toBeGreaterThan(startedAt);
    expect(player.x - target.liftBoxes[0].x).toBeCloseTo(offset, 5);
  });

  it('never kills you for riding it down', () => {
    const target = room([riser]);
    const player = new Player();
    landOn(target, player, 44, 40);

    // Several full circuits, up and down and up again.
    for (let i = 0; i < 600; i++) {
      const result = player.step(IDLE, STEP, target);
      expect(result.died, 'a lift ride should never be fatal').toBeNull();
    }
    expect(player.onGround).toBe(true);
  });
});

describe('the awkward cases', () => {
  it('lets you jump up through one and land on top, exactly like a ledge', () => {
    // A lift going nowhere, hanging one tile above the player's head.
    const shelf: LiftDef = {
      id: 'shelf',
      points: [
        { x: 40, y: 128 },
        { x: 40, y: 128 },
      ],
      speed: 20,
      width: 24,
    };
    const target = room([shelf]);
    const player = new Player();

    player.placeAt(44, STANDING_Y);
    player.step(IDLE, STEP, target);
    expect(player.onGround, 'should start on the floor, under the lift').toBe(true);
    expect(player.ridingLift).toBe(-1);

    let highest = player.y;
    for (let i = 0; i < 40; i++) {
      player.step({ left: false, right: false, jump: true }, STEP, target);
      highest = Math.min(highest, player.y);
    }

    // Rose straight through it on the way up, and came down on top of it.
    expect(highest).toBeLessThan(128 - 16);
    expect(player.onGround).toBe(true);
    expect(player.ridingLift).toBe(0);
    expect(player.y).toBeCloseTo(128 - 16, 5);
  });

  it('never crushes anybody against a ceiling', () => {
    // A solid ceiling three rows above the floor the lift climbs past.
    const sketch = [
      ...Array.from({ length: ROOM_ROWS }, (_, row) =>
        row === 5 || row === ROOM_ROWS - 1 ? '#'.repeat(ROOM_COLS) : '.'.repeat(ROOM_COLS),
      ),
    ];
    const target = room([riser], sketch);
    const player = new Player();
    landOn(target, player, 44, 70);

    for (let i = 0; i < 200; i++) {
      const result = player.step(IDLE, STEP, target);
      expect(result.died).not.toBe('hazard');
      // Never pushed up into the ceiling row, which ends at y = 48.
      expect(player.y).toBeGreaterThanOrEqual(48);
    }
  });

  it('slides out from under you rather than posting you through a wall', () => {
    const slider: LiftDef = {
      id: 'slider',
      points: [
        { x: 40, y: 100 },
        { x: 160, y: 100 },
      ],
      speed: 60,
      width: 24,
    };
    // A wall column at col 12, so x = 96..103 is solid.
    const sketch = Array.from({ length: ROOM_ROWS }, (_, row) =>
      row === ROOM_ROWS - 1
        ? '#'.repeat(ROOM_COLS)
        : '.'.repeat(12) + '#' + '.'.repeat(ROOM_COLS - 13),
    );
    const target = room([slider], sketch);
    const player = new Player();
    standOn(target, player, slider);

    for (let i = 0; i < 120; i++) player.step(IDLE, STEP, target);

    // Stopped against the wall's left face, not inside it and not beyond it.
    expect(player.x + 8).toBeLessThanOrEqual(96.001);
  });

  it('leaves you falling when it moves out from under you', () => {
    const shelf: LiftDef = {
      id: 'shelf',
      points: [
        { x: 40, y: 60 },
        { x: 160, y: 60 },
      ],
      speed: 80,
      width: 24,
    };
    const target = room([shelf]);
    const player = new Player();
    standOn(target, player, shelf);
    expect(player.ridingLift).toBe(0);
    expect(player.onGround).toBe(true);

    // Walk off the back of it and there is nothing but floor a long way below.
    for (let i = 0; i < 20; i++)
      player.step({ left: true, right: false, jump: false }, STEP, target);
    expect(player.ridingLift).toBe(-1);
    expect(player.onGround).toBe(false);
  });
});
