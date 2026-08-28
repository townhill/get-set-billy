import type Phaser from 'phaser';
import { PLAY_HEIGHT, PLAY_WIDTH, TILE_SIZE } from '../config';
import { PixelText } from '../render/PixelText';
import type { Box } from '../systems/CollisionSystem';
import type { Room } from '../world/Room';
import { DIRECTIONS } from '../world/roomTypes';
import { tileDef } from '../world/tiles';

/**
 * Development overlay. Off unless `?debug=1` is in the URL or the build sets
 * VITE_DEBUG, so none of this ever appears during an ordinary game.
 *
 * Draws the collision geometry the game is actually using, rather than the
 * geometry it looks like it is using, which is the whole point.
 */

const COLOURS = {
  solid: 0x3050ff,
  platform: 0x40e050,
  hazard: 0xff3040,
  player: 0xffe040,
  enemy: 0xff50ff,
  item: 0x40e8ff,
  spawn: 0xffffff,
  exit: 0xffe040,
};

export interface DebugModel {
  roomId: string;
  player: Box;
  enemies: readonly Box[];
  items: readonly Box[];
  lines: readonly string[];
}

export class DebugOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly text: PixelText;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(200);
    this.text = new PixelText(scene, {
      x: 2,
      y: 2,
      maxChars: 26,
      lines: 7,
      colour: 'G',
      depth: 201,
    });
  }

  private outline(box: Box, colour: number, alpha = 1): void {
    this.graphics.lineStyle(1, colour, alpha);
    this.graphics.strokeRect(
      Math.round(box.x) + 0.5,
      Math.round(box.y) + 0.5,
      Math.max(1, box.width - 1),
      Math.max(1, box.height - 1),
    );
  }

  draw(room: Room, model: DebugModel): void {
    this.graphics.clear();

    room.forEachCell((col, row, char) => {
      const def = tileDef(char);
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;
      if (def.solid) {
        this.outline({ x, y, width: TILE_SIZE, height: TILE_SIZE }, COLOURS.solid, 0.4);
      } else if (def.platform) {
        this.graphics.lineStyle(1, COLOURS.platform, 0.9);
        this.graphics.strokeRect(x, y + 0.5, TILE_SIZE, 0);
      }
      if (def.hazard) {
        this.outline(
          { x: x + def.hazard.x, y: y + def.hazard.y, width: def.hazard.w, height: def.hazard.h },
          COLOURS.hazard,
          0.9,
        );
      }
    });

    for (const point of Object.values(room.data.spawns)) {
      this.graphics.lineStyle(1, COLOURS.spawn, 0.8);
      this.graphics.strokeRect(point.x + 0.5, point.y + 0.5, 7, 15);
      this.graphics.fillStyle(COLOURS.spawn, 0.9);
      this.graphics.fillRect(point.x + 3, point.y + 7, 2, 2);
    }

    // Mark which edges lead somewhere.
    this.graphics.lineStyle(1, COLOURS.exit, 0.9);
    for (const dir of DIRECTIONS) {
      if (room.exit(dir) === undefined) continue;
      if (dir === 'left') this.graphics.strokeRect(0.5, 0.5, 0, PLAY_HEIGHT - 1);
      if (dir === 'right') this.graphics.strokeRect(PLAY_WIDTH - 1.5, 0.5, 0, PLAY_HEIGHT - 1);
      if (dir === 'up') this.graphics.strokeRect(0.5, 0.5, PLAY_WIDTH - 1, 0);
      if (dir === 'down') this.graphics.strokeRect(0.5, PLAY_HEIGHT - 1.5, PLAY_WIDTH - 1, 0);
    }

    for (const box of model.items) this.outline(box, COLOURS.item);
    for (const box of model.enemies) this.outline(box, COLOURS.enemy);
    this.outline(model.player, COLOURS.player);

    this.text.setText(model.lines);
  }

  setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
    this.text.setVisible(visible);
  }

  destroy(): void {
    this.graphics.destroy();
    this.text.destroy();
  }
}
