import { WORLD } from '../config';
import type { Direction } from '../world/roomTypes';

/** Where the player will reappear after a death: the way they came in. */
export type SpawnKey = Direction | 'start';

/** The whole of a run, in one object. Everything else is derived from it. */
export interface GameStateSnapshot {
  currentRoom: string;
  lives: number;
  collectedItems: string[];
  /** Milliseconds of play so far, carried across saves. */
  elapsedMs: number;
  entrySpawn: SpawnKey;
  deaths: number;
}

export class GameState {
  currentRoom: string;
  lives: number;
  readonly collectedItems: Set<string>;
  /** Wall-clock time this run is measured from; shifted back on load. */
  startedAt: number;
  entrySpawn: SpawnKey;
  deaths: number;

  constructor(startRoom: string = WORLD.startRoom, lives: number = WORLD.startingLives) {
    this.currentRoom = startRoom;
    this.lives = lives;
    this.collectedItems = new Set();
    this.startedAt = Date.now();
    this.entrySpawn = 'start';
    this.deaths = 0;
  }

  get collectedCount(): number {
    return this.collectedItems.size;
  }

  get elapsedMs(): number {
    return Date.now() - this.startedAt;
  }

  isCollected(id: string): boolean {
    return this.collectedItems.has(id);
  }

  /** Returns true if this was a new item, false if it had already been taken. */
  collect(id: string): boolean {
    if (this.collectedItems.has(id)) return false;
    this.collectedItems.add(id);
    return true;
  }

  hasEverything(total: number): boolean {
    return this.collectedItems.size >= total;
  }

  /** Removes a life. Returns true if the run is over. */
  loseLife(): boolean {
    this.deaths += 1;
    this.lives = Math.max(0, this.lives - 1);
    return this.lives === 0;
  }

  enterRoom(id: string, spawn: SpawnKey): void {
    this.currentRoom = id;
    this.entrySpawn = spawn;
  }

  toSnapshot(): GameStateSnapshot {
    return {
      currentRoom: this.currentRoom,
      lives: this.lives,
      collectedItems: [...this.collectedItems],
      elapsedMs: this.elapsedMs,
      entrySpawn: this.entrySpawn,
      deaths: this.deaths,
    };
  }

  static fromSnapshot(snapshot: GameStateSnapshot): GameState {
    const state = new GameState(snapshot.currentRoom, snapshot.lives);
    for (const id of snapshot.collectedItems) state.collectedItems.add(id);
    // Rewind the start time so the clock continues where it left off.
    state.startedAt = Date.now() - Math.max(0, snapshot.elapsedMs);
    state.entrySpawn = snapshot.entrySpawn;
    state.deaths = snapshot.deaths;
    return state;
  }
}

/** Formats milliseconds as MM:SS, clamped to something a HUD can show. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.min(99, Math.floor(total / 60));
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
