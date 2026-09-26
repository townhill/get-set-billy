import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WORLD } from '../src/config';
import { GameState, formatDuration } from '../src/state/GameState';

describe('a new game', () => {
  it('starts in the right room with the configured lives and nothing collected', () => {
    const state = new GameState();
    expect(state.currentRoom).toBe(WORLD.startRoom);
    expect(state.lives).toBe(WORLD.startingLives);
    expect(state.collectedCount).toBe(0);
    expect(state.deaths).toBe(0);
    expect(state.entrySpawn).toBe('start');
  });
});

describe('spare lives', () => {
  /** Collects `count` more things, calling the award after each, as the game does. */
  function find(state: GameState, count: number): number {
    let awarded = 0;
    for (let i = 0; i < count; i++) {
      state.collect(`thing-${state.collectedCount}`);
      if (state.awardSpareLife()) awarded += 1;
    }
    return awarded;
  }

  it('gives one for every so many things found, and not before', () => {
    const state = new GameState();
    expect(find(state, WORLD.itemsPerSpareLife - 1)).toBe(0);
    expect(state.lives).toBe(WORLD.startingLives);
    expect(find(state, 1)).toBe(1);
    expect(state.lives).toBe(WORLD.startingLives + 1);
    expect(find(state, WORLD.itemsPerSpareLife)).toBe(1);
    expect(state.lives).toBe(WORLD.startingLives + 2);
  });

  it('never gives one for finding nothing', () => {
    expect(new GameState().awardSpareLife()).toBe(false);
  });

  it('never tops the lives up past the most the panel can show', () => {
    const state = new GameState(WORLD.startRoom, WORLD.maxLives);
    expect(find(state, WORLD.itemsPerSpareLife)).toBe(0);
    expect(state.lives).toBe(WORLD.maxLives);
  });

  it('can earn back a life lost along the way', () => {
    const state = new GameState();
    state.loseLife();
    find(state, WORLD.itemsPerSpareLife);
    expect(state.lives).toBe(WORLD.startingLives);
  });
});

describe('collecting', () => {
  it('counts each thing once, however many times you walk over it', () => {
    const state = new GameState();
    expect(state.collect('teacup')).toBe(true);
    expect(state.collect('teacup')).toBe(false);
    expect(state.collectedCount).toBe(1);
    expect(state.isCollected('teacup')).toBe(true);
    expect(state.isCollected('umbrella')).toBe(false);
  });

  it('remembers what was collected across a room change', () => {
    const state = new GameState();
    state.collect('hall-teacup');
    state.enterRoom('library', 'left');
    expect(state.isCollected('hall-teacup')).toBe(true);
    state.enterRoom(WORLD.startRoom, 'right');
    expect(state.isCollected('hall-teacup')).toBe(true);
    expect(state.collectedCount).toBe(1);
  });

  it('knows when everything has been found', () => {
    const state = new GameState();
    expect(state.hasEverything(3)).toBe(false);
    state.collect('a');
    state.collect('b');
    expect(state.hasEverything(3)).toBe(false);
    state.collect('c');
    expect(state.hasEverything(3)).toBe(true);
  });
});

describe('lives', () => {
  it('counts down and reports the end of the run', () => {
    const state = new GameState('somewhere', 2);
    expect(state.loseLife()).toBe(false);
    expect(state.lives).toBe(1);
    expect(state.loseLife()).toBe(true);
    expect(state.lives).toBe(0);
  });

  it('never goes below zero', () => {
    const state = new GameState('somewhere', 1);
    state.loseLife();
    state.loseLife();
    expect(state.lives).toBe(0);
    expect(state.deaths).toBe(2);
  });
});

describe('entering rooms', () => {
  it('records where the player came in, so a death sends them back there', () => {
    const state = new GameState();
    state.enterRoom('attic', 'down');
    expect(state.currentRoom).toBe('attic');
    expect(state.entrySpawn).toBe('down');
  });

  it('remembers every room set foot in, for the map', () => {
    const state = new GameState('hall');
    expect([...state.visitedRooms]).toEqual(['hall']);
    state.enterRoom('attic', 'down');
    state.enterRoom('cellar', 'up');
    state.enterRoom('attic', 'left');
    expect([...state.visitedRooms].sort()).toEqual(['attic', 'cellar', 'hall']);
  });
});

describe('snapshots', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('round-trips everything that matters', () => {
    const state = new GameState('library', 4);
    state.collect('a');
    state.collect('b');
    state.enterRoom('attic', 'right');
    state.loseLife();

    const restored = GameState.fromSnapshot(state.toSnapshot());
    expect(restored.currentRoom).toBe('attic');
    expect(restored.entrySpawn).toBe('right');
    expect(restored.lives).toBe(3);
    expect(restored.deaths).toBe(1);
    expect([...restored.collectedItems].sort()).toEqual(['a', 'b']);
    expect([...restored.visitedRooms].sort()).toEqual(['attic', 'library']);
  });

  it('treats a save written before there was a map as having seen one room', () => {
    const snapshot = new GameState('library').toSnapshot();
    delete snapshot.visitedRooms;
    const restored = GameState.fromSnapshot(snapshot);
    expect([...restored.visitedRooms]).toEqual(['library']);
  });

  it('carries the clock across, rather than restarting it', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    const state = new GameState();
    vi.advanceTimersByTime(90_000);
    expect(state.elapsedMs).toBe(90_000);

    const snapshot = state.toSnapshot();
    vi.advanceTimersByTime(3_600_000); // the player goes away for an hour
    const restored = GameState.fromSnapshot(snapshot);
    expect(restored.elapsedMs).toBe(90_000);
    vi.useRealTimers();
  });
});

describe('formatDuration', () => {
  it('shows minutes and seconds, zero padded', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(9_000)).toBe('00:09');
    expect(formatDuration(61_000)).toBe('01:01');
    expect(formatDuration(600_000)).toBe('10:00');
  });

  it('copes with nonsense', () => {
    expect(formatDuration(-5)).toBe('00:00');
    expect(formatDuration(99_999_999)).toBe('99:39');
  });
});
