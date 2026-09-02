import type { Point, RopeDef } from '../world/roomTypes';

/**
 * A rope: the one thing from the era this house was most conspicuously missing.
 *
 * It hangs from a pivot and swings, and where it is depends only on how long
 * you have been in the room — the same rule the enemies and the lifts follow,
 * so it resets with the room and stays learnable.
 *
 * **Letting go does not fling you.** The game has no momentum anywhere else and
 * it does not get any here: the rope carries you along its arc, and when you let
 * go you leave from wherever it had got you to, with an ordinary fixed-height
 * jump or an ordinary drop. That keeps every gap in the house exactly as wide as
 * it looks, which is the promise the whole movement model is built on. What a
 * rope adds is reach and timing, not physics.
 */

const DEG = Math.PI / 180;

/** How long the rope takes to swing there and back, in seconds. */
export function ropePeriod(def: RopeDef): number {
  return (2 * def.arc) / Math.max(1, Math.abs(def.speed));
}

/** The rope's angle from straight down, in radians. Positive is to the right. */
export function ropeAngle(def: RopeDef, seconds: number): number {
  const period = ropePeriod(def);
  const phase = def.phase ?? 0;
  return (def.arc / 2) * Math.sin(2 * Math.PI * (seconds / period + phase)) * DEG;
}

/** A point `distance` pixels down the rope from its pivot. */
export function ropePoint(def: RopeDef, seconds: number, distance: number): Point {
  const theta = ropeAngle(def, seconds);
  return {
    x: def.cx + Math.sin(theta) * distance,
    y: def.cy + Math.cos(theta) * distance,
  };
}

/** The far end of the rope, which is where the knot is drawn. */
export function ropeEnd(def: RopeDef, seconds: number): Point {
  return ropePoint(def, seconds, def.length);
}

/**
 * How far down the rope a body at (x, y) would take hold, or null if it is not
 * close enough to any part of it.
 *
 * Projects the point onto the rope's line and clamps to the grabbable stretch,
 * so you can catch it high or low and hang from where you caught it. The very
 * top is excluded: grabbing a rope flush against its own pivot looks wrong and
 * leaves nowhere to swing from.
 */
export function gripDistance(
  def: RopeDef,
  seconds: number,
  x: number,
  y: number,
  reach: number,
): number | null {
  const theta = ropeAngle(def, seconds);
  const dx = Math.sin(theta);
  const dy = Math.cos(theta);

  // Distance along the rope of the closest point to (x, y).
  const along = (x - def.cx) * dx + (y - def.cy) * dy;
  const clamped = Math.min(def.length, Math.max(MIN_GRIP, along));

  const at = { x: def.cx + dx * clamped, y: def.cy + dy * clamped };
  const away = Math.hypot(x - at.x, y - at.y);
  return away <= reach ? clamped : null;
}

/** You cannot take hold of a rope closer than this to the thing it hangs from. */
export const MIN_GRIP = 8;
