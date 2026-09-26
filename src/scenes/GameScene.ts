import Phaser from 'phaser';
import {
  FIXED_STEP_MS,
  FLASH,
  GAME_WIDTH,
  MAX_STEPS_PER_FRAME,
  PLAYER,
  PLAY_HEIGHT,
  TILE_SIZE,
  WORLD,
  isDebugEnabled,
} from '../config';
import {
  ENEMY_SPRITES,
  ITEM_SPRITES,
  DOOR_HEIGHT,
  DOOR_WIDTH,
  VENT_KINDS,
} from '../assets/sprites';
import { ITEM_FLASH_COLOURS, LOCK_INKS, type PaletteKey, paletteHex } from '../assets/palette';
import { type ThemeDef, themeFor } from '../assets/themes';
import { PixelText } from '../render/PixelText';
import { SHADOW_OFFSET, buildRoomTextures, keys } from '../render/textures';
import { ParticleField, seededRandom } from '../render/particles';
import { Player, type PlayerPose } from '../objects/Player';
import { enemyBox, enemyFacing, enemyIsLethal, ventStage } from '../objects/Enemy';
import { liftBox } from '../objects/Lift';
import { ropeEnd, ropePoint } from '../objects/Rope';
import { boxesOverlap, hazardCellUnder, insetBox, type Box } from '../systems/CollisionSystem';
import { audio } from '../systems/AudioSystem';
import { input } from '../systems/InputSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { GameState, type GameStateSnapshot, type SpawnKey } from '../state/GameState';
import { type Cause, obituary } from '../state/obituaries';
import {
  ALL_ROOM_DATA,
  ALL_TELEPORTS,
  KEY_ITEMS,
  RoomManager,
  TOTAL_ITEMS,
  keysHeld,
} from '../world/RoomManager';
import type { Room } from '../world/Room';
import { OPPOSITE, type Direction, type EnemyDef, type ItemDef } from '../world/roomTypes';
import { GATE_ART, LIFT_ART } from '../assets/tileArt';
import { type LockColour, lockColour, shutterFor } from '../world/tiles';
import { Hud } from '../ui/Hud';
import { MapOverlay } from '../ui/MapOverlay';
import { DebugOverlay } from '../ui/DebugOverlay';

/**
 * The game itself: one room at a time, a fixed simulation step, and a small
 * pile of sprites that are repositioned every frame.
 *
 * The scene owns presentation and sequencing. All the rules live in the modules
 * it calls into, which is why almost none of this file needs a browser to test.
 */

export interface GameSceneData {
  /** Provided when continuing a saved game. */
  snapshot?: GameStateSnapshot;
}

type Mode = 'playing' | 'dying' | 'paused' | 'finished';

interface DynamicTile {
  image: Phaser.GameObjects.Image;
  col: number;
  row: number;
  char: string;
}

const DEPTH = {
  backdrop: 0,
  /** Behind the scenery, so a shadow only ever falls on the wall at the back. */
  shadows: 1,
  room: 2,
  tiles: 5,
  door: 6,
  items: 10,
  enemies: 20,
  player: 30,
  particles: 31,
  overlay: 100,
} as const;

/** The player's colours, for the pieces they go to when something gets them. */
const PLAYER_INKS: readonly PaletteKey[] = ['M', 'Y', 'C', 'R'];

/** The drawn parts of one vent: its grating, and its jet a cell at a time, top first. */
interface VentImages {
  kind: string;
  grate: Phaser.GameObjects.Image;
  cells: Phaser.GameObjects.Image[];
}

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private rooms!: RoomManager;
  private room!: Room;
  private theme!: ThemeDef;
  private player!: Player;
  private hud!: Hud;
  private debug: DebugOverlay | null = null;

  private mode: Mode = 'playing';
  private accumulatorMs = 0;
  private deathTimerMs = 0;
  private lockedNoiseCooldownMs = 0;
  private gateNagCooldownMs = 0;
  /** A gate colour part-way through grinding open, and how long it has been going. */
  private gateOpening: { lock: LockColour; ms: number } | null = null;

  private backdropImage!: Phaser.GameObjects.Image;
  private roomImage!: Phaser.GameObjects.Image;
  private playerImage!: Phaser.GameObjects.Image;
  /**
   * Everything that casts a shadow, paired with the silhouette that is its
   * shadow. The player's lasts the whole game; the rest go with the room.
   */
  private playerShadow: Phaser.GameObjects.Image | null = null;
  private roomShadows: { image: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image }[] = [];
  /** Shadows of the things drawn as lines rather than sprites: ropes and chains. */
  private lineShadows: Phaser.GameObjects.Graphics | null = null;
  private doorImage: Phaser.GameObjects.Image | null = null;
  private dynamicTiles: DynamicTile[] = [];
  /** One per enemy, in the room data's order; null for a vent, which is drawn in parts. */
  private enemyImages: (Phaser.GameObjects.Image | null)[] = [];
  private ventImages = new Map<number, VentImages>();
  /** One row of deck segments per lift, since a lift is as wide as it says. */
  private liftImages: Phaser.GameObjects.Image[][] = [];
  private teleportImages: Phaser.GameObjects.Image[] = [];
  /** Ropes are lines rather than tiles, so they are the one thing drawn as vectors. */
  private ropeGraphics: Phaser.GameObjects.Graphics | null = null;
  /** Lift chains, likewise, and behind the decks they hold up. */
  private liftGraphics: Phaser.GameObjects.Graphics | null = null;
  private itemImages = new Map<string, Phaser.GameObjects.Image>();
  private map: MapOverlay | null = null;
  private roomTitle: PixelText | null = null;
  private roomTitleMs = 0;
  /** The gentler collectable flash. Off by default; remembered when turned on. */
  private reducedFlashing = false;

  /** Dust, sparks and debris. Presentation only: nothing in here is read by the rules. */
  private particles = new ParticleField(seededRandom(Date.now()));
  private particleGraphics: Phaser.GameObjects.Graphics | null = null;
  /** Counts down after a real landing, while the player is drawn crouched. */
  private landSquashMs = 0;
  /** How long the player has stood still, for the blink. */
  private idleMs = 0;
  /** Whether the fall in progress had already gone too far last step, for the whistle. */
  private wasPlummeting = false;

  constructor() {
    super('GameScene');
  }

  create(data: GameSceneData): void {
    this.rooms = new RoomManager();
    this.state = data.snapshot ? GameState.fromSnapshot(data.snapshot) : new GameState();
    this.player = new Player();
    this.mode = 'playing';
    this.accumulatorMs = 0;

    this.cameras.main.setBackgroundColor('#000000');
    input.attach();

    this.backdropImage = this.add.image(0, 0, '__DEFAULT').setOrigin(0, 0).setDepth(DEPTH.backdrop);
    this.roomImage = this.add.image(0, 0, '__DEFAULT').setOrigin(0, 0).setDepth(DEPTH.room);
    this.playerImage = this.add.image(0, 0, '__DEFAULT').setOrigin(0, 0).setDepth(DEPTH.player);
    this.playerShadow = this.add
      .image(0, 0, '__DEFAULT')
      .setOrigin(0, 0)
      .setDepth(DEPTH.shadows)
      .setVisible(false);
    this.lineShadows = this.add.graphics().setDepth(DEPTH.shadows);
    this.particleGraphics = this.add.graphics().setDepth(DEPTH.particles);
    this.particles.clear();
    this.landSquashMs = 0;
    this.idleMs = 0;
    this.wasPlummeting = false;
    this.hud = new Hud(this);
    this.map = new MapOverlay(this, DEPTH.overlay);
    this.ropeGraphics = this.add.graphics().setDepth(DEPTH.tiles);
    this.liftGraphics = this.add.graphics().setDepth(DEPTH.tiles - 1);
    this.reducedFlashing = SaveSystem.loadSettings().reducedFlashing;

    this.roomTitle = new PixelText(this, {
      x: GAME_WIDTH / 2,
      y: 12,
      maxChars: 42,
      originX: 0.5,
      colour: 'W',
      depth: DEPTH.overlay - 1,
      outline: true,
    });

    if (isDebugEnabled()) {
      this.debug = new DebugOverlay(this);
      const problems = this.rooms.validate();
      if (problems.length > 0) console.warn('Room data problems:', problems);
    }

    this.loadRoom(this.state.currentRoom, this.state.entrySpawn, { announce: false });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
  }

  // -------------------------------------------------------------------------
  // Room construction
  // -------------------------------------------------------------------------

  private loadRoom(
    id: string,
    spawn: SpawnKey,
    options: {
      announce?: boolean;
      carryVy?: number;
      carryFall?: number;
      /** Overrides the spawn point, for arriving out of a teleport. */
      at?: { x: number; y: number };
    } = {},
  ): void {
    this.clearRoomObjects();

    this.room = this.rooms.get(id);
    this.room.reset();
    // Before anything reads the geometry: an opened gate has to already be air.
    this.room.setKeys(keysHeld(this.state.collectedItems));
    this.gateOpening = null;
    this.particles.clear();
    this.landSquashMs = 0;
    this.theme = themeFor(this.room.data.theme);
    this.state.enterRoom(id, spawn);
    this.mode = 'playing';

    const textures = buildRoomTextures(this, this.room, this.theme);
    this.backdropImage.setTexture(textures.backdrop);
    this.roomImage.setTexture(textures.scenery);

    this.buildDynamicTiles();
    this.buildLifts();
    this.buildTeleports();
    this.buildDoor();
    this.buildItems();
    this.buildEnemies();

    const point = options.at ??
      this.room.data.spawns[spawn] ??
      this.room.data.spawns.start ??
      Object.values(this.room.data.spawns)[0] ?? { x: 8, y: PLAY_HEIGHT - PLAYER.height };

    this.player.placeAt(point.x, point.y, options.carryVy ?? 0, options.carryFall ?? 0);
    // A fatal fall carried down from the room above has already had its whistle.
    this.wasPlummeting = this.player.fallIsFatal;
    this.renderPlayer();

    if (options.announce !== false) audio.playSting(this.theme.sting);
    this.announceRoom();
    this.autosave();
  }

  /**
   * The room's name, briefly, in the playfield.
   *
   * It was already in the status panel, where it is easy to miss entirely —
   * particularly since the panel is also where the house talks back to you, so
   * the name is often not even showing when you arrive.
   */
  private announceRoom(): void {
    this.roomTitle?.setText(this.room.name.toUpperCase()).setColour(this.theme.ledgeInk);
    this.roomTitleMs = WORLD.roomTitleMs;
  }

  /**
   * Gives an image a shadow on the back wall, kept in step with it every frame.
   * Returns the image, so it can wrap the call that made it.
   */
  private castShadow(image: Phaser.GameObjects.Image): Phaser.GameObjects.Image {
    const shadow = this.add
      .image(image.x + SHADOW_OFFSET, image.y + SHADOW_OFFSET, '__DEFAULT')
      .setOrigin(image.originX, image.originY)
      .setDepth(DEPTH.shadows);
    this.roomShadows.push({ image, shadow });
    return image;
  }

  /** Takes an image's shadow away with it, for something that leaves before the room does. */
  private dropShadow(image: Phaser.GameObjects.Image): void {
    this.roomShadows = this.roomShadows.filter((pair) => {
      if (pair.image !== image) return true;
      pair.shadow.destroy();
      return false;
    });
  }

  /** Moves, re-shapes and shows or hides each shadow to match what casts it. */
  private renderShadows(): void {
    const follow = (image: Phaser.GameObjects.Image, shadow: Phaser.GameObjects.Image): void => {
      const key = keys.shadow(image.texture.key);
      if (!this.textures.exists(key)) {
        shadow.setVisible(false);
        return;
      }
      if (shadow.texture.key !== key) shadow.setTexture(key);
      shadow.setPosition(image.x + SHADOW_OFFSET, image.y + SHADOW_OFFSET);
      shadow.setVisible(image.visible);
    };
    for (const { image, shadow } of this.roomShadows) follow(image, shadow);
    if (this.playerShadow !== null) follow(this.playerImage, this.playerShadow);
  }

  private clearRoomObjects(): void {
    for (const { shadow } of this.roomShadows) shadow.destroy();
    this.roomShadows = [];
    for (const tile of this.dynamicTiles) tile.image.destroy();
    this.dynamicTiles = [];
    for (const image of this.enemyImages) image?.destroy();
    this.enemyImages = [];
    for (const vent of this.ventImages.values()) {
      vent.grate.destroy();
      for (const cell of vent.cells) cell.destroy();
    }
    this.ventImages.clear();
    for (const deck of this.liftImages) for (const image of deck) image.destroy();
    this.liftImages = [];
    for (const image of this.teleportImages) image.destroy();
    this.teleportImages = [];
    for (const image of this.itemImages.values()) image.destroy();
    this.itemImages.clear();
    this.doorImage?.destroy();
    this.doorImage = null;
  }

  /** The first frame of any tile that animates, or null if the tile is static. */
  private animatedTileKey(char: string): string | null {
    const theme = this.room.data.theme;
    switch (char) {
      case '~':
        return keys.liquid(theme, 0);
      case '*':
        return keys.nasty(theme, 0);
      case '<':
      case '>':
        return keys.conveyor(theme, 0);
      case '%':
        return keys.crumble(theme, 0);
      case '!':
        return keys.lever(false);
      case '[':
      case ']':
        return keys.hatch(theme);
      default: {
        const lock = lockColour(char);
        return lock === null ? null : keys.gate(lock, 0);
      }
    }
  }

  /** Conveyors, crumbling floors, liquid and the buzzing things all animate. */
  private buildDynamicTiles(): void {
    this.room.forEachCell((col, row, char) => {
      const key = this.animatedTileKey(char);
      if (key === null) return;
      const image = this.add
        .image(col * TILE_SIZE, row * TILE_SIZE, key)
        .setOrigin(0, 0)
        .setDepth(DEPTH.tiles);
      // Liquid sits in a pit, where its shadow would only fall on the pit.
      if (char !== '~') this.castShadow(image);
      this.dynamicTiles.push({ image, col, row, char });
    });
  }

  private buildLifts(): void {
    const texture = keys.lift(this.room.data.theme, 0);
    for (const def of this.room.data.lifts ?? []) {
      const segments = Math.max(1, Math.ceil(def.width / TILE_SIZE));
      const deck: Phaser.GameObjects.Image[] = [];
      for (let i = 0; i < segments; i++) {
        deck.push(
          this.castShadow(this.add.image(0, 0, texture).setOrigin(0, 0).setDepth(DEPTH.tiles)),
        );
      }
      this.liftImages.push(deck);
    }
  }

  private buildTeleports(): void {
    for (const pad of this.room.data.teleports ?? []) {
      const image = this.add
        .image(pad.x, pad.y, keys.teleport(0))
        .setOrigin(0, 0)
        .setDepth(DEPTH.tiles);
      this.teleportImages.push(this.castShadow(image));
    }
  }

  private buildDoor(): void {
    const door = this.room.data.door;
    if (!door) return;
    const open = this.state.hasEverything(TOTAL_ITEMS);
    this.doorImage = this.castShadow(
      this.add.image(door.x, door.y, keys.door(open)).setOrigin(0, 0).setDepth(DEPTH.door),
    );
  }

  private buildItems(): void {
    for (const item of this.room.data.items ?? []) {
      if (this.state.isCollected(item.id)) continue;
      const lock = KEY_ITEMS.get(item.id);
      const texture = lock === undefined ? keys.item(item.sprite, 0) : keys.keyItem(lock, 0);
      const image = this.add.image(item.x, item.y, texture).setOrigin(0, 0).setDepth(DEPTH.items);
      this.itemImages.set(item.id, this.castShadow(image));
    }
  }

  private buildEnemies(): void {
    (this.room.data.enemies ?? []).forEach((def, index) => {
      if (def.type === 'vent') {
        this.buildVent(def, index);
        this.enemyImages.push(null);
        return;
      }
      const name = def.sprite in ENEMY_SPRITES ? def.sprite : 'bowler';
      const image = this.add
        .image(0, 0, keys.enemy(name, 0, 1))
        .setOrigin(0, 0)
        .setDepth(DEPTH.enemies);
      this.enemyImages.push(this.castShadow(image));
    });
  }

  /**
   * A vent is drawn as its grating, which is always there, and its jet, one
   * cell at a time, which is only there while it sputters or fires.
   */
  private buildVent(def: Extract<EnemyDef, { type: 'vent' }>, index: number): void {
    const kind = def.sprite in VENT_KINDS ? def.sprite : 'steam';
    const bottom = def.y + (def.cells - 1) * TILE_SIZE;
    const cells = Array.from({ length: def.cells }, (_unused, cell) =>
      this.castShadow(
        this.add
          .image(def.x, def.y + cell * TILE_SIZE, keys.enemy(kind, 0, 1))
          .setOrigin(0, 0)
          .setDepth(DEPTH.enemies)
          .setVisible(false),
      ),
    );
    const grate = this.add
      .image(def.x, bottom, keys.vent(kind, 'grate'))
      .setOrigin(0, 0)
      .setDepth(DEPTH.tiles);
    this.ventImages.set(index, { kind, grate, cells });
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  override update(_time: number, delta: number): void {
    input.poll();
    this.handleGlobalKeys();

    const deltaMs = Math.min(delta, 100);

    if (this.mode === 'playing') {
      this.accumulatorMs += deltaMs;
      let steps = 0;
      while (this.accumulatorMs >= FIXED_STEP_MS && steps < MAX_STEPS_PER_FRAME) {
        this.accumulatorMs -= FIXED_STEP_MS;
        steps += 1;
        if (this.simulate(FIXED_STEP_MS)) break; // the room changed underneath us
      }
      if (steps === MAX_STEPS_PER_FRAME) this.accumulatorMs = 0;
    } else if (this.mode === 'dying') {
      this.deathTimerMs -= deltaMs;
      if (this.deathTimerMs <= 0) this.finishDying();
    }

    if (this.roomTitleMs > 0) {
      this.roomTitleMs = Math.max(0, this.roomTitleMs - deltaMs);
      if (this.roomTitleMs === 0) this.roomTitle?.setText('');
    }

    this.landSquashMs = Math.max(0, this.landSquashMs - deltaMs);
    this.lockedNoiseCooldownMs = Math.max(0, this.lockedNoiseCooldownMs - deltaMs);
    this.gateNagCooldownMs = Math.max(0, this.gateNagCooldownMs - deltaMs);

    if (this.gateOpening !== null) {
      this.gateOpening.ms += deltaMs;
      if (this.gateOpening.ms >= WORLD.gateOpenMs) this.gateOpening = null;
    }

    this.render(deltaMs);
    input.endFrame();
  }

  private handleGlobalKeys(): void {
    if (input.justPressed('mute')) {
      const muted = audio.toggleMute();
      this.hud.say(muted ? 'SOUND OFF' : 'SOUND ON', 900, 'C');
    }

    if (input.justPressed('flash')) {
      this.reducedFlashing = !this.reducedFlashing;
      SaveSystem.saveSettings({ reducedFlashing: this.reducedFlashing });
      this.hud.say(this.reducedFlashing ? 'GENTLE FLASHING' : 'FULL FLASHING', 1200, 'C');
    }

    if (input.justPressed('pause')) {
      if (this.mode === 'playing') {
        this.mode = 'paused';
        this.showPauseOverlay();
        audio.play('select');
      } else if (this.mode === 'paused') {
        this.mode = 'playing';
        this.accumulatorMs = 0;
        this.hidePauseOverlay();
        audio.play('select');
      }
    }

    if (this.mode === 'playing' && input.justPressed('restartRoom')) {
      this.die({ kind: 'gave-up' });
    }
  }

  /** One fixed step. Returns true if the room changed, so the caller stops early. */
  private simulate(stepMs: number): boolean {
    audio.unlock();

    const result = this.player.step(input.playerInput(), stepMs / 1000, this.room);

    if (result.floorsCollapsed > 0) audio.play('crumble');
    if (result.jumped) {
      audio.play('jump');
      this.kickUpDust(2, [12, 32]);
    }
    if (result.landed && result.died === null && result.landedFrom >= WORLD.landThudDistance) {
      audio.play('land');
      this.landSquashMs = WORLD.landSquashMs;
      this.kickUpDust(3, [20, 55]);
    }

    // The moment a fall becomes one you will not walk away from, say so.
    const plummeting = this.player.fallIsFatal;
    if (plummeting && !this.wasPlummeting) audio.play('plummet');
    this.wasPlummeting = plummeting;
    if (result.flippedSwitch) {
      audio.play('lever');
      this.hud.say(
        this.room.switchState ? 'CLUNK. SOMETHING MOVED' : 'CLUNK. IT MOVED BACK',
        1200,
        'C',
      );
    }

    if (result.teleported !== null) {
      this.useTeleport(result.teleported);
      return true;
    }

    if (result.leftRoom !== null) {
      this.changeRoom(result.leftRoom);
      return true;
    }

    if (result.died !== null) {
      this.die(this.causeOf(result.died));
      return false;
    }

    const hitbox = insetBox(this.player.box, PLAYER.hazardInset);

    const culprit = this.touchesEnemy(hitbox);
    if (culprit !== null) {
      this.die({ kind: 'enemy', sprite: culprit.sprite });
      return false;
    }

    this.collectItems(hitbox);
    this.checkDoor(hitbox);
    this.nagAboutGates();
    return false;
  }

  /** The resident the player is touching, if touching it is fatal right now. */
  private touchesEnemy(hitbox: Box): EnemyDef | null {
    const seconds = this.room.seconds;
    const defs = this.room.data.enemies ?? [];
    for (const def of defs) {
      if (!enemyIsLethal(def, seconds)) continue;
      const sprite = ENEMY_SPRITES[def.sprite] ?? ENEMY_SPRITES.bowler;
      const box = enemyBox(def, seconds, sprite);
      if (boxesOverlap(hitbox, insetBox(box, 1))) return def;
    }
    return null;
  }

  /** Turns the movement model's reason for a death into something the panel can say. */
  private causeOf(died: 'hazard' | 'fall' | 'enemy'): Cause {
    if (died === 'fall') return { kind: 'fall' };
    const cell = hazardCellUnder(insetBox(this.player.box, PLAYER.hazardInset), this.room);
    return { kind: 'hazard', tile: cell === null ? null : this.room.charAt(cell.col, cell.row) };
  }

  private collectItems(hitbox: Box): void {
    for (const item of this.room.data.items ?? []) {
      if (this.state.isCollected(item.id)) continue;
      const box: Box = { x: item.x, y: item.y, width: TILE_SIZE, height: TILE_SIZE };
      if (!boxesOverlap(hitbox, box)) continue;

      this.state.collect(item.id);
      const taken = this.itemImages.get(item.id);
      if (taken !== undefined) this.dropShadow(taken);
      taken?.destroy();
      this.itemImages.delete(item.id);
      const spare = this.state.awardSpareLife();
      this.autosave();

      const lock = item.opens;
      this.particles.burst({
        x: item.x + TILE_SIZE / 2,
        y: item.y + TILE_SIZE / 2,
        count: 16,
        colours: lock === undefined ? ITEM_FLASH_COLOURS : LOCK_INKS[lock],
        speed: [30, 85],
        gravity: 90,
        lifeMs: [300, 560],
      });

      if (lock !== undefined) {
        this.openGates(lock);
      } else {
        audio.play('collect');
      }

      if (this.state.hasEverything(TOTAL_ITEMS)) {
        this.onEverythingCollected();
      } else if (lock === undefined) {
        const left = TOTAL_ITEMS - this.state.collectedCount;
        this.hud.say(`${left} STILL MISSING`, 1100, 'G');
      }

      // After whatever the pickup itself had to say, so a key's news is not lost.
      if (spare) {
        this.time.delayedCall(420, () => audio.play('spareLife'));
        this.hud.sayNext('A SPARE LIFE. DO NOT WASTE IT', 1600, 'M');
      }
    }
  }

  /** Picking up a key opens every gate of that colour, in this room and the rest. */
  private openGates(lock: LockColour): void {
    this.room.setKeys(keysHeld(this.state.collectedItems));
    this.gateOpening = { lock, ms: 0 };
    this.room.forEachCell((col, row, char) => {
      if (lockColour(char) !== lock) return;
      this.particles.burst({
        x: col * TILE_SIZE + TILE_SIZE / 2,
        y: row * TILE_SIZE + TILE_SIZE / 2,
        count: 4,
        colours: LOCK_INKS[lock],
        speed: [20, 60],
        gravity: 160,
        lifeMs: [250, 520],
        scatter: 3,
      });
    });
    audio.play('unlock');
    this.hud.say(
      `THE ${lock.toUpperCase()} KEY! EVERY ${lock.toUpperCase()} GATE IS OPEN`,
      2400,
      'Y',
    );
  }

  /**
   * Complains when the player is pressing into a gate they cannot open.
   *
   * Only fires when they are actually walking at it, so standing next to one is
   * quiet, and only every so often, so leaning on it is not a racket.
   */
  private nagAboutGates(): void {
    if (this.gateNagCooldownMs > 0) return;

    const pressed = input.playerInput();
    const heading = (pressed.right ? 1 : 0) - (pressed.left ? 1 : 0);
    if (heading === 0) return;

    // Rounded, because a body resolved against a wall stops a hair short of it,
    // and Math.floor of "a hair under 16" is the cell next door.
    const box = this.player.box;
    const x = Math.round(box.x);
    const y = Math.round(box.y);
    const probe = heading > 0 ? x + box.width : x - 1;
    const col = Math.floor(probe / TILE_SIZE);
    const top = Math.floor(y / TILE_SIZE);
    const bottom = Math.floor((y + box.height - 1) / TILE_SIZE);

    for (let row = top; row <= bottom; row++) {
      const lock = lockColour(this.room.charAt(col, row));
      if (lock === null) continue;
      this.hud.say(`THE ${lock.toUpperCase()} GATE. LOCKED.`, 1400, 'R');
      audio.play('locked');
      this.gateNagCooldownMs = WORLD.gateNagCooldownMs;
      return;
    }
  }

  private onEverythingCollected(): void {
    const { x, y } = this.playerCentre();
    this.particles.burst({
      x,
      y,
      count: 48,
      colours: ITEM_FLASH_COLOURS,
      speed: [40, 130],
      gravity: 120,
      lifeMs: [500, 1000],
    });
    const doorRoom = this.rooms.findDoorRoom();
    this.hud.say(`ALL FOUND! GO TO ${(doorRoom?.name ?? 'THE DOOR').toUpperCase()}`, 3000, 'Y');
    this.doorImage?.setTexture(keys.door(true));
  }

  private checkDoor(hitbox: Box): void {
    const door = this.room.data.door;
    if (!door) return;
    const box: Box = { x: door.x, y: door.y, width: DOOR_WIDTH, height: DOOR_HEIGHT };
    if (!boxesOverlap(hitbox, box)) return;

    if (this.state.hasEverything(TOTAL_ITEMS)) {
      this.win();
      return;
    }

    const missing = TOTAL_ITEMS - this.state.collectedCount;
    this.hud.say(`LOCKED. ${missing} THINGS STILL MISSING`, 1600, 'R');
    if (this.lockedNoiseCooldownMs === 0) {
      audio.play('locked');
      this.lockedNoiseCooldownMs = 1600;
    }
  }

  // -------------------------------------------------------------------------
  // Room changes, death and victory
  // -------------------------------------------------------------------------

  private changeRoom(direction: Direction): void {
    const targetId = this.room.exit(direction);
    if (targetId === undefined) return;

    // Falling into a room below keeps its momentum, and its consequences.
    const falling = direction === 'down';
    this.loadRoom(targetId, OPPOSITE[direction], {
      carryVy: falling ? this.player.vy : 0,
      carryFall: falling ? this.player.fallDistance : 0,
    });
  }

  /** Steps into a cupboard here and out of the one it is paired with. */
  private useTeleport(id: string): void {
    const from = ALL_TELEPORTS.get(id);
    const to = from === undefined ? undefined : ALL_TELEPORTS.get(from.to);
    if (to === undefined) return;

    audio.play('teleport');
    this.loadRoom(to.room, this.state.entrySpawn, { announce: false, at: { x: to.x, y: to.y } });
    this.materialise(['M', 'W']);
    this.hud.say('OUT THE OTHER SIDE', 1400, 'M');
  }

  private die(cause: Cause): void {
    if (this.mode !== 'playing') return;
    this.mode = 'dying';
    this.deathTimerMs = WORLD.deathDurationMs;
    audio.play('death');
    this.cameras.main.shake(220, 0.006);
    this.hud.say(obituary(cause), WORLD.deathDurationMs, 'R');

    const { x, y } = this.playerCentre();
    this.particles.burst({
      x,
      y,
      count: 26,
      colours: PLAYER_INKS,
      speed: [40, 125],
      gravity: 280,
      lifeMs: [450, 850],
      scatter: 3,
    });
    this.particles.burst({
      x,
      y,
      count: 6,
      colours: PLAYER_INKS,
      speed: [30, 80],
      angle: [Math.PI * 1.15, Math.PI * 1.85],
      gravity: 320,
      lifeMs: [600, 850],
      size: 2,
    });
  }

  /** Where the middle of the player is, for effects centred on them. */
  private playerCentre(): { x: number; y: number } {
    return { x: this.player.x + PLAYER.width / 2, y: this.player.y + PLAYER.height / 2 };
  }

  /** Specks drawn in to wherever the player has just appeared. */
  private materialise(colours: readonly PaletteKey[]): void {
    const { x, y } = this.playerCentre();
    this.particles.converge({ x, y, count: 18, radius: 16, colours, durationMs: 260 });
  }

  /** A puff of dust from the player's feet, both ways along the floor. */
  private kickUpDust(each: number, speed: readonly [number, number]): void {
    const x = this.player.x + PLAYER.width / 2;
    const y = this.player.y + PLAYER.height - 1;
    const puff = { y, count: each, colours: ['w', 'W'] as PaletteKey[], speed, gravity: 70 };
    this.particles.burst({
      ...puff,
      x: x - 2,
      angle: [Math.PI * 1.02, Math.PI * 1.25],
      lifeMs: [160, 320],
    });
    this.particles.burst({
      ...puff,
      x: x + 2,
      angle: [Math.PI * 1.75, Math.PI * 1.98],
      lifeMs: [160, 320],
    });
  }

  private finishDying(): void {
    const outOfLives = this.state.loseLife();

    if (outOfLives) {
      // Keep everything they found, but give the lives back. Continuing into a
      // run with no lives left would be a joke at the player's expense.
      SaveSystem.save({ ...this.state.toSnapshot(), lives: WORLD.startingLives });
      this.mode = 'finished';
      audio.play('gameOver');
      this.scene.start('GameOverScene', {
        collected: this.state.collectedCount,
        total: TOTAL_ITEMS,
        elapsedMs: this.state.elapsedMs,
        roomName: this.room.name,
      });
      return;
    }

    this.autosave();
    this.loadRoom(this.state.currentRoom, this.state.entrySpawn, { announce: false });
    this.materialise(['W', 'C', 'Y']);
    this.hud.say(
      this.state.lives === 1 ? 'LAST LIFE' : `${this.state.lives} LIVES LEFT`,
      1200,
      'R',
    );
  }

  private win(): void {
    this.mode = 'finished';
    audio.play('victory');
    SaveSystem.clear();

    const elapsedMs = this.state.elapsedMs;
    const { isBest } = SaveSystem.recordRun({
      elapsedMs,
      deaths: this.state.deaths,
      finishedAt: Date.now(),
    });

    this.scene.start('VictoryScene', {
      collected: this.state.collectedCount,
      total: TOTAL_ITEMS,
      elapsedMs,
      deaths: this.state.deaths,
      livesLeft: this.state.lives,
      isBest,
      best: SaveSystem.bestRun(),
    });
  }

  private autosave(): void {
    SaveSystem.save(this.state.toSnapshot());
  }

  // -------------------------------------------------------------------------
  // Presentation
  // -------------------------------------------------------------------------

  private render(deltaMs: number): void {
    this.lineShadows?.clear().fillStyle(0x000000, 1);
    this.renderPlayer(deltaMs);
    this.renderLifts();
    this.renderRopes();
    this.renderTeleports();
    this.renderEnemies(deltaMs);
    this.renderItems();
    this.renderDynamicTiles(deltaMs);
    this.renderShadows();
    this.renderParticles(deltaMs);

    this.hud.update(
      {
        roomName: this.room.name,
        collected: this.state.collectedCount,
        total: TOTAL_ITEMS,
        lives: this.state.lives,
        elapsedMs: this.state.elapsedMs,
        muted: audio.muted,
        keys: keysHeld(this.state.collectedItems),
        accent: this.theme.ledgeInk,
      },
      deltaMs,
    );

    this.debug?.draw(this.room, {
      roomId: this.room.id,
      player: this.player.box,
      enemies: (this.room.data.enemies ?? []).map((def) =>
        enemyBox(def, this.room.seconds, ENEMY_SPRITES[def.sprite] ?? ENEMY_SPRITES.bowler),
      ),
      items: [...this.itemImages.keys()].map((id) => {
        const item = (this.room.data.items ?? []).find((i) => i.id === id) as ItemDef;
        return { x: item.x, y: item.y, width: TILE_SIZE, height: TILE_SIZE };
      }),
      lines: [
        `ROOM ${this.room.id.toUpperCase()}`,
        `POS  ${this.player.x.toFixed(1)} ${this.player.y.toFixed(1)}`,
        `VEL  ${this.player.vx.toFixed(0)} ${this.player.vy.toFixed(0)}`,
        `GND  ${this.player.onGround ? 'YES' : 'NO'}  FALL ${this.player.fallDistance.toFixed(0)}`,
        `FPS  ${this.game.loop.actualFps.toFixed(0)}`,
        `TIME ${this.room.seconds.toFixed(1)}`,
        `MODE ${this.mode.toUpperCase()}`,
      ],
    });
  }

  /**
   * Which drawing of the player to show, and which frame of it.
   *
   * The movement model's pose, dressed up with the few things that are purely
   * for show: a crouch for a moment after a real landing, and a blink now and
   * then while standing about.
   */
  private presentPlayer(deltaMs: number): { pose: PlayerPose | 'dead' | 'land'; frame: number } {
    if (this.mode === 'dying') {
      return {
        pose: 'dead',
        frame: Math.floor((WORLD.deathDurationMs - this.deathTimerMs) / 120) % 2,
      };
    }

    const pose = this.player.pose;
    if (pose === 'stand' && this.mode === 'playing') this.idleMs += deltaMs;
    else if (pose !== 'stand') this.idleMs = 0;

    if ((pose === 'stand' || pose === 'walk') && this.landSquashMs > 0) {
      return { pose: 'land', frame: 0 };
    }
    switch (pose) {
      case 'walk':
        return { pose, frame: this.player.animFrame };
      case 'plummet':
        return { pose, frame: Math.floor(this.room.elapsedMs / 90) % 2 };
      case 'stand': {
        const blinking = this.idleMs % WORLD.blinkEveryMs > WORLD.blinkEveryMs - WORLD.blinkForMs;
        return { pose, frame: blinking ? 1 : 0 };
      }
      default:
        return { pose, frame: 0 };
    }
  }

  private renderPlayer(deltaMs = 0): void {
    const { pose, frame } = this.presentPlayer(deltaMs);

    this.playerImage.setTexture(keys.player(pose, this.player.facing, frame));
    this.playerImage.setPosition(Math.round(this.player.x), Math.round(this.player.y));
    this.playerImage.setVisible(this.mode !== 'finished');
  }

  /**
   * Lifts, and the chains they hang from.
   *
   * The chain is not decoration. Without it a lift is a slab of machinery
   * floating in mid-air with nothing holding it up, which reads as a bug rather
   * than as a hoist. Its links are spaced from the deck rather than from the
   * ceiling, so they travel with the lift and it looks winched rather than
   * slid — which is also the only animation a lift going straight up can have,
   * since the deck itself must not move relative to the feet standing on it.
   *
   * Only for a lift that runs vertically. A trolley crossing a room sideways
   * would be hanging from nothing.
   */
  private renderLifts(): void {
    const seconds = this.room.seconds;
    const theme = this.room.data.theme;
    const chains = this.liftGraphics;
    const shade = this.lineShadows;
    chains?.clear();

    (this.room.data.lifts ?? []).forEach((def, index) => {
      const deck = this.liftImages[index];
      if (!deck) return;

      const box = liftBox(def, seconds);
      const left = Math.round(box.x);
      const top = Math.round(box.y);

      if (chains !== null && def.points.every((point) => point.x === def.points[0].x)) {
        chains.fillStyle(paletteHex(themeFor(theme).conveyorShade), 1);
        const middle = left + Math.floor(def.width / 2);
        for (let y = top - 3; y >= 0; y -= 3) {
          chains.fillRect(middle, y, 1, 2);
          shade?.fillRect(middle + SHADOW_OFFSET, y + SHADOW_OFFSET, 1, 2);
        }
      }

      const frame = Math.floor(this.room.elapsedMs / 120) % LIFT_ART.length;
      deck.forEach((image, segment) => {
        image.setTexture(keys.lift(theme, frame));
        image.setPosition(left + segment * TILE_SIZE, top);
      });
    });
  }

  /**
   * A rope, drawn as a line of pixels from its pivot to its knot.
   *
   * The only thing in the game not made of eight-by-eight tiles, because a
   * swinging diagonal cannot be. Plotted a pixel at a time along the line so it
   * still looks hand-drawn rather than anti-aliased.
   */
  private renderRopes(): void {
    const g = this.ropeGraphics;
    const shade = this.lineShadows;
    if (g === null) return;
    g.clear();

    const ropes = this.room.data.ropes ?? [];
    if (ropes.length === 0) return;

    const seconds = this.room.seconds;
    g.fillStyle(paletteHex('y'), 1);

    for (const def of ropes) {
      for (let along = 2; along <= def.length; along += 2) {
        const at = ropePoint(def, seconds, along);
        g.fillRect(Math.round(at.x), Math.round(at.y), 1, 1);
        shade?.fillRect(Math.round(at.x) + SHADOW_OFFSET, Math.round(at.y) + SHADOW_OFFSET, 1, 1);
      }
      const knot = ropeEnd(def, seconds);
      g.fillStyle(paletteHex('Y'), 1);
      g.fillRect(Math.round(knot.x) - 1, Math.round(knot.y) - 1, 3, 3);
      shade?.fillRect(
        Math.round(knot.x) - 1 + SHADOW_OFFSET,
        Math.round(knot.y) - 1 + SHADOW_OFFSET,
        3,
        3,
      );
      g.fillStyle(paletteHex('y'), 1);
    }
  }

  private renderTeleports(): void {
    const frame = Math.floor(this.room.elapsedMs / 130) % 4;
    for (const image of this.teleportImages) image.setTexture(keys.teleport(frame));
  }

  private renderEnemies(deltaMs: number): void {
    const seconds = this.room.seconds;
    const defs = this.room.data.enemies ?? [];
    defs.forEach((def, index) => {
      if (def.type === 'vent') {
        this.renderVent(def, index, seconds, deltaMs);
        return;
      }
      const image = this.enemyImages[index];
      if (!image) return;
      const name = def.sprite in ENEMY_SPRITES ? def.sprite : 'bowler';
      const sprite = ENEMY_SPRITES[name];
      const box = enemyBox(def, seconds, sprite);
      const frame = Math.floor(this.room.elapsedMs / sprite.frameMs) % sprite.frames.length;
      image.setTexture(keys.enemy(name, frame, enemyFacing(def, seconds, sprite)));
      image.setPosition(Math.round(box.x), Math.round(box.y));
    });
  }

  /**
   * Quiet, it is a grating. Sputtering, a wisp or two comes off it. Firing, the
   * whole column is filled, ragged at the top and throwing off specks.
   */
  private renderVent(
    def: Extract<EnemyDef, { type: 'vent' }>,
    index: number,
    seconds: number,
    deltaMs: number,
  ): void {
    const parts = this.ventImages.get(index);
    if (parts === undefined) return;
    const stage = ventStage(def, seconds);
    const frame = Math.floor(this.room.elapsedMs / 80) % 2;
    const last = parts.cells.length - 1;

    parts.cells.forEach((image, cell) => {
      if (stage === 'firing') {
        const tip = cell === 0 && last > 0;
        image.setTexture(
          tip ? keys.vent(parts.kind, 'tip', frame) : keys.enemy(parts.kind, frame, 1),
        );
        image.setVisible(true);
      } else if (stage === 'warning' && cell === last) {
        image.setTexture(keys.vent(parts.kind, 'warn', frame)).setVisible(true);
      } else {
        image.setVisible(false);
      }
    });

    // About twenty specks a second, however fast the display is refreshing.
    if (stage === 'firing' && this.mode !== 'paused' && this.particles.chance() < deltaMs * 0.02) {
      const ink = VENT_KINDS[parts.kind] ?? VENT_KINDS.steam;
      this.particles.burst({
        x: def.x + TILE_SIZE / 2,
        y: def.y + 2,
        count: 1,
        colours: [ink.hot as PaletteKey, ink.edge as PaletteKey],
        speed: [18, 40],
        angle: [Math.PI * 1.3, Math.PI * 1.7],
        gravity: -20,
        lifeMs: [180, 360],
        scatter: 2,
      });
    }
  }

  private renderItems(): void {
    const step = this.reducedFlashing ? FLASH.reducedMs : FLASH.itemMs;
    const shades = this.reducedFlashing ? FLASH.reducedColours : ITEM_FLASH_COLOURS.length;
    const colour = Math.floor(this.room.elapsedMs / step) % shades;
    for (const [id, image] of this.itemImages) {
      const item = (this.room.data.items ?? []).find((i) => i.id === id);
      if (!item) continue;
      const lock = KEY_ITEMS.get(id);
      if (lock !== undefined) {
        image.setTexture(keys.keyItem(lock, Math.floor(this.room.elapsedMs / step) % 2));
        continue;
      }
      const name = item.sprite in ITEM_SPRITES ? item.sprite : 'teacup';
      image.setTexture(keys.item(name, colour));
    }
  }

  private renderDynamicTiles(deltaMs: number): void {
    const themeName = this.room.data.theme;
    const bubbling = this.mode !== 'paused';
    for (const tile of this.dynamicTiles) {
      switch (tile.char) {
        case '~':
          tile.image.setTexture(keys.liquid(themeName, Math.floor(this.room.elapsedMs / 280) % 2));
          // Now and then something surfaces. Only from the top of a pool.
          if (
            bubbling &&
            this.room.rawCharAt(tile.col, tile.row - 1) !== '~' &&
            this.particles.chance() < deltaMs * 0.0006
          ) {
            this.particles.burst({
              x: tile.col * TILE_SIZE + 1 + this.particles.chance() * 6,
              y: tile.row * TILE_SIZE + 1,
              count: 1,
              colours: [this.theme.liquidShade],
              speed: [8, 16],
              angle: [Math.PI * 1.45, Math.PI * 1.55],
              lifeMs: [260, 520],
            });
          }
          break;
        case '*':
          tile.image.setTexture(keys.nasty(themeName, Math.floor(this.room.elapsedMs / 110) % 2));
          break;
        case '<':
        case '>': {
          const step = Math.floor(this.room.elapsedMs / 70) % 4;
          const frame = tile.char === '>' ? step : 3 - step;
          tile.image.setTexture(keys.conveyor(themeName, frame));
          break;
        }
        case '%': {
          const stage = this.room.crumbleStage(tile.col, tile.row);
          if (stage < 0) {
            // The moment it goes, what is left of it goes downwards.
            if (tile.image.visible) {
              this.particles.burst({
                x: tile.col * TILE_SIZE + TILE_SIZE / 2,
                y: tile.row * TILE_SIZE + 1,
                count: 6,
                colours: [this.theme.crumbleInk, this.theme.crumbleShade],
                speed: [10, 40],
                angle: [Math.PI * 0.25, Math.PI * 0.75],
                gravity: 420,
                lifeMs: [300, 600],
                scatter: 3,
              });
            }
            tile.image.setVisible(false);
          } else {
            tile.image.setVisible(true);
            tile.image.setTexture(keys.crumble(themeName, stage));
          }
          break;
        }
        case '!':
          tile.image.setTexture(keys.lever(this.room.switchState));
          break;
        case '[':
        case ']':
          // The hatch is there only while the switch is in its position.
          tile.image.setVisible(shutterFor(tile.char) === this.room.switchState);
          break;
        default: {
          const lock = lockColour(tile.char);
          if (lock === null) break;
          tile.image.setVisible(true);
          if (!this.room.isUnlocked(lock)) {
            tile.image.setTexture(keys.gate(lock, 0));
          } else if (this.gateOpening?.lock === lock) {
            const progress = this.gateOpening.ms / WORLD.gateOpenMs;
            const frame = Math.min(GATE_ART.length - 1, Math.floor(progress * GATE_ART.length));
            tile.image.setTexture(keys.gate(lock, frame));
          } else {
            tile.image.setVisible(false);
          }
          break;
        }
      }
    }
  }

  /** Every speck in one Graphics, a filled pixel (or two) apiece. Frozen while paused. */
  private renderParticles(deltaMs: number): void {
    const g = this.particleGraphics;
    if (g === null) return;
    if (this.mode !== 'paused') this.particles.step(deltaMs);
    g.clear();
    this.particles.forEach((speck) => {
      g.fillStyle(paletteHex(speck.colour), 1);
      g.fillRect(Math.round(speck.x), Math.round(speck.y), speck.size, speck.size);
    });
  }

  /**
   * Pausing shows the map. There is nothing else worth looking at while the
   * game is stopped, and it is the only moment the player has to think.
   */
  private showPauseOverlay(): void {
    this.map?.show({
      rooms: ALL_ROOM_DATA,
      currentRoom: this.state.currentRoom,
      visited: this.state.visitedRooms,
      collected: this.state.collectedItems,
      keys: keysHeld(this.state.collectedItems),
    });
  }

  private hidePauseOverlay(): void {
    this.map?.hide();
  }

  private teardown(): void {
    this.ropeGraphics?.destroy();
    this.ropeGraphics = null;
    this.liftGraphics?.destroy();
    this.liftGraphics = null;
    this.lineShadows?.destroy();
    this.lineShadows = null;
    this.particleGraphics?.destroy();
    this.particleGraphics = null;
    this.particles.clear();
    this.playerShadow?.destroy();
    this.playerShadow = null;
    this.roomTitle?.destroy();
    this.roomTitle = null;
    this.hidePauseOverlay();
    this.map?.destroy();
    this.map = null;
    this.clearRoomObjects();
    this.hud.destroy();
    this.debug?.destroy();
    this.debug = null;
  }
}
