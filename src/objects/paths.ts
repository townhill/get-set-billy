import type { Point } from '../world/roomTypes';

/**
 * Walking a closed loop of points at a constant speed.
 *
 * Shared by the things that follow a path rather than an equation: waypoint
 * enemies and lifts. Both are pure functions of time, so both need exactly this
 * and nothing else.
 */

/** Total length of a closed loop through `points`, including the leg back to the start. */
export function pathLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/** The point `distance` pixels along that loop, wrapping round as many times as needed. */
export function alongPath(points: readonly Point[], distance: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const total = pathLength(points);
  if (total === 0) return { ...points[0] };

  let left = ((distance % total) + total) % total;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const leg = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= leg) {
      const t = leg === 0 ? 0 : left / leg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    left -= leg;
  }
  // Only reachable through floating-point drift at the very end of the loop.
  return { ...points[0] };
}

/** How long one full circuit of a path takes, in seconds. Zero if it goes nowhere. */
export function pathPeriod(points: readonly Point[], speed: number): number {
  const length = pathLength(points);
  return length === 0 || speed === 0 ? 0 : length / Math.abs(speed);
}
