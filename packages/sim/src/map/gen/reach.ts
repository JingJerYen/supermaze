import { FIXTURE_MARKERS, SPAWN_MARKERS } from "../cells.js";

/** A tile as "x,y,r" (road) or "x,y,w" (wall top). */
export type Spot = string;
type L = "r" | "w";

const D4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Fixture per node: none, obstacle, trap, or a door whose passage is D4[code - DOOR]. */
const NONE = 0;
const OBSTACLE = 1;
const TRAP = 2;
const DOOR = 3;

export function spot(x: number, y: number, l: L): Spot {
  return `${x},${y},${l}`;
}

export function parseSpot(s: Spot): { x: number; y: number; l: L } {
  const [x, y, l] = s.split(",");
  return { x: Number(x), y: Number(y), l: l as L };
}

/**
 * Walkability over map rows that may carry markers, mirroring MapGrid.tryMove
 * plus what fixtures do to it: an obstacle blocks its tile, a one-way door is
 * entered and left only along its arrow (traps do not block). The generator
 * uses it to keep a map fair: everything reachable has a way back to the tower,
 * and every candidate is reachable without a hammer. Nodes are (x, y, layer)
 * as one index; the terrain's moves are worked out once, fixtures can then be
 * changed (`setRaw`) and the reach recomputed cheaply.
 */
export class Terrain {
  readonly h: number;
  readonly w: number;
  private readonly raws: string[];
  private readonly fix: Uint8Array;
  /** Moves out of / into each node, as [other node, D4 index] pairs flattened. */
  private readonly out: number[][];
  private readonly into: number[][];

  constructor(rows: readonly string[]) {
    this.h = rows.length;
    this.w = rows[0]?.length ?? 0;
    this.raws = rows.flatMap((r) => [...r]);
    const n = this.w * this.h * 2;
    this.fix = new Uint8Array(n);
    this.out = Array.from({ length: n }, () => []);
    this.into = Array.from({ length: n }, () => []);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        this.noteFixture(x, y);
        for (const l of ["r", "w"] as const) {
          if (!walk(this.cell(x, y), l)) continue;
          const from = this.node(x, y, l);
          D4.forEach(([dx, dy], d) => {
            const nx = x + dx;
            const ny = y + dy;
            let nl: L = l;
            if (!walk(this.cell(nx, ny), l)) {
              if (this.cell(x, y) !== "S") return;
              nl = l === "r" ? "w" : "r";
              if (!walk(this.cell(nx, ny), nl)) return;
            }
            const to = this.node(nx, ny, nl);
            this.out[from]!.push(to, d);
            this.into[to]!.push(from, d);
          });
        }
      }
    }
  }

  raw(x: number, y: number): string {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? (this.raws[y * this.w + x] as string) : "X";
  }

  /** The plain cell code under any marker. */
  cell(x: number, y: number): string {
    const r = this.raw(x, y);
    return SPAWN_MARKERS[r]?.base ?? FIXTURE_MARKERS[r]?.base ?? r;
  }

  /** Change a tile's marker without changing what lies under it (placing or lifting a fixture). */
  setRaw(x: number, y: number, code: string): void {
    this.raws[y * this.w + x] = code;
    this.noteFixture(x, y);
  }

  private node(x: number, y: number, l: L): number {
    return (y * this.w + x) * 2 + (l === "w" ? 1 : 0);
  }

  private spotOf(node: number): Spot {
    const cell = node >> 1;
    return spot(cell % this.w, Math.floor(cell / this.w), node & 1 ? "w" : "r");
  }

  private noteFixture(x: number, y: number): void {
    const f = FIXTURE_MARKERS[this.raw(x, y)];
    const at = this.node(x, y, "r");
    this.fix[at] = this.fix[at + 1] = NONE;
    if (!f) return;
    const code = f.kind === "obstacle" ? OBSTACLE : f.kind === "trap" ? TRAP : DOOR + D4.findIndex(([dx, dy]) => dx === f.dir?.dx && dy === f.dir?.dy);
    this.fix[at + (f.base === "#" ? 1 : 0)] = code;
  }

  /** Whether the move from `a` to `b` along D4[d] is allowed with the fixtures in force. */
  private allowed(a: number, b: number, d: number): boolean {
    const ahead = this.fix[b] as number;
    const here = this.fix[a] as number;
    if (ahead === OBSTACLE) return false;
    if (ahead >= DOOR && ahead - DOOR !== d) return false;
    return !(here >= DOOR && here - DOOR !== d);
  }

  /** Where one may step from (x, y, l). */
  moves(x: number, y: number, l: L, strict: boolean): [number, number, L][] {
    const from = this.node(x, y, l);
    const adj = this.out[from]!;
    const out: [number, number, L][] = [];
    for (let i = 0; i < adj.length; i += 2) {
      const to = adj[i] as number;
      if (strict && !this.allowed(from, to, adj[i + 1] as number)) continue;
      const { x: nx, y: ny, l: nl } = parseSpot(this.spotOf(to));
      out.push([nx, ny, nl]);
    }
    return out;
  }

  /** Road tiles next to the tower: where everyone starts. */
  spawns(): Spot[] {
    return this.spawnNodes().map((n) => this.spotOf(n)).sort();
  }

  private spawnNodes(): number[] {
    const out = new Set<number>();
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.cell(x, y) !== "T") continue;
        for (const [dx, dy] of D4) if (this.cell(x + dx, y + dy) === ".") out.add(this.node(x + dx, y + dy, "r"));
      }
    }
    return [...out].sort((a, b) => a - b);
  }

  /** Steps from (or with `reverse`, to) the tower with fixtures in force, per node; -1 where it cannot. */
  private reach(reverse: boolean): Int32Array {
    const d = new Int32Array(this.w * this.h * 2).fill(-1);
    const queue = this.spawnNodes();
    for (const s of queue) d[s] = 0;
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i] as number;
      const adj = (reverse ? this.into : this.out)[p]!;
      for (let j = 0; j < adj.length; j += 2) {
        const q = adj[j] as number;
        if (d[q] !== -1 || !(reverse ? this.allowed(q, p, adj[j + 1] as number) : this.allowed(p, q, adj[j + 1] as number))) continue;
        d[q] = (d[p] as number) + 1;
        queue.push(q);
      }
    }
    return d;
  }

  /** Steps from the tower per node with fixtures in force, or null when something reachable has no way back. */
  fairReach(): Int32Array | null {
    const fwd = this.reach(false);
    const back = this.reach(true);
    for (let i = 0; i < fwd.length; i++) if (fwd[i] !== -1 && back[i] === -1) return null;
    return fwd;
  }

  /** `fairReach` keyed by spot. */
  fairSteps(): Map<Spot, number> | null {
    const fwd = this.fairReach();
    if (!fwd) return null;
    const out = new Map<Spot, number>();
    fwd.forEach((s, i) => {
      if (s !== -1) out.set(this.spotOf(i), s);
    });
    return out;
  }
}

function walk(c: string, l: L): boolean {
  return (c === "." && l === "r") || (c === "#" && l === "w") || c === "S" || c === "=";
}
