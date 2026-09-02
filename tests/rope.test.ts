import { describe, expect, it } from 'vitest';
import { FIXED_STEP_MS, PLAYER, ROOM_COLS, ROOM_ROWS } from '../src/config';
import { Player } from '../src/objects/Player';
import {
  MIN_GRIP,
  gripDistance,
  ropeAngle,
  ropeEnd,
  ropePeriod,
  ropePoint,
} from '../src/objects/Rope';
import type { RopeDef } from '../src/world/roomTypes';
import type { Room } from '../src/world/Room';
import { testRoom } from './helpers';

/**
 * Ropes.
 *
 * The mechanic the era is remembered for, built to the one rule this game will
 * not bend: no momentum, anywhere. A rope carries you along its arc and then
 * lets you off exactly where it had got you to — it never flings you. That is
 * what keeps every gap in the house as wide as it looks.
 */

const STEP = FIXED_STEP_MS / 1000;
const IDLE = { left: false, right: false, jump: false };
const JUMP = { left: false, right: false, jump: true };

/** Hangs from (128, 32), reaching 48px down, swinging 60 degrees in all. */
const rope: RopeDef = { id: 'test-rope', cx: 128, cy: 32, length: 48, arc: 60, speed: 60 };

function ropeRoom(ropes: RopeDef[] = [rope]): Room {
  const rows = Array.from({ length: ROOM_ROWS }, () => '.'.repeat(ROOM_COLS));
  rows[ROOM_ROWS - 1] = '#'.repeat(ROOM_COLS);
  const room = testRoom(rows, { ropes });
  room.reset();
  return room;
}

/** Puts the player's hands exactly on a point of the rope and steps once. */
function catchRope(room: Room, player: Player, distance: number): void {
  const at = ropePoint(rope, room.seconds, distance);
  player.placeAt(at.x - PLAYER.width / 2, at.y - 2);
  player.step(IDLE, STEP, room);
}

describe('where a rope is', () => {
  it('hangs straight down at the start of its swing', () => {
    expect(ropeAngle(rope, 0)).toBeCloseTo(0);
    expect(ropeEnd(rope, 0)).toEqual({ x: 128, y: 80 });
  });

  it('never swings beyond half its arc either side', () => {
    const period = ropePeriod(rope);
    for (let i = 0; i <= 720; i++) {
      const degrees = (ropeAngle(rope, (period * i) / 720) * 180) / Math.PI;
      expect(Math.abs(degrees)).toBeLessThanOrEqual(rope.arc / 2 + 0.001);
    }
  });

  it('stays exactly its own length from the pivot', () => {
    const period = ropePeriod(rope);
    for (let i = 0; i <= 360; i++) {
      const end = ropeEnd(rope, (period * i) / 360);
      expect(Math.hypot(end.x - rope.cx, end.y - rope.cy)).toBeCloseTo(rope.length);
    }
  });

  it('is the same at the same moment, every time', () => {
    for (const t of [0, 0.4, 3.7, 41.25]) {
      expect(ropePoint(rope, t, 30)).toEqual(ropePoint(rope, t, 30));
    }
  });
});

describe('taking hold of a rope', () => {
  it('catches it where the hands actually met it', () => {
    const room = ropeRoom();
    const player = new Player();
    catchRope(room, player, 30);
    expect(player.ropeGrip?.id).toBe('test-rope');
    expect(player.ropeGrip?.distance).toBeCloseTo(30, 0);
  });

  it('reports the catch, once', () => {
    const room = ropeRoom();
    const player = new Player();
    const at = ropePoint(rope, 0, 24);
    player.placeAt(at.x - PLAYER.width / 2, at.y - 2);

    const first = player.step(IDLE, STEP, room);
    expect(first.grabbedRope).toBe(true);
    for (let i = 0; i < 30; i++) {
      expect(player.step(IDLE, STEP, room).grabbedRope).toBe(false);
    }
  });

  it('will not catch one from the ground', () => {
    const room = ropeRoom();
    const player = new Player();
    player.placeAt(128 - PLAYER.width / 2, (ROOM_ROWS - 1) * 8 - PLAYER.height);
    for (let i = 0; i < 20; i++) player.step(IDLE, STEP, room);
    expect(player.onGround).toBe(true);
    expect(player.ropeGrip).toBeNull();
  });

  it('will not catch one right at the pivot, or above it', () => {
    // The nearest grabbable point is MIN_GRIP down the rope, which is further
    // than a hand can reach from the pivot itself.
    expect(gripDistance(rope, 0, rope.cx, rope.cy, PLAYER.ropeReach)).toBeNull();
    expect(gripDistance(rope, 0, rope.cx, rope.cy - 40, PLAYER.ropeReach)).toBeNull();
    expect(gripDistance(rope, 0, rope.cx, rope.cy + MIN_GRIP, PLAYER.ropeReach)).toBeCloseTo(
      MIN_GRIP,
    );
  });

  it('will not catch one it is nowhere near', () => {
    expect(gripDistance(rope, 0, rope.cx + 60, rope.cy + 20, PLAYER.ropeReach)).toBeNull();
  });
});

describe('hanging from a rope', () => {
  it('is carried along the arc, and stays the same distance down it', () => {
    const room = ropeRoom();
    const player = new Player();
    catchRope(room, player, 36);

    const startedAt = player.x;
    const held = player.ropeGrip?.distance ?? 0;
    let moved = false;
    for (let i = 0; i < 40; i++) {
      player.step(IDLE, STEP, room);
      const at = ropePoint(rope, room.seconds, held);
      expect(player.x + PLAYER.width / 2).toBeCloseTo(at.x, 5);
      expect(player.y).toBeCloseTo(at.y, 5);
      if (Math.abs(player.x - startedAt) > 1) moved = true;
    }
    expect(moved, 'a rope that never takes you anywhere is a decoration').toBe(true);
    expect(player.ropeGrip?.distance, 'you hang where you caught it').toBeCloseTo(held, 5);
  });

  it('does not fall, however long it is held', () => {
    const room = ropeRoom();
    const player = new Player();
    catchRope(room, player, 36);

    for (let i = 0; i < 600; i++) {
      const result = player.step(IDLE, STEP, room);
      expect(result.died, 'hanging is not dangerous').toBeNull();
    }
    expect(player.ropeGrip).not.toBeNull();
    expect(player.fallDistance).toBe(0);
  });

  it('poses as hanging, so it can be drawn as hanging', () => {
    const room = ropeRoom();
    const player = new Player();
    catchRope(room, player, 20);
    expect(player.pose).toBe('hang');
  });
});

describe('letting go', () => {
  it('leaves from wherever the rope got you to, with an ordinary jump', () => {
    const room = ropeRoom();
    const player = new Player();
    catchRope(room, player, 40);
    for (let i = 0; i < 25; i++) player.step(IDLE, STEP, room);

    const leftFrom = { x: player.x, y: player.y };
    const result = player.step(JUMP, STEP, room);

    expect(result.jumped).toBe(true);
    expect(player.ropeGrip).toBeNull();
    // Straight up from the release point: no sideways fling, by design.
    expect(player.x).toBeCloseTo(leftFrom.x, 5);
    expect(player.y).toBeLessThanOrEqual(leftFrom.y);
  });

  it('gets the same height off a rope as off the floor', () => {
    const floorRoom = ropeRoom([]);
    const walker = new Player();
    walker.placeAt(40, (ROOM_ROWS - 1) * 8 - PLAYER.height);
    walker.step(IDLE, STEP, floorRoom);
    const groundStart = walker.y;
    let groundBest = walker.y;
    for (let i = 0; i < 40; i++) {
      walker.step(JUMP, STEP, floorRoom);
      groundBest = Math.min(groundBest, walker.y);
    }

    const room = ropeRoom();
    const player = new Player();
    catchRope(room, player, 40);
    const ropeStart = player.y;
    let ropeBest = player.y;
    for (let i = 0; i < 40; i++) {
      player.step(JUMP, STEP, room);
      ropeBest = Math.min(ropeBest, player.y);
    }

    expect(ropeStart - ropeBest).toBeCloseTo(groundStart - groundBest, 0);
  });

  it('cannot grab the same rope again straight away', () => {
    const room = ropeRoom();
    const player = new Player();
    catchRope(room, player, 40);
    player.step(JUMP, STEP, room);
    expect(player.ropeGrip).toBeNull();

    // Released, rising, and still overlapping the rope: it must not re-catch.
    for (let i = 0; i < 6; i++) {
      player.step(IDLE, STEP, room);
      expect(player.ropeGrip, 'a rope should not snatch you straight back').toBeNull();
    }
  });

  it('falls normally once let go of over a drop', () => {
    const room = ropeRoom();
    const player = new Player();
    catchRope(room, player, 40);
    player.step(JUMP, STEP, room);

    // Walking clear of it on the way down, so it does not simply catch again.
    let landed = false;
    for (let i = 0; i < 240; i++) {
      player.step({ left: true, right: false, jump: false }, STEP, room);
      if (player.onGround) {
        landed = true;
        break;
      }
    }
    expect(landed).toBe(true);
    expect(player.ropeGrip).toBeNull();
  });
});

describe('a room with no ropes', () => {
  it('never mentions them', () => {
    const room = ropeRoom([]);
    const player = new Player();
    player.placeAt(64, 40);
    for (let i = 0; i < 90; i++) {
      expect(player.step(IDLE, STEP, room).grabbedRope).toBe(false);
    }
    expect(player.ropeGrip).toBeNull();
  });
});
