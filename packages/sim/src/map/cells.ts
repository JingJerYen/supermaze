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

export function cellKindFromCode(code: string): CellKind {
  const marker = SPAWN_MARKERS[code];
  const kind = CODE_TO_KIND[marker ? marker.base : code];
  if (!kind) throw new Error(`unknown map cell code ${JSON.stringify(code)}`);
  return kind;
}

/** Whether a player standing on `layer` may occupy a cell of this kind. */
export function isWalkable(kind: CellKind, layer: Layer): boolean {
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
