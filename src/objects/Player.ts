import { PLAY_HEIGHT, PLAY_WIDTH, PLAYER, TILE_SIZE, WORLD } from '../config';
import {
  type Box,
  insetBox,
  moveBox,
  overlapsHazard,
  supportColumns,
  sweepX,
  sweepY,
} from '../systems/CollisionSystem';
import type { Room } from '../world/Room';
import type { Direction, TeleportDef } from '../world/roomTypes';
import { isLever } from '../world/tiles';

/**
 * The player's movement model.
 *
 * Deliberately unlike a physics engine: horizontal speed is set, not
 * accelerated; jumps are a fixed height; nothing bounces or slides. The only
 * concessions to the present day are a few frames of coyote time and a jump
 * buffer, which cost nothing in predictability and save a great deal of swearing.
 *
 * Knows nothing about Phaser, so the whole thing can be stepped in a test.
 */

export interface PlayerInput {
  left: boolean;
  right: boolean;
  jump: boolean;
}

/**
 * The three numbers that decide how far the player can get.
 *
 * Injectable so the reachability tests can run the house again for a slightly
 * worse player. A room that only works at full ability is a room that only
 * works in theory.
 */
export interface PlayerTuning {
  walkSpeed: number;
  jumpVelocity: number;
  gravity: number;
}

export const DEFAULT_TUNING: PlayerTuning = {
  walkSpeed: PLAYER.walkSpeed,
  jumpVelocity: PLAYER.jumpVelocity,
  gravity: PLAYER.gravity,
};

export type DeathCause = 'hazard' | 'fall' | 'enemy';

export interface StepResult {
  /** Set when the player has walked or fallen out of the room. */
  leftRoom: Direction | null;
  /** Set when the player died this step. */
  died: DeathCause | null;
  /** True on the step the player touched down. */
  landed: boolean;
  /** True on the step a jump started. */
  jumped: boolean;
  /** How many crumbling floors finished collapsing this step. */
  floorsCollapsed: number;
  /** True on the step the player threw the room's switch. */
  flippedSwitch: boolean;
  /** The id of a teleport stepped into this step, or null. */
  teleported: string | null;
}

export type PlayerPose = 'stand' | 'walk' | 'jump' | 'fall';

export class Player {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  facing: -1 | 1 = 1;
  onGround = false;
  /** How far the player has dropped since last being supported, in pixels. */
  fallDistance = 0;
  /** Index of the lift being stood on, or -1. Kept so the next step can carry them. */
  ridingLift = -1;

  private coyoteMs = 0;
  private jumpBufferMs = 0;
  private jumpWasHeld = false;
  private animMs = 0;
  /**
   * Set on arrival, so stepping out of a teleport does not immediately step
   * back into it. Cleared the moment the player is standing clear of them all.
   */
  private teleportHeld = true;

  constructor(private readonly tuning: PlayerTuning = DEFAULT_TUNING) {}

  get box(): Box {
    return { x: this.x, y: this.y, width: PLAYER.width, height: PLAYER.height };
  }

  get pose(): PlayerPose {
    if (!this.onGround) return this.vy < 0 ? 'jump' : 'fall';
    return this.vx === 0 ? 'stand' : 'walk';
  }

  /** Frame index for the walk cycle, which only advances while actually walking. */
  get animFrame(): number {
    return Math.floor(this.animMs / PLAYER.animFrameMs) % 4;
  }

  /** Drops the player at a position, optionally keeping a fall in progress. */
  placeAt(x: number, y: number, vy = 0, fallDistance = 0): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = vy;
    this.onGround = false;
    this.fallDistance = fallDistance;
    this.ridingLift = -1;
    this.coyoteMs = 0;
    this.jumpBufferMs = 0;
    this.jumpWasHeld = true; // a held jump button must be released before it fires again
    this.teleportHeld = true; // and an arrival must step off the pad before using it
    this.animMs = 0;
  }

  /** Advances the player by exactly one fixed simulation step. */
  step(input: PlayerInput, dtSeconds: number, room: Room): StepResult {
    const dtMs = dtSeconds * 1000;

    // The room moves first: floors give way, and the lifts travel. Anything
    // standing on a lift goes with it before it gets a say in the matter.
    const moved = room.advance(dtMs);
    const result: StepResult = {
      leftRoom: null,
      died: null,
      landed: false,
      jumped: false,
      floorsCollapsed: moved.collapsed.length,
      flippedSwitch: false,
      teleported: null,
    };
    this.rideLift(moved.liftDeltas, room);

    // --- intent ---------------------------------------------------------
    if (input.jump && !this.jumpWasHeld) this.jumpBufferMs = PLAYER.jumpBufferMs;
    this.jumpWasHeld = input.jump;
    this.jumpBufferMs = Math.max(0, this.jumpBufferMs - dtMs);

    const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (PLAYER.airControl || this.onGround) {
      this.vx = direction * this.tuning.walkSpeed;
    }
    if (direction !== 0) this.facing = direction as -1 | 1;

    // --- conveyors ------------------------------------------------------
    let drift = 0;
    if (this.onGround) {
      const groundRow = Math.floor((this.y + PLAYER.height) / TILE_SIZE);
      for (const col of supportColumns(this.box, groundRow)) {
        const push = room.conveyorAt(col, groundRow);
        if (push !== 0) {
          drift = push * WORLD.conveyorSpeed;
          break;
        }
      }
    }

    // --- jump -----------------------------------------------------------
    const mayJump = this.onGround || this.coyoteMs > 0;
    if (mayJump && this.jumpBufferMs > 0) {
      this.vy = -this.tuning.jumpVelocity;
      this.onGround = false;
      this.coyoteMs = 0;
      this.jumpBufferMs = 0;
      this.fallDistance = 0;
      result.jumped = true;
    } else {
      this.vy = Math.min(PLAYER.maxFallSpeed, this.vy + this.tuning.gravity * dtSeconds);
    }

    // --- movement -------------------------------------------------------
    const previousY = this.y;
    const wasOnGround = this.onGround;
    const step = moveBox(this.box, (this.vx + drift) * dtSeconds, this.vy * dtSeconds, room);

    this.x = step.x;
    this.y = step.y;

    if (step.hitCeiling) this.vy = 0;

    const droppedBy = this.y - previousY;
    if (!step.onGround && droppedBy > 0) this.fallDistance += droppedBy;

    if (step.onGround) {
      this.vy = 0;
      this.coyoteMs = PLAYER.coyoteTimeMs;
      if (!wasOnGround) result.landed = true;
      // Anything crumbling underfoot starts to go.
      for (const col of supportColumns(this.box, step.groundRow)) {
        room.standOn(col, step.groundRow);
      }
    } else {
      this.coyoteMs = Math.max(0, this.coyoteMs - dtMs);
    }
    this.onGround = step.onGround;
    this.ridingLift = step.groundLift;

    // --- animation ------------------------------------------------------
    if (this.onGround && this.vx !== 0) {
      this.animMs += dtMs;
    } else if (this.vx === 0) {
      this.animMs = 0;
    }

    // --- levers -----------------------------------------------------------
    if (room.hasSwitch) {
      result.flippedSwitch = room.touchLever(this.touchingLever(room));
    }

    // --- teleports ---------------------------------------------------------
    const pads = room.data.teleports;
    if (pads !== undefined && pads.length > 0) {
      const standing = this.teleportUnderfoot(pads);
      if (standing === null) {
        this.teleportHeld = false;
      } else if (!this.teleportHeld) {
        this.teleportHeld = true;
        result.teleported = standing;
        return result;
      }
    }

    // --- leaving the room ------------------------------------------------
    const exiting = this.boundaryCrossed();
    if (exiting !== null && room.exit(exiting) !== undefined) {
      result.leftRoom = exiting;
      return result;
    }
    this.keepInsideSealedEdges(room);

    // --- dying ------------------------------------------------------------
    if (result.landed && this.fallDistance > PLAYER.fatalFallDistance) {
      result.died = 'fall';
    } else if (overlapsHazard(insetBox(this.box, PLAYER.hazardInset), room)) {
      result.died = 'hazard';
    }

    if (result.landed) this.fallDistance = 0;

    return result;
  }

  /**
   * Moves with the lift underfoot, if there is one.
   *
   * Swept rather than teleported, so a lift carrying you sideways into a wall
   * leaves you against the wall and slides out from under you, rather than
   * posting you through it. A lift going down does not drag you: gravity
   * catches you up on the same step, and being pulled downward faster than you
   * fall would feel like being grabbed.
   */
  private rideLift(deltas: readonly { x: number; y: number }[], room: Room): void {
    if (!this.onGround || this.ridingLift < 0) return;
    const delta = deltas[this.ridingLift];
    if (delta === undefined || (delta.x === 0 && delta.y === 0)) return;

    const across = sweepX(this.box, delta.x, room);
    this.x = across.x;

    if (delta.y < 0) {
      const up = sweepY(this.box, delta.y, room);
      this.y = up.y;
    } else {
      this.y += delta.y;
    }
  }

  /** The teleport the player is standing in, if any. */
  private teleportUnderfoot(pads: readonly TeleportDef[]): string | null {
    const box = insetBox(this.box, PLAYER.hazardInset);
    for (const pad of pads) {
      const cell = { x: pad.x, y: pad.y, width: TILE_SIZE, height: TILE_SIZE };
      if (
        box.x < cell.x + cell.width &&
        box.x + box.width > cell.x &&
        box.y < cell.y + cell.height &&
        box.y + box.height > cell.y
      ) {
        return pad.id;
      }
    }
    return null;
  }

  /** True when any part of the player overlaps a lever cell. */
  private touchingLever(room: Room): boolean {
    if (!room.hasSwitch) return false;
    const box = insetBox(this.box, PLAYER.hazardInset);
    const c0 = Math.floor(box.x / TILE_SIZE);
    const c1 = Math.floor((box.x + box.width - 1) / TILE_SIZE);
    const r0 = Math.floor(box.y / TILE_SIZE);
    const r1 = Math.floor((box.y + box.height - 1) / TILE_SIZE);
    for (let col = c0; col <= c1; col++) {
      for (let row = r0; row <= r1; row++) {
        if (isLever(room.charAt(col, row))) return true;
      }
    }
    return false;
  }

  /**
   * Going up is the odd one out.
   *
   * Walking off the side or falling out of the bottom carries you further in
   * that direction whatever happens, so those only count once you are entirely
   * outside the room. A jump does not: it slows to a stop and comes back. Asking
   * for the whole 16-pixel body to clear the ceiling means the exit only opens
   * at the very top of the arc, for a fraction of a step, which turns a doorway
   * into a trick. Half the body through the gap is unambiguous, still cannot
   * happen by accident, and leaves the jump room to spare.
   */
  private boundaryCrossed(): Direction | null {
    if (this.x + PLAYER.width <= 0) return 'left';
    if (this.x >= PLAY_WIDTH) return 'right';
    if (this.y + PLAYER.height / 2 <= 0) return 'up';
    if (this.y >= PLAY_HEIGHT) return 'down';
    return null;
  }

  /**
   * A room with no exit in some direction is sealed that way. Room geometry
   * normally makes this impossible, but clamping here means a mistake in the
   * data can never let the player wander off the screen and disappear.
   */
  private keepInsideSealedEdges(room: Room): void {
    if (this.x < 0 && room.exit('left') === undefined) {
      this.x = 0;
      this.vx = 0;
    }
    if (this.x + PLAYER.width > PLAY_WIDTH && room.exit('right') === undefined) {
      this.x = PLAY_WIDTH - PLAYER.width;
      this.vx = 0;
    }
    if (this.y < 0 && room.exit('up') === undefined) {
      this.y = 0;
      this.vy = 0;
    }
    if (this.y + PLAYER.height > PLAY_HEIGHT && room.exit('down') === undefined) {
      this.y = PLAY_HEIGHT - PLAYER.height;
      this.vy = 0;
    }
  }
}
