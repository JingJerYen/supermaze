import { normalizeMap } from "./normalize.js";
import type { MapData, NormalizedMapData, TilePos } from "./types.js";

export type QuarterTurns = 0 | 1 | 2 | 3;

/**
 * Rotate a map clockwise by `turns` quarter turns. Every hand-made map can be
 * played in four orientations, so 12 maps feel like 48 (CLAUDE.md section 6).
 * Stairs directions and bridge orientations are derived from neighbours, so
 * rotating the cell grid and the spawn coordinates is all that is needed.
 */
export function rotateMap(raw: MapData, turns: QuarterTurns): NormalizedMapData {
  let out: NormalizedMapData = normalizeMap(raw);
  for (let i = 0; i < turns; i++) out = rotateOnce(out);
  return { ...out, rotation: (((raw.rotation ?? 0) + turns) % 4) as QuarterTurns };
}

function rotateOnce(map: NormalizedMapData): NormalizedMapData {
  const h = map.rows.length;
  const w = map.rows[0]?.length ?? 0;
  // Clockwise: new[x'][y'] with x' = h-1-y, y' = x. New width = h, new height = w.
  const rows: string[] = [];
  for (let ny = 0; ny < w; ny++) {
    let row = "";
    for (let nx = 0; nx < h; nx++) {
      const x = ny;
      const y = h - 1 - nx;
      row += map.rows[y]?.[x] ?? "X";
    }
    rows.push(row);
  }
  const rot = (t: TilePos): TilePos => ({ x: h - 1 - t.y, y: t.x, layer: t.layer });
  return {
    ...map,
    rows,
    spawns: {
      keys: map.spawns.keys.map(rot),
      itemBoxes: map.spawns.itemBoxes.map(rot),
      lightSwitches: map.spawns.lightSwitches.map(rot),
    },
  };
}
