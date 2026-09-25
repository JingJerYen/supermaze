import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateMap, type MapData } from "@supermaze/sim";

const here = path.dirname(fileURLToPath(import.meta.url));
const mapsDir = path.resolve(here, "../../../content/maps");

/** Load one map from content/maps and refuse to serve an invalid one. */
export async function loadMap(id: string): Promise<MapData> {
  const map = JSON.parse(await readFile(path.join(mapsDir, `${id}.json`), "utf8")) as MapData;
  const problems = validateMap(map);
  if (problems.length) throw new Error(`map ${id} is invalid:\n  ${problems.join("\n  ")}`);
  return map;
}
