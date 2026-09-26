import type Phaser from 'phaser';
import {
  DOOR_ART,
  ENEMY_SPRITES,
  ITEM_SPRITES,
  PLAYER_DEAD,
  PLAYER_FALL,
  PLAYER_HANG,
  PLAYER_JUMP,
  PLAYER_LAND,
  PLAYER_PLUMMET,
  PLAYER_STAND,
  PLAYER_WALK,
  type SpriteDef,
  VENT_GRATE,
  VENT_KINDS,
  VENT_TIP,
  VENT_WARN,
  mirrorArt,
} from '../assets/sprites';
import {
  ITEM_FLASH_COLOURS,
  LOCK_INKS,
  PALETTE,
  type PaletteKey,
  paletteColour,
} from '../assets/palette';
import {
  CONVEYOR_ART,
  CRUMBLE_ART,
  DECOR_ART,
  GATE_ART,
  HATCH_ART,
  LEDGE_ART,
  LEVER_ART,
  LIFT_ART,
  LIQUID_ART,
  NASTY_ART,
  SPIKES_DOWN,
  SPIKES_UP,
  TELEPORT_ART,
  WALL_ART,
} from '../assets/tileArt';
import { LOCK_COLOURS, type LockColour } from '../world/tiles';
import { type ThemeDef, THEMES } from '../assets/themes';
import { PLAY_HEIGHT, PLAY_WIDTH, TILE_SIZE } from '../config';
import {
  type Art,
  artToCanvas,
  context2d,
  createCanvas,
  paintArt,
  paintField,
  silhouetteOf,
  themedResolver,
} from './pixels';
import { backdropFor } from '../assets/backdrops';
import type { Room } from '../world/Room';

/**
 * Builds every texture the game uses, at boot, from the art data in src/assets.
 *
 * There is not a single image file in this project. Everything is plotted a
 * pixel at a time into a canvas and handed to Phaser as a texture.
 */

/** How far everything's shadow falls on the wall behind it, down and to the right. */
export const SHADOW_OFFSET = 2;

/**
 * Registers a texture, and a black silhouette of it to use as its shadow.
 *
 * Every sprite in the game gets one, so anything can cast a shadow without
 * somebody having remembered to draw one for it. Silhouettes are made here
 * rather than by tinting at draw time, because tinting is a WebGL nicety and
 * this has to look the same whichever renderer the browser hands over.
 */
function addCanvasTexture(
  scene: Phaser.Scene,
  key: string,
  canvas: HTMLCanvasElement,
  withShadow = true,
): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
  if (!withShadow) return;
  const shadow = keys.shadow(key);
  if (scene.textures.exists(shadow)) scene.textures.remove(shadow);
  scene.textures.addCanvas(shadow, silhouetteOf(canvas));
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
  gate: (lock: LockColour, stage: number): string => `gate-${lock}-${stage}`,
  lift: (theme: string, frame: number): string => `tile-${theme}-lift-${frame}`,
  lever: (on: boolean): string => `tile-lever-${on ? 'on' : 'off'}`,
  teleport: (frame: number): string => `tile-teleport-${frame}`,
  hatch: (theme: string): string => `tile-${theme}-hatch`,
  keyItem: (lock: LockColour, frame: number): string => `key-item-${lock}-${frame}`,
  /** The parts of a vent that are not its jet: the tip, the warning sputter, and the grating. */
  vent: (kind: string, part: 'tip' | 'warn' | 'grate', frame = 0): string =>
    `vent-${kind}-${part}-${frame}`,
  room: (id: string): string => `room-${id}`,
  backdrop: (id: string): string => `backdrop-${id}`,
  /** The silhouette of any texture built here, for the shadow it casts. */
  shadow: (key: string): string => `${key}~shadow`,
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
  buildSprite(scene, 'fall', PLAYER_FALL);
  buildSprite(scene, 'plummet', PLAYER_PLUMMET);
  buildSprite(scene, 'land', PLAYER_LAND);
  buildSprite(scene, 'hang', PLAYER_HANG);
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

/** The jet is an ordinary enemy sprite; the rest of a vent is built here. */
function buildVents(scene: Phaser.Scene): void {
  for (const [kind, ink] of Object.entries(VENT_KINDS)) {
    const jet = paletteInk(['1', ink.hot as PaletteKey], ['2', ink.edge as PaletteKey]);
    VENT_TIP.forEach((art, frame) => ensureArt(scene, keys.vent(kind, 'tip', frame), art, jet));
    VENT_WARN.forEach((art, frame) => ensureArt(scene, keys.vent(kind, 'warn', frame), art, jet));
    ensureArt(scene, keys.vent(kind, 'grate'), VENT_GRATE, paletteInk(['1', 'W'], ['2', 'w']));
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
  // Lifts and hatches borrow the theme's machinery colours, the same ones the
  // conveyors use, so they read as apparatus rather than as scenery.
  LIFT_ART.forEach((art, index) => {
    ensureArt(
      scene,
      keys.lift(name, index),
      art,
      paletteInk(['1', theme.conveyorInk], ['2', theme.conveyorShade]),
    );
  });
  ensureArt(
    scene,
    keys.hatch(name),
    HATCH_ART,
    paletteInk(['1', theme.conveyorInk], ['2', theme.conveyorShade]),
  );
}

/**
 * Gates are coloured by their lock rather than by the room's theme, so a brass
 * gate is the same brass gate wherever you run into it.
 */
/** The lever is the same bright yellow everywhere: it is the thing you touch. */
function buildLevers(scene: Phaser.Scene): void {
  LEVER_ART.forEach((art, index) => {
    ensureArt(scene, keys.lever(index === 1), art, paletteInk(['1', 'Y'], ['2', 'w']));
  });
}

/** Cupboards are the same magenta wherever they are: they are a promise. */
function buildTeleports(scene: Phaser.Scene): void {
  TELEPORT_ART.forEach((art, index) => {
    ensureArt(scene, keys.teleport(index), art, paletteInk(['1', 'M'], ['2', 'W']));
  });
}

function buildGates(scene: Phaser.Scene): void {
  for (const lock of LOCK_COLOURS) {
    const [ink, shade] = LOCK_INKS[lock];
    GATE_ART.forEach((art, stage) => {
      ensureArt(scene, keys.gate(lock, stage), art, paletteInk(['1', ink], ['2', shade]));
    });
    // A key pulses between its two inks rather than flashing through the whole
    // palette like the other collectables: which lock it fits has to be obvious.
    ensureArt(scene, keys.keyItem(lock, 0), ITEM_SPRITES.key, paletteInk(['1', ink]));
    ensureArt(scene, keys.keyItem(lock, 1), ITEM_SPRITES.key, paletteInk(['1', shade]));
  }
}

export function buildAllTextures(scene: Phaser.Scene): void {
  buildPlayer(scene);
  buildEnemies(scene);
  buildVents(scene);
  buildItems(scene);
  buildDoor(scene);
  buildGates(scene);
  buildLevers(scene);
  buildTeleports(scene);
  for (const [name, theme] of Object.entries(THEMES)) {
    buildThemeTiles(scene, name, theme);
  }
}

/** Tiles that are part of the painted room, and so cast a shadow on its back wall. */
const CASTS_SHADOW = new Set(['#', '=', ',', ':', '^', 'v', '<', '>']);

/** Every art pixel that is not transparent, painted black: a silhouette. */
const silhouette = (ch: string): string | null => (ch === '.' ? null : '#000000');

/** The bright version of a colour, for the lit top of a wall. Bright colours stay as they are. */
export function brightInk(key: PaletteKey): PaletteKey {
  const upper = key.toUpperCase();
  return upper !== key && upper in PALETTE ? (upper as PaletteKey) : key;
}

export interface RoomTextures {
  /** The back wall, fully opaque. */
  backdrop: string;
  /** The walls, ledges and decoration, with their shadows, on a clear ground. */
  scenery: string;
}

/**
 * Paints a room's fixed scenery, as two textures.
 *
 * Only the parts that never change go in here. Conveyors, crumbling floors,
 * liquid and the nastier hazards animate, so they are drawn as sprites on top.
 *
 * Two layers rather than one so that the shadows moving things cast can be
 * slid in between: on the wallpaper, and under the scenery. A shadow then only
 * ever darkens the wall behind, and a player standing on a floor never takes a
 * bite out of it.
 *
 * The scenery's own shadows are painted before any of the scenery, for the
 * same reason — and only for things that are there for good, since a
 * crumbling floor's shadow would outlive the floor.
 */
export function buildRoomTextures(scene: Phaser.Scene, room: Room, theme: ThemeDef): RoomTextures {
  const result = { backdrop: keys.backdrop(room.id), scenery: keys.room(room.id) };
  if (scene.textures.exists(result.scenery) && scene.textures.exists(result.backdrop)) {
    return result;
  }

  const back = createCanvas(PLAY_WIDTH, PLAY_HEIGHT);
  const backdrop = backdropFor(theme.backdrop);
  const backdropInks: Record<string, string | null> = {
    '1': paletteColour(theme.backdropInk),
    '2': paletteColour(theme.backdropShade),
    '.': null,
  };
  paintField(
    context2d(back),
    PLAY_WIDTH,
    PLAY_HEIGHT,
    (x, y) => backdropInks[backdrop(x, y)] ?? null,
    paletteColour(theme.background) ?? '#000000',
  );
  addCanvasTexture(scene, result.backdrop, back, false);

  const canvas = createCanvas(PLAY_WIDTH, PLAY_HEIGHT);
  const ctx = context2d(canvas);

  const wall = WALL_ART[theme.wall] ?? WALL_ART.brick;
  const ledge = LEDGE_ART[theme.ledge] ?? LEDGE_ART.ledge;
  const decor = DECOR_ART[theme.decor] ?? DECOR_ART.cobweb;
  const decorTwo = DECOR_ART[theme.decorTwo] ?? DECOR_ART.cobweb;

  const artFor = (char: string): Art | null => {
    switch (char) {
      case '#':
        return wall;
      case '=':
        return ledge;
      case ',':
        return decor;
      case ':':
        return decorTwo;
      case '^':
        return SPIKES_UP;
      case 'v':
        return SPIKES_DOWN;
      case '<':
      case '>':
        return CONVEYOR_ART[0];
      default:
        return null;
    }
  };

  room.forEachCell((col, row, char) => {
    if (!CASTS_SHADOW.has(char)) return;
    const art = artFor(char);
    if (art === null) return;
    paintArt(
      ctx,
      art,
      col * TILE_SIZE + SHADOW_OFFSET,
      row * TILE_SIZE + SHADOW_OFFSET,
      silhouette,
    );
  });

  const wallInk = themedResolver(paletteInk(['1', theme.wallInk], ['2', theme.wallShade]));
  const ledgeInk = themedResolver(paletteInk(['1', theme.ledgeInk], ['2', theme.ledgeShade]));
  const decorInk = themedResolver(paletteInk(['1', theme.decorInk]));
  const decorTwoInk = themedResolver(paletteInk(['1', theme.decorTwoInk]));
  const hazardInk = themedResolver(paletteInk(['1', theme.hazardInk]));
  const rimLight = paletteColour(brightInk(theme.wallInk)) ?? '#ffffff';

  room.forEachCell((col, row, char) => {
    const x = col * TILE_SIZE;
    const y = row * TILE_SIZE;
    switch (char) {
      case '#':
        paintArt(ctx, wall, x, y, wallInk);
        // The top of a wall you can stand on catches the light, which is also
        // the quickest way to say "you can stand on this".
        if (row > 0 && room.rawCharAt(col, row - 1) !== '#') {
          ctx.fillStyle = rimLight;
          ctx.fillRect(x, y, TILE_SIZE, 1);
        }
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

  addCanvasTexture(scene, result.scenery, canvas, false);
  return result;
}
