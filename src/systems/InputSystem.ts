import type { PlayerInput } from '../objects/Player';

/**
 * Keyboard and gamepad, read straight from the browser.
 *
 * Deliberately not routed through Phaser's input plugin: the game only needs a
 * handful of held keys and a few one-shot actions, and doing it here keeps the
 * whole thing testable and free of scene lifecycle surprises.
 */

export type Action = 'jump' | 'restartRoom' | 'pause' | 'mute' | 'confirm' | 'menuUp' | 'menuDown';

const HELD_LEFT = ['ArrowLeft', 'KeyA'];
const HELD_RIGHT = ['ArrowRight', 'KeyD'];
const HELD_JUMP = ['Space', 'ArrowUp', 'KeyW'];

/** Keys we swallow so the page never scrolls out from under the game. */
const SWALLOW = new Set([...HELD_LEFT, ...HELD_RIGHT, ...HELD_JUMP, 'ArrowDown', 'KeyS']);

const ACTION_KEYS: Record<Action, string[]> = {
  jump: HELD_JUMP,
  restartRoom: ['KeyR'],
  pause: ['Escape', 'KeyP'],
  mute: ['KeyM'],
  confirm: ['Enter', 'Space'],
  menuUp: ['ArrowUp', 'KeyW'],
  menuDown: ['ArrowDown', 'KeyS'],
};

/** Standard-layout gamepad buttons we care about. */
const PAD_LEFT = [14];
const PAD_RIGHT = [15];
const PAD_JUMP = [0, 1, 12];
const PAD_PAUSE = [9];
const PAD_RESTART = [2];
const PAD_CONFIRM = [0, 9];
const PAD_UP = [12];
const PAD_DOWN = [13];

const AXIS_DEADZONE = 0.4;

export class InputSystem {
  private readonly held = new Set<string>();
  /** Keys pressed since the last consume; cleared by `justPressed`. */
  private readonly pressed = new Set<string>();
  private readonly padPressed = new Set<number>();
  private padWasDown = new Set<number>();
  private attached = false;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (SWALLOW.has(event.code)) event.preventDefault();
    if (!event.repeat) this.pressed.add(event.code);
    this.held.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.code);
  };

  private readonly onBlur = (): void => {
    this.held.clear();
    this.pressed.clear();
  };

  attach(): void {
    if (this.attached || typeof window === 'undefined') return;
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.attached = true;
  }

  detach(): void {
    if (!this.attached || typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.attached = false;
    this.onBlur();
  }

  /** Call once per frame, before reading anything. */
  poll(): void {
    this.padPressed.clear();
    const pad = this.firstGamepad();
    if (!pad) {
      this.padWasDown.clear();
      return;
    }
    const down = new Set<number>();
    pad.buttons.forEach((button, index) => {
      if (button.pressed) down.add(index);
    });
    for (const index of down) {
      if (!this.padWasDown.has(index)) this.padPressed.add(index);
    }
    this.padWasDown = down;
  }

  /** Clears one-shot presses. Call at the end of each frame. */
  endFrame(): void {
    this.pressed.clear();
    this.padPressed.clear();
  }

  private firstGamepad(): Gamepad | null {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function')
      return null;
    for (const pad of navigator.getGamepads()) {
      if (pad?.connected) return pad;
    }
    return null;
  }

  private padAxis(): number {
    const pad = this.firstGamepad();
    if (!pad) return 0;
    const axis = pad.axes[0] ?? 0;
    if (axis < -AXIS_DEADZONE) return -1;
    if (axis > AXIS_DEADZONE) return 1;
    return 0;
  }

  private anyHeld(codes: readonly string[]): boolean {
    return codes.some((code) => this.held.has(code));
  }

  private anyPadHeld(buttons: readonly number[]): boolean {
    return buttons.some((index) => this.padWasDown.has(index));
  }

  /** The three things the player controller cares about. */
  playerInput(): PlayerInput {
    const axis = this.padAxis();
    return {
      left: this.anyHeld(HELD_LEFT) || this.anyPadHeld(PAD_LEFT) || axis < 0,
      right: this.anyHeld(HELD_RIGHT) || this.anyPadHeld(PAD_RIGHT) || axis > 0,
      jump: this.anyHeld(HELD_JUMP) || this.anyPadHeld(PAD_JUMP),
    };
  }

  /** True exactly once per physical press. */
  justPressed(action: Action): boolean {
    if (ACTION_KEYS[action].some((code) => this.pressed.has(code))) return true;
    const padButtons: Partial<Record<Action, readonly number[]>> = {
      jump: PAD_JUMP,
      pause: PAD_PAUSE,
      restartRoom: PAD_RESTART,
      confirm: PAD_CONFIRM,
      menuUp: PAD_UP,
      menuDown: PAD_DOWN,
    };
    return padButtons[action]?.some((index) => this.padPressed.has(index)) ?? false;
  }

  get gamepadConnected(): boolean {
    return this.firstGamepad() !== null;
  }
}

/** One shared instance: input is a property of the browser tab, not of a scene. */
export const input = new InputSystem();
