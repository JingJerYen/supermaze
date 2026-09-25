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

export function cellKindFromCode(code: string): CellKind {
  const kind = CODE_TO_KIND[code];
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
