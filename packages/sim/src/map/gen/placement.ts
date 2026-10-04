import type { SeededRandom } from "../../random/seeded.js";
import type { Cell } from "./canvas.js";
import { parseSpot, Terrain, type Spot } from "./reach.js";

type Grid = string[][];

const D4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const DOOR_CHAR: Record<string, string> = { "0,-1": "^", "0,1": "v", "-1,0": "<", "1,0": ">" };
/** Unfair spots tried per fixture kind before settling for fewer: each try is a whole-map reach check. */
const MAX_MISSES = 40;
/** Keys sit at least this share of the longest walk from the tower. */
const KEY_DEPTH = 0.5;
const rowsOf = (g: Grid) => g.map((r) => r.join(""));
const manhattan = (a: Cell, b: Cell) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

/**
 * Doors, obstacles and traps on straight one-wide corridors away from the
 * tower, at least `gap` apart. A door or obstacle stays only if the map is
 * still fair afterwards: nothing that was reachable is lost and everything
 * reachable has a way back, so an obstacle only ever blocks a shortcut.
 * Fewer are placed when no fair spot turns up.
 */
export function placeFixtures(g: Grid, rng: SeededRandom, counts: { doors: number; obstacles: number; traps: number }, centre: Cell, clear: number, gap = 6): void {
  const t = new Terrain(rowsOf(g));
  const cells: { c: Cell; axis: readonly [number, number] }[] = [];
  for (let y = 1; y < t.h - 1; y++) {
    for (let x = 1; x < t.w - 1; x++) {
      if (t.raw(x, y) !== "." || Math.max(Math.abs(x - centre[0]), Math.abs(y - centre[1])) <= clear) continue;
      const open = D4.filter(([dx, dy]) => t.raw(x + dx, y + dy) === ".");
      const walls = D4.filter(([dx, dy]) => t.raw(x + dx, y + dy) === "#");
      if (open.length === 2 && walls.length === 2 && open[0]![0] === -open[1]![0] && open[0]![1] === -open[1]![1]) cells.push({ c: [x, y], axis: open[0]! });
    }
  }
  rng.shuffle(cells);
  const base = t.fairReach();
  if (!base) return;
  const placed: Cell[] = [];
  for (const [kind, n] of [
    ["door", counts.doors],
    ["obstacle", counts.obstacles],
    ["trap", counts.traps],
  ] as const) {
    let count = 0;
    let misses = 0;
    for (const { c, axis } of cells) {
      if (count >= n || misses > MAX_MISSES) break;
      const [x, y] = c;
      if (g[y]![x] !== "." || !placed.every((p) => manhattan(p, c) >= gap)) continue;
      const flip = kind === "door" && rng.next() < 0.5 ? -1 : 1;
      const code = kind === "trap" ? "A" : kind === "obstacle" ? "O" : (DOOR_CHAR[`${axis[0] * flip},${axis[1] * flip}`] as string);
      t.setRaw(x, y, code);
      if (kind !== "trap" && !keepsReach(base, t.fairReach(), (y * t.w + x) * 2)) {
        t.setRaw(x, y, ".");
        misses++;
        continue;
      }
      g[y]![x] = code;
      placed.push(c);
      count++;
    }
  }
}

/** Whether everything reachable `before` still is, bar the road node `except` the fixture stands on. */
function keepsReach(before: Int32Array, after: Int32Array | null, except: number): boolean {
  if (!after) return false;
  for (let i = 0; i < before.length; i++) if (i !== except && before[i] !== -1 && after[i] === -1) return false;
  return true;
}

export interface CandidateCounts {
  /** Keys on wall tops; the rest are on the road. */
  topKeys: number;
  keys: number;
  boxes: number;
  topBoxes: number;
  switches: number;
}

/**
 * Key, item-box and switch markers on a finished terrain (the TypeScript side
 * of the drafter's `auto_candidates`): keys on the dead ends that take longest
 * to walk to with the fixtures in force (the far half of the map), spread out
 * and capped per quarter;
 * boxes and switches spread along corridors, as many as fit. Whether that is
 * enough is the validator's call. False when the terrain itself is not fair.
 */
export function placeCandidates(g: Grid, rng: SeededRandom, n: CandidateCounts): boolean {
  const t = new Terrain(rowsOf(g));
  const steps = t.fairSteps();
  if (!steps) return false;
  const cx = Math.floor(t.w / 2);
  const cy = Math.floor(t.h / 2);
  const entries = new Set(t.spawns());
  const free = (x: number, y: number) =>
    x > 0 && y > 0 && x < t.w - 1 && y < t.h - 1 && ".#".includes(t.raw(x, y)) && !entries.has(`${x},${y},r`) && !D4.some(([dx, dy]) => t.cell(x + dx, y + dy) === "T");
  const degree = (s: Spot) => {
    const { x, y, l } = parseSpot(s);
    return [...t.moves(x, y, l, true)].length;
  };
  const tiles = [...steps.keys()].sort().map((s) => ({ s, ...parseSpot(s) })).filter((p) => free(p.x, p.y) && t.cell(p.x, p.y) === (p.l === "r" ? "." : "#"));
  const road = tiles.filter((p) => p.l === "r");
  const top = tiles.filter((p) => p.l === "w");
  const far = (p: { s: Spot }) => steps.get(p.s) as number;
  const deepest = Math.max(0, ...tiles.map(far));
  // Keys go on dead ends in the far part of the map; with too few of those, on any far tile, then anywhere.
  const keyPool = (list: typeof tiles, need: number) => {
    const deep = list.filter((p) => far(p) >= deepest * KEY_DEPTH);
    const deadDeep = deep.filter((p) => degree(p.s) === 1);
    return deadDeep.length >= need * 2 ? deadDeep : deep.length >= need * 2 ? deep : list;
  };
  const quad = (c: Cell) => `${c[0] > cx},${c[1] > cy}`;

  const taken: Cell[] = [];
  const pick = (pool: typeof tiles, count: number, gap: number, score: (p: (typeof tiles)[number]) => number, takenGap: number, quadCap?: number): Cell[] => {
    const out: Cell[] = [];
    for (const p of [...pool].sort((a, b) => score(b) - score(a))) {
      if (out.length >= count) break;
      const c: Cell = [p.x, p.y];
      if (quadCap !== undefined && [...out, ...taken].filter((q) => quad(q) === quad(c)).length >= quadCap) continue;
      if (out.every((q) => manhattan(q, c) >= gap) && taken.every((q) => manhattan(q, c) >= takenGap)) out.push(c);
    }
    taken.push(...out);
    return out;
  };

  const topKeys = pick(keyPool(top, n.topKeys), n.topKeys, 7, far, 7, 2);
  const roadKeys = pick(keyPool(road, n.keys - topKeys.length), n.keys - topKeys.length, 7, far, 7, 3);
  const corridor = road.filter((p) => degree(p.s) === 2);
  const random = new Map(tiles.map((p) => [p.s, rng.next()]));
  const shuffle = (p: { s: Spot }) => random.get(p.s) as number;
  const boxes = pick(corridor, n.boxes, 5, shuffle, 3);
  const topBoxes = pick(top, n.topBoxes, 8, shuffle, 3);
  const switches = pick(
    corridor.filter((p) => D4.some(([dx, dy]) => t.cell(p.x + dx, p.y + dy) === "#")),
    n.switches,
    12,
    shuffle,
    2,
  );
  for (const [x, y] of topKeys) g[y]![x] = "k";
  for (const [x, y] of roadKeys) g[y]![x] = "K";
  for (const [x, y] of boxes) g[y]![x] = "B";
  for (const [x, y] of topBoxes) g[y]![x] = "b";
  for (const [x, y] of switches) g[y]![x] = "L";
  return true;
}
