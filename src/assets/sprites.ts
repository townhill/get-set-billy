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

/** Standing about, and now and then blinking, which is the whole of the idle animation. */
export const PLAYER_STAND = sprite(
  [
    legs('..CCCC..', '..CCCC..', '.RR..RR.'),
    [
      '..MMMM..',
      '.MMMMMM.',
      'MMMMMMM.',
      '.YYYYYY.',
      '.YyYyYY.',
      '.YYYYYk.',
      '..YYYY..',
      ...PLAYER_TORSO,
      '..CCCC..',
      '..CCCC..',
      '.RR..RR.',
    ],
  ],
  1000,
);

export const PLAYER_JUMP = sprite([legs('.CCCCCC.', '.CC..CC.', 'RR....RR')], 1000);

/** On the way down: legs together and toes pointed, which is how you tell it from the way up. */
export const PLAYER_FALL = sprite([legs('..CCCC..', '..CCCC..', '..R..R..')], 1000);

/**
 * A fall that has already gone too far, and knows it.
 *
 * Shown from the moment the drop passes the fatal distance, so that the death
 * waiting at the bottom is announced rather than sprung. Arms windmilling and
 * mouth open, in two frames, because it should look like a mistake.
 */
export const PLAYER_PLUMMET = sprite(
  [
    [
      'Y.MMMM.Y',
      'CMMMMMMC',
      'MMMMMMM.',
      '.YYYYYY.',
      '.YkYkYY.',
      '.YYYkkY.',
      '..YkkY..',
      '.CCCCCC.',
      '.CCCCCC.',
      '.CCCCCC.',
      '.CCCCCC.',
      '.CCCCCC.',
      '.CCCCCC.',
      '.CC..CC.',
      'CC....CC',
      'R......R',
    ],
    [
      '..MMMM..',
      '.MMMMMM.',
      'MMMMMMM.',
      '.YYYYYY.',
      '.YkYkYY.',
      '.YYYkkY.',
      '..YkkY..',
      '.CCCCCC.',
      'YCCCCCCY',
      '.CCCCCC.',
      '.CCCCCC.',
      '.CCCCCC.',
      '.CCCCCC.',
      '..C..C..',
      '.CC..CC.',
      '.R....R.',
    ],
  ],
  90,
);

/**
 * Touching down: knees bent and the head a pixel lower, for a moment.
 *
 * Still sixteen pixels tall, since the sprite is drawn at exactly the size of
 * the collision box and a landing is not a reason to change that.
 */
export const PLAYER_LAND = sprite(
  [
    [
      '........',
      '..MMMM..',
      '.MMMMMM.',
      'MMMMMMM.',
      '.YYYYYY.',
      '.YkYkYY.',
      '.YYYYYk.',
      '..YYYY..',
      '.CCCCCC.',
      'CCCCCCCC',
      'CCCCCCCY',
      '.CCCCCC.',
      '.CCCCCC.',
      '.CC..CC.',
      'CC....CC',
      'RR....RR',
    ],
  ],
  1000,
);

/**
 * Hanging from a rope: both hands on it above the head, legs together and
 * dangling.
 *
 * The rope runs down the middle of the sprite, so that is where the hands go.
 * Drawn from scratch rather than from the usual head-and-torso pieces, because
 * the arms have to go above the head and nothing else in the game does that.
 */
export const PLAYER_HANG = sprite(
  [
    [
      '...YY...',
      '..C..C..',
      '.CMMMMC.',
      '.CMMMMC.',
      '.CYYYYC.',
      '.CkYYkC.',
      '..YYYY..',
      '.CCCCCC.',
      'CCCCCCCC',
      '.CCCCCC.',
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

// ---------------------------------------------------------------------------
// Vents: a grating in the floor, and what comes out of it. Written in two inks,
// '1' for the hot middle and '2' for the edges, so steam and flame can share
// the shapes and differ only in colour.
// ---------------------------------------------------------------------------

/** One cell of jet, firing. Stacked to make the column; two frames, alternated. */
export const VENT_JET: readonly Art[] = [
  ['.2.22.2.', '..2112..', '.211112.', '.211212.', '..2112..', '.21111..', '.212112.', '..2112..'],
  ['..2.2.2.', '.2112...', '.211112.', '.212112.', '..21112.', '..2112..', '.211112.', '.21112..'],
];

/** The top cell of a jet: ragged, thinning out into nothing. */
export const VENT_TIP: readonly Art[] = [
  ['........', '..2...2.', '....2...', '.2..2...', '...22.2.', '..2112..', '.2.112..', '..2112..'],
  ['...2....', '......2.', '.2..2...', '...2..2.', '..2.2...', '..2112..', '..2112..', '.21112..'],
];

/** The sputter before it fires: a few wisps rising off the grating. */
export const VENT_WARN: readonly Art[] = [
  ['........', '........', '........', '........', '....2...', '...2....', '..2.2...', '...12...'],
  ['........', '........', '........', '........', '...2....', '....2...', '...2.2..', '..21....'],
];

/** The grating itself, drawn on top of the floor whether or not the vent is firing. */
export const VENT_GRATE: Art = [
  '........',
  '........',
  '........',
  '........',
  '........',
  '........',
  '12.12.12',
  '22222222',
];

/** The two kinds of vent, and the inks each is drawn in: '1', '2', and the grating's '1', '2'. */
export const VENT_KINDS: Readonly<Record<string, { hot: string; edge: string }>> = {
  steam: { hot: 'W', edge: 'w' },
  flame: { hot: 'Y', edge: 'R' },
};

/** Swaps the placeholder inks in a piece of art for real palette characters. */
function inked(art: Art, ink: Readonly<Record<string, string>>): Art {
  return art.map((row) => [...row].map((ch) => ink[ch] ?? ch).join(''));
}

const ventSprite = (kind: { hot: string; edge: string }): SpriteDef =>
  sprite(
    VENT_JET.map((frame) => inked(frame, { '1': kind.hot, '2': kind.edge })),
    80,
  );

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

  /** A vent's jet, one cell of it. See VENT_JET; a vent is drawn a cell at a time. */
  steam: ventSprite(VENT_KINDS.steam),
  flame: ventSprite(VENT_KINDS.flame),
};

// ---------------------------------------------------------------------------
// The thirty-seven things that must be collected before you are allowed to leave.
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
