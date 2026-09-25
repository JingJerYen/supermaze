import type { TilePos } from "./map/types.js";
import type { SeededRandom } from "./random/seeded.js";
import type { PlayerId } from "./types.js";

/** One key on the map. `ownerId` is set the instant it is picked up and never changes. */
export interface KeyState {
  id: string;
  pos: TilePos;
  ownerId: PlayerId | null;
}

/**
 * Choose `count` distinct spawn tiles from the map's author-verified candidates
 * using the round seed (CLAUDE.md section 6). Throws when the map does not
 * offer enough candidates; the validator should have caught that earlier.
 */
export function selectKeySpawns(rng: SeededRandom, candidates: readonly TilePos[], count: number): TilePos[] {
  if (candidates.length < count) {
    throw new Error(`map offers ${candidates.length} key spawns but ${count} are needed`);
  }
  return rng.shuffle([...candidates]).slice(0, count);
}

export function createKeys(positions: readonly TilePos[], startIndex = 0): Record<string, KeyState> {
  const keys: Record<string, KeyState> = {};
  positions.forEach((pos, i) => {
    const id = `k${startIndex + i}`;
    keys[id] = { id, pos, ownerId: null };
  });
  return keys;
}

/** The unowned key sitting exactly on `tile` (same layer), if any. */
export function unownedKeyAt(keys: Record<string, KeyState>, tile: TilePos): KeyState | undefined {
  for (const k of Object.values(keys)) {
    if (k.ownerId === null && k.pos.x === tile.x && k.pos.y === tile.y && k.pos.layer === tile.layer) return k;
  }
  return undefined;
}
