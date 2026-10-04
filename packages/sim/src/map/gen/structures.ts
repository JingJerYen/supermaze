import type { SeededRandom } from "../../random/seeded.js";
import type { Cell } from "./canvas.js";
import { key } from "./canvas.js";

const D4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

type Grid = string[][];

const at = (g: Grid, x: number, y: number) => g[y]?.[x] ?? "X";
const manhattan = (a: Cell, b: Cell) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const roadish = (c: string) => c === "." || c === "S" || c === "=";

/** Connected wall-top regions (walls and bridges), as a region id per "x,y" and each region's size. */
function wallRegions(g: Grid): { id: Map<string, number>; size: Map<number, number> } {
  const id = new Map<string, number>();
  const size = new Map<number, number>();
  let n = 0;
  for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < (g[0]?.length ?? 0); x++) {
      if (!"#=".includes(at(g, x, y)) || id.has(key([x, y]))) continue;
      n++;
      id.set(key([x, y]), n);
      const queue: Cell[] = [[x, y]];
      for (let i = 0; i < queue.length; i++) {
        const [a, b] = queue[i] as Cell;
        for (const [dx, dy] of D4) {
          const m: Cell = [a + dx, b + dy];
          if ("#=".includes(at(g, m[0], m[1])) && !id.has(key(m))) {
            id.set(key(m), n);
            queue.push(m);
          }
        }
      }
      size.set(n, queue.length);
    }
  }
  return { id, size };
}

/**
 * Bridges over straight one-wide corridors, joining the wall tops on either
 * side; a bridge between two separate wall regions comes first. At least
 * `gap` tiles apart, never in the tower's neighbourhood (`clear` from the centre).
 */
export function addBridges(g: Grid, rng: SeededRandom, count: number, centre: Cell, clear: number, gap = 8): void {
  const { id } = wallRegions(g);
  const spots: { c: Cell; joins: boolean; r: number }[] = [];
  for (let y = 1; y < g.length - 1; y++) {
    for (let x = 1; x < (g[0]?.length ?? 0) - 1; x++) {
      if (at(g, x, y) !== "." || Math.max(Math.abs(x - centre[0]), Math.abs(y - centre[1])) <= clear) continue;
      if (D4.some(([dx, dy]) => "S=".includes(at(g, x + dx, y + dy)))) continue;
      for (const [ax, ay] of [
        [1, 0],
        [0, 1],
      ] as const) {
        const walls = at(g, x + ax, y + ay) === "#" && at(g, x - ax, y - ay) === "#";
        const road = roadish(at(g, x + ay, y + ax)) && roadish(at(g, x - ay, y - ax));
        if (walls && road) {
          const joins = id.get(key([x + ax, y + ay])) !== id.get(key([x - ax, y - ay]));
          spots.push({ c: [x, y], joins, r: rng.next() });
        }
      }
    }
  }
  spots.sort((a, b) => Number(b.joins) - Number(a.joins) || a.r - b.r);
  const chosen: Cell[] = [];
  for (const s of spots) {
    if (chosen.length >= count) break;
    if (chosen.every((c) => manhattan(c, s.c) >= gap)) chosen.push(s.c);
  }
  for (const [x, y] of chosen) g[y]![x] = "=";
}

/**
 * Stairs up onto the wall tops: one onto every wall region of at least
 * `minRegion` tiles, then more spread over the big regions until `count`.
 * A stairs tile is a road tile with exactly one wall beside it and road
 * opposite (the validator's rule), at least `gap` tiles from other stairs.
 */
export function addStairs(g: Grid, rng: SeededRandom, count: number, centre: Cell, clear: number, minRegion = 8, gap = 8): void {
  const { id, size } = wallRegions(g);
  const byRegion = new Map<number, Cell[]>();
  for (let y = 1; y < g.length - 1; y++) {
    for (let x = 1; x < (g[0]?.length ?? 0) - 1; x++) {
      if (at(g, x, y) !== "." || Math.max(Math.abs(x - centre[0]), Math.abs(y - centre[1])) <= clear) continue;
      const walls = D4.filter(([dx, dy]) => at(g, x + dx, y + dy) === "#");
      if (walls.length !== 1) continue;
      const [dx, dy] = walls[0]!;
      if (at(g, x - dx, y - dy) !== "." || D4.some(([ex, ey]) => "S=".includes(at(g, x + ex, y + ey)))) continue;
      const region = id.get(key([x + dx, y + dy])) as number;
      const list = byRegion.get(region);
      if (list) list.push([x, y]);
      else byRegion.set(region, [[x, y]]);
    }
  }
  const regions = [...byRegion.keys()].filter((r) => (size.get(r) ?? 0) >= minRegion).sort((a, b) => (size.get(b) ?? 0) - (size.get(a) ?? 0) || a - b);
  for (const r of regions) rng.shuffle(byRegion.get(r)!);

  const chosen: Cell[] = [];
  const far = (c: Cell) => chosen.every((q) => manhattan(q, c) >= gap && Math.max(Math.abs(q[0] - c[0]), Math.abs(q[1] - c[1])) > 1);
  for (const r of regions) {
    const pick = byRegion.get(r)!.find(far);
    if (pick && chosen.length < count) chosen.push(pick);
  }
  const big = rng.shuffle(regions.filter((r) => (size.get(r) ?? 0) >= minRegion * 5).flatMap((r) => byRegion.get(r)!));
  for (const c of big) {
    if (chosen.length >= count) break;
    if (far(c)) chosen.push(c);
  }
  for (const [x, y] of chosen) g[y]![x] = "S";
}
