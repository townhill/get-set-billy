import type Phaser from 'phaser';
import { PLAY_HEIGHT, PLAY_WIDTH } from '../config';
import { LOCK_INKS, paletteHex } from '../assets/palette';
import { PixelText } from '../render/PixelText';
import { DIRECTIONS, type Point, type RoomData } from '../world/roomTypes';
import { type LockColour, lockColour } from '../world/tiles';

/**
 * The map of the house, drawn on the pause screen.
 *
 * Every room has always carried a `grid` position, used until now only to check
 * that neighbours line up. It is a map; this draws it.
 *
 * What it is for is knowing where you have not been and what you have not
 * picked up — and, once there are gates, which way is shut. A locked house
 * without a map is not a puzzle, it is a search.
 */

const CELL = { width: 38, height: 18, gap: 4 } as const;
const TOP = 20;

/** One room's rectangle on screen, in playfield pixels. */
export interface MapCell {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Works out where each room goes.
 *
 * Pure, and exported, because the arithmetic is the part worth testing: the
 * grid is centred on whatever spread of cells the house happens to occupy, so
 * adding a room at the edge of the map has to shift everything, not overflow.
 */
export function mapLayout(rooms: readonly { id: string; grid: Point }[]): MapCell[] {
  if (rooms.length === 0) return [];

  const xs = rooms.map((room) => room.grid.x);
  const ys = rooms.map((room) => room.grid.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const cols = Math.max(...xs) - minX + 1;

  const step = { x: CELL.width + CELL.gap, y: CELL.height + CELL.gap };
  const totalWidth = cols * CELL.width + (cols - 1) * CELL.gap;
  const originX = Math.round((PLAY_WIDTH - totalWidth) / 2);

  return rooms.map((room) => ({
    id: room.id,
    x: originX + (room.grid.x - minX) * step.x,
    y: TOP + (room.grid.y - minY) * step.y,
    width: CELL.width,
    height: CELL.height,
  }));
}

export interface MapModel {
  rooms: readonly RoomData[];
  currentRoom: string;
  visited: ReadonlySet<string>;
  collected: ReadonlySet<string>;
  keys: ReadonlySet<LockColour>;
}

const INK = {
  unvisited: paletteHex('K'),
  visited: paletteHex('c'),
  current: paletteHex('Y'),
  item: paletteHex('W'),
  door: paletteHex('G'),
  link: paletteHex('b'),
} as const;

export class MapOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly title: PixelText;
  private readonly legend: PixelText;

  constructor(scene: Phaser.Scene, depth: number) {
    this.graphics = scene.add.graphics().setDepth(depth).setVisible(false);

    this.title = new PixelText(scene, {
      x: PLAY_WIDTH / 2,
      y: 8,
      maxChars: 20,
      originX: 0.5,
      colour: 'Y',
      depth: depth + 1,
    });

    this.legend = new PixelText(scene, {
      x: PLAY_WIDTH / 2,
      y: PLAY_HEIGHT - 28,
      maxChars: 40,
      lines: 2,
      originX: 0.5,
      colour: 'C',
      depth: depth + 1,
    });
  }

  show(model: MapModel): void {
    const cells = new Map(mapLayout(model.rooms).map((cell) => [cell.id, cell]));
    const byId = new Map(model.rooms.map((room) => [room.id, room]));

    const g = this.graphics;
    g.clear();
    g.setVisible(true);

    // Opaque, not merely dark: a bright ledge showing through the map reads as
    // part of it, and the map is hard enough to parse without imaginary rooms.
    g.fillStyle(0x000000, 1);
    g.fillRect(0, 0, PLAY_WIDTH, PLAY_HEIGHT);

    this.drawLinks(model, cells, byId);

    for (const room of model.rooms) {
      const cell = cells.get(room.id);
      if (cell === undefined) continue;
      this.drawRoom(model, room, cell);
    }

    this.title.setText('THE HOUSE SO FAR');
    this.legend.setText([
      `${model.visited.size}/${model.rooms.length} ROOMS SEEN`,
      'ESC TO CARRY ON   M FOR SOUND',
    ]);
  }

  /** Short stubs in the gaps, showing which rooms actually join up. */
  private drawLinks(
    model: MapModel,
    cells: Map<string, MapCell>,
    byId: Map<string, RoomData>,
  ): void {
    const g = this.graphics;
    g.fillStyle(INK.link, 1);

    for (const room of model.rooms) {
      if (!model.visited.has(room.id)) continue;
      const cell = cells.get(room.id);
      if (cell === undefined) continue;

      for (const dir of DIRECTIONS) {
        const target = room.exits[dir];
        if (target === undefined || !byId.has(target)) continue;
        // Draw each link once, from whichever end is drawn first.
        if (dir === 'left' || dir === 'up') continue;

        if (dir === 'right') {
          g.fillRect(cell.x + cell.width, cell.y + cell.height / 2 - 1, CELL.gap, 2);
        } else {
          g.fillRect(cell.x + cell.width / 2 - 1, cell.y + cell.height, 2, CELL.gap);
        }
      }
    }
  }

  private drawRoom(model: MapModel, room: RoomData, cell: MapCell): void {
    const g = this.graphics;
    const here = room.id === model.currentRoom;
    const seen = model.visited.has(room.id);

    const shut = this.lockedGate(model, room);
    const outline = here
      ? INK.current
      : shut !== null
        ? paletteHex(LOCK_INKS[shut][0])
        : seen
          ? INK.visited
          : INK.unvisited;

    if (here) {
      g.fillStyle(outline, 0.25);
      g.fillRect(cell.x, cell.y, cell.width, cell.height);
    }

    g.lineStyle(1, outline, 1);
    g.strokeRect(cell.x + 0.5, cell.y + 0.5, cell.width - 1, cell.height - 1);

    // Nothing else is known about a room you have not been in yet.
    if (!seen) return;

    const left = (room.items ?? []).filter((item) => !model.collected.has(item.id));
    g.fillStyle(INK.item, 1);
    left.forEach((_item, index) => {
      g.fillRect(cell.x + 4 + index * 5, cell.y + cell.height - 7, 3, 3);
    });

    if (room.door !== undefined) {
      g.fillStyle(INK.door, 1);
      g.fillRect(cell.x + cell.width - 8, cell.y + 4, 4, 6);
    }
  }

  /** The colour of a gate in this room the player still cannot open, if any. */
  private lockedGate(model: MapModel, room: RoomData): LockColour | null {
    for (const row of room.tiles) {
      for (const char of row) {
        const lock = lockColour(char);
        if (lock !== null && !model.keys.has(lock)) return lock;
      }
    }
    return null;
  }

  hide(): void {
    this.graphics.clear();
    this.graphics.setVisible(false);
    this.title.setText('');
    this.legend.setText(['', '']);
  }

  destroy(): void {
    this.graphics.destroy();
    this.title.destroy();
    this.legend.destroy();
  }
}
