import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mapWarnings, validateMap, type MapData } from "@supermaze/sim";

/**
 * Validates every map in content/maps/ (or only the ones named on the command
 * line) using the same rules the simulation relies on. Exit code 1 if any fails.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const mapsDir = path.resolve(here, "../../../content/maps");

async function main(): Promise<void> {
  // Optional arguments name the maps to check (`maze-02` or `maze-02.json`); none means all.
  const wanted = process.argv.slice(2).map((a) => (a.endsWith(".json") ? a : `${a}.json`));
  const files = (await readdir(mapsDir)).filter((f) => f.endsWith(".json") && (wanted.length === 0 || wanted.includes(f)));
  if (files.length === 0) {
    console.log(wanted.length ? `[map-validator] no such map: ${wanted.join(", ")}` : `[map-validator] no maps in ${mapsDir}`);
    if (wanted.length) process.exit(1);
    return;
  }

  let failed = 0;
  for (const file of files) {
    const raw = await readFile(path.join(mapsDir, file), "utf8");
    let errors: string[];
    let warnings: string[] = [];
    try {
      const data = JSON.parse(raw) as MapData;
      errors = validateMap(data);
      warnings = mapWarnings(data);
    } catch (e) {
      errors = [`invalid JSON: ${(e as Error).message}`];
    }
    if (errors.length) {
      failed++;
      console.error(`[FAIL] ${file}\n  ${errors.join("\n  ")}`);
    } else {
      console.log(`[ok]   ${file}`);
    }
    // Wide corridors and thick walls are allowed; they are listed so a slip is not mistaken for a room.
    if (warnings.length) console.log(`[note] ${file}: ${warnings.length} wide spot(s) where items can be walked round\n  ${warnings.join("\n  ")}`);
  }
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
