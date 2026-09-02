import { describe, expect, it } from 'vitest';
import { enemyBox, enemyFacing, enemyPeriod, enemyPosition } from '../src/objects/Enemy';
import type { EnemyDef } from '../src/world/roomTypes';

const SIZE = { width: 8, height: 8 };

describe('horizontal patrols', () => {
  const def: EnemyDef = {
    type: 'patrol-h',
    id: 'test',
    sprite: 'bowler',
    y: 100,
    from: 40,
    to: 120,
    speed: 80,
  };

  it('starts at the near end and never leaves its stretch', () => {
    expect(enemyPosition(def, 0, SIZE)).toEqual({ x: 40, y: 100 });
    for (let t = 0; t < 10; t += 0.017) {
      const { x, y } = enemyPosition(def, t, SIZE);
      expect(x).toBeGreaterThanOrEqual(40);
      expect(x).toBeLessThanOrEqual(120);
      expect(y).toBe(100);
    }
  });

  it('turns round at the far end', () => {
    // 80 pixels at 80 px/s: one second out, one second back.
    expect(enemyPosition(def, 1, SIZE).x).toBeCloseTo(120, 5);
    expect(enemyPosition(def, 2, SIZE).x).toBeCloseTo(40, 5);
    expect(enemyPosition(def, 0.5, SIZE).x).toBeCloseTo(80, 5);
    expect(enemyPosition(def, 1.5, SIZE).x).toBeCloseTo(80, 5);
  });

  it('repeats exactly, one cycle later', () => {
    for (const t of [0.1, 0.37, 0.9, 1.6]) {
      expect(enemyPosition(def, t, SIZE).x).toBeCloseTo(enemyPosition(def, t + 2, SIZE).x, 5);
    }
  });

  it('is shifted along its cycle by the phase', () => {
    const shifted: EnemyDef = { ...def, phase: 0.5 };
    expect(enemyPosition(shifted, 0, SIZE).x).toBeCloseTo(120, 5);
  });

  it('reports which way it is going', () => {
    expect(enemyFacing(def, 0.2, SIZE)).toBe(1);
    expect(enemyFacing(def, 1.2, SIZE)).toBe(-1);
  });
});

describe('vertical patrols', () => {
  const def: EnemyDef = {
    type: 'patrol-v',
    id: 'test',
    sprite: 'ghost',
    x: 64,
    from: 20,
    to: 60,
    speed: 40,
  };

  it('moves only on the y axis', () => {
    for (let t = 0; t < 5; t += 0.05) {
      const { x, y } = enemyPosition(def, t, SIZE);
      expect(x).toBe(64);
      expect(y).toBeGreaterThanOrEqual(20);
      expect(y).toBeLessThanOrEqual(60);
    }
  });
});

describe('circling enemies', () => {
  const def: EnemyDef = {
    type: 'circle',
    id: 'test',
    sprite: 'moth',
    cx: 100,
    cy: 80,
    radius: 20,
    speed: 90,
  };

  it('stays exactly on its circle, measured from the sprite centre', () => {
    for (let t = 0; t < 4; t += 0.05) {
      const { x, y } = enemyPosition(def, t, SIZE);
      const dx = x + SIZE.width / 2 - 100;
      const dy = y + SIZE.height / 2 - 80;
      expect(Math.hypot(dx, dy)).toBeCloseTo(20, 5);
    }
  });

  it('goes all the way round in the time its speed implies', () => {
    const start = enemyPosition(def, 0, SIZE);
    const lap = enemyPosition(def, 4, SIZE); // 90 deg/s -> 4 seconds
    expect(lap.x).toBeCloseTo(start.x, 5);
    expect(lap.y).toBeCloseTo(start.y, 5);
  });

  it('goes the other way when the speed is negative', () => {
    const clockwise = enemyPosition(def, 0.5, SIZE);
    const other = enemyPosition({ ...def, speed: -90 }, 0.5, SIZE);
    expect(other.y).toBeCloseTo(160 - clockwise.y - SIZE.height, 5);
  });
});

describe('pendulums', () => {
  const def: EnemyDef = {
    type: 'pendulum',
    id: 'test',
    sprite: 'cog',
    cx: 128,
    cy: 40,
    length: 40,
    arc: 90,
    speed: 90,
  };

  it('hangs at exactly its length from the pivot', () => {
    for (let t = 0; t < 4; t += 0.05) {
      const { x, y } = enemyPosition(def, t, SIZE);
      const dx = x + SIZE.width / 2 - 128;
      const dy = y + SIZE.height / 2 - 40;
      expect(Math.hypot(dx, dy)).toBeCloseTo(40, 5);
    }
  });

  it('never swings beyond half the arc either side of straight down', () => {
    const limit = Math.sin(((def.type === 'pendulum' ? def.arc : 0) / 2) * (Math.PI / 180)) * 40;
    for (let t = 0; t < 6; t += 0.02) {
      const { x } = enemyPosition(def, t, SIZE);
      const offset = x + SIZE.width / 2 - 128;
      expect(Math.abs(offset)).toBeLessThanOrEqual(limit + 1e-6);
    }
  });

  it('starts hanging straight down', () => {
    const { x, y } = enemyPosition(def, 0, SIZE);
    expect(x + SIZE.width / 2).toBeCloseTo(128, 5);
    expect(y + SIZE.height / 2).toBeCloseTo(80, 5);
  });
});

describe('static hazards', () => {
  const def: EnemyDef = { type: 'static', id: 'test', sprite: 'candle', x: 50, y: 60 };

  it('never moves, ever', () => {
    for (const t of [0, 1, 99, 12345]) {
      expect(enemyPosition(def, t, SIZE)).toEqual({ x: 50, y: 60 });
    }
  });

  it('always faces right, having nowhere else to look', () => {
    expect(enemyFacing(def, 3, SIZE)).toBe(1);
  });
});

describe('waypoint walkers', () => {
  const square: EnemyDef = {
    type: 'waypoint',
    id: 'test',
    sprite: 'mouse',
    points: [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 30 },
      { x: 0, y: 30 },
    ],
    speed: 20,
  };

  it('starts on the first point', () => {
    expect(enemyPosition(square, 0, SIZE)).toEqual({ x: 0, y: 0 });
  });

  it('closes the loop, so the last leg returns to the start', () => {
    // 40 across, 30 down, 40 back, 30 up.
    expect(enemyPeriod(square)).toBeCloseTo(140 / 20);
    expect(enemyPosition(square, 140 / 20, SIZE).x).toBeCloseTo(0);
    expect(enemyPosition(square, 140 / 20, SIZE).y).toBeCloseTo(0);
  });

  it('walks each leg at the speed it was given', () => {
    expect(enemyPosition(square, 1, SIZE)).toEqual({ x: 20, y: 0 });
    expect(enemyPosition(square, 2, SIZE)).toEqual({ x: 40, y: 0 });
    expect(enemyPosition(square, 3, SIZE)).toEqual({ x: 40, y: 20 });
  });

  it('never leaves the box its points describe', () => {
    for (let t = 0; t < 20; t += 0.05) {
      const at = enemyPosition(square, t, SIZE);
      expect(at.x).toBeGreaterThanOrEqual(-0.001);
      expect(at.x).toBeLessThanOrEqual(40.001);
      expect(at.y).toBeGreaterThanOrEqual(-0.001);
      expect(at.y).toBeLessThanOrEqual(30.001);
    }
  });

  it('is a patrol when it has only two points', () => {
    const there: EnemyDef = {
      type: 'waypoint',
      id: 'test',
      sprite: 'mouse',
      points: [
        { x: 0, y: 8 },
        { x: 60, y: 8 },
      ],
      speed: 30,
    };
    expect(enemyPosition(there, 0, SIZE)).toEqual({ x: 0, y: 8 });
    expect(enemyPosition(there, 2, SIZE)).toEqual({ x: 60, y: 8 });
    expect(enemyPosition(there, 4, SIZE).x).toBeCloseTo(0);
    expect(enemyPosition(there, 3, SIZE).x).toBeCloseTo(30);
  });

  it('turns round to face the way it is going', () => {
    expect(enemyFacing(square, 0.5, SIZE)).toBe(1);
    expect(enemyFacing(square, 4, SIZE)).toBe(-1);
  });

  it('is shifted along its cycle by the phase', () => {
    const shifted: EnemyDef = { ...square, phase: 0.5 } as EnemyDef;
    const period = enemyPeriod(square);
    expect(enemyPosition(shifted, 0, SIZE)).toEqual(enemyPosition(square, period / 2, SIZE));
  });

  it('sits still when told to walk a path of no length', () => {
    const stuck: EnemyDef = {
      type: 'waypoint',
      id: 'test',
      sprite: 'mouse',
      points: [
        { x: 12, y: 12 },
        { x: 12, y: 12 },
      ],
      speed: 40,
    };
    expect(enemyPeriod(stuck)).toBe(0);
    expect(enemyPosition(stuck, 9, SIZE)).toEqual({ x: 12, y: 12 });
  });
});

describe('figure-eight fliers', () => {
  const def: EnemyDef = {
    type: 'figure-eight',
    id: 'test',
    sprite: 'wasp',
    cx: 100,
    cy: 60,
    width: 40,
    height: 16,
    speed: 90,
  };

  it('starts at the crossing point, in the middle', () => {
    const at = enemyPosition(def, 0, SIZE);
    expect(at.x).toBeCloseTo(100 - SIZE.width / 2);
    expect(at.y).toBeCloseTo(60 - SIZE.height / 2);
  });

  it('stays inside the half-extents it was given', () => {
    const period = enemyPeriod(def);
    for (let i = 0; i <= 600; i++) {
      const at = enemyPosition(def, (period * i) / 600, SIZE);
      expect(Math.abs(at.x + SIZE.width / 2 - 100)).toBeLessThanOrEqual(40.001);
      expect(Math.abs(at.y + SIZE.height / 2 - 60)).toBeLessThanOrEqual(16.001);
    }
  });

  it('crosses its own path in the middle, which is what makes it an eight', () => {
    const period = enemyPeriod(def);
    const centre = enemyPosition(def, 0, SIZE);
    const half = enemyPosition(def, period / 2, SIZE);
    // Half a lap apart and in the same place: that is the crossing.
    expect(half.x).toBeCloseTo(centre.x);
    expect(half.y).toBeCloseTo(centre.y);
  });

  it('reaches each side with the two lobes between', () => {
    const period = enemyPeriod(def);
    const at = (fraction: number) => {
      const p = enemyPosition(def, period * fraction, SIZE);
      return { x: p.x + SIZE.width / 2 - 100, y: p.y + SIZE.height / 2 - 60 };
    };

    // A quarter and three quarters of the way round: the far right and far
    // left, both back on the centre line.
    expect(at(0.25).x).toBeCloseTo(40);
    expect(at(0.25).y).toBeCloseTo(0);
    expect(at(0.75).x).toBeCloseTo(-40);
    expect(at(0.75).y).toBeCloseTo(0);

    // An eighth and three eighths: the top and bottom of the right-hand lobe.
    expect(at(0.125).y).toBeCloseTo(16);
    expect(at(0.375).y).toBeCloseTo(-16);
    expect(at(0.125).x).toBeCloseTo(at(0.375).x);
  });

  it('goes all the way round in the time its speed implies', () => {
    expect(enemyPeriod(def)).toBeCloseTo(4); // 360 degrees at 90 deg/s
    const start = enemyPosition(def, 0, SIZE);
    const later = enemyPosition(def, 4, SIZE);
    expect(later.x).toBeCloseTo(start.x);
    expect(later.y).toBeCloseTo(start.y);
  });
});

describe('determinism', () => {
  it('gives the same answer for the same time, every time', () => {
    const defs: EnemyDef[] = [
      { type: 'patrol-h', id: 'a', sprite: 'bowler', y: 10, from: 0, to: 90, speed: 37 },
      { type: 'patrol-v', id: 'b', sprite: 'ghost', x: 10, from: 0, to: 90, speed: 53 },
      { type: 'circle', id: 'c', sprite: 'moth', cx: 50, cy: 50, radius: 17, speed: 123 },
      { type: 'pendulum', id: 'd', sprite: 'cog', cx: 50, cy: 10, length: 30, arc: 70, speed: 61 },
      {
        type: 'waypoint',
        id: 'e',
        sprite: 'mouse',
        points: [
          { x: 0, y: 0 },
          { x: 31, y: 17 },
          { x: 5, y: 40 },
        ],
        speed: 29,
      },
      {
        type: 'figure-eight',
        id: 'f',
        sprite: 'wasp',
        cx: 40,
        cy: 40,
        width: 20,
        height: 9,
        speed: 47,
      },
    ];
    for (const def of defs) {
      for (const t of [0, 0.333, 7.77]) {
        expect(enemyPosition(def, t, SIZE)).toEqual(enemyPosition(def, t, SIZE));
      }
    }
  });

  it('produces a box the size of the sprite', () => {
    const def: EnemyDef = { type: 'static', id: 'x', sprite: 'candle', x: 8, y: 16 };
    expect(enemyBox(def, 0, { width: 8, height: 8 })).toEqual({
      x: 8,
      y: 16,
      width: 8,
      height: 8,
    });
  });
});
