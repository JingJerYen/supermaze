import { PLATFORM_RING, cellKindFromCode, isWalkable, otherLayer, type CellKind } from "./cells.js";
import { normalizeMap } from "./normalize.js";
import type { Layer, MapData, TilePos } from "./types.js";

export interface Dir {
  dx: number;
  dy: number;
}

/** Map y grows downward (row index). North is -y. */
export const DIRS = {
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  west: { dx: -1, dy: 0 },
  east: { dx: 1, dy: 0 },
} as const satisfies Record<string, Dir>;

export const ALL_DIRS: readonly Dir[] = [DIRS.north, DIRS.south, DIRS.west, DIRS.east];

export function tileKey(x: number, y: number, layer: Layer): string {
  return `${x},${y},${layer}`;
}

/**
 * Walkability graph of a map. Enforces the two-layer topology from CLAUDE.md
 * section 6: layers only connect at stairs, and nothing else lets a player
 * change height.
 */
export class MapGrid {
  readonly width: number;
  readonly height: number;
  private readonly kinds: CellKind[];
  /** Every key / box / switch candidate tile; placeables may never sit on one (section 9). */
  private readonly candidates: ReadonlySet<string>;

  private constructor(width: number, height: number, kinds: CellKind[], candidates: ReadonlySet<string>) {
    this.width = width;
    this.height = height;
    this.kinds = kinds;
    this.candidates = candidates;
  }

  static fromMapData(raw: MapData): MapGrid {
    const data = normalizeMap(raw);
    const height = data.rows.length;
    const width = data.rows[0]?.length ?? 0;
    if (height === 0 || width === 0) throw new Error("map has no cells");
    const kinds: CellKind[] = [];
    data.rows.forEach((row, y) => {
      if (row.length !== width) throw new Error(`row ${y} has length ${row.length}, expected ${width}`);
      for (const code of row) kinds.push(cellKindFromCode(code));
    });
    const candidates = new Set(
      [...data.spawns.keys, ...data.spawns.itemBoxes, ...data.spawns.lightSwitches].map((t) => tileKey(t.x, t.y, t.layer)),
    );
    return new MapGrid(width, height, kinds, candidates);
  }

  /** Whether a tile is a spawn candidate for keys, boxes or switches. */
  isCandidateTile(x: number, y: number, layer: Layer): boolean {
    return this.candidates.has(tileKey(x, y, layer));
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  kindAt(x: number, y: number): CellKind {
    if (!this.inBounds(x, y)) return "void";
    return this.kinds[y * this.width + x] as CellKind;
  }

  isWalkable(x: number, y: number, layer: Layer): boolean {
    if (layer === "towerTop") return this.isPlatformTile(x, y);
    return isWalkable(this.kindAt(x, y), layer);
  }

  private platformBounds: { minX: number; maxX: number; minY: number; maxY: number } | null | undefined;

  /** Tower footprint expanded by PLATFORM_RING; null when the map has no tower. */
  private bounds() {
    if (this.platformBounds !== undefined) return this.platformBounds;
    const cells = this.findCells("tower");
    if (cells.length === 0) return (this.platformBounds = null);
    const xs = cells.map((c) => c.x);
    const ys = cells.map((c) => c.y);
    return (this.platformBounds = {
      minX: Math.min(...xs) - PLATFORM_RING,
      maxX: Math.max(...xs) + PLATFORM_RING,
      minY: Math.min(...ys) - PLATFORM_RING,
      maxY: Math.max(...ys) + PLATFORM_RING,
    });
  }

  /** Whether (x,y) is part of the walkable platform on top of the tower. */
  isPlatformTile(x: number, y: number): boolean {
    const b = this.bounds();
    return !!b && x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;
  }

  /** Platform tiles, centre first then outward, used to seat climbers without overlap. */
  platformTiles(): TilePos[] {
    const b = this.bounds();
    if (!b) return [];
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const out: TilePos[] = [];
    for (let y = b.minY; y <= b.maxY; y++) for (let x = b.minX; x <= b.maxX; x++) out.push({ x, y, layer: "towerTop" });
    return out.sort((p, q) => Math.hypot(p.x - cx, p.y - cy) - Math.hypot(q.x - cx, q.y - cy) || p.y - q.y || p.x - q.x);
  }

  /**
   * Attempt one step. Returns the destination tile (with its layer) or null when blocked.
   * Leaving a stairs cell is the only move that may change layer.
   */
  tryMove(from: TilePos, dir: Dir): TilePos | null {
    const x = from.x + dir.dx;
    const y = from.y + dir.dy;
    if (this.isWalkable(x, y, from.layer)) return { x, y, layer: from.layer };
    if (this.kindAt(from.x, from.y) === "stairs") {
      const layer = otherLayer(from.layer);
      if (this.isWalkable(x, y, layer)) return { x, y, layer };
    }
    return null;
  }

  /** Direction a stairs ramp rises in: toward its single adjacent wall. Null if ambiguous or not stairs. */
  stairsRiseDir(x: number, y: number): Dir | null {
    if (this.kindAt(x, y) !== "stairs") return null;
    const walls = ALL_DIRS.filter((d) => this.kindAt(x + d.dx, y + d.dy) === "wall");
    return walls.length === 1 ? (walls[0] as Dir) : null;
  }

  findCells(kind: CellKind): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.kindAt(x, y) === kind) out.push({ x, y });
      }
    }
    return out;
  }

  private entryKeys: Set<string> | null = null;

  /** Whether a road tile touches the tower footprint. Players climb from these tiles. */
  isTowerEntry(x: number, y: number): boolean {
    if (!this.entryKeys) {
      this.entryKeys = new Set(this.spawnTiles().map((t) => `${t.x},${t.y}`));
    }
    return this.entryKeys.has(`${x},${y}`);
  }

  /** Road cells touching the tower footprint, in scan order. Players start here and climb from here. */
  spawnTiles(): TilePos[] {
    const seen = new Set<string>();
    const out: TilePos[] = [];
    for (const t of this.findCells("tower")) {
      for (const d of ALL_DIRS) {
        const x = t.x + d.dx;
        const y = t.y + d.dy;
        const key = `${x},${y}`;
        if (this.kindAt(x, y) === "road" && !seen.has(key)) {
          seen.add(key);
          out.push({ x, y, layer: "road" });
        }
      }
    }
    return out;
  }

  /** Every tile reachable from `start` via legal moves. Keys are `tileKey(...)`. */
  reachableFrom(start: TilePos): Set<string> {
    const seen = new Set<string>([tileKey(start.x, start.y, start.layer)]);
    const queue: TilePos[] = [start];
    while (queue.length) {
      const cur = queue.shift() as TilePos;
      for (const d of ALL_DIRS) {
        const next = this.tryMove(cur, d);
        if (!next) continue;
        const key = tileKey(next.x, next.y, next.layer);
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push(next);
      }
    }
    return seen;
  }
}
