import { SeededRandom } from "../random/seeded.js";
import { DEFAULT_TUNING, type Tuning } from "../tuning/index.js";
import type { MapData } from "./types.js";
import { validateMap } from "./validate.js";

/**
 * The maps a round may be played on: those that pass the validator, in id
 * order so every machine sees the same list. A map that is still being drawn
 * simply stays out of the pool; `onInvalid` hears why.
 */
export function playableMaps(
  maps: readonly MapData[],
  onInvalid?: (map: MapData, problems: string[]) => void,
  tuning: Tuning = DEFAULT_TUNING,
): MapData[] {
  const ok: MapData[] = [];
  for (const map of maps) {
    const problems = validateMap(map, tuning);
    if (problems.length === 0) ok.push(map);
    else onInvalid?.(map, problems);
  }
  return ok.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Draw the map for a round (CLAUDE.md section 6): uniformly among the maps
 * whose `supportedParticipants` lists this many participants (CPUs count),
 * decided by the round seed so it can be replayed. Null when no map supports
 * that many; the caller refuses to start rather than play on an unfit map.
 */
export function pickMap(maps: readonly MapData[], participants: number, seed: number): MapData | null {
  const fit = maps.filter((m) => m.supportedParticipants.includes(participants)).sort((a, b) => a.id.localeCompare(b.id));
  if (fit.length === 0) return null;
  // Its own stream, so choosing a map does not shift the round's other draws.
  return new SeededRandom((seed ^ 0x9e3779b9) >>> 0).pick(fit);
}
