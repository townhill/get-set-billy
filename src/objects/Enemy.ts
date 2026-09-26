import type { Box } from '../systems/CollisionSystem';
import { TILE_SIZE } from '../config';
import { type EnemyDef, type Point, VENT_WARNING_SECONDS } from '../world/roomTypes';
import { alongPath, pathPeriod } from './paths';

/**
 * Enemy movement, as a pure function of "how long have you been in this room".
 *
 * There is no state here on purpose. Re-entering a room, or dying and
 * respawning, resets the room clock to zero and every resident snaps back to
 * exactly where it started. That is what made the enemies in these games
 * learnable, and learnable is the whole game.
 */

export interface SpriteSize {
  width: number;
  height: number;
}

const DEG = Math.PI / 180;

/** Bounces a value back and forth between `from` and `to` at `speed` px/s. */
function triangle(from: number, to: number, speed: number, seconds: number, phase: number): number {
  const span = Math.abs(to - from);
  if (span === 0 || speed === 0) return from;
  const period = (2 * span) / Math.abs(speed);
  const t = (((seconds + phase * period) % period) + period) % period;
  const travelled = t * Math.abs(speed);
  const offset = travelled <= span ? travelled : 2 * span - travelled;
  return from < to ? from + offset : from - offset;
}

/**
 * How long an enemy takes to get back to exactly where it started, in seconds.
 *
 * Zero for anything that never moves. Used to shift an enemy along its cycle by
 * its `phase`, and by the tests, which sample a whole cycle rather than
 * restating each path's extremes in a second place.
 */
export function enemyPeriod(def: EnemyDef): number {
  switch (def.type) {
    case 'patrol-h':
    case 'patrol-v': {
      const span = Math.abs(def.to - def.from);
      return span === 0 || def.speed === 0 ? 0 : (2 * span) / Math.abs(def.speed);
    }
    case 'circle':
    case 'figure-eight':
      return def.speed === 0 ? 0 : 360 / Math.abs(def.speed);
    case 'pendulum':
      return (2 * def.arc) / Math.max(1, Math.abs(def.speed));
    case 'waypoint':
      return pathPeriod(def.points, def.speed);
    case 'vent':
      return def.period;
    case 'static':
      return 0;
  }
}

export type VentStage = 'idle' | 'warning' | 'firing';

type VentDef = Extract<EnemyDef, { type: 'vent' }>;

/**
 * Where a vent is in its cycle: quiet, sputtering, or firing.
 *
 * The cycle ends with the firing, so a vent at the moment you walk in is always
 * quiet — arriving never means arriving into a jet of steam.
 */
export function ventStage(def: VentDef, seconds: number): VentStage {
  if (def.period <= 0) return 'firing';
  const t = (((seconds + (def.phase ?? 0) * def.period) % def.period) + def.period) % def.period;
  const firesAt = def.period - def.on;
  if (t >= firesAt) return 'firing';
  if (t >= firesAt - VENT_WARNING_SECONDS) return 'warning';
  return 'idle';
}

/**
 * Whether touching this enemy right now would kill you.
 *
 * Everything that moves is always deadly. A vent is deadly only while it fires.
 */
export function enemyIsLethal(def: EnemyDef, seconds: number): boolean {
  return def.type !== 'vent' || ventStage(def, seconds) === 'firing';
}

/** Top-left corner of an enemy at a given moment. */
export function enemyPosition(def: EnemyDef, seconds: number, size: SpriteSize): Point {
  const phase = def.type === 'static' ? 0 : (def.phase ?? 0);

  switch (def.type) {
    case 'patrol-h':
      return { x: triangle(def.from, def.to, def.speed, seconds, phase), y: def.y };

    case 'patrol-v':
      return { x: def.x, y: triangle(def.from, def.to, def.speed, seconds, phase) };

    case 'circle': {
      const angle = (phase * 360 + def.speed * seconds) * DEG;
      return {
        x: def.cx + Math.cos(angle) * def.radius - size.width / 2,
        y: def.cy + Math.sin(angle) * def.radius - size.height / 2,
      };
    }

    case 'pendulum': {
      // A full there-and-back sweep covers 2 * arc degrees at `speed` deg/s.
      const period = (2 * def.arc) / Math.max(1, Math.abs(def.speed));
      const theta = (def.arc / 2) * Math.sin(2 * Math.PI * (seconds / period + phase)) * DEG;
      return {
        x: def.cx + Math.sin(theta) * def.length - size.width / 2,
        y: def.cy + Math.cos(theta) * def.length - size.height / 2,
      };
    }

    case 'waypoint':
      // A two-point path is exactly a patrol, which is why these coordinates
      // are the sprite's top-left like a patrol's, not a centre like a circle's.
      return alongPath(def.points, def.speed * (seconds + phase * enemyPeriod(def)));

    case 'figure-eight': {
      // A 1:2 Lissajous: once across horizontally for twice vertically.
      const angle = (phase * 360 + def.speed * seconds) * DEG;
      return {
        x: def.cx + Math.sin(angle) * def.width - size.width / 2,
        y: def.cy + Math.sin(2 * angle) * def.height - size.height / 2,
      };
    }

    case 'static':
    case 'vent':
      return { x: def.x, y: def.y };
  }
}

/**
 * Collision box of an enemy at a given moment.
 *
 * A vent's is the whole height of its jet, whatever the size of the sprite it
 * is drawn with, since the jet is drawn a cell at a time.
 */
export function enemyBox(def: EnemyDef, seconds: number, size: SpriteSize): Box {
  const { x, y } = enemyPosition(def, seconds, size);
  if (def.type === 'vent') return { x, y, width: TILE_SIZE, height: def.cells * TILE_SIZE };
  return { x, y, width: size.width, height: size.height };
}

/**
 * Which way an enemy is currently facing: -1 left, +1 right.
 *
 * Only for the ones that travel along a line and would look wrong going
 * backwards. A circling moth and a swinging cog are symmetrical about their own
 * path and are left facing right, which is also what a static hazard does,
 * having nowhere else to look.
 */
const TURNS_ROUND: readonly EnemyDef['type'][] = ['patrol-h', 'waypoint', 'figure-eight'];

export function enemyFacing(def: EnemyDef, seconds: number, size: SpriteSize): -1 | 1 {
  if (!TURNS_ROUND.includes(def.type)) return 1;
  const now = enemyPosition(def, seconds, size).x;
  const soon = enemyPosition(def, seconds + 1 / 30, size).x;
  return soon < now ? -1 : 1;
}
