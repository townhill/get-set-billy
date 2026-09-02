/**
 * Central configuration for The Peculiar House.
 *
 * Nothing in here touches the DOM at import time, so this module can be
 * imported freely by unit tests and by pure-logic modules.
 */

/** Size of one world cell, in logical pixels. */
export const TILE_SIZE = 8;

/** A room is always exactly this many cells across... */
export const ROOM_COLS = 32;
/** ...and this many cells down. Rooms never scroll. */
export const ROOM_ROWS = 20;

/** Logical size of the playfield (the room itself). */
export const PLAY_WIDTH = ROOM_COLS * TILE_SIZE; // 256
export const PLAY_HEIGHT = ROOM_ROWS * TILE_SIZE; // 160

/** The status panel lives underneath the playfield. */
export const HUD_HEIGHT = 32;

/** Logical screen resolution. Scaled up to the browser with integer nearest-neighbour scaling. */
export const GAME_WIDTH = PLAY_WIDTH; // 256
export const GAME_HEIGHT = PLAY_HEIGHT + HUD_HEIGHT; // 192

/** The simulation always advances in whole steps of this length, in milliseconds. */
export const FIXED_STEP_MS = 1000 / 60;

/** Never run more than this many simulation steps for a single rendered frame. */
export const MAX_STEPS_PER_FRAME = 5;

export const PLAYER = {
  /** Collision box. The sprite is drawn at exactly this size too. */
  width: 8,
  height: 16,

  /** Horizontal speed, in logical pixels per second. Applied instantly: no acceleration, no drag. */
  walkSpeed: 96,

  /** Downward acceleration, in pixels per second squared. */
  gravity: 1000,

  /** Upward speed applied on the frame a jump starts, in pixels per second. */
  jumpVelocity: 250,

  /** Falls are clamped to this speed so the player can never tunnel through a floor. */
  maxFallSpeed: 320,

  /**
   * Jumps are a fixed height: releasing the button early does not shorten them.
   * This is deliberate. It makes every gap in the house exactly as wide as it looks.
   */
  variableJumpHeight: false,

  /** The player may steer freely while airborne. Predictable, and much kinder than the games of the era. */
  airControl: true,

  /** Falling further than this without landing is fatal, in logical pixels. */
  fatalFallDistance: 72,

  /** Grace period after walking off a ledge during which a jump still works, in milliseconds. */
  coyoteTimeMs: 60,

  /** A jump pressed this long before landing is remembered and fires on touchdown, in milliseconds. */
  jumpBufferMs: 100,

  /** Hazard tests use a hitbox inset by this many pixels on each side, so deaths always look deserved. */
  hazardInset: 1,

  /** How fast the walk cycle advances, in milliseconds per frame. */
  animFrameMs: 90,
} as const;

export const WORLD = {
  /** Room the player wakes up in. */
  startRoom: 'entrance-hall',
  /** Number of lives a new game begins with. */
  startingLives: 5,
  /** Length of the death animation before the room resets, in milliseconds. */
  deathDurationMs: 900,
  /** Length of the "you need everything first" door message, in milliseconds. */
  doorMessageMs: 1600,
  /** Conveyor belts push anything standing on them at this speed, in pixels per second. */
  conveyorSpeed: 48,
  /** How long a crumbling floor survives being stood on, in milliseconds. */
  crumbleLifetimeMs: 520,
  /** How long a gate takes to grind open once you pick up its key, in milliseconds. */
  gateOpenMs: 520,
  /** Shortest gap between two "that gate is locked" complaints, in milliseconds. */
  gateNagCooldownMs: 1400,
  /**
   * How tall a lift's collision box is, in pixels.
   *
   * Only its top edge ever blocks anything — a lift is a one-way platform, so
   * you jump up through it — but it is drawn one cell deep so it reads as a
   * ledge rather than a hairline.
   */
  liftHeight: 8,
} as const;

export const AUDIO = {
  /** Master gain, 0..1. Deliberately modest: these are square waves. */
  volume: 0.22,
  /** Start muted? */
  startMuted: false,
} as const;

export const SAVE = {
  storageKey: 'peculiar-house/save/v1',
  settingsKey: 'peculiar-house/settings/v1',
} as const;

/**
 * Debug mode is off unless explicitly asked for, so it never shows during normal play.
 * Enable with `?debug=1` in the URL, or by building with `VITE_DEBUG=1`.
 */
export function isDebugEnabled(): boolean {
  if (typeof window !== 'undefined' && typeof window.location?.search === 'string') {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get('debug');
    if (flag !== null) return flag !== '0' && flag !== 'false';
  }
  try {
    return import.meta.env?.VITE_DEBUG === '1';
  } catch {
    return false;
  }
}
