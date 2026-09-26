import type { MapData } from "@supermaze/sim";

/**
 * Every JSON in content/maps is bundled; add a file there and it is selectable
 * with `?map=<id>` without touching code. Online play still follows the server.
 */
const files = import.meta.glob("../../../content/maps/*.json", { eager: true, import: "default" }) as Record<
  string,
  MapData
>;

export const MAPS: Record<string, MapData> = Object.fromEntries(Object.values(files).map((m) => [m.id, m]));
export const DEFAULT_MAP_ID = "maze-01";

export function loadMapById(id: string): MapData {
  const map = MAPS[id] ?? MAPS[DEFAULT_MAP_ID];
  if (!map) throw new Error("no maps bundled");
  if (!MAPS[id]) console.warn(`[maps] unknown map "${id}", using ${map.id}. Available: ${Object.keys(MAPS).join(", ")}`);
  return map;
}
