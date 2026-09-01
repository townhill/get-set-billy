import { SAVE } from '../config';
import { type GameStateSnapshot } from '../state/GameState';

/**
 * Progress lives in localStorage and nowhere else. There is no server, and a
 * browser that refuses to store anything simply plays without a Continue option.
 */

export interface Settings {
  muted: boolean;
}

const DEFAULT_SETTINGS: Settings = { muted: false };

function storage(): Storage | null {
  try {
    const store = globalThis.localStorage;
    // Touch it: private-mode browsers throw here rather than at lookup.
    const probe = '__peculiar_probe__';
    store.setItem(probe, '1');
    store.removeItem(probe);
    return store;
  } catch {
    return null;
  }
}

function isSnapshot(value: unknown): value is GameStateSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.currentRoom === 'string' &&
    typeof v.lives === 'number' &&
    Array.isArray(v.collectedItems) &&
    v.collectedItems.every((item) => typeof item === 'string') &&
    typeof v.elapsedMs === 'number' &&
    typeof v.entrySpawn === 'string' &&
    typeof v.deaths === 'number' &&
    // Added with the map, so a save written before it is still perfectly good.
    (v.visitedRooms === undefined ||
      (Array.isArray(v.visitedRooms) && v.visitedRooms.every((id) => typeof id === 'string')))
  );
}

export const SaveSystem = {
  save(snapshot: GameStateSnapshot): boolean {
    const store = storage();
    if (!store) return false;
    try {
      store.setItem(SAVE.storageKey, JSON.stringify(snapshot));
      return true;
    } catch {
      return false;
    }
  },

  /** Returns null when there is nothing to continue, or the save is unreadable. */
  load(): GameStateSnapshot | null {
    const store = storage();
    if (!store) return null;
    try {
      const raw = store.getItem(SAVE.storageKey);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      return isSnapshot(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },

  hasSave(): boolean {
    return this.load() !== null;
  },

  clear(): void {
    try {
      storage()?.removeItem(SAVE.storageKey);
    } catch {
      /* nothing we can do, and nothing that matters */
    }
  },

  loadSettings(): Settings {
    const store = storage();
    if (!store) return { ...DEFAULT_SETTINGS };
    try {
      const raw = store.getItem(SAVE.settingsKey);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null && 'muted' in parsed) {
        return { muted: Boolean((parsed as { muted: unknown }).muted) };
      }
    } catch {
      /* fall through to defaults */
    }
    return { ...DEFAULT_SETTINGS };
  },

  saveSettings(settings: Settings): void {
    try {
      storage()?.setItem(SAVE.settingsKey, JSON.stringify(settings));
    } catch {
      /* settings are a convenience, not a requirement */
    }
  },
};
