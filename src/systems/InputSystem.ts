import type { PlayerInput } from '../objects/Player';
import { SaveSystem } from './SaveSystem';

/**
 * Keyboard and gamepad, read straight from the browser.
 *
 * Deliberately not routed through Phaser's input plugin: the game only needs a
 * handful of held keys and a few one-shot actions, and doing it here keeps the
 * whole thing testable and free of scene lifecycle surprises.
 */

export type Action =
  | 'left'
  | 'right'
  | 'jump'
  | 'restartRoom'
  | 'pause'
  | 'mute'
  | 'flash'
  | 'confirm'
  | 'menuUp'
  | 'menuDown';

/**
 * The actions a player may move to a different key.
 *
 * Menu navigation is deliberately not among them. Rebinding the keys that work
 * the options screen would let somebody lock themselves out of the options
 * screen, and no amount of warning text is a substitute for the possibility not
 * existing.
 */
export const BINDABLE = ['left', 'right', 'jump', 'restartRoom', 'pause', 'mute', 'flash'] as const;

export type Bindable = (typeof BINDABLE)[number];

export function isBindable(action: string): action is Bindable {
  return (BINDABLE as readonly string[]).includes(action);
}

/** What each action answers to out of the box. */
export const DEFAULT_KEYS: Readonly<Record<Action, readonly string[]>> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  jump: ['Space', 'ArrowUp', 'KeyW'],
  restartRoom: ['KeyR'],
  pause: ['Escape', 'KeyP'],
  mute: ['KeyM'],
  flash: ['KeyF'],
  confirm: ['Enter', 'Space'],
  menuUp: ['ArrowUp', 'KeyW'],
  menuDown: ['ArrowDown', 'KeyS'],
};

/** How each action is described on the options screen. */
export const ACTION_NAMES: Readonly<Record<Bindable, string>> = {
  left: 'WALK LEFT',
  right: 'WALK RIGHT',
  jump: 'JUMP',
  restartRoom: 'GIVE UP ON A ROOM',
  pause: 'PAUSE AND SEE THE MAP',
  mute: 'SOUND ON AND OFF',
  flash: 'GENTLER FLASHING',
};

/**
 * A short, upper-case name for a key, for a typeface that has no lower case.
 *
 * Codes rather than characters throughout, so the bindings survive a change of
 * keyboard layout — but `KeyA` is not something to show anybody.
 */
export function keyLabel(code: string): string {
  const named: Record<string, string> = {
    Space: 'SPACE',
    Enter: 'ENTER',
    Escape: 'ESC',
    ArrowLeft: 'LEFT',
    ArrowRight: 'RIGHT',
    ArrowUp: 'UP',
    ArrowDown: 'DOWN',
    ShiftLeft: 'L SHIFT',
    ShiftRight: 'R SHIFT',
    ControlLeft: 'L CTRL',
    ControlRight: 'R CTRL',
    AltLeft: 'L ALT',
    AltRight: 'R ALT',
    Tab: 'TAB',
    Backspace: 'BKSP',
    Minus: '-',
    Equal: '=',
    Comma: ',',
    Period: '.',
    Slash: '/',
    Semicolon: ';',
    Quote: "'",
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Backquote: '`',
  };
  if (named[code] !== undefined) return named[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `NUM ${code.slice(6)}`.toUpperCase();
  return code.toUpperCase();
}

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
  /** The live key table: the defaults, with whatever the player has changed. */
  private keys: Record<Action, readonly string[]> = { ...DEFAULT_KEYS };
  private swallow = new Set<string>();
  /** The most recent key pressed, whatever it was. Used to capture a new binding. */
  private lastCode: string | null = null;
  /** Keys pressed since the last consume; cleared by `justPressed`. */
  private readonly pressed = new Set<string>();
  private readonly padPressed = new Set<number>();
  private padWasDown = new Set<number>();
  private attached = false;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.swallow.has(event.code)) event.preventDefault();
    if (!event.repeat) {
      this.pressed.add(event.code);
      this.lastCode = event.code;
    }
    this.held.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.code);
  };

  private readonly onBlur = (): void => {
    this.held.clear();
    this.pressed.clear();
    this.lastCode = null;
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

  /** Reads the saved bindings. Safe to call before anything is attached. */
  loadBindings(): void {
    this.applyBindings(SaveSystem.loadSettings().bindings);
  }

  private applyBindings(overrides: Partial<Record<Bindable, string[]>> | undefined): void {
    this.keys = { ...DEFAULT_KEYS };
    for (const action of BINDABLE) {
      const codes = overrides?.[action];
      // An empty binding would be a key that cannot be pressed, so it is ignored
      // rather than honoured: a corrupt setting must never make the game unplayable.
      if (Array.isArray(codes) && codes.length > 0) this.keys[action] = [...codes];
    }
    this.rebuildSwallow();
  }

  /** Every key the page must not act on itself, so it never scrolls under the game. */
  private rebuildSwallow(): void {
    this.swallow = new Set<string>([
      ...this.keys.left,
      ...this.keys.right,
      ...this.keys.jump,
      ...DEFAULT_KEYS.menuUp,
      ...DEFAULT_KEYS.menuDown,
    ]);
  }

  /** The keys an action currently answers to. */
  keysFor(action: Action): readonly string[] {
    return this.keys[action];
  }

  /** Moves an action onto one key, and remembers it. */
  setBinding(action: Bindable, code: string): void {
    this.keys = { ...this.keys, [action]: [code] };
    this.rebuildSwallow();
    this.persist();
  }

  /** Puts every key back the way it came. */
  resetBindings(): void {
    this.keys = { ...DEFAULT_KEYS };
    this.rebuildSwallow();
    SaveSystem.saveSettings({ bindings: {} });
  }

  private persist(): void {
    const overrides: Partial<Record<Bindable, string[]>> = {};
    for (const action of BINDABLE) {
      const codes = this.keys[action];
      const same =
        codes.length === DEFAULT_KEYS[action].length &&
        codes.every((code, index) => code === DEFAULT_KEYS[action][index]);
      if (!same) overrides[action] = [...codes];
    }
    SaveSystem.saveSettings({ bindings: overrides });
  }

  /**
   * The last key pressed, for the options screen to capture.
   *
   * Deliberately raw: rebinding has to see keys that are not bound to anything,
   * which is most of them.
   */
  takeLastPressed(): string | null {
    const code = this.lastCode;
    this.lastCode = null;
    return code;
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
      left: this.anyHeld(this.keys.left) || this.anyPadHeld(PAD_LEFT) || axis < 0,
      right: this.anyHeld(this.keys.right) || this.anyPadHeld(PAD_RIGHT) || axis > 0,
      jump: this.anyHeld(this.keys.jump) || this.anyPadHeld(PAD_JUMP),
    };
  }

  /** True exactly once per physical press. */
  justPressed(action: Action): boolean {
    if (this.keys[action].some((code) => this.pressed.has(code))) return true;
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
