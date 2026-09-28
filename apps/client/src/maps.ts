import { pickMap, playableMaps, type MapData } from "@supermaze/sim";

/**
 * Every JSON in content/maps is bundled; add a file there and it joins the
 * pool once it passes the validator, without touching code. Online play
 * follows the server's draw; single player draws here with the same rule.
 */
const files = import.meta.glob("../../../content/maps/*.json", { eager: true, import: "default" }) as Record<
  string,
  MapData
>;

/** Every bundled map by id, valid or not: `?map=<id>` may open one that is still being drawn. */
export const MAPS: Record<string, MapData> = Object.fromEntries(Object.values(files).map((m) => [m.id, m]));

/** The maps rounds are drawn from: the bundled ones that pass the validator. */
export const MAP_POOL: MapData[] = playableMaps(Object.values(MAPS), (map, problems) =>
  console.warn(`[maps] ${map.id} is not in the pool: ${problems.length} problem(s), first: ${problems[0]}`),
);

export function loadMapById(id: string): MapData {
  const map = MAPS[id] ?? MAP_POOL[0];
  if (!map) throw new Error("no maps bundled");
  if (!MAPS[id]) console.warn(`[maps] unknown map "${id}", using ${map.id}. Available: ${Object.keys(MAPS).join(", ")}`);
  return map;
}

/** The map for a single-player round of `participants` (you plus the CPUs), or null when none supports that many. */
export function drawMap(participants: number, seed: number): MapData | null {
  return pickMap(MAP_POOL, participants, seed);
}
