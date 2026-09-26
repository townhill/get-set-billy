/**
 * What the status panel says when something kills you.
 *
 * A death that says what did it is a death you can learn from — "that was
 * further than it looked" teaches the fatal fall in a way a sound effect never
 * will — and it is also the house's last chance to be rude to you.
 *
 * Pure text and pure functions. Every line has to fit the status panel and be
 * printable in the project's own typeface, and there is a test for both.
 */

export type Cause =
  | { kind: 'fall' }
  | { kind: 'hazard'; tile: string | null }
  | { kind: 'enemy'; sprite: string }
  | { kind: 'gave-up' };

/** One line per resident. A new enemy sprite without one here fails a test. */
export const ENEMY_OBITUARIES: Readonly<Record<string, string>> = {
  bowler: 'FLATTENED BY A BOWLER HAT',
  teapot: 'SCALDED BY A TEAPOT',
  fork: 'SKEWERED BY A FORK',
  eyeball: 'STARED OUT BY AN EYEBALL',
  ghost: 'BORED TO DEATH BY A GHOST',
  wasp: 'STUNG, AND RATHER OFFENDED',
  book: 'SAVAGED BY A LIBRARY BOOK',
  flask: 'NEVER ASK WHAT IS IN THE FLASK',
  cog: 'CAUGHT IN THE WORKS',
  moth: 'EATEN BY A MOTH. SOMEHOW',
  duck: 'SHOULD HAVE DUCKED',
  mouse: 'OUTWITTED BY A MOUSE',
  candle: 'SINGED BY A CANDLE',
  spark: 'THE WIRING GOT YOU',
  fern: 'THE FERN HAD AMBITIONS',
  steam: 'STEAMED LIKE A PUDDING',
  flame: 'THE HOB WAS ON',
};

/** One line per kind of deadly tile, by its character in the room data. */
export const HAZARD_OBITUARIES: Readonly<Record<string, string>> = {
  '^': 'THOSE WERE SPIKES',
  v: 'THE CEILING HAD SPIKES',
  '~': 'IN OVER YOUR HEAD',
  '*': 'THAT WAS UNPLEASANT. FATALLY',
};

export const FALL_OBITUARY = 'THAT WAS FURTHER THAN IT LOOKED';
export const GAVE_UP_OBITUARY = 'GIVING UP ON THIS ROOM';
const FALLBACK = 'SOMETHING GOT YOU';

export function obituary(cause: Cause): string {
  switch (cause.kind) {
    case 'fall':
      return FALL_OBITUARY;
    case 'gave-up':
      return GAVE_UP_OBITUARY;
    case 'hazard':
      return (cause.tile !== null ? HAZARD_OBITUARIES[cause.tile] : undefined) ?? FALLBACK;
    case 'enemy':
      return ENEMY_OBITUARIES[cause.sprite] ?? FALLBACK;
  }
}

/** Every line this module can produce, for the tests that check they all print. */
export const ALL_OBITUARIES: readonly string[] = [
  ...Object.values(ENEMY_OBITUARIES),
  ...Object.values(HAZARD_OBITUARIES),
  FALL_OBITUARY,
  GAVE_UP_OBITUARY,
  FALLBACK,
];
