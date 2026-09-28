import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { playableMaps, validateMap, type MapData } from "@supermaze/sim";

const here = path.dirname(fileURLToPath(import.meta.url));
const mapsDir = path.resolve(here, "../../../content/maps");

/** Load one map from content/maps and refuse to serve an invalid one. */
export async function loadMap(id: string): Promise<MapData> {
  const map = JSON.parse(await readFile(path.join(mapsDir, `${id}.json`), "utf8")) as MapData;
  const problems = validateMap(map);
  if (problems.length) throw new Error(`map ${id} is invalid:\n  ${problems.join("\n  ")}`);
  return map;
}

/**
 * Every map in content/maps that passes the validator. A file that does not
 * parse or does not validate is left out with a warning, so a map someone is
 * still drawing never takes the server down or gets drawn for a round.
 */
export async function loadMapPool(): Promise<MapData[]> {
  const files = (await readdir(mapsDir)).filter((f) => f.endsWith(".json")).sort();
  const maps: MapData[] = [];
  for (const file of files) {
    try {
      maps.push(JSON.parse(await readFile(path.join(mapsDir, file), "utf8")) as MapData);
    } catch (e) {
      console.warn(`[maps] ${file} skipped: ${(e as Error).message}`);
    }
  }
  return playableMaps(maps, (map, problems) => console.warn(`[maps] ${map.id} skipped: ${problems.length} problem(s), first: ${problems[0]}`));
}
