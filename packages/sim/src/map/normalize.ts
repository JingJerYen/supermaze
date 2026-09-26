import { SPAWN_MARKERS } from "./cells.js";
import type { MapData, NormalizedMapData, TilePos } from "./types.js";

/**
 * Resolve authoring sugar: spawn markers drawn in the rows become `spawns`
 * entries (appended after any explicit lists) and the rows are reduced to the
 * six plain cell codes. Idempotent; every loader calls this once.
 */
export function normalizeMap(map: MapData): NormalizedMapData {
  const keys: TilePos[] = [...(map.spawns?.keys ?? [])];
  const itemBoxes: TilePos[] = [...(map.spawns?.itemBoxes ?? [])];
  const lightSwitches: TilePos[] = [...(map.spawns?.lightSwitches ?? [])];
  const lists = { keys, itemBoxes, lightSwitches };

  const rows = map.rows.map((row, y) => {
    let out = "";
    for (let x = 0; x < row.length; x++) {
      const code = row[x] as string;
      const marker = SPAWN_MARKERS[code];
      if (!marker) {
        out += code;
        continue;
      }
      lists[marker.kind].push({ x, y, layer: marker.base === "#" ? "wallTop" : "road" });
      out += marker.base;
    }
    return out;
  });

  return { ...map, rows, spawns: lists };
}
