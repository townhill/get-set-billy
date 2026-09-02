import { ROOM_COLS, ROOM_ROWS } from '../config';
import { LOCK_COLOURS, type LockColour, isKnownTile } from './tiles';
import { MIN_GRIP } from '../objects/Rope';

/** The four ways out of a room. */
export type Direction = 'left' | 'right' | 'up' | 'down';

export const DIRECTIONS: readonly Direction[] = ['left', 'right', 'up', 'down'];

export const OPPOSITE: Readonly<Record<Direction, Direction>> = {
  left: 'right',
  right: 'left',
  up: 'down',
  down: 'up',
};

export interface Point {
  x: number;
  y: number;
}

/**
 * Enemy movement is a pure function of time, so an enemy is fully described by
 * its definition plus "how long has the player been in this room".
 */
export type EnemyDef =
  | {
      type: 'patrol-h';
      id: string;
      sprite: string;
      /** Top edge of the sprite. */
      y: number;
      /** Left-most and right-most positions of the sprite's left edge. */
      from: number;
      to: number;
      /** Pixels per second. */
      speed: number;
      /** 0..1, shifts the enemy along its cycle at room entry. */
      phase?: number;
    }
  | {
      type: 'patrol-v';
      id: string;
      sprite: string;
      x: number;
      from: number;
      to: number;
      speed: number;
      phase?: number;
    }
  | {
      type: 'circle';
      id: string;
      sprite: string;
      /** Centre of the circle, in room pixels. */
      cx: number;
      cy: number;
      radius: number;
      /** Degrees per second. Negative goes anticlockwise. */
      speed: number;
      phase?: number;
    }
  | {
      type: 'pendulum';
      id: string;
      sprite: string;
      /** The pivot the enemy swings from. */
      cx: number;
      cy: number;
      length: number;
      /** Total sweep in degrees, centred on straight down. */
      arc: number;
      /** Degrees per second along the arc. */
      speed: number;
      phase?: number;
    }
  | {
      type: 'waypoint';
      id: string;
      sprite: string;
      /**
       * A closed loop of sprite top-left positions, walked at a constant speed
       * and joined up from the last back to the first. Two points is exactly a
       * patrol; three or more is a shape.
       */
      points: Point[];
      /** Pixels per second along the path. */
      speed: number;
      phase?: number;
    }
  | {
      type: 'figure-eight';
      id: string;
      sprite: string;
      /** Centre of the figure. */
      cx: number;
      cy: number;
      /** Half-extents: the figure reaches cx ± width and cy ± height. */
      width: number;
      height: number;
      /** Degrees per second. Negative goes the other way round. */
      speed: number;
      phase?: number;
    }
  | {
      type: 'static';
      id: string;
      sprite: string;
      x: number;
      y: number;
    };

export type EnemyKind = EnemyDef['type'];

/**
 * A moving ledge.
 *
 * Deliberately the same idea as an enemy: where it is depends only on how long
 * you have been in the room, so it snaps back to the start every time you enter
 * or die, and it is as learnable as everything else.
 *
 * There is one movement type rather than several, because a closed loop of
 * points already covers all of them — two points is a straight run, up and down
 * or side to side, and more than two is a circuit.
 */
export interface LiftDef {
  /** Unique within the room. */
  id: string;
  /** Top-left of the platform at each corner of its loop, joined last to first. */
  points: Point[];
  /** Pixels per second along the path. */
  speed: number;
  /** How wide the platform is. Multiples of 8 line up with everything else. */
  width: number;
  /** 0..1, shifts the lift along its cycle at room entry. */
  phase?: number;
}

/**
 * A rope hanging from a pivot, swinging.
 *
 * The same shape as a pendulum enemy, because it is one — the difference is
 * that this one you hold on to rather than die of.
 */
export interface RopeDef {
  /** Unique within the room. */
  id: string;
  /** The pivot it hangs from. */
  cx: number;
  cy: number;
  /** How far it reaches, in pixels. */
  length: number;
  /** Total sweep in degrees, centred on straight down. */
  arc: number;
  /** Degrees per second along the arc. */
  speed: number;
  /** 0..1, shifts the rope along its swing at room entry. */
  phase?: number;
}

/**
 * A cupboard you step into and come out of somewhere else.
 *
 * Teleports come in pairs, each naming the other, and both ends must be
 * somewhere the player could already stand — so arriving through one is never
 * more dangerous than walking in through the door.
 */
export interface TeleportDef {
  /** Unique across the whole house. */
  id: string;
  /** Top-left of the cupboard, which is one cell. */
  x: number;
  y: number;
  /** The id of the teleport this one leads to. */
  to: string;
}

export interface ItemDef {
  /** Unique across the whole house. */
  id: string;
  sprite: string;
  x: number;
  y: number;
  /**
   * Makes this collectable a key. Picking it up opens every gate of that colour
   * in the house, permanently.
   *
   * A key is still an ordinary item and still counts towards the total, which
   * is why holding one needs no room in the save file: the set of keys is
   * derived from the set of items collected.
   */
  opens?: LockColour;
}

export interface RoomData {
  /** Unique, kebab-case, and equal to the file name. */
  id: string;
  /** Shown in the status panel. */
  name: string;
  /** Key into the theme table; decides how walls and ledges are painted. */
  theme: string;
  /** Position on the mansion map. Used by the debug overlay and validated for consistency. */
  grid: Point;
  /** Neighbouring room ids. A missing direction means there is no way out that way. */
  exits: Partial<Record<Direction, string>>;
  /**
   * Where the player appears. `start` is used for a new game and for restarting
   * the room; the four directions are used when entering through that edge.
   */
  spawns: Partial<Record<Direction | 'start', Point>>;
  /** Exactly ROOM_ROWS strings of exactly ROOM_COLS tile characters. */
  tiles: string[];
  enemies?: EnemyDef[];
  items?: ItemDef[];
  lifts?: LiftDef[];
  ropes?: RopeDef[];
  teleports?: TeleportDef[];
  /** The front door. Present in exactly one room: it is how the game is won. */
  door?: Point;
}

export interface ValidationIssue {
  room: string;
  message: string;
}

/**
 * Structural validation of a single room, independent of the rest of the house.
 * Returns a list of problems; an empty list means the room is well formed.
 */
export function validateRoomShape(data: RoomData): string[] {
  const issues: string[] = [];

  if (!/^[a-z0-9-]+$/.test(data.id)) issues.push(`id "${data.id}" must be kebab-case`);
  if (!data.name) issues.push('missing display name');
  if (!data.theme) issues.push('missing theme');

  if (!Array.isArray(data.tiles) || data.tiles.length !== ROOM_ROWS) {
    issues.push(`expected ${ROOM_ROWS} tile rows, found ${data.tiles?.length ?? 0}`);
  } else {
    data.tiles.forEach((row, index) => {
      if (row.length !== ROOM_COLS) {
        issues.push(`row ${index} is ${row.length} characters, expected ${ROOM_COLS}`);
      }
      for (const ch of row) {
        if (!isKnownTile(ch)) issues.push(`row ${index} uses unknown tile "${ch}"`);
      }
    });
  }

  for (const dir of DIRECTIONS) {
    if (data.exits[dir] !== undefined && data.spawns[dir] === undefined) {
      issues.push(`has a "${dir}" exit but no "${dir}" spawn point`);
    }
  }

  for (const enemy of data.enemies ?? []) {
    if (enemy.type === 'waypoint' && enemy.points.length < 2) {
      issues.push(`enemy "${enemy.id}" needs at least two waypoints to go anywhere`);
    }
  }

  const liftIds = new Set<string>();
  for (const lift of data.lifts ?? []) {
    if (liftIds.has(lift.id)) issues.push(`duplicate lift id "${lift.id}"`);
    liftIds.add(lift.id);
    if (lift.points.length < 2) issues.push(`lift "${lift.id}" needs at least two points`);
    if (lift.width <= 0) issues.push(`lift "${lift.id}" has no width`);
  }

  const ropeIds = new Set<string>();
  for (const rope of data.ropes ?? []) {
    if (ropeIds.has(rope.id)) issues.push(`duplicate rope id "${rope.id}"`);
    ropeIds.add(rope.id);
    if (rope.length <= MIN_GRIP) issues.push(`rope "${rope.id}" is too short to take hold of`);
    if (rope.arc <= 0) issues.push(`rope "${rope.id}" does not swing`);
  }

  for (const pad of data.teleports ?? []) {
    if (pad.x % 8 !== 0 || pad.y % 8 !== 0) {
      issues.push(`teleport "${pad.id}" is not on a cell boundary`);
    }
    if (pad.to === pad.id) issues.push(`teleport "${pad.id}" leads to itself`);
  }

  const ids = new Set<string>();
  for (const item of data.items ?? []) {
    if (ids.has(item.id)) issues.push(`duplicate item id "${item.id}"`);
    ids.add(item.id);
    if (item.opens !== undefined && !LOCK_COLOURS.includes(item.opens)) {
      issues.push(`item "${item.id}" opens unknown lock "${item.opens}"`);
    }
  }

  return issues;
}
