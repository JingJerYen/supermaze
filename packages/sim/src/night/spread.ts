import { ALL_DIRS, tileKey, type MapGrid } from "../map/grid.js";
import type { TilePos } from "../map/types.js";
import type { SeededRandom } from "../random/seeded.js";

/** Path steps from `from` to every tile reachable from it, keyed by `tileKey`. */
export function stepsFrom(grid: MapGrid, from: TilePos): Map<string, { tile: TilePos; steps: number }> {
  const out = new Map<string, { tile: TilePos; steps: number }>([[tileKey(from.x, from.y, from.layer), { tile: from, steps: 0 }]]);
  const queue: TilePos[] = [from];
  while (queue.length) {
    const cur = queue.shift() as TilePos;
    const steps = (out.get(tileKey(cur.x, cur.y, cur.layer)) as { steps: number }).steps;
    for (const d of ALL_DIRS) {
      const next = grid.tryMove(cur, d);
      if (!next) continue;
      const key = tileKey(next.x, next.y, next.layer);
      if (out.has(key)) continue;
      out.set(key, { tile: next, steps: steps + 1 });
      queue.push(next);
    }
  }
  return out;
}

/**
 * Where the night parade's ghosts start (section 4.4): walkable tiles off the
 * stairs and away from the tower, at least `minSteps` from `from` when the map
 * has room, spread out by always taking the tile farthest from those already
 * taken (and from `from`). Seeded, so a replay puts them in the same places.
 */
export function ghostStartTiles(grid: MapGrid, from: TilePos, count: number, minSteps: number, rng: SeededRandom): TilePos[] {
  const all = [...stepsFrom(grid, from).values()].filter(
    ({ tile }) => tile.layer !== "towerTop" && grid.kindAt(tile.x, tile.y) !== "stairs" && !grid.isTowerEntry(tile.x, tile.y),
  );
  const far = all.filter((t) => t.steps >= minSteps);
  // A small map: the farther half will do.
  const pool = rng.shuffle((far.length >= count ? far : all.sort((a, b) => b.steps - a.steps).slice(0, Math.max(count, Math.ceil(all.length / 2)))).map((t) => t.tile));
  const chosen: TilePos[] = [];
  const dist = (a: TilePos, b: TilePos) => Math.hypot(a.x - b.x, a.y - b.y);
  while (chosen.length < count && pool.length > 0) {
    let best = 0;
    let bestGap = -1;
    pool.forEach((t, i) => {
      const gap = Math.min(dist(t, from), ...chosen.map((c) => dist(t, c)));
      if (gap > bestGap) {
        bestGap = gap;
        best = i;
      }
    });
    chosen.push(pool.splice(best, 1)[0] as TilePos);
  }
  // More ghosts than tiles (a tiny test map): they share.
  for (let i = 0; chosen.length < count && i < count; i++) chosen.push(chosen[i % Math.max(1, chosen.length)] ?? from);
  return chosen;
}

/** The candidate farthest (path steps) from `from`; the first listed on a tie. Unreachable candidates are skipped. */
export function farthestTile(grid: MapGrid, from: TilePos, candidates: readonly TilePos[]): TilePos | null {
  const steps = stepsFrom(grid, from);
  let best: TilePos | null = null;
  let bestSteps = -1;
  for (const c of candidates) {
    const s = steps.get(tileKey(c.x, c.y, c.layer))?.steps;
    if (s !== undefined && s > bestSteps) {
      best = c;
      bestSteps = s;
    }
  }
  return best;
}
