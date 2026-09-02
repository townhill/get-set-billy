import type { Art } from '../render/pixels';

/**
 * Original pixel art for everything that moves.
 *
 * The player is drawn with palette characters directly (see palette.ts), because
 * a nightcap really ought to be magenta. Enemies are the same. Collectables are
 * single-ink silhouettes written with '1', so they can flash through colours the
 * way the items in these games always did.
 */

export interface SpriteDef {
  width: number;
  height: number;
  frames: readonly Art[];
  /** Milliseconds per animation frame. */
  frameMs: number;
}

function sprite(frames: readonly Art[], frameMs = 140): SpriteDef {
  const height = frames[0].length;
  const width = frames[0].reduce((max, row) => Math.max(max, row.length), 0);
  return { width, height, frames, frameMs };
}

// ---------------------------------------------------------------------------
// The player: a bewildered person in a nightcap and dressing gown.
// M = nightcap, Y = face, C = dressing gown, R = slippers, k = features.
// ---------------------------------------------------------------------------

const PLAYER_HEAD = [
  '..MMMM..',
  '.MMMMMM.',
  'MMMMMMM.',
  '.YYYYYY.',
  '.YkYkYY.',
  '.YYYYYk.',
  '..YYYY..',
];

const PLAYER_TORSO = ['.CCCCCC.', 'CCCCCCCC', 'CCCCCCCY', '.CCCCCC.', '.CCCCCC.', '.CCCCCC.'];

const legs = (a: string, b: string, c: string): Art => [...PLAYER_HEAD, ...PLAYER_TORSO, a, b, c];

/** Four-frame walk cycle: stride, pass, stride, pass. */
export const PLAYER_WALK = sprite(
  [
    legs('.CC..CC.', '.CC..CC.', 'RR....RR'),
    legs('..CCCC..', '..CCCC..', '..RRRR..'),
    legs('.CC..CC.', '.CC..CC.', '.RR..RR.'),
    legs('..CCCC..', '..CCCC..', '..RRRR..'),
  ],
  90,
);

export const PLAYER_STAND = sprite([legs('..CCCC..', '..CCCC..', '.RR..RR.')], 1000);

export const PLAYER_JUMP = sprite([legs('.CCCCCC.', '.CC..CC.', 'RR....RR')], 1000);

/**
 * Hanging from a rope: both arms straight up, legs together and dangling.
 *
 * Drawn from scratch rather than from the usual head-and-torso pieces, because
 * the arms have to go above the head and nothing else in the game does that.
 */
export const PLAYER_HANG = sprite(
  [
    [
      'C......C',
      'C......C',
      'C.WWWW.C',
      'CWWWWWWC',
      '.WKWWKW.',
      '.WWWWWW.',
      '..WWWW..',
      '.CCCCCC.',
      'CCCCCCCC',
      'CCCCCCCC',
      '.CCCCCC.',
      '.CCCCCC.',
      '..CCCC..',
      '..CCCC..',
      '..CCCC..',
      '..RRRR..',
    ],
  ],
  1000,
);

/** A brief, undignified end. */
export const PLAYER_DEAD = sprite(
  [
    [
      '........',
      '........',
      '........',
      '..MMMM..',
      '.MMMMMM.',
      '.YkYkYY.',
      '.YYYYYY.',
      'CCCCCCCC',
      'CCCCCCCC',
      '.CCCCCC.',
      'RR....RR',
      '........',
      '........',
      '........',
      '........',
      '........',
    ],
    [
      '........',
      '........',
      '........',
      '........',
      '..MMMM..',
      '.YYYYYY.',
      'CCCCCCCC',
      'CCCCCCCC',
      'RRCCCCRR',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
    ],
  ],
  120,
);

// ---------------------------------------------------------------------------
// The residents. All 8x8, two frames each, predictable to a fault.
// ---------------------------------------------------------------------------

export const ENEMY_SPRITES: Readonly<Record<string, SpriteDef>> = {
  /** A bowler hat that has learned to walk. */
  bowler: sprite([
    [
      '........',
      '..BBBB..',
      '.BBBBBB.',
      '.BBBBBB.',
      'WWWWWWWW',
      '........',
      '.W....W.',
      '.W....W.',
    ],
    [
      '........',
      '..BBBB..',
      '.BBBBBB.',
      '.BBBBBB.',
      'WWWWWWWW',
      '........',
      '..W..W..',
      '..W..W..',
    ],
  ]),

  /** Perpetually about to pour. */
  teapot: sprite([
    [
      '...WW...',
      '..CCCC..',
      'WCCCCCCW',
      'WCCCCCCW',
      'WCCCCCCW',
      '.CCCCCC.',
      '..CCCC..',
      '.W....W.',
    ],
    [
      '........',
      '...WW...',
      '..CCCC..',
      'WCCCCCCW',
      'WCCCCCCW',
      'WCCCCCCW',
      '.CCCCCC.',
      '..WCCW..',
    ],
  ]),

  /** Cutlery with opinions. */
  fork: sprite([
    [
      'W.W.W...',
      'W.W.W...',
      'WWWWW...',
      '.WWW....',
      '..W.....',
      '..W.....',
      '..W.....',
      '..W.....',
    ],
    [
      '.W.W.W..',
      '.W.W.W..',
      '.WWWWW..',
      '..WWW...',
      '...W....',
      '...W....',
      '...W....',
      '...W....',
    ],
  ]),

  /** It watches. It is not clear with what. */
  eyeball: sprite([
    [
      '..WWWW..',
      '.WWWWWW.',
      'WWWBBWWW',
      'WWWBBWWW',
      'WWWWWWWW',
      '.WWWWWW.',
      '..WWWW..',
      '........',
    ],
    [
      '..WWWW..',
      '.WWWWWW.',
      'WWBBWWWW',
      'WWBBWWWW',
      'WWWWWWWW',
      '.WWWWWW.',
      '..WWWW..',
      '........',
    ],
  ]),

  /** A ghost, though rather a bored one. */
  ghost: sprite([
    [
      '..WWWW..',
      '.WWWWWW.',
      'WWkWWkWW',
      'WWWWWWWW',
      'WWWWWWWW',
      'WWWWWWWW',
      'WWWWWWWW',
      'W.W.W.W.',
    ],
    [
      '..WWWW..',
      '.WWWWWW.',
      'WWkWWkWW',
      'WWWWWWWW',
      'WWWWWWWW',
      'WWWWWWWW',
      'WWWWWWWW',
      '.W.W.W.W',
    ],
  ]),

  /** A wasp with a grievance. */
  wasp: sprite(
    [
      [
        '.W...W..',
        '..W.W...',
        '..YYYY..',
        '..kkkk..',
        '..YYYY..',
        '..kkkk..',
        '...YY...',
        '........',
      ],
      [
        '........',
        '.WW.WW..',
        '..YYYY..',
        '..kkkk..',
        '..YYYY..',
        '..kkkk..',
        '...YY...',
        '....k...',
      ],
    ],
    70,
  ),

  /** An unshelved book, flapping. */
  book: sprite([
    [
      '........',
      '.RWWWWR.',
      'RWWWWWWR',
      'RWWWWWWR',
      'RWWWWWWR',
      '.RWWWWR.',
      '........',
      '........',
    ],
    [
      '........',
      '..RWWR..',
      '.RWWWWR.',
      '.RWWWWR.',
      '.RWWWWR.',
      '..RWWR..',
      '........',
      '........',
    ],
  ]),

  /** Something in a flask. It is best not to ask. */
  flask: sprite([
    [
      '..WWW...',
      '..W.W...',
      '..W.W...',
      '.WWWWW..',
      '.WGGGW..',
      'WGGGGGW.',
      'WGGGGGW.',
      '.WWWWW..',
    ],
    [
      '..WWW...',
      '..W.W...',
      '..WGW...',
      '.WWWWW..',
      '.WGWGW..',
      'WGGGGGW.',
      'WGGGGGW.',
      '.WWWWW..',
    ],
  ]),

  /** A cog that escaped. */
  cog: sprite([
    [
      '.Y.YY.Y.',
      '.YYYYYY.',
      'YYY..YYY',
      'YY....YY',
      'YY....YY',
      'YYY..YYY',
      '.YYYYYY.',
      '.Y.YY.Y.',
    ],
    [
      'Y..YY..Y',
      '.YYYYYY.',
      '.YY..YY.',
      'YY....YY',
      'YY....YY',
      '.YY..YY.',
      '.YYYYYY.',
      'Y..YY..Y',
    ],
  ]),

  /** A moth of unusual size. */
  moth: sprite([
    [
      '........',
      '.M.kk.M.',
      'MMMkkMMM',
      'MMMkkMMM',
      '.MMkkMM.',
      '..MkkM..',
      '...kk...',
      '........',
    ],
    [
      '........',
      '..Mkk.M.',
      '.MMkkMM.',
      '.MMkkMM.',
      '..MkkM..',
      '..MkkM..',
      '...kk...',
      '........',
    ],
  ]),

  /** Escaped from a bath, some years ago. */
  duck: sprite([
    [
      '...YYY..',
      '..YYYYY.',
      '.RYkYYY.',
      '.RYYYYY.',
      '..YYYYYY',
      '.YYYYYYY',
      '.YYYYYY.',
      '..YYYY..',
    ],
    [
      '........',
      '...YYY..',
      '..YYYYY.',
      '.RYkYYY.',
      '.RYYYYYY',
      '..YYYYYY',
      '.YYYYYY.',
      '..YYYY..',
    ],
  ]),

  /** Small, grey, unbothered. */
  mouse: sprite([
    [
      '........',
      '.ww.....',
      'wwww....',
      'wwwwwww.',
      'wkwwwwww',
      'wwwwwwww',
      '.w.w.w.w',
      '........',
    ],
    [
      '........',
      '.ww.....',
      'wwww....',
      'wwwwwww.',
      'wkwwwwww',
      'wwwwwwww',
      'w.w.w.w.',
      '........',
    ],
  ]),

  /** A candle that has been left burning for forty years. */
  candle: sprite(
    [
      [
        '...Y....',
        '..YRY...',
        '..YRY...',
        '...Y....',
        '..WWW...',
        '..WWW...',
        '..WWW...',
        '..WWW...',
      ],
      [
        '...Y....',
        '...YY...',
        '..YRY...',
        '...Y....',
        '..WWW...',
        '..WWW...',
        '..WWW...',
        '..WWW...',
      ],
    ],
    160,
  ),

  /** The wiring in this house is not to standard. */
  spark: sprite(
    [
      [
        '....C...',
        '..C.C.C.',
        '...CCC..',
        'CCCWWWCC',
        '...CCC..',
        '..C.C.C.',
        '....C...',
        '........',
      ],
      [
        '........',
        '.C.C.C..',
        '..CCC...',
        '.CWWWC..',
        '..CCC...',
        '.C.C.C..',
        '........',
        '........',
      ],
    ],
    80,
  ),

  /** A fern with ambitions. */
  fern: sprite([
    [
      'G.....G.',
      '.G...G..',
      '.GG.GG..',
      '..GGG...',
      '...G....',
      '...G....',
      '..GGG...',
      '.GGGGG..',
    ],
    [
      '..G..G..',
      '.GG.GG..',
      '.GGGGG..',
      '..GGG...',
      '...G....',
      '...G....',
      '..GGG...',
      '.GGGGG..',
    ],
  ]),
};

// ---------------------------------------------------------------------------
// The twenty-five things that must be collected before you are allowed to leave.
// Single ink, so they can flash.
// ---------------------------------------------------------------------------

export const ITEM_SPRITES: Readonly<Record<string, Art>> = {
  teacup: [
    '........',
    '.111111.',
    '.1....1.',
    '.1....11',
    '.1....1.',
    '..1111..',
    '........',
    '.111111.',
  ],
  key: [
    '..111...',
    '.1...1..',
    '.1...1..',
    '..111...',
    '...1....',
    '...1....',
    '...111..',
    '...1.1..',
  ],
  umbrella: [
    '...1....',
    '.11111..',
    '1111111.',
    '1.1.1.1.',
    '...1....',
    '...1....',
    '...1.1..',
    '....11..',
  ],
  monocle: [
    '..111...',
    '.1...1..',
    '1.....1.',
    '1.....1.',
    '1.....1.',
    '.1...1..',
    '..111.1.',
    '.......1',
  ],
  biscuit: [
    '........',
    '.111111.',
    '1.1..1.1',
    '11....11',
    '1..11..1',
    '1.1..1.1',
    '.111111.',
    '........',
  ],
  candlestick: [
    '...1....',
    '...1....',
    '..111...',
    '...1....',
    '...1....',
    '...1....',
    '..111...',
    '.11111..',
  ],
  bell: [
    '...1....',
    '..111...',
    '.11111..',
    '.11111..',
    '.11111..',
    '1111111.',
    '........',
    '...1....',
  ],
  boot: [
    '.11.....',
    '.11.....',
    '.11.....',
    '.11.....',
    '.111....',
    '.111111.',
    '.111111.',
    '.111111.',
  ],
  spectacles: [
    '........',
    '111.111.',
    '1.1.1.1.',
    '1.1.1.1.',
    '111.111.',
    '........',
    '........',
    '........',
  ],
  pipe: [
    '........',
    '......11',
    '.....11.',
    '11111...',
    '1.....1.',
    '1.....1.',
    '.11111..',
    '........',
  ],
  pocketwatch: [
    '...11...',
    '..1111..',
    '.11..11.',
    '1..1..11',
    '1..11..1',
    '1......1',
    '.11..11.',
    '..1111..',
  ],
  crown: [
    '........',
    '1..1..1.',
    '11.11.11',
    '1111111.',
    '1111111.',
    '1111111.',
    '........',
    '........',
  ],
  jar: [
    '..1111..',
    '.111111.',
    '.1....1.',
    '.1....1.',
    '.1....1.',
    '.1....1.',
    '.111111.',
    '..1111..',
  ],
  gramophone: [
    '.....111',
    '....1111',
    '...11111',
    '..111...',
    '..1.....',
    '.111....',
    '11111...',
    '.111....',
  ],
};

// ---------------------------------------------------------------------------
// The front door. The whole point of the exercise.
// '1' frame, '2' panels, 'W' handle.
// ---------------------------------------------------------------------------

export const DOOR_ART: Art = [
  '.11111111111111.',
  '1333333333333331',
  '1322222222222231',
  '1323333333333231',
  '1323222222223231',
  '1323233333323231',
  '1323233333323231',
  '1323233333323231',
  '1323222222223231',
  '1323333333333231',
  '1322222222222231',
  '1333333333333331',
  '1322222222222231',
  '1323333333333231',
  '1323222222223231',
  '1323233333323231',
  '13232333W3323231',
  '1323233333323231',
  '1323222222223231',
  '1323333333333231',
  '1322222222222231',
  '1333333333333331',
  '.11111111111111.',
  '................',
];

/** The little head used to count remaining lives in the status panel. */
export const LIFE_ICON: Art = [
  '..MMMM..',
  '.MMMMMM.',
  'MMMMMMM.',
  '.YYYYYY.',
  '.YkYkYY.',
  '.YYYYYk.',
  '..YYYY..',
  '..CCCC..',
];

export const DOOR_WIDTH = 16;
export const DOOR_HEIGHT = 24;

/** Mirrors a block of art horizontally, for left-facing sprites. */
export function mirrorArt(art: Art): Art {
  return art.map((row) => [...row].reverse().join(''));
}
