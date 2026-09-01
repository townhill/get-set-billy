import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SAVE } from '../src/config';
import { GameState } from '../src/state/GameState';
import { SaveSystem } from '../src/systems/SaveSystem';

/** The smallest thing that behaves like localStorage. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  } as Storage;
}

function withStorage(store: Storage | undefined): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value: store,
    configurable: true,
    writable: true,
  });
}

describe('with working storage', () => {
  beforeEach(() => withStorage(memoryStorage()));
  afterEach(() => withStorage(undefined));

  it('reports no save before anything is written', () => {
    expect(SaveSystem.hasSave()).toBe(false);
    expect(SaveSystem.load()).toBeNull();
  });

  it('round-trips a game in progress', () => {
    const state = new GameState('damp-library', 3);
    state.collect('library-spectacles');
    state.enterRoom('hat-attic', 'down');

    expect(SaveSystem.save(state.toSnapshot())).toBe(true);
    const loaded = SaveSystem.load();
    expect(loaded).not.toBeNull();

    const restored = GameState.fromSnapshot(loaded!);
    expect(restored.currentRoom).toBe('hat-attic');
    expect(restored.entrySpawn).toBe('down');
    expect(restored.lives).toBe(3);
    expect(restored.isCollected('library-spectacles')).toBe(true);
    expect([...restored.visitedRooms].sort()).toEqual(['damp-library', 'hat-attic']);
  });

  it('still loads a save written before rooms were remembered', () => {
    globalThis.localStorage.setItem(
      SAVE.storageKey,
      JSON.stringify({
        currentRoom: 'hat-attic',
        lives: 3,
        collectedItems: ['a'],
        elapsedMs: 1000,
        entrySpawn: 'down',
        deaths: 1,
      }),
    );
    const loaded = SaveSystem.load();
    expect(loaded).not.toBeNull();
    expect(loaded?.visitedRooms).toBeUndefined();
    expect([...GameState.fromSnapshot(loaded!).visitedRooms]).toEqual(['hat-attic']);
  });

  it('refuses a save whose room list is the wrong shape', () => {
    globalThis.localStorage.setItem(
      SAVE.storageKey,
      JSON.stringify({
        currentRoom: 'attic',
        lives: 3,
        collectedItems: [],
        elapsedMs: 0,
        entrySpawn: 'start',
        deaths: 0,
        visitedRooms: [1, 2],
      }),
    );
    expect(SaveSystem.load()).toBeNull();
  });

  it('forgets a game when asked to', () => {
    SaveSystem.save(new GameState().toSnapshot());
    expect(SaveSystem.hasSave()).toBe(true);
    SaveSystem.clear();
    expect(SaveSystem.hasSave()).toBe(false);
  });

  it('refuses to load rubbish rather than crashing', () => {
    globalThis.localStorage.setItem(SAVE.storageKey, 'not json at all');
    expect(SaveSystem.load()).toBeNull();
  });

  it('refuses to load a save that is missing fields', () => {
    globalThis.localStorage.setItem(SAVE.storageKey, JSON.stringify({ currentRoom: 'attic' }));
    expect(SaveSystem.load()).toBeNull();
  });

  it('refuses to load a save whose collected list is the wrong shape', () => {
    globalThis.localStorage.setItem(
      SAVE.storageKey,
      JSON.stringify({
        currentRoom: 'attic',
        lives: 3,
        collectedItems: [1, 2, 3],
        elapsedMs: 0,
        entrySpawn: 'start',
        deaths: 0,
      }),
    );
    expect(SaveSystem.load()).toBeNull();
  });

  it('remembers the sound setting on its own key', () => {
    expect(SaveSystem.loadSettings()).toEqual({ muted: false });
    SaveSystem.saveSettings({ muted: true });
    expect(SaveSystem.loadSettings()).toEqual({ muted: true });
    expect(SaveSystem.load()).toBeNull(); // settings are not a saved game
  });
});

describe('with no storage at all', () => {
  beforeEach(() => withStorage(undefined));
  afterEach(() => withStorage(undefined));

  it('carries on without a Continue option instead of falling over', () => {
    expect(SaveSystem.save(new GameState().toSnapshot())).toBe(false);
    expect(SaveSystem.load()).toBeNull();
    expect(SaveSystem.hasSave()).toBe(false);
    expect(() => SaveSystem.clear()).not.toThrow();
    expect(SaveSystem.loadSettings()).toEqual({ muted: false });
    expect(() => SaveSystem.saveSettings({ muted: true })).not.toThrow();
  });
});

describe('with storage that throws', () => {
  beforeEach(() => {
    withStorage({
      getItem: () => {
        throw new Error('quota');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('quota');
      },
    } as unknown as Storage);
  });
  afterEach(() => withStorage(undefined));

  it('treats a private-mode browser as simply having no save', () => {
    expect(SaveSystem.save(new GameState().toSnapshot())).toBe(false);
    expect(SaveSystem.load()).toBeNull();
  });
});
