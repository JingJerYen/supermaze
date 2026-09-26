import type { TilePos } from "./map/types.js";
import type { SeededRandom } from "./random/seeded.js";
import type { ItemKind, Tuning } from "./tuning/index.js";

/** An unopened item box on the map (CLAUDE.md section 9). */
export interface BoxState {
  id: string;
  pos: TilePos;
}

/** Draw `count` distinct box tiles from the candidates that are not in `occupied`. */
export function drawBoxTiles(
  rng: SeededRandom,
  candidates: readonly TilePos[],
  occupied: ReadonlySet<string>,
  count: number,
  strict = true,
): TilePos[] {
  const free = candidates.filter((t) => !occupied.has(tileId(t)));
  if (free.length < count && strict) {
    throw new Error(`map offers ${free.length} free item box spawns but ${count} are needed`);
  }
  // Non-strict (replacement mid-round): place as many as fit rather than crash the round.
  return rng.shuffle([...free]).slice(0, Math.min(count, free.length));
}

/** Weighted item draw from the tuning table. Kinds with weight 0 are never drawn. */
export function drawItem(rng: SeededRandom, tuning: Tuning): ItemKind {
  const kinds = Object.keys(tuning.itemBoxes.weights) as ItemKind[];
  const weights = kinds.map((k) => tuning.itemBoxes.weights[k]);
  return rng.pickWeighted(kinds, weights);
}

export function boxAt(boxes: Record<string, BoxState>, tile: TilePos): BoxState | undefined {
  for (const b of Object.values(boxes)) {
    if (b.pos.x === tile.x && b.pos.y === tile.y && b.pos.layer === tile.layer) return b;
  }
  return undefined;
}

export function tileId(t: TilePos): string {
  return `${t.x},${t.y},${t.layer}`;
}
