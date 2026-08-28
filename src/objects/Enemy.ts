import type { Box } from '../systems/CollisionSystem';
import type { EnemyDef, Point } from '../world/roomTypes';

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

    case 'static':
      return { x: def.x, y: def.y };
  }
}

/** Collision box of an enemy at a given moment. */
export function enemyBox(def: EnemyDef, seconds: number, size: SpriteSize): Box {
  const { x, y } = enemyPosition(def, seconds, size);
  return { x, y, width: size.width, height: size.height };
}

/** Which way a patrolling enemy is currently facing: -1 left, +1 right. */
export function enemyFacing(def: EnemyDef, seconds: number, size: SpriteSize): -1 | 1 {
  if (def.type !== 'patrol-h') return 1;
  const now = enemyPosition(def, seconds, size).x;
  const soon = enemyPosition(def, seconds + 1 / 30, size).x;
  return soon < now ? -1 : 1;
}
