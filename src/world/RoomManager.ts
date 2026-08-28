import { Room } from './Room';
import { type Direction, type RoomData, validateRoomShape } from './roomTypes';

/**
 * Loads every room in src/data/rooms and hands them out by id.
 *
 * Rooms are picked up with a glob, so adding a screen to the house is a matter
 * of dropping one more JSON file into that folder. No code changes, no registry
 * to update, no import to remember.
 */
const roomModules = import.meta.glob<{ default: RoomData }>('../data/rooms/*.json', {
  eager: true,
});

function loadAll(): RoomData[] {
  return Object.entries(roomModules)
    .map(([path, module]) => {
      const data = module.default;
      const expected = path.split('/').pop()?.replace('.json', '');
      if (data.id !== expected) {
        throw new Error(`Room "${data.id}" is in a file called ${expected}.json; those must match`);
      }
      return data;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export const ALL_ROOM_DATA: readonly RoomData[] = loadAll();

/** Every collectable in the house, in a stable order. */
export const ALL_ITEM_IDS: readonly string[] = ALL_ROOM_DATA.flatMap((room) =>
  (room.items ?? []).map((item) => item.id),
);

export const TOTAL_ITEMS = ALL_ITEM_IDS.length;

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  constructor(data: readonly RoomData[] = ALL_ROOM_DATA) {
    for (const entry of data) {
      this.rooms.set(entry.id, new Room(entry));
    }
  }

  has(id: string): boolean {
    return this.rooms.has(id);
  }

  /** Throws rather than returning undefined: a missing room is a bug in the data. */
  get(id: string): Room {
    const room = this.rooms.get(id);
    if (!room) throw new Error(`No such room: "${id}"`);
    return room;
  }

  get ids(): string[] {
    return [...this.rooms.keys()];
  }

  get size(): number {
    return this.rooms.size;
  }

  neighbour(id: string, dir: Direction): Room | undefined {
    const target = this.get(id).exit(dir);
    return target === undefined ? undefined : this.rooms.get(target);
  }

  /** The room containing the front door. */
  findDoorRoom(): Room | undefined {
    return [...this.rooms.values()].find((room) => room.data.door !== undefined);
  }

  /**
   * Checks the whole house for structural problems. Used by the test suite and
   * surfaced in debug mode, so a broken new room is noticed immediately.
   */
  validate(): string[] {
    const problems: string[] = [];
    const seenItems = new Set<string>();

    for (const room of this.rooms.values()) {
      for (const issue of validateRoomShape(room.data)) {
        problems.push(`${room.id}: ${issue}`);
      }

      for (const [dir, targetId] of Object.entries(room.data.exits) as [Direction, string][]) {
        const target = this.rooms.get(targetId);
        if (!target) {
          problems.push(`${room.id}: "${dir}" exit points at unknown room "${targetId}"`);
          continue;
        }
        const back = { left: 'right', right: 'left', up: 'down', down: 'up' } as const;
        if (target.data.exits[back[dir]] !== room.id) {
          problems.push(`${room.id}: "${dir}" exit to "${targetId}" is not reciprocated`);
        }
      }

      for (const item of room.data.items ?? []) {
        if (seenItems.has(item.id)) problems.push(`duplicate item id "${item.id}"`);
        seenItems.add(item.id);
      }
    }

    return problems;
  }
}
