import { DEFAULT_TUNING, type Tuning } from "../tuning/index.js";
import { ALL_DIRS, DIRS, MapGrid, tileKey } from "./grid.js";
import { normalizeMap } from "./normalize.js";
import type { MapData, NormalizedMapData, TilePos } from "./types.js";

/**
 * Structural checks a hand-made map must pass (CLAUDE.md section 6).
 * Returns human-readable problems; an empty array means the map is valid.
 * Phase 0 covers geometry and reachability; spawn-point checks arrive in phase 1.
 */
export function validateMap(raw: MapData, tuning: Tuning = DEFAULT_TUNING): string[] {
  const errors: string[] = [];
  let grid: MapGrid;
  let data: NormalizedMapData;
  try {
    data = normalizeMap(raw);
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

  errors.push(...corridorWidthErrors(grid, data.plazaRadius ?? 0));

  const spawns = grid.spawnTiles();
  if (spawns.length === 0) {
    errors.push("no road cell touches the tower; players cannot spawn");
    return errors;
  }

  const reach = grid.reachableFrom(spawns[0] as (typeof spawns)[number]);
  for (const { x, y } of grid.findCells("road")) {
    if (!reach.has(tileKey(x, y, "road"))) errors.push(`road cell (${x},${y}) is unreachable from the tower`);
  }
  for (const { x, y } of grid.findCells("stairs")) {
    if (!reach.has(tileKey(x, y, "road"))) errors.push(`stairs (${x},${y}) is unreachable from the tower`);
  }

  // Spawn candidates: enough of each kind for the largest supported round, all
  // walkable, reachable, unique, off the tower entries, and disjoint across kinds.
  const maxParticipants = Math.max(0, ...data.supportedParticipants);
  const candidates = data.spawns;
  const needed: Record<keyof NormalizedMapData["spawns"], number> = {
    keys: maxParticipants * tuning.keys.perParticipant,
    itemBoxes: maxParticipants * tuning.itemBoxes.perParticipant,
    lightSwitches: data.lightSwitchCount ?? 0,
  };
  const seen = new Map<string, string>();
  for (const kind of ["keys", "itemBoxes", "lightSwitches"] as const) {
    const list: TilePos[] = candidates[kind];
    if (list.length < needed[kind]) {
      errors.push(`only ${list.length} ${kind} spawns but ${needed[kind]} may be needed`);
    }
    for (const t of list) {
      const key = tileKey(t.x, t.y, t.layer);
      const prev = seen.get(key);
      if (prev) errors.push(`${kind} spawn ${key} collides with ${prev} spawn`);
      seen.set(key, kind);
      if (!grid.isWalkable(t.x, t.y, t.layer)) errors.push(`${kind} spawn ${key} is not walkable on its layer`);
      else if (!reach.has(key)) errors.push(`${kind} spawn ${key} is unreachable from the tower`);
      if (grid.isTowerEntry(t.x, t.y)) errors.push(`${kind} spawn ${key} sits on a tower entry tile`);
    }
  }

  const switches = data.lightSwitchCount ?? 0;
  if (switches < tuning.lighting.switchCountMin) {
    errors.push(`lightSwitchCount ${switches} is below the minimum ${tuning.lighting.switchCountMin}`);
  }
  if (switches % 2 !== 0) errors.push(`lightSwitchCount ${switches} must be even so the map ends lit`);

  return errors;
}

/**
 * Corridors are exactly one tile wide and walls exactly one tile thick
 * (CLAUDE.md section 6): no 2x2 block may be fully walkable on the road layer
 * or fully walkable on the wallTop layer, except inside the tower plaza.
 */
function corridorWidthErrors(grid: MapGrid, plazaRadius: number): string[] {
  const errors: string[] = [];
  const tower = grid.findCells("tower");
  const inPlaza = (x: number, y: number) =>
    tower.some((t) => Math.max(Math.abs(t.x - x), Math.abs(t.y - y)) <= plazaRadius);

  for (let y = 0; y + 1 < grid.height; y++) {
    for (let x = 0; x + 1 < grid.width; x++) {
      const cells = [
        [x, y],
        [x + 1, y],
        [x, y + 1],
        [x + 1, y + 1],
      ] as const;
      if (cells.every(([cx, cy]) => inPlaza(cx, cy))) continue;
      if (cells.every(([cx, cy]) => grid.isWalkable(cx, cy, "road"))) {
        errors.push(`corridor wider than one tile at (${x},${y})-(${x + 1},${y + 1})`);
      }
      if (cells.every(([cx, cy]) => grid.isWalkable(cx, cy, "wallTop"))) {
        errors.push(`wall thicker than one tile at (${x},${y})-(${x + 1},${y + 1})`);
      }
    }
  }
  return errors;
}
