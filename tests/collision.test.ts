import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../src/config';
import {
  boxesOverlap,
  insetBox,
  moveBox,
  overlapsHazard,
  supportColumns,
  sweepX,
  sweepY,
  type Box,
} from '../src/systems/CollisionSystem';
import { grid } from './helpers';

const box = (x: number, y: number, width = 8, height = 16): Box => ({ x, y, width, height });

describe('sweepX', () => {
  const walls = grid(['..#.....', '..#.....', '########']);

  it('moves freely through empty space', () => {
    expect(sweepX(box(0, 0), 3, walls)).toEqual({ x: 3, hitLeft: false, hitRight: false });
  });

  it('stops flush against a wall when moving right', () => {
    const result = sweepX(box(4, 0), 20, walls);
    expect(result.x).toBe(2 * TILE_SIZE - 8);
    expect(result.hitRight).toBe(true);
    expect(result.hitLeft).toBe(false);
  });

  it('stops flush against a wall when moving left', () => {
    const result = sweepX(box(30, 0), -30, walls);
    expect(result.x).toBe(3 * TILE_SIZE);
    expect(result.hitLeft).toBe(true);
  });

  it('does nothing at all when dx is zero', () => {
    expect(sweepX(box(4, 0), 0, walls)).toEqual({ x: 4, hitLeft: false, hitRight: false });
  });

  it('treats tiles outside the grid as empty, so exits are the caller"s business', () => {
    const result = sweepX(box(0, 0), -8, walls);
    expect(result.x).toBe(-8);
    expect(result.hitLeft).toBe(false);
  });
});

describe('sweepY', () => {
  const floor = grid(['........', '........', '########']);

  it('lands exactly on top of a solid tile', () => {
    const result = sweepY(box(0, 0), 100, floor);
    expect(result.y).toBe(2 * TILE_SIZE - 16);
    expect(result.onGround).toBe(true);
    expect(result.groundRow).toBe(2);
  });

  it('stops under a ceiling when moving up', () => {
    const ceiling = grid(['########', '........', '........']);
    const result = sweepY(box(0, 20), -30, ceiling);
    expect(result.y).toBe(TILE_SIZE);
    expect(result.hitCeiling).toBe(true);
    expect(result.onGround).toBe(false);
  });

  it('lands on a one-way platform approached from above', () => {
    const platform = grid(['........', '========', '........']);
    // Starts with its underside level with the top of the grid, so it really
    // is above the platform at row 1.
    const result = sweepY(box(0, -16), 40, platform);
    expect(result.y).toBe(TILE_SIZE - 16);
    expect(result.onGround).toBe(true);
    expect(result.groundRow).toBe(1);
  });

  it('falls past a platform its underside had already gone below', () => {
    const platform = grid(['........', '========', '########']);
    const result = sweepY(box(0, 0), 40, platform);
    expect(result.groundRow).toBe(2);
    expect(result.y).toBe(2 * TILE_SIZE - 16);
  });

  it('passes straight up through a one-way platform', () => {
    const platform = grid(['........', '========', '........']);
    const result = sweepY(box(0, 16), -20, platform);
    expect(result.y).toBe(-4);
    expect(result.onGround).toBe(false);
    expect(result.hitCeiling).toBe(false);
  });

  it('passes down through a platform it was already inside', () => {
    const platform = grid(['........', '========', '........']);
    // Bottom edge starts below the platform surface, so it must not snap up.
    const result = sweepY(box(0, 4), 4, platform);
    expect(result.onGround).toBe(false);
    expect(result.y).toBe(8);
  });

  it('reports the nearest landing when two rows are candidates', () => {
    const stack = grid(['........', '====....', '########']);
    const result = sweepY(box(0, -16), 100, stack);
    expect(result.groundRow).toBe(1);
    expect(result.y).toBe(TILE_SIZE - 16);
  });

  it('cannot tunnel through a floor however fast it is moving', () => {
    const floorOnly = grid(['........', '........', '########']);
    const result = sweepY(box(0, -100), 10000, floorOnly);
    expect(result.onGround).toBe(true);
    expect(result.y).toBe(2 * TILE_SIZE - 16);
  });
});

describe('moveBox', () => {
  it('resolves horizontally first, then vertically from the new position', () => {
    const world = grid(['........', '..#.....', '########']);
    const result = moveBox(box(0, 0), 40, 40, world);
    expect(result.hitRight).toBe(true);
    expect(result.x).toBe(2 * TILE_SIZE - 8);
    expect(result.onGround).toBe(true);
  });
});

describe('overlapsHazard', () => {
  const spikes = grid(['........', '........', '..^^....']);

  it('ignores a body resting above the spike tips', () => {
    // Spikes only occupy the bottom five pixels of their cell.
    expect(overlapsHazard({ x: 16, y: 0, width: 8, height: 16 }, spikes)).toBe(false);
  });

  it('kills a body that reaches into the spikes', () => {
    expect(overlapsHazard({ x: 16, y: 4, width: 8, height: 16 }, spikes)).toBe(true);
  });

  it('ignores a body beside the spikes', () => {
    expect(overlapsHazard({ x: 0, y: 8, width: 8, height: 16 }, spikes)).toBe(false);
  });
});

describe('geometry helpers', () => {
  it('finds the columns under a standing body', () => {
    expect(supportColumns({ x: 4, y: 0, width: 8, height: 16 }, 3)).toEqual([0, 1]);
    expect(supportColumns({ x: 8, y: 0, width: 8, height: 16 }, 3)).toEqual([1]);
    expect(supportColumns({ x: 8, y: 0, width: 8, height: 16 }, -1)).toEqual([]);
  });

  it('detects overlapping boxes', () => {
    expect(boxesOverlap(box(0, 0), box(4, 4))).toBe(true);
    expect(boxesOverlap(box(0, 0), box(8, 0))).toBe(false);
    expect(boxesOverlap(box(0, 0), box(0, 16))).toBe(false);
  });

  it('shrinks a box without ever inverting it', () => {
    expect(insetBox(box(10, 10), 1)).toEqual({ x: 11, y: 11, width: 6, height: 14 });
    expect(insetBox(box(0, 0, 2, 2), 5)).toEqual({ x: 5, y: 5, width: 0, height: 0 });
  });
});
