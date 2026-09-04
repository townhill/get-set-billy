# The Peculiar House

An original single-screen platform game, written as if by an ambitious 1980s
bedroom programmer who had somehow got hold of TypeScript.

You are trapped in a large, eccentric, mildly unreasonable mansion. Thirty-seven
objects are scattered through its twenty rooms. Find all of them, then find
the front door, which will not open until you have.

Three of those objects are keys. Parts of the house are barred by gates, and a
gate stays shut until you are carrying the right key — so the house is not
simply open from the first second, and there is an order in which it gives way.

The game is inspired by the _shape_ of early-1980s British 8-bit platform games:
single-screen rooms that join up into one interconnected house, precise jumps,
strange and entirely predictable enemies, flashing collectables, and a status
panel along the bottom. Everything in it — the code, the artwork, the room
layouts, the characters, the sounds and the jokes — is original to this project.
No assets from any commercial game are used, copied, or derived from.

---

## Screenshots

|                                                                      |                                                                                 |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| ![Title screen](docs/screenshots/01-title.png)                       | ![The Unnecessarily Grand Entrance Hall](docs/screenshots/02-entrance-hall.png) |
| _The title screen_                                                   | _The Unnecessarily Grand Entrance Hall, where you start and, eventually, leave_ |
| ![The Room Of Unreliable Clocks](docs/screenshots/03-clock-room.png) | ![The Strange Laboratory](docs/screenshots/04-laboratory.png)                   |
| _The Room Of Unreliable Clocks, with its swinging cogs_              | _The Strange Laboratory: conveyors, crumbling floors and something in a flask_  |
| ![The Roof, Obviously](docs/screenshots/05-roof.png)                 | ![Debug mode](docs/screenshots/06-debug-mode.png)                               |
| _The Roof, Obviously_                                                | _Debug mode, showing collision boxes, hazard rectangles, spawns and exits_      |

---

## Running with Docker

```bash
docker compose up --build
```

Then open **<http://localhost:8088>**.

If that port is busy, override it:

```bash
PECULIAR_PORT=9000 docker compose up --build
```

To stop it:

```bash
docker compose down
```

The build is two stages. The first uses `node:24-alpine` to install
dependencies, type-check and bundle. The second copies only the built `dist/`
into `nginx:1.29-alpine`. The image that actually runs contains no Node, no npm,
no source and no `node_modules` — just static files and nginx, at around 63 MB.
There is a health check on `/healthz`, which `docker compose ps` reports as
`healthy` once nginx is answering.

---

## Development

Node 22.12 or newer.

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>. Vite hot-reloads as you edit.

### npm scripts

| Script                 | What it does                                                 |
| ---------------------- | ------------------------------------------------------------ |
| `npm run dev`          | Vite dev server with hot reload on port 5173                 |
| `npm run build`        | Type-check, then bundle to `dist/`                           |
| `npm run preview`      | Serve the built `dist/` on port 4173                         |
| `npm run typecheck`    | `tsc --noEmit` in strict mode                                |
| `npm run lint`         | ESLint, zero warnings tolerated                              |
| `npm run lint:fix`     | ESLint with `--fix`                                          |
| `npm run format`       | Prettier, writing changes                                    |
| `npm run format:check` | Prettier, checking only                                      |
| `npm test`             | Vitest, one run                                              |
| `npm run test:watch`   | Vitest in watch mode                                         |
| `npm run verify`       | Type-check, lint, test and build — everything CI would do    |
| `npm run check-room`   | Check one room, or all of them, and draw what can be reached |

---

## Controls

| Action                   | Keyboard                    | Gamepad                    |
| ------------------------ | --------------------------- | -------------------------- |
| Walk left                | `←` or `A`                  | D-pad left, or left stick  |
| Walk right               | `→` or `D`                  | D-pad right, or left stick |
| Jump                     | `Space`, `↑` or `W`         | A / B, or D-pad up         |
| Restart the current room | `R` — **this costs a life** | X                          |
| Pause, and see the map   | `Esc` or `P`                | Start                      |
| Sound on/off             | `M`                         | —                          |
| Gentler flashing         | `F`                         | —                          |
| Change any of these      | **Controls**, on the title  | —                          |
| Choose a menu option     | `↑` / `↓`                   | D-pad up/down              |
| Confirm                  | `Space` or `Enter`          | A, or Start                |

Every key in that table except the menu ones can be moved, from **Controls** on
the title screen. The keys that work the menus are deliberately fixed: rebinding
those is how somebody would lock themselves out of the screen that puts it back.
There is a reset as well, but only as a convenience rather than as the way out.

Notes on how it feels, all of which are deliberate:

- **Jumps are a fixed height.** Letting go of the button early does not shorten
  them. Every gap in the house is therefore exactly as wide as it looks.
- **There is no acceleration and no momentum.** Releasing the direction key
  stops you dead. You never slide, bounce or rotate.
- **You can steer in mid-air.** The games of the era mostly would not let you.
  They were wrong.
- **A jump clears four tiles (32 px) but not five.** The whole house is laid out
  around that number, and there is a test that pins it.
- **Falling too far is fatal** — more than 72 px without landing. A fall that
  carries you down into the room below keeps counting.
- `R` costs a life on purpose: it is the way out of a spot you cannot escape,
  not a free retry.
- **A rope carries you; it never flings you.** Letting go leaves you exactly
  where the rope had got you to, with an ordinary fixed-height jump. That is the
  same rule as everything else, and it is why every gap in the house is still
  exactly as wide as it looks. What a rope adds is reach and timing, not physics.
- **Leaving through the ceiling** counts once half the player is through the
  gap, rather than all of them. Walking off the side or falling out of the
  bottom carries you onward whatever happens, so those wait until you are
  entirely outside; a jump does not, and demanding the whole body clear the
  ceiling would only open the exit at the very top of the arc, for a fraction of
  a step. That is a trick, not a doorway.

---

## Architecture

```
src/
  main.ts                  Phaser game config and integer scaling
  config.ts                Every tunable number in the game

  scenes/
    BootScene.ts           Draws every texture, then hands over
    TitleScene.ts          Title, menu, Continue / New Game
    GameScene.ts           The game: sequencing and presentation
    OptionsScene.ts        Which key does what, and the two settings
    GameOverScene.ts       Out of lives
    VictoryScene.ts        Out of the house

  objects/
    Player.ts              Movement model (no Phaser)
    Enemy.ts               Enemy motion as a pure function of time (no Phaser)
    Lift.ts                Moving ledges, likewise (no Phaser)
    Rope.ts                Swinging ropes, likewise (no Phaser)
    paths.ts               Walking a closed loop of points (no Phaser)

  world/
    tiles.ts               What each tile character means (no Phaser)
    roomTypes.ts           Room data schema and per-room validation (no Phaser)
    Room.ts                One room, plus its crumbling floors (no Phaser)
    RoomManager.ts         Loads every room JSON, validates the whole house

  systems/
    CollisionSystem.ts     Swept AABB against the tile grid (no Phaser)
    InputSystem.ts         Keyboard and gamepad, straight from the browser
    AudioSystem.ts         Square waves generated at runtime
    SaveSystem.ts          localStorage, defensively

  state/
    GameState.ts           Room, lives, collected items, rooms seen, clock

  render/
    pixels.ts              Plot art strings onto a canvas
    textures.ts            Build every texture at boot
    PixelText.ts           Text in the project's own typeface

  ui/
    Hud.ts                 The status panel
    MapOverlay.ts          The map of the house, shown while paused
    DebugOverlay.ts        Collision boxes and numbers, when asked for

  assets/
    palette.ts             Sixteen colours and black
    font.ts                An original 5x7 typeface
    sprites.ts             Player, enemies, collectables, the door
    tileArt.ts             Walls, ledges, decoration, hazards
    themes.ts              Which shapes and colours each kind of room uses

  data/rooms/*.json        The house itself
```

### Phaser's job, and everyone else's

Phaser draws things and runs the loop. It does not decide anything.

All the rules — movement, collision, enemy paths, room structure, game state,
saving — live in modules that import no Phaser at all. That is why 464 tests can
run in a plain Node environment with no canvas and no WebGL, and it is why
`GameScene` is mostly sequencing rather than logic.

Arcade Physics is deliberately not used. The movement controller in
`objects/Player.ts` sets velocities rather than accumulating forces, which is
what makes the jumps repeatable to the pixel.

### Things that move on a clock

Enemies, lifts and the shimmer on a cupboard all come from the same idea: their
state is a pure function of **how long you have been in this room**. The room
owns that clock, resets it on entry and after every death, and hands it out. No
part of the game keeps a second copy, and nothing about a moving thing has to be
saved, restored or reconciled.

### The simulation loop

`GameScene.update()` accumulates real time and steps the simulation in fixed
1/60 s slices (at most five per rendered frame). Everything that affects the
game happens inside a fixed step; everything outside one only draws. A slow
frame therefore changes nothing about how the game plays.

### Rooms and the RoomManager

`RoomManager` picks up every file in `src/data/rooms/` with `import.meta.glob`
and wraps each in a `Room`. There is no registry and no list of rooms in the
code: adding a file adds a room.

A `Room` is the JSON plus the only thing about a room that changes while you are
in it — which crumbling floors have gone. It implements the `TileGrid` interface
that the collision system needs, so collision never sees a room at all, only
`solidAt`, `platformAt` and `hazardAt`.

Rooms are laid out on a grid (`grid: {x, y}`) which acts as the map of the
house. Exits must be reciprocal and must agree with that grid, and there are
tests for both.

### The collision system

`systems/CollisionSystem.ts` resolves one axis at a time, X first, against 8×8
cells:

- A **solid** tile blocks from all four sides.
- A **platform** tile blocks downward movement only, and only if the body's
  underside was at or above the tile's surface before the step. You jump
  straight up through it.
- Sweeps check the whole path travelled, not just the destination, so nothing
  can tunnel through a wall however fast it is moving.
- Only cells the body was genuinely clear of can block it, so a body that has
  somehow ended up inside a wall is nudged out rather than flung across the room.
- Hazards are tested against a sub-rectangle of the cell — floor spikes only
  occupy the bottom five pixels — using a player hitbox inset by one pixel on
  every side. Deaths should always look deserved.

### Proving the house is playable

`tests/reachability.ts` is a small solver that explores a room by running the
actual `Player.step` model: from every place the player can stand, it tries
walking and jumping in each direction, records where they land, and repeats.

It is deliberately optimistic — no enemies, and every attempt starts with the
crumbling floors intact — so anything it calls unreachable really is
unreachable, and it never fails at random.

Optimism cuts both ways, though. A perfect simulated player proves only that a
route _exists_, not that anybody could follow it: a landing that works from one
launch pixel for one frame counts as reachable, and is not. So every room is
explored twice, the second time by a **clumsy player** who jumps and walks five
per cent less far. Only what survives that has real margin in it, and that
second pass is what stops a knife-edge route passing for a staircase.

It exists because rooms kept passing every structural check while being
impossible to play. Reasoning about geometry is not enough; only simulating the
jump tells you whether the jump works, and only simulating a worse jump tells
you whether it works reliably.

### Enemies

An enemy's position is a **pure function of how long you have been in the room**:

```ts
enemyPosition(def, seconds, spriteSize) -> { x, y }
```

There is no per-enemy state anywhere. Entering a room, or dying and respawning,
resets the room clock to zero and every resident snaps back to exactly where it
started. That is what made the enemies in these games learnable, and learnable
is the whole game.

Five behaviours: `patrol-h`, `patrol-v`, `circle`, `pendulum` and `static`.

### Game state

```ts
interface GameState {
  currentRoom: string;
  lives: number;
  collectedItems: Set<string>;
  startedAt: number; // elapsedMs is derived from this
  entrySpawn: SpawnKey; // where a death sends you back to
  deaths: number;
  visitedRooms: Set<string>; // for the map
}
```

One object, held by `GameScene`, untouched by room changes. Collected items are
global and keyed by id, so an item stays collected when you come back.

`entrySpawn` records the edge you came in through, so dying returns you to where
you entered the room rather than to some fixed point.

### Best times

Finishing the house records the run, and the fastest ten are kept. The title
screen shows the time to beat once there is one, and nothing at all before that:
an empty scoreboard on a game nobody has finished is just a reproach.

### Controls that move

`InputSystem` holds one table of actions to key codes: the defaults, with
whatever the player has changed laid over the top. Only the differences are
saved, so an action nobody has touched follows the default even if the default
later changes.

Codes rather than characters (`KeyA`, not `a`), so a binding survives a change
of keyboard layout — which is why there is a small table turning `ShiftLeft`
into `L SHIFT` for a typeface that has no lower case.

A stored binding with no keys in it is ignored rather than honoured. An action
with no key is an action that cannot be performed, and no settings file is worth
making the game unplayable over.

### Saving

`SaveSystem` writes a snapshot to `localStorage` after every room change, every
item picked up, and every death. Which keys the player holds is not in there:
it is worked out from the items they have collected, so keys arrived without a
format change, and `visitedRooms` is optional so a save written before the map
existed still loads. The title screen offers **Continue** when a save
exists and **New Game** always.

Everything is wrapped in `try`/`catch` and validated on the way back in: a
private-mode browser, a full quota, or a corrupted save all end up as "no saved
game" rather than an error. The clock is stored as elapsed milliseconds, so a
game resumed a week later continues from the right time rather than claiming you
took a week.

Running out of lives saves your progress but restores a full set of lives, so
Continue can never drop you into a run you cannot survive.

### Graphics

There is not a single binary image file in this project.

Sprites are written as arrays of strings in `src/assets/`, one character per
pixel, using single-letter palette keys — so a bowler hat is legible as text in
the source. At boot, `render/textures.ts` plots them into canvases and hands
them to Phaser as textures. The 5×7 typeface in `assets/font.ts` is drawn the
same way, as slash-separated binary strings.

The one file on disk is `public/favicon.svg`, and that is pixel art too: a 16×16
grid of `<rect>` elements with `shape-rendering="crispEdges"`, showing the
player's head in its nightcap. It scales up crisply to whatever size a browser
asks for, and it is still just text you can edit.

Each room's fixed scenery is painted once into a single 256×160 texture. Only
the parts that animate — conveyors, crumbling floors, liquid — are separate
sprites.

The game runs at a logical 256×192 (a 256×160 playfield plus a 32-pixel status
panel) and is scaled up by a whole number of pixels to fit the window, so every
pixel on screen is a perfect square block. Nothing is ever smoothed.

Collectables flash through six colours about nine times a second, which is the
look the game is going for and is also inside the range associated with
photosensitive seizures. `F` slows it to a gentle two-colour pulse, and the
setting is remembered. It is one key rather than a menu on purpose.

Themes give each room its own two-colour scheme in the manner of the period,
without ever making anything hard to read. Enemies and decorations are always
different colours from each other, on purpose.

### Audio

Each theme has three notes of its own, played as you walk in — the roof gets the
highest in the house, the cellar the lowest. A theme is what a room is like, and
what a room is like includes what it sounds like when the door shuts behind you.

Every sound is a square wave generated on the spot with the Web Audio API. There
are no audio files, so there is nothing that can fail to load. If the browser has
no `AudioContext`, or refuses to start one, the game runs in silence and says so
in the status panel. `M` toggles sound, and the setting is remembered.

---

## Creating a new room

**Adding a room means adding one JSON file.** No code changes, no imports, no
registry to update. `RoomManager` globs the directory; the tests check your work.

### 1. Create `src/data/rooms/<your-room-id>.json`

The file name must match the `id` field.

```json
{
  "id": "the-airing-cupboard",
  "name": "The Airing Cupboard Of Doubt",
  "theme": "attic",
  "grid": { "x": 0, "y": 1 },
  "exits": { "right": "hat-attic" },
  "spawns": {
    "right": { "x": 246, "y": 136 }
  },
  "tiles": [
    "################################",
    "#,............................,#",
    "#..............................#",
    "#..............................#",
    "#........======................#",
    "#..............................#",
    "#..............................#",
    "#..====...........======.......#",
    "#..............................#",
    "#..............................#",
    "#..........%%%%%...............#",
    "#..............................#",
    "#..............................#",
    "#....======..........=====.....#",
    "#..............................#",
    "#..............................#",
    "#...............====...........#",
    "#...............................",
    "#.........^^^...................",
    "################################"
  ],
  "enemies": [
    {
      "type": "patrol-h",
      "id": "cupboard-bowler",
      "sprite": "bowler",
      "y": 96,
      "from": 40,
      "to": 160,
      "speed": 42
    }
  ],
  "items": [{ "id": "cupboard-boot", "sprite": "boot", "x": 80, "y": 24 }]
}
```

> The one existing file you must also edit is the neighbour's. This example
> exits `right` into `hat-attic`, so `hat-attic.json` needs `"left":
"the-airing-cupboard"` adding to its `exits`, and a `"left"` spawn if it has
> not got one. Exits are always reciprocal, and the tests will tell you if you
> forget.

### 2. The tile grid

Exactly **20 rows of exactly 32 characters**. Each cell is 8×8 logical pixels.

| Char | Meaning                                                               |
| ---- | --------------------------------------------------------------------- |
| `.`  | Air                                                                   |
| `#`  | Wall — solid from every side                                          |
| `=`  | Ledge — one-way; you land on it, and jump up through it               |
| `%`  | Crumbling ledge — collapses about half a second after you stand on it |
| `<`  | Conveyor belt, pushing left (also a one-way ledge)                    |
| `>`  | Conveyor belt, pushing right                                          |
| `^`  | Floor spikes — fatal (only the bottom 5 px of the cell)               |
| `v`  | Ceiling spikes — fatal (only the top 5 px)                            |
| `~`  | Something wet — fatal                                                 |
| `*`  | Unpleasantness — a small static hazard                                |
| `!`  | Lever — touch it and the room's hatches swap over                     |
| `[`  | Hatch — a ledge, there until the lever is pulled                      |
| `]`  | Hatch — a ledge, not there until the lever is pulled                  |
| `,`  | Decoration — the theme's first decorative shape, never solid          |
| `:`  | Decoration — the theme's second decorative shape, never solid         |
| `B`  | Brass gate — solid until you are carrying the brass key               |
| `S`  | Silver gate                                                           |
| `I`  | Iron gate                                                             |
| `C`  | Copper gate                                                           |

### 3. Exits, spawns and the map

- `grid` is the room's cell on the map of the house. It must be free, and it must
  be adjacent to each neighbour in the right direction.
- `exits` names the neighbouring room in each direction. **Every exit must be
  reciprocated**: if your room's `left` is `hat-attic`, then `hat-attic`'s
  `right` must be your room.
- `spawns` is where the player appears, keyed by **the edge they came in
  through**. If your room has a `left` exit, it needs a `left` spawn, because
  that is where the player will arrive coming back. Add `start` too if the game
  is going to begin there.
- **An edge with no exit must be sealed.** No exit to the left means column 0 is
  solid all the way down. No exit downwards means row 19 blocks falling.
- **An edge with an exit must have a way through it** — a gap in the wall, or a
  hole in the floor or ceiling.
- **Vertical holes must line up.** If your floor has a hole at columns 14–15,
  the ceiling of the room below must have its hole at columns 14–15 too.

Spawn coordinates are the top-left of the player's 8×16 box. Standing on the
floor at row 19 means `y: 136`. A comfortable side entry is `x: 2` on the left
and `x: 246` on the right.

### 4. Laying out a room that can actually be climbed

- A jump clears **four rows (32 px)**, so put ledges **three rows apart** for a
  comfortable climb and four for a hard one. Five is impossible.
- A standing jump crosses about **48 px** horizontally at the same height, but
  that is the absolute limit and needs a frame-perfect launch. Keep same-height
  gaps to **40 px (five tiles) or less**.
- Entering from above, the player arrives falling at the `up` spawn. Make sure
  something catches them within 72 px, or the landing is fatal.

**Mind the headroom.** This is the rule that is easiest to get wrong, because
the room looks fine. A jump only reaches its full height if there is nothing
above the player's head. Standing on a ledge at row 4 with a solid ceiling at
row 0, the player's head hits that ceiling after eight pixels, and their feet
get no higher than the top of row 3.

So a ledge at row 2 is unreachable, however close it looks. And a ledge at row 3
is _worse than unreachable_: the feet arrive at exactly its surface, so it can
be landed on for one simulation step, from one launch position, if everything
lines up. It looks possible, plays as impossible, and passes a naive check.
**Under a solid ceiling, row 4 is the highest ledge worth putting anywhere.**

**Rooms with an `up` exit** have a shape that works, and it is worth copying:

- Put the top ledge at **row 4**, spanning the columns of the ceiling hole.
  Standing on it under the hole, a straight-up jump goes clear out of the room,
  because there is no ceiling in the way.
- Put a ledge **directly below it at row 7**, sharing some columns, so the
  climb up to it is an ordinary three-row jump.
- Do not put a ledge inside the ceiling hole itself. Dropping in from the room
  above lands you on it, walled in on both sides, with no way down: platforms
  are one-way, so you cannot drop through.

### 4a. Every doorway has to work on its own

A room is not playable because _some_ way in leads everywhere. It is playable
when **every** way in does. It is very easy to build a room that works
beautifully when you fall into it through the ceiling, and is a one-way trap
when you walk in from the side — the ledge you need is reachable from above and
from nowhere else.

`tests/reachability.test.ts` checks this for you, per entrance, by running the
real movement model. If it says a room is broken, it is broken.

### 5. Enemies

`id` must be unique across the whole house. `sprite` must be one of the names in
`ENEMY_SPRITES` (`bowler`, `teapot`, `fork`, `eyeball`, `ghost`, `wasp`, `book`,
`flask`, `cog`, `moth`, `duck`, `mouse`, `candle`, `spark`, `fern`). All are 8×8.

| `type`         | Fields                                           | Behaviour                                           |
| -------------- | ------------------------------------------------ | --------------------------------------------------- |
| `patrol-h`     | `y`, `from`, `to`, `speed`, `phase?`             | Back and forth horizontally, `speed` in px/s        |
| `patrol-v`     | `x`, `from`, `to`, `speed`, `phase?`             | Back and forth vertically                           |
| `circle`       | `cx`, `cy`, `radius`, `speed`, `phase?`          | Round a circle, `speed` in deg/s; negative reverses |
| `pendulum`     | `cx`, `cy`, `length`, `arc`, `speed`, `phase?`   | Swings under a pivot, `arc` degrees total           |
| `waypoint`     | `points`, `speed`, `phase?`                      | Walks a closed loop of points at `speed` px/s       |
| `figure-eight` | `cx`, `cy`, `width`, `height`, `speed`, `phase?` | A 1:2 Lissajous: once across for twice up and down  |
| `static`       | `x`, `y`                                         | Sits there being lethal                             |

`phase` is 0–1 and shifts an enemy along its cycle, which is how you get two
enemies on the same path to stay out of step.

Coordinates are the sprite's top-left, except `circle`, `pendulum` and
`figure-eight`, where `cx`/`cy` is the centre of the path. A `waypoint` path
uses top-left coordinates, because a two-point waypoint path is exactly a
patrol and it would be strange for the two to disagree. The tests check that enemies stay inside
the room.

### 6. Collectables

```json
{ "id": "cupboard-boot", "sprite": "boot", "x": 80, "y": 24 }
```

Add `"opens"` to make it a key:

```json
{ "id": "cupboard-key", "sprite": "key", "x": 80, "y": 24, "opens": "brass" }
```

`id` must be unique across the house — prefixing it with the room name is a good
habit. `x` and `y` should be multiples of 8. Sprites are 8×8, drawn as a single
flashing colour: `teacup`, `key`, `umbrella`, `monocle`, `biscuit`,
`candlestick`, `bell`, `boot`, `spectacles`, `pipe`, `pocketwatch`, `crown`,
`jar`, `gramophone`.

The total is counted from the data, so the HUD and the win condition update on
their own. Adding a collectable changes `37` to `38` everywhere with no other
edits.

Keys do not flash through the palette like the other collectables. They are
drawn in their own lock's colour, pulsing gently between its two inks, because
which gate a key fits has to be obvious from across the room.

### 5a. Lifts

A lift is a ledge that moves. Where it is depends only on how long you have
been in the room, exactly like an enemy, so it snaps back to the start every
time you enter or die and stays as learnable as everything else.

```json
"lifts": [
  { "id": "boiler-hoist", "points": [{ "x": 16, "y": 128 }, { "x": 16, "y": 64 }],
    "speed": 24, "width": 16 }
]
```

There is one movement type rather than several, because a closed loop of points
already covers all of them: two points is a straight run, up and down or side to
side, and more than two is a circuit. `points` are the platform's top-left.

**A lift is a one-way platform, never a solid.** You jump up through it and land
on top, and it can never crush you against a ceiling — the failure mode that
makes moving solids miserable to get right is simply absent. Stand on one and it
carries you, sweeping you against walls rather than posting you through them.

A lift that runs straight up and down is drawn hanging from a chain that reaches
the ceiling, so it reads as a hoist rather than as a slab of machinery floating
in mid-air. Its links are spaced from the deck rather than from the ceiling, so
they travel with the lift and it looks winched — which is also the only
animation such a lift can have, since the deck itself must not appear to move
relative to the feet standing on it.

Lifts ignore the tile grid, so nothing stops a badly placed one gliding through
a wall, or its chain being drawn up through one. `tests/rooms.test.ts` samples
the whole circuit and the whole shaft above it, and fails if either happens.

What those checks look at is **solid**, though, and a ledge is not solid. A lift
that glides through a beam, or a chain drawn down through one, passes every test
in the suite and still looks like a mistake. The same is true of a rope hung
through a ledge. Nothing enforces it, so it is worth an eye — the quickest check
is to sample the circuit or the sweep against the tile grid and look for any cell
that is not air.

**Keep a lift out of any column the player can fall through.** This is the one
placement mistake that reports itself as something else entirely, so it is worth
knowing about before it happens rather than afterwards.

A room with a lift in it is explored several times over, from evenly spaced
moments in the lift's cycle, and only what _every_ one of those runs can reach
counts. A lift passing under a hole in the floor therefore catches a player
dropping through it on some of the runs and not others — and that hole is the
room's `down` exit. In the runs where the lift caught them, the exit is not
reachable; it drops out of the intersection; and the room fails a reachability
test that says nothing whatsoever about lifts and points at the doorway instead.

### 5b. Levers and hatches

A hatch is a ledge that is only there while the room's switch is one way round,
and touching a lever swaps it over. `[` hatches start there, `]` hatches start
absent, so one lever can take a floor away and put another one down.

The switch is **room-local and reset on entry**. It can never become hidden
state that follows the player round the house, and no arrangement of it survives
a death, so it can never leave the game in a position a fresh visit cannot undo.

Hatches are ledges rather than walls, deliberately: a one-way platform cannot
wall a player in, and cannot block a climb that was working before.

The reachability solver knows about them. Which way the switch is round is part
of a _spot_, not a detail of it — reaching a ledge with the hatches one way is a
different situation from reaching it with them the other, and treating the two as
the same would let the solver stitch a route together out of halves that never
existed at the same moment.

### 5c. Ropes

```json
"ropes": [{ "id": "hall-rope", "cx": 216, "cy": 16, "length": 52, "arc": 50, "speed": 45 }]
```

A rope hangs from a pivot and swings — the same shape as a pendulum enemy,
because it is one; the difference is that this one you hold on to rather than
die of. Jump at it and you catch it wherever your hands met it, and hang from
there. Press jump again to let go.

**Letting go does not fling you**, and that is the whole design of it. The game
has no momentum anywhere else and it does not get any here: you leave from
wherever the rope had carried you to, with exactly the jump you would get off
the floor. A rope adds reach and timing, not physics.

**Nothing in the house may depend on a rope**, and that guarantee comes free
rather than by anybody remembering it. The reachability solver holds one input
for a whole attempt, so it cannot do the "hang on, and let go at the right
moment" that a rope needs — which means it proves every room navigable without
using them. A rope is always a shortcut, never the only way.

### 6a. Teleport cupboards

```json
"teleports": [{ "id": "roof-cupboard", "x": 160, "y": 48, "to": "cellar-cupboard" }]
```

Cupboards come in pairs, each naming the other, and the tests check both that
the pairing is mutual and that **each end is somewhere the player could already
stand** — so coming out of one is never more dangerous than walking in through
the door. Stepping out of a cupboard does not immediately step you back into it.

### 6b. Keys and gates

A gate is a tile that is solid until you are carrying its key, and plain air the
moment you are. There are four colours — `brass`, `silver`, `iron`, `copper` —
written in the grid as `B`, `S`, `I` and `C`, and drawn in that colour in every
room, so a brass gate is recognisably the brass gate wherever you meet it.

**A key is an ordinary collectable with one extra field.** It counts towards the
thirty-seven like everything else, and which keys you are carrying is worked out
from the items you have collected rather than stored, so adding keys needed no
change at all to the save format and every save written before they existed
still loads.

**Keys are never spent.** Picking one up opens every gate of that colour in the
house, for good. That is deliberate: a key you can use up is a key you can use
on the wrong door, and then the game is over without saying so.

Gates work by the same trick crumbling floors already used. `Room.charAt()`
returns air for a cell that has collapsed; it now also returns air for a gate
you can open. Everything downstream — `solidAt`, the swept collision, the
reachability solver — gets the new behaviour without knowing locks exist.

Where a gate may go:

- **Never on an edge row or column.** A gate stops being solid, so it must never
  be the thing sealing an edge the room is supposed to seal.
- **From something solid to something solid.** A gate with a gap above it can be
  jumped over; one with a gap below can be walked under. Run it wall to wall.
- **Not in a column you can fall through.** Otherwise a player dropping in from
  the room above lands on top of a locked gate, in mid-air, with nowhere to go.
- **Not where a spawn point is**, which the spawn tests already catch, because a
  fresh `Room` holds no keys and every gate in it is solid.

`tests/rooms.test.ts` checks all of these. `tests/progression.test.ts` checks the
much more important thing: that the house can still be finished.

### 6c. Not painting yourself into a corner

Locks introduce a way to break the game that no per-room check can see. Every
room can be well formed, every exit reciprocal, every ledge reachable — and the
game still unfinishable, because the iron key is behind the iron gate.

`tests/progression.test.ts` settles it by running a fixpoint. Start at the front
door with nothing. Walk the house, room by room and doorway by doorway, using
the real movement model. Take everything you can reach. If that got you a key,
go round again. Keys are never spent, so the set only grows and the loop always
finishes. When it does, everything must be collectable and the front door
reachable, or the build fails.

It also checks the nastier half, which is easy to miss: **every room you can get
into, you can get out of again, the way you came.** A gate on the wrong side of
a doorway makes a room that swallows the player, and dying does not help, because
a death puts them back at the same doorway. That check runs for the clumsy player
too.

### 7. Themes

Pick one of the nineteen in `src/assets/themes.ts` — `hall`, `library`, `attic`,
`boiler`, `conservatory`, `clock`, `corridor`, `laboratory`, `roof`, `cellar`,
`gallery`, `kitchen`, `billiards`, `landing`, `chimney`, `scullery`, `organ`,
`bathroom`, `aviary` — or add your own. A theme chooses
the wall and ledge shapes, the two decorative shapes, and the inks for all of
them.

### 8. Check it

```bash
npm test
```

`tests/rooms.test.ts` is the contract. It checks the grid size and characters,
that exits are reciprocal and agree with the map, that unexited edges are sealed
and exited ones are not, that vertical holes line up, that spawns are not inside
walls or hazards, that items are reachable and uniquely named, that enemies stay
in the room, and that the whole house is still reachable on foot from the start
room. A broken room fails the build.

---

## Testing

```bash
npm test
```

604 tests, in a plain Node environment — no browser, no canvas, no Phaser.

| File                         | Covers                                                                                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/collision.test.ts`    | Sweeps, one-way platforms, hazard rectangles, tunnelling                                                                                                                |
| `tests/player.test.ts`       | Walking, jump height, coyote time, jump buffer, fatal falls, conveyors, crumbling floors, room edges                                                                    |
| `tests/enemy.test.ts`        | Each movement type, its bounds, its period, and its determinism                                                                                                         |
| `tests/rooms.test.ts`        | The whole house: structure, connectivity, spawns, items, enemies                                                                                                        |
| `tests/reachability.test.ts` | Whether the house is actually _playable_: the real movement model run from every doorway, at full ability and again for a player who cannot quite manage a perfect jump |
| `tests/progression.test.ts`  | Whether the house can still be _finished_: keys and gates worked through from nothing, and no room you can walk into and not walk out of                                |
| `tests/gamestate.test.ts`    | Collecting, lives, win condition, snapshots, rooms seen, the clock                                                                                                      |
| `tests/save.test.ts`         | Round trips, corrupt saves, saves written before the map existed, no storage, storage that throws                                                                       |
| `tests/map.test.ts`          | That every room gets a cell on the map, on screen, in the right place                                                                                                   |
| `tests/input.test.ts`        | What may be rebound and what may not, that a change sticks, and that a corrupt binding falls back rather than making an action unpressable                              |
| `tests/font.test.ts`         | Every glyph and every piece of artwork is the size it claims                                                                                                            |

The tests are there to catch real mistakes — a room you cannot get out of, a
jump that no longer reaches, a save that crashes the title screen — not to
inflate a number.

---

## Configuration

Every tunable number lives in `src/config.ts`: player speed, jump velocity,
gravity, terminal velocity, fatal fall distance, coyote time, jump buffer,
starting lives, conveyor speed, crumble lifetime, logical resolution, tile size,
audio volume and the localStorage keys. Nothing is hard-coded anywhere else.

## Debug mode

Off unless you ask for it, so it never appears during an ordinary game.

```
http://localhost:5173/?debug=1
```

or build with `VITE_DEBUG=1`. It draws collision boxes for solid tiles,
platforms, hazards, the player, enemies and items; marks spawn points and the
edges that lead somewhere; and prints the room id, player position and velocity,
grounded state, fall distance, FPS and the current mode. It also validates the
whole house at startup and logs anything wrong to the console.

---

## What is not in here

No React, no Vue, no backend, no database, no authentication, no cloud services,
no ECS framework, and no third-party artwork, fonts or audio. Not one PNG.
Phaser draws things; the rest is a few thousand lines of plain TypeScript.

# get-set-billy
