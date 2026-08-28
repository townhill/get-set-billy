import { TILE_SIZE } from '../config';
import type { HazardRect } from '../world/tiles';

/**
 * Deterministic axis-separated AABB collision against a grid of tiles.
 *
 * Everything here is a pure function of its arguments, so the whole movement
 * model can be exercised in unit tests without Phaser, a canvas or a clock.
 *
 * The rules, in full:
 *   - Movement is resolved on one axis at a time, X first.
 *   - A solid tile blocks from all four sides.
 *   - A platform tile blocks downward movement only, and only if the body was
 *     already entirely above it before the step. You jump straight through it.
 *   - Nothing ever bounces, slides, rotates or accumulates momentum.
 *   - Tiles outside the grid are treated as empty; the room boundary is the
 *     caller's business, because that is where the doors are.
 */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The read-only view of a room that collision needs. */
export interface TileGrid {
  readonly cols: number;
  readonly rows: number;
  solidAt(col: number, row: number): boolean;
  platformAt(col: number, row: number): boolean;
  hazardAt(col: number, row: number): HazardRect | null;
}

export interface SweepXResult {
  x: number;
  hitLeft: boolean;
  hitRight: boolean;
}

export interface SweepYResult {
  y: number;
  onGround: boolean;
  hitCeiling: boolean;
  /** Row index of the tile landed on, or -1 when airborne. */
  groundRow: number;
}

export interface MoveResult extends SweepXResult, Omit<SweepYResult, 'y'> {
  y: number;
}

function rowRange(box: Box): [number, number] {
  return [Math.floor(box.y / TILE_SIZE), Math.ceil((box.y + box.height) / TILE_SIZE) - 1];
}

function colRange(box: Box): [number, number] {
  return [Math.floor(box.x / TILE_SIZE), Math.ceil((box.x + box.width) / TILE_SIZE) - 1];
}

/**
 * Moves a box horizontally by `dx`, stopping at the first solid tile in its path.
 *
 * The whole swept range is checked, not just where the box ends up, so nothing
 * can pass through a wall however fast it is going. Only cells the box was
 * genuinely clear of before the step can block it, which means a body somehow
 * overlapping a wall is nudged out rather than flung across the room.
 */
export function sweepX(box: Box, dx: number, grid: TileGrid): SweepXResult {
  if (dx === 0) return { x: box.x, hitLeft: false, hitRight: false };

  const [r0, r1] = rowRange(box);
  const blocked = (col: number): boolean => {
    for (let row = r0; row <= r1; row++) {
      if (grid.solidAt(col, row)) return true;
    }
    return false;
  };

  if (dx > 0) {
    const oldRight = box.x + box.width;
    const newRight = oldRight + dx;
    const first = Math.ceil(oldRight / TILE_SIZE);
    let last = Math.ceil(newRight / TILE_SIZE) - 1;
    if (newRight >= first * TILE_SIZE) last = Math.max(last, first);
    for (let col = first; col <= last; col++) {
      if (blocked(col)) return { x: col * TILE_SIZE - box.width, hitLeft: false, hitRight: true };
    }
  } else {
    const oldLeft = box.x;
    const newLeft = oldLeft + dx;
    const first = Math.floor(oldLeft / TILE_SIZE - 1);
    let last = Math.floor(newLeft / TILE_SIZE);
    if (newLeft <= (first + 1) * TILE_SIZE) last = Math.min(last, first);
    for (let col = first; col >= last; col--) {
      if (blocked(col)) return { x: (col + 1) * TILE_SIZE, hitLeft: true, hitRight: false };
    }
  }

  return { x: box.x + dx, hitLeft: false, hitRight: false };
}

/**
 * Moves a box vertically by `dy`, landing it on solid tiles and on platform
 * tiles it was above at the start of the step.
 *
 * Because only rows starting at or below the box's previous underside are
 * considered, "was I above this platform?" falls out of the geometry rather
 * than needing a separate check.
 */
export function sweepY(box: Box, dy: number, grid: TileGrid): SweepYResult {
  const still: SweepYResult = { y: box.y, onGround: false, hitCeiling: false, groundRow: -1 };
  if (dy === 0) return still;

  const [c0, c1] = colRange(box);

  if (dy > 0) {
    const oldBottom = box.y + box.height;
    const newBottom = oldBottom + dy;
    const first = Math.ceil(oldBottom / TILE_SIZE);
    let last = Math.ceil(newBottom / TILE_SIZE) - 1;
    if (newBottom >= first * TILE_SIZE) last = Math.max(last, first);

    for (let row = first; row <= last; row++) {
      for (let col = c0; col <= c1; col++) {
        if (!grid.solidAt(col, row) && !grid.platformAt(col, row)) continue;
        return {
          y: row * TILE_SIZE - box.height,
          onGround: true,
          hitCeiling: false,
          groundRow: row,
        };
      }
    }
  } else {
    const oldTop = box.y;
    const newTop = oldTop + dy;
    const first = Math.floor(oldTop / TILE_SIZE - 1);
    let last = Math.floor(newTop / TILE_SIZE);
    if (newTop <= (first + 1) * TILE_SIZE) last = Math.min(last, first);

    for (let row = first; row >= last; row--) {
      for (let col = c0; col <= c1; col++) {
        if (!grid.solidAt(col, row)) continue;
        return {
          y: (row + 1) * TILE_SIZE,
          onGround: false,
          hitCeiling: true,
          groundRow: -1,
        };
      }
    }
  }

  return { ...still, y: box.y + dy };
}

/** Convenience wrapper: sweep X, then sweep Y from the resolved X. */
export function moveBox(box: Box, dx: number, dy: number, grid: TileGrid): MoveResult {
  const horizontal = sweepX(box, dx, grid);
  const vertical = sweepY({ ...box, x: horizontal.x }, dy, grid);
  return {
    x: horizontal.x,
    y: vertical.y,
    hitLeft: horizontal.hitLeft,
    hitRight: horizontal.hitRight,
    onGround: vertical.onGround,
    hitCeiling: vertical.hitCeiling,
    groundRow: vertical.groundRow,
  };
}

/** True when any hazard sub-rectangle overlaps the box. */
export function overlapsHazard(box: Box, grid: TileGrid): boolean {
  const [c0, c1] = colRange(box);
  const [r0, r1] = rowRange(box);
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const hazard = grid.hazardAt(col, row);
      if (!hazard) continue;
      const hx = col * TILE_SIZE + hazard.x;
      const hy = row * TILE_SIZE + hazard.y;
      if (
        box.x < hx + hazard.w &&
        box.x + box.width > hx &&
        box.y < hy + hazard.h &&
        box.y + box.height > hy
      ) {
        return true;
      }
    }
  }
  return false;
}

/** The column indices of the cells directly beneath a box standing on `groundRow`. */
export function supportColumns(box: Box, groundRow: number): number[] {
  if (groundRow < 0) return [];
  const [c0, c1] = colRange(box);
  const cols: number[] = [];
  for (let col = c0; col <= c1; col++) cols.push(col);
  return cols;
}

/** Standard rectangle overlap, used for enemies and collectables. */
export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Shrinks a box by `inset` on every side, never below zero size. */
export function insetBox(box: Box, inset: number): Box {
  return {
    x: box.x + inset,
    y: box.y + inset,
    width: Math.max(0, box.width - inset * 2),
    height: Math.max(0, box.height - inset * 2),
  };
}
