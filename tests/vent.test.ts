import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../src/config';
import { ENEMY_SPRITES, VENT_KINDS } from '../src/assets/sprites';
import { enemyBox, enemyIsLethal, enemyPeriod, ventStage } from '../src/objects/Enemy';
import { Room } from '../src/world/Room';
import { ALL_ROOM_DATA } from '../src/world/RoomManager';
import {
  type EnemyDef,
  type RoomData,
  VENT_WARNING_SECONDS,
  validateRoomShape,
} from '../src/world/roomTypes';
import { tileDef } from '../src/world/tiles';
import { flatRoom } from './helpers';

type Vent = Extract<EnemyDef, { type: 'vent' }>;

const vent = (overrides: Partial<Vent> = {}): Vent => ({
  type: 'vent',
  id: 'test-vent',
  sprite: 'steam',
  x: 64,
  y: 136,
  cells: 2,
  period: 3,
  on: 1,
  ...overrides,
});

const SIZE = ENEMY_SPRITES.steam;

describe('a vent', () => {
  it('is quiet, then sputters, then fires, at the end of each period', () => {
    const def = vent();
    expect(ventStage(def, 0)).toBe('idle');
    expect(ventStage(def, 1.4)).toBe('idle');
    expect(ventStage(def, 2 - VENT_WARNING_SECONDS)).toBe('warning');
    expect(ventStage(def, 1.9)).toBe('warning');
    expect(ventStage(def, 2)).toBe('firing');
    expect(ventStage(def, 2.99)).toBe('firing');
    expect(ventStage(def, 3)).toBe('idle');
  });

  it('keeps time forever, exactly like everything else on the room clock', () => {
    const def = vent();
    for (const t of [0.3, 1.7, 2.2, 2.9]) {
      expect(ventStage(def, t + 100 * def.period)).toBe(ventStage(def, t));
    }
    expect(enemyPeriod(def)).toBe(def.period);
  });

  it('is shifted along its cycle by its phase', () => {
    const def = vent({ phase: 0.5 });
    // Half of a three-second period in: the same as 1.5s into an unshifted one.
    expect(ventStage(def, 0)).toBe(ventStage(vent(), 1.5));
    expect(ventStage(def, 0.5)).toBe('firing');
  });

  it('is only deadly while it fires', () => {
    const def = vent();
    expect(enemyIsLethal(def, 0.5)).toBe(false);
    expect(enemyIsLethal(def, 1.8)).toBe(false);
    expect(enemyIsLethal(def, 2.5)).toBe(true);
  });

  it('leaves every other resident deadly all the time', () => {
    const bowler: EnemyDef = { type: 'static', id: 'b', sprite: 'bowler', x: 0, y: 0 };
    for (const t of [0, 0.5, 2.5]) expect(enemyIsLethal(bowler, t)).toBe(true);
  });

  it('is as tall as its jet, however big the sprite that draws a cell of it', () => {
    const box = enemyBox(vent({ cells: 3, y: 128 }), 0, SIZE);
    expect(box).toEqual({ x: 64, y: 128, width: TILE_SIZE, height: 3 * TILE_SIZE });
  });
});

describe('checking a vent', () => {
  const room = (enemy: Vent): RoomData => ({ ...flatRoom().data, enemies: [enemy] });

  it('accepts a sensible one', () => {
    expect(validateRoomShape(room(vent()))).toEqual([]);
  });

  it('refuses one with no quiet spell to walk past it in', () => {
    const issues = validateRoomShape(room(vent({ period: 1.2, on: 1 })));
    expect(issues.join()).toMatch(/no quiet spell/);
  });

  it('refuses one that never fires, or has no height', () => {
    expect(validateRoomShape(room(vent({ on: 0 }))).join()).toMatch(/never fires/);
    expect(validateRoomShape(room(vent({ cells: 0 }))).join()).toMatch(/one cell tall/);
  });

  it('refuses one that is off the grid', () => {
    expect(validateRoomShape(room(vent({ x: 63 }))).join()).toMatch(/cell boundary/);
  });
});

/** Every vent in the house, with the room it is in. */
const HOUSE_VENTS: { room: RoomData; def: Vent }[] = ALL_ROOM_DATA.flatMap((room) =>
  (room.enemies ?? [])
    .filter((enemy): enemy is Vent => enemy.type === 'vent')
    .map((def) => ({ room, def })),
);

describe('the vents in the house', () => {
  it('exist, since the house was built to have some', () => {
    expect(HOUSE_VENTS.length).toBeGreaterThan(0);
  });

  it.each(HOUSE_VENTS.map(({ room, def }) => [`${room.id}/${def.id}`, room, def] as const))(
    '%s is fair',
    (_name, data, def) => {
      const grid = new Room(data);
      const col = def.x / TILE_SIZE;
      const top = def.y / TILE_SIZE;

      expect(Object.keys(VENT_KINDS), 'draws as steam or flame').toContain(def.sprite);

      // The grating sits on something, so a vent is never a jet out of mid-air.
      const below = top + def.cells;
      expect(grid.solidAt(col, below) || grid.platformAt(col, below), 'stands on a floor').toBe(
        true,
      );

      // And the jet itself is out in the open, not buried in a wall.
      for (let row = top; row < below; row++) {
        const char = grid.rawCharAt(col, row);
        expect(tileDef(char).solid, `cell ${col},${row} is "${char}"`).toBe(false);
      }

      // Walking in never means walking into a jet of steam.
      expect(ventStage(def, 0), 'firing on arrival').not.toBe('firing');

      // And there is always time to get past: the warning, and half a second more.
      expect(def.period - def.on).toBeGreaterThanOrEqual(VENT_WARNING_SECONDS + 0.5);
    },
  );
});
