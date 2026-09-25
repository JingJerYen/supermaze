import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateMap, type MapData } from "@supermaze/sim";

/**
 * Validates every map in content/maps/ using the same rules the simulation
 * relies on. Exit code 1 if any map fails.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const mapsDir = path.resolve(here, "../../../content/maps");

async function main(): Promise<void> {
  const files = (await readdir(mapsDir)).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.log(`[map-validator] no maps in ${mapsDir}`);
    return;
  }

  let failed = 0;
  for (const file of files) {
    const raw = await readFile(path.join(mapsDir, file), "utf8");
    let errors: string[];
    try {
      const data = JSON.parse(raw) as MapData;
      errors = validateMap(data);
    } catch (e) {
      errors = [`invalid JSON: ${(e as Error).message}`];
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
