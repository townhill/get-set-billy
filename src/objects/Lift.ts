import { WORLD } from '../config';
import type { Box } from '../systems/CollisionSystem';
import type { LiftDef } from '../world/roomTypes';
import { alongPath, pathPeriod } from './paths';

/**
 * A lift: a ledge that moves.
 *
 * Where it is depends only on how long you have been in the room, exactly like
 * an enemy, so it snaps back to the start whenever you enter or die. There is
 * no per-lift state anywhere, which is the whole reason a room with lifts in it
 * is still learnable.
 *
 * A lift is a one-way platform, never a solid. You jump up through it and land
 * on top, and it can never crush you against a ceiling — which is the failure
 * mode that makes moving solids miserable to get right, and it is simply
 * absent here.
 */

/** How long a lift takes to get back to where it started, in seconds. */
export function liftPeriod(def: LiftDef): number {
  return pathPeriod(def.points, def.speed);
}

/** Where a lift is at a given moment. */
export function liftBox(def: LiftDef, seconds: number): Box {
  const phase = def.phase ?? 0;
  const at = alongPath(def.points, def.speed * (seconds + phase * liftPeriod(def)));
  return { x: at.x, y: at.y, width: def.width, height: WORLD.liftHeight };
}

/** Every lift in a room, at a given moment, in the order they were declared. */
export function liftBoxes(defs: readonly LiftDef[], seconds: number): Box[] {
  return defs.map((def) => liftBox(def, seconds));
}
