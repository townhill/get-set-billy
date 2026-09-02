import { SAVE } from '../config';
import { type GameStateSnapshot } from '../state/GameState';

/**
 * Progress lives in localStorage and nowhere else. There is no server, and a
 * browser that refuses to store anything simply plays without a Continue option.
 */

export interface Settings {
  muted: boolean;
  /**
   * Slows the collectables' flash right down and cuts it to two colours.
   *
   * Off by default, because the flash is the look of the thing; one key press
   * away, because nine colour changes a second is not something everybody can
   * safely look at.
   */
  reducedFlashing: boolean;
}

const DEFAULT_SETTINGS: Settings = { muted: false, reducedFlashing: false };

/** One finished run. Kept so the title screen can show a time to beat. */
export interface RunRecord {
  /** How long the run took, in milliseconds. */
  elapsedMs: number;
  deaths: number;
  /** When it finished, as epoch milliseconds. */
  finishedAt: number;
}

/** How many finished runs are remembered. Enough for a personal best and a bit of history. */
const MAX_RECORDS = 10;

function isRecord(value: unknown): value is RunRecord {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.elapsedMs === 'number' &&
    typeof v.deaths === 'number' &&
    typeof v.finishedAt === 'number'
  );
}

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
      if (typeof parsed === 'object' && parsed !== null) {
        const v = parsed as Record<string, unknown>;
        return {
          muted: Boolean(v.muted),
          reducedFlashing: Boolean(v.reducedFlashing),
        };
      }
    } catch {
      /* fall through to defaults */
    }
    return { ...DEFAULT_SETTINGS };
  },

  /**
   * Writes some settings, leaving the rest alone.
   *
   * A partial on purpose: whoever is turning the sound off should not have to
   * know what else lives in here, and adding a setting should not make every
   * existing caller wrong.
   */
  saveSettings(settings: Partial<Settings>): void {
    try {
      storage()?.setItem(SAVE.settingsKey, JSON.stringify({ ...this.loadSettings(), ...settings }));
    } catch {
      /* settings are a convenience, not a requirement */
    }
  },

  /** Every finished run that has been kept, fastest first. */
  loadRecords(): RunRecord[] {
    const store = storage();
    if (!store) return [];
    try {
      const raw = store.getItem(SAVE.recordsKey);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isRecord).sort((a, b) => a.elapsedMs - b.elapsedMs);
    } catch {
      return [];
    }
  },

  /**
   * Remembers a finished run and says whether it was the best one yet.
   *
   * Called once, on the victory screen. A browser that cannot store anything
   * simply never has a best time, which is a disappointment rather than a bug.
   */
  recordRun(run: RunRecord): { records: RunRecord[]; isBest: boolean } {
    const previous = this.loadRecords();
    const isBest = previous.length === 0 || run.elapsedMs < previous[0].elapsedMs;
    const records = [...previous, run]
      .sort((a, b) => a.elapsedMs - b.elapsedMs)
      .slice(0, MAX_RECORDS);
    try {
      storage()?.setItem(SAVE.recordsKey, JSON.stringify(records));
    } catch {
      /* a lost best time is not worth interrupting the celebration for */
    }
    return { records, isBest };
  },

  /** The fastest run so far, or null if the house has never been escaped. */
  bestRun(): RunRecord | null {
    return this.loadRecords()[0] ?? null;
  },
};
