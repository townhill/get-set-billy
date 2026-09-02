import { describe, expect, it } from 'vitest';
import { FIXED_STEP_MS, ROOM_COLS, ROOM_ROWS } from '../src/config';
import { Player } from '../src/objects/Player';
import { testRoom } from './helpers';

/**
 * Levers and hatches.
 *
 * A hatch is a ledge that is only there while the room's switch is one way
 * round, and a lever swaps it over. The switch is room-local and reset every
 * time the room is entered, on purpose: it can never become hidden state that
 * follows the player about the house, and no arrangement of it survives a
 * death, so it can never leave the game in a position a fresh visit cannot undo.
 */

const STEP = FIXED_STEP_MS / 1000;
const IDLE = { left: false, right: false, jump: false };

/**
 * A floor, a lever standing on it, a hatch that starts shut and one that starts
 * open — both a row above the floor so they are easy to ask about.
 */
function switchRoom(): ReturnType<typeof testRoom> {
  const rows = Array.from({ length: ROOM_ROWS }, () => '.'.repeat(ROOM_COLS));
  rows[ROOM_ROWS - 1] = '#'.repeat(ROOM_COLS);
  rows[ROOM_ROWS - 3] = '.'.repeat(4) + '!' + '.'.repeat(ROOM_COLS - 5);
  rows[10] = '.'.repeat(10) + '[[[[' + '.'.repeat(4) + ']]]]' + '.'.repeat(ROOM_COLS - 22);
  const room = testRoom(rows);
  room.reset();
  return room;
}

describe('hatches', () => {
  it('start with the shut ones there and the open ones not', () => {
    const room = switchRoom();
    expect(room.switchState).toBe(false);
    expect(room.platformAt(10, 10), 'a "[" hatch is a ledge to begin with').toBe(true);
    expect(room.platformAt(18, 10), 'a "]" hatch is not').toBe(false);
    expect(room.charAt(18, 10), 'and reads as plain air').toBe('.');
  });

  it('swap over when the switch is thrown', () => {
    const room = switchRoom();
    room.setSwitch(true);
    expect(room.platformAt(10, 10)).toBe(false);
    expect(room.platformAt(18, 10)).toBe(true);
  });

  it('are never solid, so they cannot wall anybody in', () => {
    const room = switchRoom();
    for (const on of [false, true]) {
      room.setSwitch(on);
      expect(room.solidAt(10, 10)).toBe(false);
      expect(room.solidAt(18, 10)).toBe(false);
    }
  });
});

describe('levers', () => {
  const leverCol = 4;
  const standingY = (ROOM_ROWS - 1) * 8 - 16;

  it('flip the switch when the player touches one', () => {
    const room = switchRoom();
    const player = new Player();
    player.placeAt(leverCol * 8, standingY);

    const result = player.step(IDLE, STEP, room);
    expect(result.flippedSwitch).toBe(true);
    expect(room.switchState).toBe(true);
  });

  it('flip once per touch, however long you stand on them', () => {
    const room = switchRoom();
    const player = new Player();
    player.placeAt(leverCol * 8, standingY);

    let flips = 0;
    for (let i = 0; i < 120; i++) {
      if (player.step(IDLE, STEP, room).flippedSwitch) flips += 1;
    }
    expect(flips, 'standing on a lever should not make it chatter').toBe(1);
    expect(room.switchState).toBe(true);
  });

  it('flip again when you walk off and come back', () => {
    const room = switchRoom();
    const player = new Player();
    player.placeAt(leverCol * 8, standingY);
    player.step(IDLE, STEP, room);
    expect(room.switchState).toBe(true);

    // Away, far enough to be clear of it...
    for (let i = 0; i < 40; i++) player.step({ left: false, right: true, jump: false }, STEP, room);
    expect(room.switchState).toBe(true);

    // ...and back again.
    let flippedBack = false;
    for (let i = 0; i < 80; i++) {
      if (player.step({ left: true, right: false, jump: false }, STEP, room).flippedSwitch) {
        flippedBack = true;
        break;
      }
    }
    expect(flippedBack).toBe(true);
    expect(room.switchState).toBe(false);
  });

  it('are put back the way they were when the room resets', () => {
    const room = switchRoom();
    const player = new Player();
    player.placeAt(leverCol * 8, standingY);
    player.step(IDLE, STEP, room);
    expect(room.switchState).toBe(true);

    room.reset();
    expect(room.switchState).toBe(false);
    expect(room.platformAt(10, 10)).toBe(true);
  });
});

describe('a room with no lever', () => {
  it('never reports a flip, and never has one to report', () => {
    const rows = Array.from({ length: ROOM_ROWS }, () => '.'.repeat(ROOM_COLS));
    rows[ROOM_ROWS - 1] = '#'.repeat(ROOM_COLS);
    const room = testRoom(rows);
    room.reset();
    expect(room.hasSwitch).toBe(false);

    const player = new Player();
    player.placeAt(32, (ROOM_ROWS - 1) * 8 - 16);
    for (let i = 0; i < 60; i++) {
      expect(player.step(IDLE, STEP, room).flippedSwitch).toBe(false);
    }
    expect(room.switchState).toBe(false);
  });
});
