import { ROOM_COLS, ROOM_ROWS, TILE_SIZE, WORLD } from '../config';
import { liftBoxes, liftPeriod } from '../objects/Lift';
import type { Box, TileGrid } from '../systems/CollisionSystem';
import { type HazardRect, type LockColour, tileDef } from './tiles';
import type { Direction, Point, RoomData } from './roomTypes';

/** Shared, because a room with no lifts returns it on every single step. */
const NO_LIFTS: readonly Point[] = Object.freeze([]);

/**
 * A single screen of the house, plus the small amount of state that changes
 * while you are standing in it: the crumbling floors, the gates you have keys
 * for, the switch, and where the lifts have got to.
 */
export class Room implements TileGrid {
  readonly cols = ROOM_COLS;
  readonly rows = ROOM_ROWS;

  /** Cells that have finished collapsing and are now air. */
  private readonly collapsed = new Set<number>();
  /** Cells mid-collapse, with the milliseconds they have left. */
  private readonly collapsing = new Map<number, number>();
  /** Gate colours the player currently holds the key to. */
  private readonly openLocks = new Set<LockColour>();
  /**
   * How long the player has been in this room, in milliseconds.
   *
   * The room owns this rather than the scene because the lifts are part of the
   * room's geometry, and collision has to be able to ask where they are without
   * being handed a clock.
   */
  private timeMs = 0;
  private lifts: Box[];
  /**
   * The room's one switch, which every shutter in it answers to.
   *
   * Deliberately room-local and reset on entry, so it can never become hidden
   * state that follows the player around the house, and can never leave the
   * game in a position a fresh visit does not undo.
   */
  private switchOn = false;
  private leverHeld = false;
  /** Whether this room has a lever at all. Worked out once; scanned for often. */
  readonly hasSwitch: boolean;
  /**
   * True when no cell in this room can ever read as anything but itself.
   *
   * `charAt` is the hottest function in the project — every sweep of the
   * collision system goes through it thousands of times per explored room — so
   * the common case of a room with no gates and no shutters skips the lot.
   */
  private readonly plain: boolean;

  constructor(readonly data: RoomData) {
    this.lifts = liftBoxes(data.lifts ?? [], 0);
    this.hasSwitch = data.tiles.some((row) => [...row].some((char) => tileDef(char).lever));
    this.plain = !data.tiles.some((row) =>
      [...row].some((char) => {
        const def = tileDef(char);
        return def.lock !== null || def.shutter !== null;
      }),
    );
  }

  /** Seconds since the player entered. Drives the lifts, and the scene's enemies. */
  get seconds(): number {
    return this.timeMs / 1000;
  }

  get elapsedMs(): number {
    return this.timeMs;
  }

  /** Where the lifts are at this instant. Read by the collision system. */
  get liftBoxes(): readonly Box[] {
    return this.lifts;
  }

  get id(): string {
    return this.data.id;
  }

  get name(): string {
    return this.data.name;
  }

  private index(col: number, row: number): number {
    return row * this.cols + col;
  }

  /**
   * The tile character at a cell, or '.' outside the room, where a floor has
   * gone, or where a gate has been unlocked.
   *
   * Everything downstream — solidAt, platformAt, the swept collision, the
   * reachability solver — reads the room through here, so an opened gate simply
   * stops existing and nothing else has to know about locks at all.
   */
  charAt(col: number, row: number): string {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return '.';
    if (this.collapsed.has(this.index(col, row))) return '.';
    const char = this.data.tiles[row][col];
    if (this.plain) return char;
    const def = tileDef(char);
    if (def.lock !== null && this.openLocks.has(def.lock)) return '.';
    if (def.shutter !== null && def.shutter !== this.switchOn) return '.';
    return char;
  }

  /** The tile character as authored, ignoring collapses and unlocked gates. */
  rawCharAt(col: number, row: number): string {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return '.';
    return this.data.tiles[row][col];
  }

  solidAt(col: number, row: number): boolean {
    return tileDef(this.charAt(col, row)).solid;
  }

  platformAt(col: number, row: number): boolean {
    return tileDef(this.charAt(col, row)).platform;
  }

  hazardAt(col: number, row: number): HazardRect | null {
    return tileDef(this.charAt(col, row)).hazard;
  }

  /** -1, 0 or +1: which way the floor under a cell is trying to drag you. */
  conveyorAt(col: number, row: number): -1 | 0 | 1 {
    return tileDef(this.charAt(col, row)).conveyor;
  }

  exit(dir: Direction): string | undefined {
    return this.data.exits[dir];
  }

  /** Starts a floor collapsing. Harmless if it is already going, or is not that kind of floor. */
  standOn(col: number, row: number): void {
    const key = this.index(col, row);
    if (this.collapsed.has(key) || this.collapsing.has(key)) return;
    if (!tileDef(this.charAt(col, row)).crumbles) return;
    this.collapsing.set(key, WORLD.crumbleLifetimeMs);
  }

  /**
   * Moves the room on by one simulation step: the clock, the lifts, and any
   * floor part-way through giving way.
   *
   * Returns the cells that finished collapsing, and how far each lift moved, so
   * the player can be carried by whichever one they are standing on.
   */
  advance(deltaMs: number): { collapsed: number[]; liftDeltas: readonly Point[] } {
    this.timeMs += deltaMs;

    const defs = this.data.lifts;
    // Most rooms have no lifts, and this runs on every step of every attempt
    // the solver makes. Allocating two empty arrays a million times over is not
    // free, so it does not happen.
    if (defs === undefined || defs.length === 0) {
      return { collapsed: this.updateCrumbling(deltaMs), liftDeltas: NO_LIFTS };
    }

    const before = this.lifts;
    this.lifts = liftBoxes(defs, this.seconds);
    const liftDeltas = this.lifts.map((lift, index) => ({
      x: lift.x - (before[index]?.x ?? lift.x),
      y: lift.y - (before[index]?.y ?? lift.y),
    }));
    return { collapsed: this.updateCrumbling(deltaMs), liftDeltas };
  }

  /** Advances every collapsing floor. Returns the cells that vanished this step. */
  updateCrumbling(deltaMs: number): number[] {
    if (this.collapsing.size === 0) return [];
    const gone: number[] = [];
    for (const [key, remaining] of this.collapsing) {
      const left = remaining - deltaMs;
      if (left <= 0) {
        this.collapsing.delete(key);
        this.collapsed.add(key);
        gone.push(key);
      } else {
        this.collapsing.set(key, left);
      }
    }
    return gone;
  }

  /** 0 for intact through 3 for nearly gone; -1 once the cell has vanished. */
  crumbleStage(col: number, row: number): number {
    const key = this.index(col, row);
    if (this.collapsed.has(key)) return -1;
    const remaining = this.collapsing.get(key);
    if (remaining === undefined) return 0;
    const elapsed = 1 - remaining / WORLD.crumbleLifetimeMs;
    return Math.min(3, 1 + Math.floor(elapsed * 3));
  }

  /**
   * Tells the room which keys the player is carrying.
   *
   * Deliberately separate from `reset()`: the reachability solver resets the
   * floors before every single attempt, and losing the keys each time would
   * make a gated room look impassable.
   */
  setKeys(keys: Iterable<LockColour>): void {
    this.openLocks.clear();
    for (const lock of keys) this.openLocks.add(lock);
  }

  isUnlocked(lock: LockColour): boolean {
    return this.openLocks.has(lock);
  }

  get switchState(): boolean {
    return this.switchOn;
  }

  /** Forces the switch, for the solver, which has to try a room both ways. */
  setSwitch(on: boolean): void {
    this.switchOn = on;
    this.leverHeld = on;
  }

  /**
   * Reports whether the player is touching a lever this step.
   *
   * The switch flips on the rising edge only, so standing on a lever does not
   * make it chatter, and walking off and back on flips it again.
   */
  touchLever(touching: boolean): boolean {
    if (!this.hasSwitch) return false;
    const flipped = touching && !this.leverHeld;
    if (flipped) this.switchOn = !this.switchOn;
    this.leverHeld = touching;
    return flipped;
  }

  /** Every gate colour this room actually contains. */
  get locks(): Set<LockColour> {
    const found = new Set<LockColour>();
    for (const row of this.data.tiles) {
      for (const char of row) {
        const lock = tileDef(char).lock;
        if (lock !== null) found.add(lock);
      }
    }
    return found;
  }

  /**
   * Puts every floor back and the clock to zero, so every lift and every
   * resident snaps to exactly where they started. Called whenever the room is
   * entered, and after every death.
   */
  reset(atMs = 0): void {
    this.collapsed.clear();
    this.collapsing.clear();
    this.timeMs = atMs;
    this.lifts = liftBoxes(this.data.lifts ?? [], this.seconds);
    this.switchOn = false;
    this.leverHeld = false;
  }

  /** The longest circuit any lift in here takes, in seconds. Zero if there are none. */
  get liftCycle(): number {
    return (this.data.lifts ?? []).reduce((longest, def) => Math.max(longest, liftPeriod(def)), 0);
  }

  /** Walks every cell, for renderers and for the debug overlay. */
  forEachCell(fn: (col: number, row: number, char: string) => void): void {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        fn(col, row, this.data.tiles[row][col]);
      }
    }
  }

  static cellToPixels(col: number, row: number): { x: number; y: number } {
    return { x: col * TILE_SIZE, y: row * TILE_SIZE };
  }
}
