/**
 * The wall at the back of each room.
 *
 * Every room used to be painted on plain black, which is authentic and also
 * the reason every room looked like every other room with the walls recoloured.
 * A backdrop gives the hall its wallpaper and the roof its sky.
 *
 * A backdrop is a pure function of a pixel's position, answering '1' for the
 * backdrop's ink, '2' for its shade and '.' for black. Both inks are always deep
 * shades (see palette.ts), which nothing in the foreground is ever drawn in, so
 * a busy wallpaper can never hide a ledge, a hazard or something coming at you.
 *
 * Patterns rather than art strings because most of them are bigger than a cell,
 * and several are gradients, which are a formula whether you like it or not.
 */

export type BackdropPixel = '1' | '2' | '.';

export type BackdropFn = (x: number, y: number) => BackdropPixel;

/** A 4x4 ordered-dither matrix, for gradients made of whole pixels. */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const;

/** True when a pixel should be lit to show a shade of `level` (0..1). */
function dither(x: number, y: number, level: number): boolean {
  return BAYER[y & 3][x & 3] < Math.round(level * 16);
}

/** A small, repeatable scatter: the same room always gets the same stars. */
function hash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const mod = (value: number, by: number): number => ((value % by) + by) % by;

export const BACKDROPS: Readonly<Record<string, BackdropFn>> = {
  /** Flocked wallpaper: small diamonds on a solid ground, every other row staggered. */
  damask: (x, y) => {
    const stagger = mod(Math.floor(y / 16), 2) * 8;
    const dx = Math.abs(mod(x + stagger, 16) - 8);
    const dy = Math.abs(mod(y, 16) - 8);
    const d = dx + dy;
    if (d === 3 || d === 0) return '2';
    return '1';
  },

  /** Regency stripes: a broad band, a gap, and a pinstripe down the middle of it. */
  stripes: (x) => {
    const at = mod(x, 16);
    if (at === 11) return '2';
    return at < 8 ? '1' : '.';
  },

  /** Vertical boards, with seams, staggered butt joints and the odd nail. */
  boards: (x, y) => {
    const board = Math.floor(x / 12);
    const across = mod(x, 12);
    if (across === 0) return '.';
    const joint = mod(y + board * 23, 48);
    if (joint === 0) return '.';
    if (joint === 2 && (across === 2 || across === 9)) return '2';
    return across === 1 ? '2' : '1';
  },

  /** Glazed tiles on a black grout, with a glint in one corner of each. */
  tiles: (x, y) => {
    const tx = mod(x, 16);
    const ty = mod(y, 16);
    if (tx === 15 || ty === 15) return '.';
    if ((tx === 1 && ty <= 3) || (ty === 1 && tx <= 3)) return '2';
    return '1';
  },

  /** Brickwork: half-bond courses, black mortar, a lighter top edge on each brick. */
  bricks: (x, y) => {
    const course = Math.floor(y / 8);
    const tx = mod(x + (course % 2) * 8, 16);
    const ty = mod(y, 8);
    if (ty === 7 || tx === 15) return '.';
    return ty === 0 ? '2' : '1';
  },

  /** Pipework: vertical runs with flanges, and one long horizontal main. */
  pipes: (x, y) => {
    const main = mod(y - 36, 64);
    if (main <= 5) return main === 0 || main === 5 ? '2' : '1';
    const run = mod(x - 6, 40);
    if (run > 6) return '.';
    const flange = mod(y + Math.floor(x / 40) * 20, 48) < 3;
    if (flange) return '2';
    if (run === 0 || run === 6) return '.';
    return run === 1 ? '2' : '1';
  },

  /** A night sky, darkest overhead and lightening to the horizon, with a few faint stars. */
  sky: (x, y) => {
    if (hash(x, y) > 0.9965) return '2';
    const level = Math.max(0, (y - 24) / 136);
    return dither(x, y, level * 0.85) ? '1' : '.';
  },

  /** Big panes of glass in a frame, the light falling off towards the floor. */
  glass: (x, y) => {
    const px = mod(x, 32);
    const py = mod(y, 40);
    if (px === 0 || py === 0) return '2';
    if (mod(px - py, 32) < 2 && py < 20) return '2';
    const level = 0.75 - (py / 40) * 0.6;
    return dither(x, y, level) ? '1' : '.';
  },

  /**
   * Organ pipes, rising from the floor in a rank that swells to the middle.
   *
   * Each pipe has a mouth, the dark slot a little way up from its foot, which
   * is what makes a row of tubes read as an organ rather than as a fence.
   */
  organ: (x, y) => {
    const pipe = Math.floor(x / 8);
    const across = mod(x, 8);
    if (across === 0 || across === 7) return '.';
    const fromMiddle = Math.abs(pipe - 15.5);
    const top = 20 + Math.round(fromMiddle * 5) + (pipe % 2) * 6;
    if (y < top) return '.';
    if (y < top + 2) return '2';
    const mouth = top + 14;
    if (y >= mouth && y < mouth + 3 && across >= 2 && across <= 5) return '.';
    return across === 1 ? '2' : '1';
  },
};

export const BACKDROP_NAMES: readonly string[] = Object.keys(BACKDROPS);

/** A backdrop by name, falling back to plain black for a name nobody has drawn. */
export function backdropFor(name: string): BackdropFn {
  return BACKDROPS[name] ?? (() => '.');
}
