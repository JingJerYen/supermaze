import { SeededRandom } from "../../random/seeded.js";
import { DEFAULT_TUNING, type Tuning } from "../../tuning/index.js";
import type { MapData } from "../types.js";
import { validateMap } from "../validate.js";
import { Canvas, type Cell } from "./canvas.js";
import { placeCandidates, placeFixtures } from "./placement.js";
import { addBridges, addStairs } from "./structures.js";

export interface GenerateOptions {
  /** Odd sizes three more than a multiple of four (31, 35, 39, 43...), so the tower sits on the lattice. */
  width: number;
  height: number;
  /** Round length for two participants, as in a map file. */
  timeLimitSec: number;
  theme?: string;
  traps: number;
  obstacles: number;
  doors: number;
}

/** Tries before giving up; a map fails only when the validator finds too few places for something. */
const ATTEMPTS = 24;

/**
 * A hard map made on the spot from a seed (CLAUDE.md sections 4.1 and 6: the
 * tower run's floors past the table). The same seed always gives the same map.
 * A lattice maze in one of a few styles (long corridors, east-west galleries,
 * north-south galleries, many short branches; sometimes a road round the
 * edge), then bridges between wall tops, stairs onto every wall region, fair
 * fixtures and the spawn candidates, the farthest dead ends holding the keys.
 * Every map passes the same validator as the hand-made ones; a draw that does
 * not is redrawn from the next seed.
 */
export function generateMap(seed: number, opts: GenerateOptions, tuning: Tuning = DEFAULT_TUNING): MapData {
  for (let i = 0; i < ATTEMPTS; i++) {
    const map = draw((seed + Math.imul(i, 0x9e3779b1)) >>> 0, opts, `gen-${(seed >>> 0).toString(36)}`);
    if (map && validateMap(map, tuning).length === 0) return map;
  }
  throw new Error(`no valid map for seed ${seed}`);
}

function draw(seed: number, opts: GenerateOptions, id: string): MapData | null {
  const rng = new SeededRandom(seed);
  const c = new Canvas(opts.width, opts.height);
  const area = opts.width * opts.height;
  const style = rng.nextInt(0, 3);
  const bias =
    style === 1 ? (a: Cell, b: Cell) => (a[1] === b[1] ? 8 : 1) : style === 2 ? (a: Cell, b: Cell) => (a[0] === b[0] ? 8 : 1) : undefined;
  const cells = rng.shuffle(c.junctions());
  c.maze(cells, rng, { algo: style === 3 ? "prim" : "dfs", ...(bias ? { bias } : {}), loops: Math.round(area / (style === 3 ? 160 : 120)) });
  if (rng.next() < 0.2) c.rect(1, c.w - 2, 1, c.h - 2);
  c.tower();

  const g = c.rows().map((r) => [...r]);
  const centre: Cell = [c.cx, c.cy];
  addBridges(g, rng, Math.max(2, Math.round(area / 450)), centre, 3);
  addStairs(g, rng, Math.max(3, Math.round(area / 220)), centre, 3);
  placeFixtures(g, rng, { doors: opts.doors, obstacles: opts.obstacles, traps: opts.traps }, centre, 4);
  if (!placeCandidates(g, rng, { keys: 10, topKeys: 4, boxes: 18, topBoxes: 3, switches: 6 })) return null;

  return {
    id,
    name: "Generated",
    theme: opts.theme ?? "stone",
    difficulty: "hard",
    supportedParticipants: [2, 3, 4, 5, 6],
    plazaRadius: 1,
    timeLimitSec: opts.timeLimitSec,
    lightSwitchCount: 4,
    itemBoxCount: 12,
    rows: g.map((r) => r.join("")),
  };
}
