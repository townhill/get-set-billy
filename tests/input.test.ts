import { beforeEach, describe, expect, it } from 'vitest';
import {
  ACTION_NAMES,
  BINDABLE,
  DEFAULT_KEYS,
  InputSystem,
  isBindable,
  keyLabel,
} from '../src/systems/InputSystem';
import { SaveSystem } from '../src/systems/SaveSystem';

/**
 * Remappable controls.
 *
 * The safety property is the one worth stating: the keys that work the options
 * screen are not themselves rebindable, so no arrangement of bindings can leave
 * a player unable to get back to the options screen and put it right. The reset
 * is a convenience, not the escape hatch.
 */

/** The smallest thing that behaves like localStorage. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  } as Storage;
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage(),
    configurable: true,
    writable: true,
  });
});

describe('what may be rebound', () => {
  it('covers everything the player does in a room', () => {
    expect([...BINDABLE].sort()).toEqual(
      ['flash', 'jump', 'left', 'mute', 'pause', 'restartRoom', 'right'].sort(),
    );
  });

  it('leaves the keys that work the menus alone, on purpose', () => {
    // Rebinding these is how somebody would lock themselves out of the screen
    // that lets them put it back.
    expect(isBindable('confirm')).toBe(false);
    expect(isBindable('menuUp')).toBe(false);
    expect(isBindable('menuDown')).toBe(false);
  });

  it('has a name for every one of them, for the options screen to show', () => {
    for (const action of BINDABLE) {
      expect(ACTION_NAMES[action], `${action} has no name`).toBeTruthy();
    }
  });
});

describe('changing a key', () => {
  it('moves the action onto it, and off the old one', () => {
    const input = new InputSystem();
    input.loadBindings();
    expect(input.keysFor('jump')).toEqual(DEFAULT_KEYS.jump);

    input.setBinding('jump', 'KeyZ');
    expect(input.keysFor('jump')).toEqual(['KeyZ']);
  });

  it('leaves every other action where it was', () => {
    const input = new InputSystem();
    input.loadBindings();
    input.setBinding('jump', 'KeyZ');

    expect(input.keysFor('left')).toEqual(DEFAULT_KEYS.left);
    expect(input.keysFor('pause')).toEqual(DEFAULT_KEYS.pause);
    expect(input.keysFor('confirm')).toEqual(DEFAULT_KEYS.confirm);
  });

  it('is remembered, and picked up by a fresh start', () => {
    const first = new InputSystem();
    first.loadBindings();
    first.setBinding('left', 'KeyN');
    first.setBinding('right', 'KeyM');

    const second = new InputSystem();
    second.loadBindings();
    expect(second.keysFor('left')).toEqual(['KeyN']);
    expect(second.keysFor('right')).toEqual(['KeyM']);
    expect(second.keysFor('jump')).toEqual(DEFAULT_KEYS.jump);
  });

  it('only writes down what was actually changed', () => {
    const input = new InputSystem();
    input.loadBindings();
    input.setBinding('flash', 'KeyG');
    expect(SaveSystem.loadSettings().bindings).toEqual({ flash: ['KeyG'] });
  });

  it('puts everything back when asked', () => {
    const input = new InputSystem();
    input.loadBindings();
    input.setBinding('jump', 'KeyZ');
    input.setBinding('pause', 'KeyQ');

    input.resetBindings();
    for (const action of BINDABLE) {
      expect(input.keysFor(action)).toEqual(DEFAULT_KEYS[action]);
    }
    expect(SaveSystem.loadSettings().bindings).toEqual({});
  });

  it('ignores a stored binding with no keys in it', () => {
    SaveSystem.saveSettings({ bindings: { jump: [] } });
    const input = new InputSystem();
    input.loadBindings();
    expect(input.keysFor('jump'), 'an unpressable jump is worse than the default').toEqual(
      DEFAULT_KEYS.jump,
    );
  });
});

describe('naming a key for a typeface with no lower case', () => {
  it('turns codes into something a person would recognise', () => {
    expect(keyLabel('KeyA')).toBe('A');
    expect(keyLabel('Digit7')).toBe('7');
    expect(keyLabel('Space')).toBe('SPACE');
    expect(keyLabel('Escape')).toBe('ESC');
    expect(keyLabel('ArrowLeft')).toBe('LEFT');
    expect(keyLabel('ShiftLeft')).toBe('L SHIFT');
    expect(keyLabel('Numpad5')).toBe('NUM 5');
  });

  it('never gives back nothing, whatever it is handed', () => {
    for (const code of ['Unknown', 'F13', '', 'Semicolon']) {
      expect(typeof keyLabel(code)).toBe('string');
    }
    expect(keyLabel('Semicolon')).toBe(';');
  });
});
