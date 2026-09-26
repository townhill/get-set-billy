import { describe, expect, it } from 'vitest';
import { FIXED_STEP_MS, PLAYER, PLAY_WIDTH, WORLD } from '../src/config';
import { Player, type PlayerInput, type StepResult } from '../src/objects/Player';
import type { Room } from '../src/world/Room';
import { flatRoom, testRoom } from './helpers';

const STEP = FIXED_STEP_MS / 1000;
const STILL: PlayerInput = { left: false, right: false, jump: false };
const RIGHT: PlayerInput = { left: false, right: true, jump: false };
const LEFT: PlayerInput = { left: true, right: false, jump: false };
const JUMP: PlayerInput = { left: false, right: false, jump: true };

/** Steps the player and returns every result, so tests can look for events. */
function run(player: Player, room: Room, input: PlayerInput, steps: number): StepResult[] {
  const results: StepResult[] = [];
  for (let i = 0; i < steps; i++) results.push(player.step(input, STEP, room));
  return results;
}

/** Drops the player onto the floor and waits for them to settle. */
function standing(room: Room, x = 64): Player {
  const player = new Player();
  player.placeAt(x, 100);
  run(player, room, STILL, 60);
  return player;
}

describe('walking', () => {
  it('moves at exactly the configured speed, with no run-up', () => {
    const room = flatRoom();
    const player = standing(room);
    const before = player.x;
    run(player, room, RIGHT, 1);
    expect(player.x - before).toBeCloseTo(PLAYER.walkSpeed * STEP, 5);
  });

  it('stops dead when the key is released, with no slide', () => {
    const room = flatRoom();
    const player = standing(room);
    run(player, room, RIGHT, 20);
    const stopped = player.x;
    run(player, room, STILL, 20);
    expect(player.x).toBe(stopped);
    expect(player.vx).toBe(0);
  });

  it('faces the way it is walking, and keeps facing that way when it stops', () => {
    const room = flatRoom();
    const player = standing(room);
    run(player, room, LEFT, 3);
    expect(player.facing).toBe(-1);
    run(player, room, STILL, 3);
    expect(player.facing).toBe(-1);
    run(player, room, RIGHT, 3);
    expect(player.facing).toBe(1);
  });
});

describe('jumping', () => {
  it('clears four tiles but not five, which is the whole basis of the level design', () => {
    const room = flatRoom();
    const player = standing(room);
    const ground = player.y;

    let highest = ground;
    player.step(STILL, STEP, room); // release, so the press is seen as a new one
    for (let i = 0; i < 60; i++) {
      player.step(JUMP, STEP, room);
      highest = Math.min(highest, player.y);
    }

    const height = ground - highest;
    // Continuous physics gives v^2/2g; stepping at a fixed rate adds half a
    // step of travel on top, which is where the extra couple of pixels go.
    const theoretical = PLAYER.jumpVelocity ** 2 / (2 * PLAYER.gravity);
    expect(height).toBeGreaterThanOrEqual(theoretical);
    expect(height).toBeLessThan(theoretical + 4);

    expect(height).toBeGreaterThanOrEqual(32); // a ledge four rows up is reachable
    expect(height).toBeLessThan(40); // one five rows up is not
  });

  it('is a fixed height: letting go early changes nothing', () => {
    const room = flatRoom();

    const held = standing(room);
    held.step(STILL, STEP, room);
    let heldPeak = held.y;
    for (let i = 0; i < 60; i++) {
      held.step(JUMP, STEP, room);
      heldPeak = Math.min(heldPeak, held.y);
    }

    const tapped = standing(room);
    tapped.step(STILL, STEP, room);
    tapped.step(JUMP, STEP, room);
    let tappedPeak = tapped.y;
    for (let i = 0; i < 60; i++) {
      tapped.step(STILL, STEP, room);
      tappedPeak = Math.min(tappedPeak, tapped.y);
    }

    expect(tappedPeak).toBeCloseTo(heldPeak, 5);
  });

  it('lands back on the floor it started from', () => {
    const room = flatRoom();
    const player = standing(room);
    const ground = player.y;
    player.step(STILL, STEP, room);
    run(player, room, JUMP, 90);
    expect(player.y).toBe(ground);
    expect(player.onGround).toBe(true);
  });

  it('allows a jump just after walking off a ledge (coyote time)', () => {
    // A short ledge with nothing to the right of it.
    const room = testRoom([
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '========',
    ]);
    const player = new Player();
    player.placeAt(0, 100);
    run(player, room, STILL, 40);
    expect(player.onGround).toBe(true);

    // Walk until the ledge runs out, then jump on the very next step.
    let steps = 0;
    while (player.onGround && steps < 200) {
      player.step(RIGHT, STEP, room);
      steps += 1;
    }
    expect(player.onGround).toBe(false);

    player.step({ left: false, right: true, jump: true }, STEP, room);
    expect(player.vy).toBe(-PLAYER.jumpVelocity);
  });

  it('refuses a jump once the grace period has passed', () => {
    const room = testRoom([
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '========',
    ]);
    const player = new Player();
    player.placeAt(0, 100);
    run(player, room, STILL, 40);

    let steps = 0;
    while (player.onGround && steps < 200) {
      player.step(RIGHT, STEP, room);
      steps += 1;
    }
    // Well past coyoteTimeMs by now.
    run(player, room, RIGHT, 10);
    const results = run(player, room, { left: false, right: true, jump: true }, 3);
    expect(results.every((r) => r.jumped)).toBe(false);
  });

  it('remembers a jump pressed slightly too early (jump buffer)', () => {
    const room = flatRoom();

    // Work out how long the drop takes, so the press can be aimed just short of it.
    const probe = new Player();
    probe.placeAt(64, 100);
    let untilLanding = 0;
    while (!probe.onGround && untilLanding < 200) {
      probe.step(STILL, STEP, room);
      untilLanding += 1;
    }

    const player = new Player();
    player.placeAt(64, 100);
    run(player, room, STILL, untilLanding - 2);
    expect(player.onGround).toBe(false);

    const results = run(player, room, JUMP, 10);
    expect(results.some((r) => r.landed)).toBe(true);
    expect(results.some((r) => r.jumped)).toBe(true);
  });

  it('forgets a jump pressed far too early', () => {
    const room = flatRoom();
    const player = new Player();
    player.placeAt(64, 0);
    run(player, room, STILL, 1);
    const results = run(player, room, JUMP, 40);
    const landed = results.findIndex((r) => r.landed);
    expect(landed).toBeGreaterThan(0);
    // The button went down far more than jumpBufferMs before touchdown.
    expect(results.slice(0, landed + 1).some((r) => r.jumped)).toBe(false);
  });
});

describe('dying', () => {
  it('survives a short drop', () => {
    const room = flatRoom();
    const player = new Player();
    player.placeAt(64, 152 - PLAYER.height - 40);
    const results = run(player, room, STILL, 60);
    expect(results.every((r) => r.died === null)).toBe(true);
  });

  it('does not survive a long one', () => {
    const room = flatRoom();
    const player = new Player();
    player.placeAt(64, 0);
    const results = run(player, room, STILL, 90);
    expect(results.some((r) => r.died === 'fall')).toBe(true);
  });

  it('reports the fall as fatal only once it lands', () => {
    const room = flatRoom();
    const player = new Player();
    player.placeAt(64, 0);
    const results = run(player, room, STILL, 90);
    const fatal = results.findIndex((r) => r.died === 'fall');
    expect(results[fatal].landed).toBe(true);
  });

  it('dies on spikes', () => {
    const sketch = Array(19).fill('.'.repeat(32));
    sketch[18] = '.'.repeat(8) + '^'.repeat(8) + '.'.repeat(16);
    sketch.push('#'.repeat(32));
    const room = testRoom(sketch);
    const player = new Player();
    player.placeAt(70, 120);
    const results = run(player, room, STILL, 60);
    expect(results.some((r) => r.died === 'hazard')).toBe(true);
  });

  it('is not killed by spikes it is merely standing near', () => {
    const sketch = Array(19).fill('.'.repeat(32));
    sketch[18] = '.'.repeat(8) + '^'.repeat(8) + '.'.repeat(16);
    sketch.push('#'.repeat(32));
    const room = testRoom(sketch);
    const player = new Player();
    player.placeAt(0, 120);
    const results = run(player, room, STILL, 60);
    expect(results.every((r) => r.died === null)).toBe(true);
  });
});

describe('seeing a fatal fall coming', () => {
  it('does not call an ordinary drop fatal', () => {
    const room = flatRoom();
    const player = new Player();
    player.placeAt(64, 152 - PLAYER.height - 40);
    for (let i = 0; i < 60; i++) {
      player.step(STILL, STEP, room);
      expect(player.fallIsFatal).toBe(false);
      expect(player.pose).not.toBe('plummet');
    }
  });

  it('says so before the landing, for exactly the falls the landing then kills', () => {
    const room = flatRoom();
    const player = new Player();
    player.placeAt(64, 0);
    let warnedAt = -1;
    let diedAt = -1;
    for (let i = 0; i < 90 && diedAt < 0; i++) {
      const result = player.step(STILL, STEP, room);
      if (warnedAt < 0 && player.fallIsFatal) warnedAt = i;
      if (result.died === 'fall') diedAt = i;
    }
    expect(warnedAt, 'never warned').toBeGreaterThanOrEqual(0);
    expect(diedAt, 'never died').toBeGreaterThan(warnedAt);
  });

  it('switches to the flailing pose while the fall is fatal', () => {
    const room = flatRoom();
    const player = new Player();
    player.placeAt(64, 0);
    while (!player.fallIsFatal) player.step(STILL, STEP, room);
    expect(player.fallDistance).toBeGreaterThan(PLAYER.fatalFallDistance);
    expect(player.pose).toBe('plummet');
  });

  it('is never fatal while standing', () => {
    const player = standing(flatRoom());
    expect(player.fallIsFatal).toBe(false);
  });
});

describe('landing', () => {
  it('reports how far the player fell, on the step they land and on no other', () => {
    const room = flatRoom();
    const player = new Player();
    player.placeAt(64, 152 - PLAYER.height - 40);
    const results = run(player, room, STILL, 60);
    const landing = results.find((r) => r.landed);
    // Measured the way the fatal-fall rule measures it, which stops counting on
    // the step before touchdown: a little under the forty pixels dropped.
    expect(landing?.landedFrom).toBeGreaterThan(32);
    expect(landing?.landedFrom).toBeLessThanOrEqual(40);
    expect(results.filter((r) => r.landedFrom > 0)).toHaveLength(1);
  });
});

describe('leaving the room', () => {
  it('reports the direction when there is a way out', () => {
    const room = flatRoom({ exits: { right: 'somewhere-else' } });
    const player = standing(room, PLAY_WIDTH - 20);
    const results = run(player, room, RIGHT, 60);
    expect(results.some((r) => r.leftRoom === 'right')).toBe(true);
  });

  it('bumps into the edge when there is not', () => {
    const room = flatRoom();
    const player = standing(room, PLAY_WIDTH - 20);
    const results = run(player, room, RIGHT, 60);
    expect(results.every((r) => r.leftRoom === null)).toBe(true);
    expect(player.x).toBe(PLAY_WIDTH - PLAYER.width);
  });

  it('reports falling out of the bottom', () => {
    const room = testRoom(Array(20).fill('.'.repeat(32)), { exits: { down: 'the-cellar' } });
    const player = new Player();
    player.placeAt(64, 100);
    const results = run(player, room, STILL, 60);
    expect(results.some((r) => r.leftRoom === 'down')).toBe(true);
  });
});

describe('conveyors', () => {
  it('drags a player who is standing still', () => {
    const sketch = Array(19).fill('.'.repeat(32));
    sketch.push('>'.repeat(32));
    const room = testRoom(sketch);
    const player = standing(room, 64);
    const before = player.x;
    run(player, room, STILL, 30);
    expect(player.x).toBeGreaterThan(before);
    expect(player.x - before).toBeCloseTo((WORLD.conveyorSpeed * 30) / 60, 0);
  });

  it('lets the player walk against it, only slower', () => {
    const sketch = Array(19).fill('.'.repeat(32));
    sketch.push('>'.repeat(32));
    const room = testRoom(sketch);
    const player = standing(room, 128);
    const before = player.x;
    run(player, room, LEFT, 30);
    expect(player.x).toBeLessThan(before);
    expect(before - player.x).toBeLessThan((PLAYER.walkSpeed * 30) / 60);
  });
});

describe('crumbling floors', () => {
  it('gives way after being stood on, and drops the player', () => {
    const sketch = Array(16).fill('.'.repeat(32));
    sketch.push('%'.repeat(32)); // row 16
    sketch.push('.'.repeat(32));
    sketch.push('.'.repeat(32));
    sketch.push('#'.repeat(32));
    const room = testRoom(sketch);

    const player = new Player();
    player.placeAt(64, 16 * 8 - PLAYER.height);
    run(player, room, STILL, 2);
    expect(player.onGround).toBe(true);
    const perched = player.y;

    const stepsToCollapse = Math.ceil(WORLD.crumbleLifetimeMs / FIXED_STEP_MS) + 20;
    const results = run(player, room, STILL, stepsToCollapse);
    expect(results.some((r) => r.floorsCollapsed > 0)).toBe(true);
    expect(player.y).toBeGreaterThan(perched);
    expect(player.onGround).toBe(true); // landed on the real floor below
  });

  it('leaves a floor alone if nobody stands on it', () => {
    const sketch = Array(16).fill('.'.repeat(32));
    sketch.push('%'.repeat(32));
    sketch.push('.'.repeat(32));
    sketch.push('.'.repeat(32));
    sketch.push('#'.repeat(32));
    const room = testRoom(sketch);
    room.updateCrumbling(5000);
    expect(room.charAt(4, 16)).toBe('%');
  });
});
