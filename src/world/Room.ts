import { ROOM_COLS, ROOM_ROWS, TILE_SIZE, WORLD } from '../config';
import type { TileGrid } from '../systems/CollisionSystem';
import { type HazardRect, type LockColour, tileDef } from './tiles';
import type { Direction, RoomData } from './roomTypes';

/**
 * A single screen of the house, plus the small amount of state that changes
 * while you are standing in it (which is only ever the crumbling floors).
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

  constructor(readonly data: RoomData) {}

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
    const lock = tileDef(char).lock;
    if (lock !== null && this.openLocks.has(lock)) return '.';
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

  /** Puts every floor back. Called whenever the room is (re)entered. */
  reset(): void {
    this.collapsed.clear();
    this.collapsing.clear();
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
