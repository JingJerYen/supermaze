import { DIRS, type Dir, type MapGrid } from "./map/grid.js";
import type { TilePos } from "./map/types.js";
import type { SeededRandom } from "./random/seeded.js";

/**
 * A one-shot light switch (CLAUDE.md section 8). It is used from `pos`, a road
 * tile, and drawn on the adjacent wall face given by `facing`.
 */
export interface LightSwitchState {
  id: string;
  pos: TilePos;
  /** Direction from `pos` to the wall the panel hangs on. */
  facing: Dir;
  used: boolean;
}

/** Visibility-ordered preference for the 2.5D camera: north wall reads best, south worst. */
const FACING_PRIORITY: readonly Dir[] = [DIRS.north, DIRS.east, DIRS.west, DIRS.south];

/** Pick the wall face a switch on `tile` hangs on, or null when no wall touches it. */
export function deriveSwitchFacing(grid: MapGrid, tile: TilePos): Dir | null {
  for (const d of FACING_PRIORITY) {
    if (grid.kindAt(tile.x + d.dx, tile.y + d.dy) === "wall") return d;
  }
  return null;
}

/** Draw `count` switch positions from the map's candidates and resolve their facings. */
export function createLightSwitches(
  rng: SeededRandom,
  grid: MapGrid,
  candidates: readonly TilePos[],
  count: number,
): Record<string, LightSwitchState> {
  if (candidates.length < count) {
    throw new Error(`map offers ${candidates.length} light switch spawns but ${count} are needed`);
  }
  const chosen = rng.shuffle([...candidates]).slice(0, count);
  const out: Record<string, LightSwitchState> = {};
  chosen.forEach((pos, i) => {
    const facing = deriveSwitchFacing(grid, pos);
    if (!facing) throw new Error(`light switch at (${pos.x},${pos.y}) touches no wall`);
    const id = `s${i}`;
    out[id] = { id, pos, facing, used: false };
  });
  return out;
}

/** The unused switch a player standing on `tile` can operate, if any. */
export function usableSwitchAt(switches: Record<string, LightSwitchState>, tile: TilePos): LightSwitchState | undefined {
  for (const s of Object.values(switches)) {
    if (!s.used && s.pos.x === tile.x && s.pos.y === tile.y && s.pos.layer === tile.layer) return s;
  }
  return undefined;
}
