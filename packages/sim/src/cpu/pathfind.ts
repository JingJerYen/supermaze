import { ALL_DIRS, tileKey, type MapGrid } from "../map/grid.js";
import type { TilePos } from "../map/types.js";
import type { MoveFilter } from "../movement.js";

/**
 * Breadth-first shortest path over legal moves (stairs change layer, bridges
 * keep it) from `start` to the nearest tile satisfying `isGoal`. Returns the
 * tiles to step through, start excluded and goal included; an empty array when
 * already there; null when nothing satisfying `isGoal` is reachable. `allow`
 * vetoes steps the way the mover does (obstacles, one-way doors).
 */
export function shortestPath(
  grid: MapGrid,
  start: TilePos,
  isGoal: (t: TilePos) => boolean,
  allow?: MoveFilter,
  maxNodes = 20000,
): TilePos[] | null {
  if (isGoal(start)) return [];
  const startKey = tileKey(start.x, start.y, start.layer);
  const parent = new Map<string, { tile: TilePos; prev: string | null }>([[startKey, { tile: start, prev: null }]]);
  const queue: TilePos[] = [start];
  let head = 0;
  while (head < queue.length && parent.size < maxNodes) {
    const cur = queue[head++] as TilePos;
    const curKey = tileKey(cur.x, cur.y, cur.layer);
    for (const d of ALL_DIRS) {
      const next = grid.tryMove(cur, d);
      if (!next || (allow && !allow(cur, next, d))) continue;
      const key = tileKey(next.x, next.y, next.layer);
      if (parent.has(key)) continue;
      parent.set(key, { tile: next, prev: curKey });
      if (isGoal(next)) {
        const path: TilePos[] = [];
        for (let k: string | null = key; k !== null && k !== startKey; k = (parent.get(k) as { prev: string | null }).prev) {
          path.push((parent.get(k) as { tile: TilePos }).tile);
        }
        return path.reverse();
      }
      queue.push(next);
    }
  }
  return null;
}

/** Parse the keys of `MapGrid.reachableFrom` back into tiles. */
export function tilesFromKeys(keys: Iterable<string>): TilePos[] {
  const out: TilePos[] = [];
  for (const k of keys) {
    const [x, y, layer] = k.split(",");
    out.push({ x: Number(x), y: Number(y), layer: layer as TilePos["layer"] });
  }
  return out;
}
