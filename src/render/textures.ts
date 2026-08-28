import type Phaser from 'phaser';
import {
  DOOR_ART,
  ENEMY_SPRITES,
  ITEM_SPRITES,
  PLAYER_DEAD,
  PLAYER_JUMP,
  PLAYER_STAND,
  PLAYER_WALK,
  type SpriteDef,
  mirrorArt,
} from '../assets/sprites';
import { ITEM_FLASH_COLOURS, PALETTE, type PaletteKey, paletteColour } from '../assets/palette';
import {
  CONVEYOR_ART,
  CRUMBLE_ART,
  DECOR_ART,
  LEDGE_ART,
  LIQUID_ART,
  NASTY_ART,
  SPIKES_DOWN,
  SPIKES_UP,
  WALL_ART,
} from '../assets/tileArt';
import { type ThemeDef, THEMES } from '../assets/themes';
import { PLAY_HEIGHT, PLAY_WIDTH, TILE_SIZE } from '../config';
import { type Art, artToCanvas, context2d, createCanvas, paintArt, themedResolver } from './pixels';
import type { Room } from '../world/Room';

/**
 * Builds every texture the game uses, at boot, from the art data in src/assets.
 *
 * There is not a single image file in this project. Everything is plotted a
 * pixel at a time into a canvas and handed to Phaser as a texture.
 */

function addCanvasTexture(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

function ensureArt(scene: Phaser.Scene, key: string, art: Art, ink: Record<string, string>): void {
  if (scene.textures.exists(key)) return;
  addCanvasTexture(scene, key, artToCanvas(art, themedResolver(ink)));
}

// ---------------------------------------------------------------------------
// Texture key helpers. Every lookup in the game goes through one of these, so
// there are no stringly-typed keys scattered about.
// ---------------------------------------------------------------------------

export const keys = {
  player: (pose: string, facing: -1 | 1, frame = 0): string =>
    `player-${pose}-${facing < 0 ? 'l' : 'r'}-${frame}`,
  enemy: (sprite: string, frame: number, facing: -1 | 1): string =>
    `enemy-${sprite}-${frame}-${facing < 0 ? 'l' : 'r'}`,
  item: (sprite: string, colour: number): string => `item-${sprite}-${colour}`,
  door: (open: boolean): string => `door-${open ? 'open' : 'shut'}`,
  liquid: (theme: string, frame: number): string => `tile-${theme}-liquid-${frame}`,
  nasty: (theme: string, frame: number): string => `tile-${theme}-nasty-${frame}`,
  conveyor: (theme: string, frame: number): string => `tile-${theme}-conveyor-${frame}`,
  crumble: (theme: string, stage: number): string => `tile-${theme}-crumble-${stage}`,
  room: (id: string): string => `room-${id}`,
};

function paletteInk(...pairs: [string, PaletteKey][]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [ch, colour] of pairs) {
    const css = PALETTE[colour];
    if (css !== null) map[ch] = css;
  }
  return map;
}

// ---------------------------------------------------------------------------

function buildSprite(scene: Phaser.Scene, pose: string, def: SpriteDef): void {
  def.frames.forEach((frame, index) => {
    addCanvasTexture(scene, keys.player(pose, 1, index), artToCanvas(frame));
    addCanvasTexture(scene, keys.player(pose, -1, index), artToCanvas(mirrorArt(frame)));
  });
}

function buildPlayer(scene: Phaser.Scene): void {
  buildSprite(scene, 'stand', PLAYER_STAND);
  buildSprite(scene, 'walk', PLAYER_WALK);
  buildSprite(scene, 'jump', PLAYER_JUMP);
  buildSprite(scene, 'fall', PLAYER_JUMP);
  buildSprite(scene, 'dead', PLAYER_DEAD);
}

function buildEnemies(scene: Phaser.Scene): void {
  for (const [name, def] of Object.entries(ENEMY_SPRITES)) {
    def.frames.forEach((frame, index) => {
      addCanvasTexture(scene, keys.enemy(name, index, 1), artToCanvas(frame));
      addCanvasTexture(scene, keys.enemy(name, index, -1), artToCanvas(mirrorArt(frame)));
    });
  }
}

function buildItems(scene: Phaser.Scene): void {
  for (const [name, art] of Object.entries(ITEM_SPRITES)) {
    ITEM_FLASH_COLOURS.forEach((colour, index) => {
      const ink = paletteInk(['1', colour]);
      addCanvasTexture(scene, keys.item(name, index), artToCanvas(art, themedResolver(ink)));
    });
  }
}

function buildDoor(scene: Phaser.Scene): void {
  addCanvasTexture(
    scene,
    keys.door(false),
    artToCanvas(
      DOOR_ART,
      themedResolver(paletteInk(['1', 'y'], ['2', 'K'], ['3', 'r'], ['W', 'Y'])),
    ),
  );
  addCanvasTexture(
    scene,
    keys.door(true),
    artToCanvas(
      DOOR_ART,
      themedResolver(paletteInk(['1', 'Y'], ['2', 'g'], ['3', 'G'], ['W', 'W'])),
    ),
  );
}

/** Animated tiles need one texture per frame; static ones are painted into the room. */
function buildThemeTiles(scene: Phaser.Scene, name: string, theme: ThemeDef): void {
  LIQUID_ART.forEach((art, index) => {
    ensureArt(
      scene,
      keys.liquid(name, index),
      art,
      paletteInk(['1', theme.liquidInk], ['2', theme.liquidShade]),
    );
  });
  NASTY_ART.forEach((art, index) => {
    ensureArt(scene, keys.nasty(name, index), art, paletteInk(['1', theme.hazardInk]));
  });
  CONVEYOR_ART.forEach((art, index) => {
    ensureArt(
      scene,
      keys.conveyor(name, index),
      art,
      paletteInk(['1', theme.conveyorInk], ['2', theme.conveyorShade]),
    );
  });
  CRUMBLE_ART.forEach((art, index) => {
    ensureArt(
      scene,
      keys.crumble(name, index),
      art,
      paletteInk(['1', theme.crumbleInk], ['2', theme.crumbleShade]),
    );
  });
}

export function buildAllTextures(scene: Phaser.Scene): void {
  buildPlayer(scene);
  buildEnemies(scene);
  buildItems(scene);
  buildDoor(scene);
  for (const [name, theme] of Object.entries(THEMES)) {
    buildThemeTiles(scene, name, theme);
  }
}

/**
 * Paints a whole room's fixed scenery into one texture.
 *
 * Only the parts that never change go in here. Conveyors, crumbling floors,
 * liquid and the nastier hazards animate, so they are drawn as sprites on top.
 */
export function buildRoomTexture(scene: Phaser.Scene, room: Room, theme: ThemeDef): string {
  const key = keys.room(room.id);
  if (scene.textures.exists(key)) return key;

  const canvas = createCanvas(PLAY_WIDTH, PLAY_HEIGHT);
  const ctx = context2d(canvas);

  const background = paletteColour(theme.background) ?? '#000000';
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, PLAY_WIDTH, PLAY_HEIGHT);

  const wall = WALL_ART[theme.wall] ?? WALL_ART.brick;
  const ledge = LEDGE_ART[theme.ledge] ?? LEDGE_ART.ledge;
  const decor = DECOR_ART[theme.decor] ?? DECOR_ART.cobweb;
  const decorTwo = DECOR_ART[theme.decorTwo] ?? DECOR_ART.cobweb;

  const wallInk = themedResolver(paletteInk(['1', theme.wallInk], ['2', theme.wallShade]));
  const ledgeInk = themedResolver(paletteInk(['1', theme.ledgeInk], ['2', theme.ledgeShade]));
  const decorInk = themedResolver(paletteInk(['1', theme.decorInk]));
  const decorTwoInk = themedResolver(paletteInk(['1', theme.decorTwoInk]));
  const hazardInk = themedResolver(paletteInk(['1', theme.hazardInk]));

  room.forEachCell((col, row, char) => {
    const x = col * TILE_SIZE;
    const y = row * TILE_SIZE;
    switch (char) {
      case '#':
        paintArt(ctx, wall, x, y, wallInk);
        break;
      case '=':
        paintArt(ctx, ledge, x, y, ledgeInk);
        break;
      case ',':
        paintArt(ctx, decor, x, y, decorInk);
        break;
      case ':':
        paintArt(ctx, decorTwo, x, y, decorTwoInk);
        break;
      case '^':
        paintArt(ctx, SPIKES_UP, x, y, hazardInk);
        break;
      case 'v':
        paintArt(ctx, SPIKES_DOWN, x, y, hazardInk);
        break;
      default:
        break;
    }
  });

  addCanvasTexture(scene, key, canvas);
  return key;
}
