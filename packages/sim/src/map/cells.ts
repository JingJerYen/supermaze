import type { Layer } from "./types.js";

export type CellKind = "void" | "road" | "wall" | "stairs" | "bridge" | "tower";

const CODE_TO_KIND: Record<string, CellKind> = {
  X: "void",
  " ": "void",
  ".": "road",
  "#": "wall",
  S: "stairs",
  "=": "bridge",
  T: "tower",
};

export type SpawnKind = "keys" | "itemBoxes" | "lightSwitches";

/**
 * Spawn-candidate markers drawn straight into the rows. Upper case marks a road
 * cell, lower case the top of a wall cell. Light switches exist on the road
 * layer only (they hang on an adjacent wall face), so there is no `l`. They are
 * authoring sugar: loading turns them into `spawns` entries and plain cells.
 */
export const SPAWN_MARKERS: Record<string, { kind: SpawnKind; base: "." | "#" }> = {
  K: { kind: "keys", base: "." },
  k: { kind: "keys", base: "#" },
  B: { kind: "itemBoxes", base: "." },
  b: { kind: "itemBoxes", base: "#" },
  L: { kind: "lightSwitches", base: "." },
};

export type FixtureKind = "obstacle" | "trap" | "oneWayDoor";

/**
 * Fixtures: doors, obstacles and traps that are on the map from the first tick
 * and never time out (CLAUDE.md section 10.6). Same sugar as the spawn markers:
 * upper case on the road, lower case on a wall top. A door is drawn as the
 * arrow of its passage direction, on the road layer; wall-top doors go in the
 * `fixtures` list. `dir` is in map coordinates (y grows downward).
 */
export const FIXTURE_MARKERS: Record<string, { kind: FixtureKind; base: "." | "#"; dir?: { dx: number; dy: number } }> = {
  O: { kind: "obstacle", base: "." },
  o: { kind: "obstacle", base: "#" },
  A: { kind: "trap", base: "." },
  a: { kind: "trap", base: "#" },
  "^": { kind: "oneWayDoor", base: ".", dir: { dx: 0, dy: -1 } },
  v: { kind: "oneWayDoor", base: ".", dir: { dx: 0, dy: 1 } },
  "<": { kind: "oneWayDoor", base: ".", dir: { dx: -1, dy: 0 } },
  ">": { kind: "oneWayDoor", base: ".", dir: { dx: 1, dy: 0 } },
};

export function cellKindFromCode(code: string): CellKind {
  const marker = SPAWN_MARKERS[code] ?? FIXTURE_MARKERS[code];
  const kind = CODE_TO_KIND[marker ? marker.base : code];
  if (!kind) throw new Error(`unknown map cell code ${JSON.stringify(code)}`);
  return kind;
}

/** Whether a player standing on `layer` may occupy a cell of this kind. */
export function isWalkable(kind: CellKind, layer: Layer): boolean {
  if (layer === "towerTop") return false; // decided by MapGrid.isPlatformTile, not by the cell
  switch (kind) {
    case "road":
      return layer === "road";
    case "wall":
      return layer === "wallTop";
    case "stairs":
    case "bridge":
      return true;
    default:
      return false;
  }
}

export function otherLayer(layer: Layer): Layer {
  return layer === "road" ? "wallTop" : "road";
}

/** Ring width of the tower platform around the footprint, in tiles. */
export const PLATFORM_RING = 1;
