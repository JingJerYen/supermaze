import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { MapData } from "@supermaze/sim";

/**
 * Validates every map in content/maps/. Phase-0 skeleton: only checks that files
 * parse and carry the required top-level fields. Reachability, stair/bridge
 * topology and spawn-point checks arrive with the real map format in phase 1.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const mapsDir = path.resolve(here, "../../../content/maps");

const REQUIRED_FIELDS: (keyof MapData)[] = [
  "id",
  "name",
  "width",
  "height",
  "supportedParticipants",
  "layers",
  "tower",
  "spawns",
];

async function main(): Promise<void> {
  const files = (await readdir(mapsDir)).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.log(`[map-validator] no maps in ${mapsDir}`);
    return;
  }

  let failed = 0;
  for (const file of files) {
    const raw = await readFile(path.join(mapsDir, file), "utf8");
    const errors: string[] = [];
    try {
      const data = JSON.parse(raw) as Partial<MapData>;
      for (const field of REQUIRED_FIELDS) {
        if (!(field in data)) errors.push(`missing field "${field}"`);
      }
    } catch (e) {
      errors.push(`invalid JSON: ${(e as Error).message}`);
    }
    if (errors.length) {
      failed++;
      console.error(`[FAIL] ${file}\n  ${errors.join("\n  ")}`);
    } else {
      console.log(`[ok]   ${file}`);
    }
  }
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
