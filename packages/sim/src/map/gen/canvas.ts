import type { SeededRandom } from "../../random/seeded.js";

export type Cell = readonly [number, number];

/** Two-tile steps between lattice junctions. */
const STEPS: readonly Cell[] = [
  [2, 0],
  [-2, 0],
  [0, 2],
  [0, -2],
];

/**
 * A grid of map codes that starts as solid wall, for carving lattice mazes
 * (the TypeScript side of `tools/map-drafter/mapkit.py`). Junctions sit on odd
 * coordinates, so corridors are one tile wide and walls one tile thick.
 */
export class Canvas {
  readonly cx: number;
  readonly cy: number;
  private readonly g: string[][];

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.cx = Math.floor(w / 2);
    this.cy = Math.floor(h / 2);
    this.g = Array.from({ length: h }, () => Array.from({ length: w }, () => "#"));
  }

  get(x: number, y: number): string {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? (this.g[y]![x] as string) : "X";
  }

  put(x: number, y: number, c = "."): void {
    this.g[y]![x] = c;
  }

  hline(x0: number, x1: number, y: number): void {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.put(x, y);
  }

  vline(x: number, y0: number, y1: number): void {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.put(x, y);
  }

  rect(x0: number, x1: number, y0: number, y1: number): void {
    this.hline(x0, x1, y0);
    this.hline(x0, x1, y1);
    this.vline(x0, y0, y1);
    this.vline(x1, y0, y1);
  }

  /** The 3x3 tower in the middle, a one-wide plaza ring round it and a gate out of each side. */
  tower(): void {
    const { cx, cy } = this;
    this.rect(cx - 2, cx + 2, cy - 2, cy + 2);
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) this.put(x, y, "T");
    this.put(cx, cy - 3);
    this.put(cx, cy + 3);
    this.put(cx - 3, cy);
    this.put(cx + 3, cy);
  }

  /** Whether (x, y) is inside the tower and its plaza ring. */
  inPlaza(x: number, y: number): boolean {
    return Math.abs(x - this.cx) <= 2 && Math.abs(y - this.cy) <= 2;
  }

  /** Every odd junction outside the plaza, inside the outer wall. */
  junctions(): Cell[] {
    const out: Cell[] = [];
    for (let y = 1; y < this.h - 1; y += 2) for (let x = 1; x < this.w - 1; x += 2) if (!this.inPlaza(x, y)) out.push([x, y]);
    return out;
  }

  /**
   * Carve a maze over `cells`: depth first (long corridors; `bias(a, b)`
   * weights a step, e.g. to favour east-west galleries) or Prim (many short
   * branches and dead ends). Then `loops` walls between junctions are opened,
   * each adding a cycle.
   */
  maze(cells: readonly Cell[], rng: SeededRandom, opts: { algo: "dfs" | "prim"; bias?: (a: Cell, b: Cell) => number; loops: number }): void {
    const inSet = new Set(cells.map(key));
    for (const [x, y] of cells) this.put(x, y);
    const start = cells[0];
    if (!start) return;
    const seen = new Set([key(start)]);
    const open = (a: Cell, b: Cell) => this.put((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    const around = (c: Cell) => STEPS.map(([dx, dy]) => [c[0] + dx, c[1] + dy] as Cell).filter((n) => inSet.has(key(n)));

    if (opts.algo === "prim") {
      const frontier = around(start);
      while (frontier.length > 0) {
        const n = frontier.splice(rng.nextInt(0, frontier.length - 1), 1)[0] as Cell;
        if (seen.has(key(n))) continue;
        open(rng.pick(around(n).filter((m) => seen.has(key(m)))), n);
        seen.add(key(n));
        for (const m of around(n)) if (!seen.has(key(m))) frontier.push(m);
      }
    } else {
      const stack: Cell[] = [start];
      while (stack.length > 0) {
        const c = stack[stack.length - 1] as Cell;
        const next = around(c).filter((n) => !seen.has(key(n)));
        if (next.length === 0) {
          stack.pop();
          continue;
        }
        const n = opts.bias ? rng.pickWeighted(next, next.map((m) => opts.bias!(c, m))) : rng.pick(next);
        open(c, n);
        seen.add(key(n));
        stack.push(n);
      }
    }

    const shut: Cell[] = [];
    for (const a of cells) {
      for (const b of [[a[0] + 2, a[1]] as Cell, [a[0], a[1] + 2] as Cell]) {
        if (inSet.has(key(b)) && this.get((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) === "#") shut.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
      }
    }
    rng.shuffle(shut);
    for (const [x, y] of shut.slice(0, opts.loops)) this.put(x, y);
  }

  rows(): string[] {
    return this.g.map((r) => r.join(""));
  }
}

export function key(c: Cell): string {
  return `${c[0]},${c[1]}`;
}
