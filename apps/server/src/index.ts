import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_TUNING, Simulation, validateMap, type MapData } from "@supermaze/sim";

/**
 * Headless authoritative loop. Phase-0 skeleton: runs the simulation at the
 * configured tick rate with no network attached.
 *
 * Transport (Colyseus vs raw WebSocket) is chosen at the end of phase 0 and
 * plugged in here; the simulation itself does not change.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const mapPath = path.resolve(here, "../../../content/maps/test-01.json");
const map = JSON.parse(await readFile(mapPath, "utf8")) as MapData;

const problems = validateMap(map);
if (problems.length) {
  console.error(`[server] map ${map.id} is invalid:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

const sim = new Simulation({
  seed: Date.now() >>> 0,
  map,
  participants: [],
});

const tickMs = 1000 / DEFAULT_TUNING.tickRate;
let lastLog = Date.now();

setInterval(() => {
  sim.step(new Map());
  const now = Date.now();
  if (now - lastLog >= 5000) {
    console.log(`[server] tick=${sim.getState().tick}`);
    lastLog = now;
  }
}, tickMs);

console.log(`[server] map ${map.id}, simulation at ${DEFAULT_TUNING.tickRate} Hz (no transport yet)`);
