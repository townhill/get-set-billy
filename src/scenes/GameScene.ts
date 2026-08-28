import Phaser from 'phaser';
import {
  FIXED_STEP_MS,
  GAME_WIDTH,
  MAX_STEPS_PER_FRAME,
  PLAYER,
  PLAY_HEIGHT,
  TILE_SIZE,
  WORLD,
  isDebugEnabled,
} from '../config';
import { ENEMY_SPRITES, ITEM_SPRITES, DOOR_HEIGHT, DOOR_WIDTH } from '../assets/sprites';
import { ITEM_FLASH_COLOURS } from '../assets/palette';
import { type ThemeDef, themeFor } from '../assets/themes';
import { PixelText } from '../render/PixelText';
import { buildRoomTexture, keys } from '../render/textures';
import { Player } from '../objects/Player';
import { enemyBox, enemyFacing } from '../objects/Enemy';
import { boxesOverlap, insetBox, type Box } from '../systems/CollisionSystem';
import { audio } from '../systems/AudioSystem';
import { input } from '../systems/InputSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { GameState, type GameStateSnapshot, type SpawnKey } from '../state/GameState';
import { RoomManager, TOTAL_ITEMS } from '../world/RoomManager';
import type { Room } from '../world/Room';
import { OPPOSITE, type Direction, type ItemDef } from '../world/roomTypes';
import { Hud } from '../ui/Hud';
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
  room: 0,
  tiles: 5,
  door: 6,
  items: 10,
  enemies: 20,
  player: 30,
  overlay: 100,
} as const;

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
  /** Time since the room was entered. Drives every enemy, and nothing else. */
  private roomTimeMs = 0;
  private deathTimerMs = 0;
  private lockedNoiseCooldownMs = 0;

  private roomImage!: Phaser.GameObjects.Image;
  private playerImage!: Phaser.GameObjects.Image;
  private doorImage: Phaser.GameObjects.Image | null = null;
  private dynamicTiles: DynamicTile[] = [];
  private enemyImages: Phaser.GameObjects.Image[] = [];
  private itemImages = new Map<string, Phaser.GameObjects.Image>();
  private pauseLabel: PixelText | null = null;
  private pauseHint: PixelText | null = null;

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

    this.roomImage = this.add.image(0, 0, '__DEFAULT').setOrigin(0, 0).setDepth(DEPTH.room);
    this.playerImage = this.add.image(0, 0, '__DEFAULT').setOrigin(0, 0).setDepth(DEPTH.player);
    this.hud = new Hud(this);

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
    options: { announce?: boolean; carryVy?: number; carryFall?: number } = {},
  ): void {
    this.clearRoomObjects();

    this.room = this.rooms.get(id);
    this.room.reset();
    this.theme = themeFor(this.room.data.theme);
    this.state.enterRoom(id, spawn);
    this.roomTimeMs = 0;
    this.mode = 'playing';

    this.roomImage.setTexture(buildRoomTexture(this, this.room, this.theme));

    this.buildDynamicTiles();
    this.buildDoor();
    this.buildItems();
    this.buildEnemies();

    const point = this.room.data.spawns[spawn] ??
      this.room.data.spawns.start ??
      Object.values(this.room.data.spawns)[0] ?? { x: 8, y: PLAY_HEIGHT - PLAYER.height };

    this.player.placeAt(point.x, point.y, options.carryVy ?? 0, options.carryFall ?? 0);
    this.renderPlayer();

    if (options.announce !== false) audio.play('roomChange');
    this.autosave();
  }

  private clearRoomObjects(): void {
    for (const tile of this.dynamicTiles) tile.image.destroy();
    this.dynamicTiles = [];
    for (const image of this.enemyImages) image.destroy();
    this.enemyImages = [];
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
      default:
        return null;
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
      this.dynamicTiles.push({ image, col, row, char });
    });
  }

  private buildDoor(): void {
    const door = this.room.data.door;
    if (!door) return;
    const open = this.state.hasEverything(TOTAL_ITEMS);
    this.doorImage = this.add
      .image(door.x, door.y, keys.door(open))
      .setOrigin(0, 0)
      .setDepth(DEPTH.door);
  }

  private buildItems(): void {
    for (const item of this.room.data.items ?? []) {
      if (this.state.isCollected(item.id)) continue;
      const image = this.add
        .image(item.x, item.y, keys.item(item.sprite, 0))
        .setOrigin(0, 0)
        .setDepth(DEPTH.items);
      this.itemImages.set(item.id, image);
    }
  }

  private buildEnemies(): void {
    for (const def of this.room.data.enemies ?? []) {
      const name = def.sprite in ENEMY_SPRITES ? def.sprite : 'bowler';
      const image = this.add
        .image(0, 0, keys.enemy(name, 0, 1))
        .setOrigin(0, 0)
        .setDepth(DEPTH.enemies);
      this.enemyImages.push(image);
    }
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

    this.lockedNoiseCooldownMs = Math.max(0, this.lockedNoiseCooldownMs - deltaMs);

    this.render(deltaMs);
    input.endFrame();
  }

  private handleGlobalKeys(): void {
    if (input.justPressed('mute')) {
      const muted = audio.toggleMute();
      this.hud.say(muted ? 'SOUND OFF' : 'SOUND ON', 900, 'C');
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
      this.hud.say('GIVING UP ON THIS ROOM', 1200, 'R');
      this.die();
    }
  }

  /** One fixed step. Returns true if the room changed, so the caller stops early. */
  private simulate(stepMs: number): boolean {
    audio.unlock();
    this.roomTimeMs += stepMs;

    const result = this.player.step(input.playerInput(), stepMs / 1000, this.room);

    if (result.floorsCollapsed > 0) audio.play('crumble');
    if (result.jumped) audio.play('jump');

    if (result.leftRoom !== null) {
      this.changeRoom(result.leftRoom);
      return true;
    }

    if (result.died !== null) {
      this.die();
      return false;
    }

    const hitbox = insetBox(this.player.box, PLAYER.hazardInset);

    if (this.touchesEnemy(hitbox)) {
      this.die();
      return false;
    }

    this.collectItems(hitbox);
    this.checkDoor(hitbox);
    return false;
  }

  private touchesEnemy(hitbox: Box): boolean {
    const seconds = this.roomTimeMs / 1000;
    const defs = this.room.data.enemies ?? [];
    for (const def of defs) {
      const sprite = ENEMY_SPRITES[def.sprite] ?? ENEMY_SPRITES.bowler;
      const box = enemyBox(def, seconds, sprite);
      if (boxesOverlap(hitbox, insetBox(box, 1))) return true;
    }
    return false;
  }

  private collectItems(hitbox: Box): void {
    for (const item of this.room.data.items ?? []) {
      if (this.state.isCollected(item.id)) continue;
      const box: Box = { x: item.x, y: item.y, width: TILE_SIZE, height: TILE_SIZE };
      if (!boxesOverlap(hitbox, box)) continue;

      this.state.collect(item.id);
      this.itemImages.get(item.id)?.destroy();
      this.itemImages.delete(item.id);
      audio.play('collect');
      this.autosave();

      if (this.state.hasEverything(TOTAL_ITEMS)) {
        this.onEverythingCollected();
      } else {
        const left = TOTAL_ITEMS - this.state.collectedCount;
        this.hud.say(`${left} STILL MISSING`, 1100, 'G');
      }
    }
  }

  private onEverythingCollected(): void {
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

  private die(): void {
    if (this.mode !== 'playing') return;
    this.mode = 'dying';
    this.deathTimerMs = WORLD.deathDurationMs;
    audio.play('death');
    this.cameras.main.shake(220, 0.006);
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
    this.hud.say(`${this.state.lives} LIVES LEFT`, 1200, 'R');
  }

  private win(): void {
    this.mode = 'finished';
    audio.play('victory');
    SaveSystem.clear();
    this.scene.start('VictoryScene', {
      collected: this.state.collectedCount,
      total: TOTAL_ITEMS,
      elapsedMs: this.state.elapsedMs,
      deaths: this.state.deaths,
      livesLeft: this.state.lives,
    });
  }

  private autosave(): void {
    SaveSystem.save(this.state.toSnapshot());
  }

  // -------------------------------------------------------------------------
  // Presentation
  // -------------------------------------------------------------------------

  private render(deltaMs: number): void {
    this.renderPlayer();
    this.renderEnemies();
    this.renderItems();
    this.renderDynamicTiles();

    this.hud.update(
      {
        roomName: this.room.name,
        collected: this.state.collectedCount,
        total: TOTAL_ITEMS,
        lives: this.state.lives,
        elapsedMs: this.state.elapsedMs,
        muted: audio.muted,
        accent: this.theme.ledgeInk,
      },
      deltaMs,
    );

    this.debug?.draw(this.room, {
      roomId: this.room.id,
      player: this.player.box,
      enemies: (this.room.data.enemies ?? []).map((def) =>
        enemyBox(def, this.roomTimeMs / 1000, ENEMY_SPRITES[def.sprite] ?? ENEMY_SPRITES.bowler),
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
        `TIME ${(this.roomTimeMs / 1000).toFixed(1)}`,
        `MODE ${this.mode.toUpperCase()}`,
      ],
    });
  }

  private renderPlayer(): void {
    const pose = this.mode === 'dying' ? 'dead' : this.player.pose;
    const frame =
      this.mode === 'dying'
        ? Math.floor((WORLD.deathDurationMs - this.deathTimerMs) / 120) % 2
        : pose === 'walk'
          ? this.player.animFrame
          : 0;

    this.playerImage.setTexture(keys.player(pose, this.player.facing, frame));
    this.playerImage.setPosition(Math.round(this.player.x), Math.round(this.player.y));
    this.playerImage.setVisible(this.mode !== 'finished');
  }

  private renderEnemies(): void {
    const seconds = this.roomTimeMs / 1000;
    const defs = this.room.data.enemies ?? [];
    defs.forEach((def, index) => {
      const image = this.enemyImages[index];
      if (!image) return;
      const name = def.sprite in ENEMY_SPRITES ? def.sprite : 'bowler';
      const sprite = ENEMY_SPRITES[name];
      const box = enemyBox(def, seconds, sprite);
      const frame = Math.floor(this.roomTimeMs / sprite.frameMs) % sprite.frames.length;
      image.setTexture(keys.enemy(name, frame, enemyFacing(def, seconds, sprite)));
      image.setPosition(Math.round(box.x), Math.round(box.y));
    });
  }

  private renderItems(): void {
    const colour = Math.floor(this.roomTimeMs / 110) % ITEM_FLASH_COLOURS.length;
    for (const [id, image] of this.itemImages) {
      const item = (this.room.data.items ?? []).find((i) => i.id === id);
      if (!item) continue;
      const name = item.sprite in ITEM_SPRITES ? item.sprite : 'teacup';
      image.setTexture(keys.item(name, colour));
    }
  }

  private renderDynamicTiles(): void {
    const themeName = this.room.data.theme;
    for (const tile of this.dynamicTiles) {
      switch (tile.char) {
        case '~':
          tile.image.setTexture(keys.liquid(themeName, Math.floor(this.roomTimeMs / 280) % 2));
          break;
        case '*':
          tile.image.setTexture(keys.nasty(themeName, Math.floor(this.roomTimeMs / 110) % 2));
          break;
        case '<':
        case '>': {
          const step = Math.floor(this.roomTimeMs / 70) % 4;
          const frame = tile.char === '>' ? step : 3 - step;
          tile.image.setTexture(keys.conveyor(themeName, frame));
          break;
        }
        case '%': {
          const stage = this.room.crumbleStage(tile.col, tile.row);
          if (stage < 0) {
            tile.image.setVisible(false);
          } else {
            tile.image.setVisible(true);
            tile.image.setTexture(keys.crumble(themeName, stage));
          }
          break;
        }
        default:
          break;
      }
    }
  }

  private showPauseOverlay(): void {
    if (this.pauseLabel) return;
    this.pauseLabel = new PixelText(this, {
      x: GAME_WIDTH / 2,
      y: PLAY_HEIGHT / 2 - 12,
      maxChars: 7,
      originX: 0.5,
      colour: 'Y',
      scale: 2,
      depth: DEPTH.overlay,
    });
    this.pauseLabel.setText('PAUSED');

    this.pauseHint = new PixelText(this, {
      x: GAME_WIDTH / 2,
      y: PLAY_HEIGHT / 2 + 10,
      maxChars: 30,
      lines: 2,
      originX: 0.5,
      colour: 'C',
      depth: DEPTH.overlay,
    });
    this.pauseHint.setText(['ESC TO CARRY ON', 'M FOR SOUND']);
  }

  private hidePauseOverlay(): void {
    this.pauseLabel?.destroy();
    this.pauseHint?.destroy();
    this.pauseLabel = null;
    this.pauseHint = null;
  }

  private teardown(): void {
    this.hidePauseOverlay();
    this.clearRoomObjects();
    this.hud.destroy();
    this.debug?.destroy();
    this.debug = null;
  }
}
