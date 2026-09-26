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
 *   - A lift is the same rule without the grid: a rectangle that only its top
 *     edge blocks, and only from above. Lifts are never solid, so nothing can
 *     ever be crushed by one.
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
  /** Moving ledges, where they are at this instant. Empty in most rooms. */
  readonly liftBoxes: readonly Box[];
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
  /** Row index of the tile landed on, or -1 when airborne or riding a lift. */
  groundRow: number;
  /** Index of the lift landed on, or -1 when not standing on one. */
  groundLift: number;
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
  const still: SweepYResult = {
    y: box.y,
    onGround: false,
    hitCeiling: false,
    groundRow: -1,
    groundLift: -1,
  };
  if (dy === 0) return still;

  const [c0, c1] = colRange(box);

  if (dy > 0) {
    const oldBottom = box.y + box.height;
    const newBottom = oldBottom + dy;
    const first = Math.ceil(oldBottom / TILE_SIZE);
    let last = Math.ceil(newBottom / TILE_SIZE) - 1;
    if (newBottom >= first * TILE_SIZE) last = Math.max(last, first);

    // The highest surface anywhere in the swept path wins, whether it is a tile
    // or a lift, so a lift hanging just above a floor is what you land on.
    let bestY = Infinity;
    let bestRow = -1;

    for (let row = first; row <= last; row++) {
      for (let col = c0; col <= c1; col++) {
        if (!grid.solidAt(col, row) && !grid.platformAt(col, row)) continue;
        bestY = row * TILE_SIZE - box.height;
        bestRow = row;
        break;
      }
      if (bestRow >= 0) break;
    }

    const lift = landingLift(box, dy, grid, bestY);
    if (lift.index >= 0) {
      return {
        y: lift.y,
        onGround: true,
        hitCeiling: false,
        groundRow: -1,
        groundLift: lift.index,
      };
    }

    if (bestRow >= 0) {
      return { y: bestY, onGround: true, hitCeiling: false, groundRow: bestRow, groundLift: -1 };
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
          groundLift: -1,
        };
      }
    }
  }

  return { ...still, y: box.y + dy };
}

/**
 * Which lift a falling box comes to rest on, if any.
 *
 * The same "was I above it before the step" rule the platform tiles use, so a
 * lift rising past you does not snatch you off a ledge, and jumping up through
 * one works exactly as it does through a ledge. `ceiling` is the highest tile
 * surface already found, so a lift below a floor is ignored rather than
 * teleporting the body through it.
 */
function landingLift(
  box: Box,
  dy: number,
  grid: TileGrid,
  ceiling: number,
): { index: number; y: number } {
  let best = { index: -1, y: Infinity };
  const oldBottom = box.y + box.height;
  const newBottom = oldBottom + dy;

  grid.liftBoxes.forEach((lift, index) => {
    if (box.x + box.width <= lift.x || box.x >= lift.x + lift.width) return;
    // Only a top edge the body was at or above before the step can catch it.
    if (lift.y < oldBottom || lift.y > newBottom) return;
    const restingY = lift.y - box.height;
    if (restingY > ceiling) return;
    if (restingY < best.y) best = { index, y: restingY };
  });

  return best;
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
    groundLift: vertical.groundLift,
  };
}

/** True when any hazard sub-rectangle overlaps the box. */
export function overlapsHazard(box: Box, grid: TileGrid): boolean {
  return hazardCellUnder(box, grid) !== null;
}

/**
 * The first hazardous cell a box is touching, or null.
 *
 * The same test as `overlapsHazard`, for when it matters which hazard it was —
 * which it does to the status panel, when it has to say what killed you.
 */
export function hazardCellUnder(box: Box, grid: TileGrid): { col: number; row: number } | null {
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
        return { col, row };
      }
    }
  }
  return null;
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
