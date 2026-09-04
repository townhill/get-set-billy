/**
 * Checks one room, or the whole house, and draws what the solver could reach.
 *
 *   npm run check-room                              -- every room
 *   npm run check-room src/data/rooms/hat-attic.json
 *
 * `npm test` already answers whether a room works. What this adds is the map:
 * when a room is broken, seeing which ledges the solver could actually stand on
 * tells you *why* in about a second, where a failing assertion only tells you
 * that something is wrong.
 *
 * It runs the real modules rather than a copy of them, by borrowing Vite's own
 * loader. That costs nothing — Vite is already a dependency — and it means this
 * can never drift out of step with the game.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { createServer } from 'vite';

const ROOM_DIR = 'src/data/rooms';
const COLS = 32;
const ROWS = 20;
const TILE = 8;

const paint = {
  reset: '[0m',
  dim: '[2m',
  red: '[31m',
  green: '[32m',
  yellow: '[33m',
  cyan: '[36m',
};

function readRoom(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Draws the room, overlaying every cell the player can stand in with a dot.
 * A room whose ledges are covered in dots is a room that can be got around.
 */
function drawReach(data, spots) {
  const standable = new Set();
  for (const key of spots) {
    const [x, y] = key.split(',').map(Number);
    standable.add(`${Math.floor(x / TILE)},${Math.floor((y + 15) / TILE)}`);
  }

  const lines = [];
  for (let row = 0; row < ROWS; row++) {
    let line = '';
    for (let col = 0; col < COLS; col++) {
      const char = data.tiles[row][col];
      if (standable.has(`${col},${row}`)) {
        line += `${paint.green}o${paint.reset}`;
      } else if (char === '.') {
        line += `${paint.dim}.${paint.reset}`;
      } else {
        line += `${paint.cyan}${char}${paint.reset}`;
      }
    }
    lines.push(`  ${String(row).padStart(2)} ${line}`);
  }
  return lines.join('\n');
}

async function main() {
  const wanted = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
  const showMap = !process.argv.includes('--quiet');

  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  });

  let failures = 0;

  try {
    const { Room } = await server.ssrLoadModule('/src/world/Room.ts');
    const { validateRoomShape, DIRECTIONS } = await server.ssrLoadModule('/src/world/roomTypes.ts');
    const { explore, CLUMSY_TUNING } = await server.ssrLoadModule('/tests/reachability.ts');

    const paths =
      wanted.length > 0
        ? wanted.map((p) => resolve(p))
        : readdirSync(ROOM_DIR)
            .filter((f) => f.endsWith('.json'))
            .map((f) => resolve(ROOM_DIR, f));

    for (const path of paths) {
      const data = readRoom(path);
      const room = new Room(data);
      const problems = [];

      for (const issue of validateRoomShape(data)) problems.push(issue);

      const entrances = Object.keys(data.spawns);
      const allSpots = new Set();

      for (const entrance of entrances) {
        for (const [who, tuning] of [
          ['a player at full ability', undefined],
          ['a clumsy player', CLUMSY_TUNING],
        ]) {
          const found = explore(room, [entrance], tuning);
          for (const spot of found.spots) allSpots.add(spot);

          if (found.spots.size === 0) {
            problems.push(`${who} entering via "${entrance}" has nowhere to stand`);
            continue;
          }
          for (const dir of DIRECTIONS) {
            if (data.exits[dir] === undefined) continue;
            if (!found.exits.has(dir)) {
              problems.push(`${who} entering via "${entrance}" cannot get out through ${dir}`);
            }
          }
          for (const item of data.items ?? []) {
            if (!found.items.has(item.id)) {
              problems.push(`${who} entering via "${entrance}" cannot collect ${item.id}`);
            }
          }
          for (const pad of data.teleports ?? []) {
            if (!found.teleports.has(pad.id)) {
              problems.push(
                `${who} entering via "${entrance}" cannot reach the cupboard ${pad.id}`,
              );
            }
          }
          if (data.door !== undefined && !found.door) {
            problems.push(`${who} entering via "${entrance}" cannot reach the front door`);
          }
        }
      }

      const name = basename(path);
      if (problems.length === 0) {
        console.log(
          `${paint.green}PASS${paint.reset} ${name}  ${paint.dim}${data.name}${paint.reset}`,
        );
      } else {
        failures += 1;
        console.log(
          `${paint.red}FAIL${paint.reset} ${name}  ${paint.dim}${data.name}${paint.reset}`,
        );
        for (const problem of problems)
          console.log(`     ${paint.yellow}- ${problem}${paint.reset}`);
      }

      if (showMap && (problems.length > 0 || paths.length === 1)) {
        console.log(drawReach(data, allSpots));
        console.log(`     ${paint.green}o${paint.reset} = somewhere the player can stand\n`);
      }
    }
  } finally {
    await server.close();
  }

  if (failures > 0) {
    console.log(`\n${paint.red}${failures} room(s) with problems.${paint.reset}`);
    process.exitCode = 1;
  }
}

await main();
