import { ALL_DIRS, DIRS, MapGrid, tileKey } from "./grid.js";
import type { MapData } from "./types.js";

/**
 * Structural checks a hand-made map must pass (CLAUDE.md section 6).
 * Returns human-readable problems; an empty array means the map is valid.
 * Phase 0 covers geometry and reachability; spawn-point checks arrive in phase 1.
 */
export function validateMap(data: MapData): string[] {
  const errors: string[] = [];
  let grid: MapGrid;
  try {
    grid = MapGrid.fromMapData(data);
  } catch (e) {
    return [(e as Error).message];
  }

  if (grid.findCells("tower").length === 0) errors.push("map has no tower cells (T)");

  for (const { x, y } of grid.findCells("stairs")) {
    const rise = grid.stairsRiseDir(x, y);
    if (!rise) {
      errors.push(`stairs at (${x},${y}) must have exactly one adjacent wall`);
      continue;
    }
    if (grid.kindAt(x - rise.dx, y - rise.dy) !== "road") {
      errors.push(`stairs at (${x},${y}) must have road opposite its wall`);
    }
    for (const d of ALL_DIRS) {
      if (d === rise || (d.dx === -rise.dx && d.dy === -rise.dy)) continue;
      if (grid.kindAt(x + d.dx, y + d.dy) === "stairs") {
        errors.push(`stairs at (${x},${y}) may not touch another stairs cell sideways`);
      }
    }
  }

  for (const { x, y } of grid.findCells("bridge")) {
    const ew = [DIRS.west, DIRS.east].every((d) => grid.kindAt(x + d.dx, y + d.dy) === "wall");
    const ns = [DIRS.north, DIRS.south].every((d) => grid.kindAt(x + d.dx, y + d.dy) === "wall");
    const roadEW = [DIRS.west, DIRS.east].every((d) => grid.isWalkable(x + d.dx, y + d.dy, "road"));
    const roadNS = [DIRS.north, DIRS.south].every((d) => grid.isWalkable(x + d.dx, y + d.dy, "road"));
    if (!((ew && roadNS) || (ns && roadEW))) {
      errors.push(`bridge at (${x},${y}) must join two walls with road passing underneath`);
    }
  }

  const spawns = grid.spawnTiles();
  if (spawns.length === 0) {
    errors.push("no road cell touches the tower; players cannot spawn");
  } else {
    const reach = grid.reachableFrom(spawns[0] as (typeof spawns)[number]);
    for (const { x, y } of grid.findCells("road")) {
      if (!reach.has(tileKey(x, y, "road"))) errors.push(`road cell (${x},${y}) is unreachable from the tower`);
    }
    for (const { x, y } of grid.findCells("stairs")) {
      if (!reach.has(tileKey(x, y, "road"))) errors.push(`stairs (${x},${y}) is unreachable from the tower`);
    }
  }

  return errors;
}
