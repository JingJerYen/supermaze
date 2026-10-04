import { describe, expect, it } from "vitest";
import { generateMap, type GenerateOptions } from "../src/map/gen/generate.js";
import { Terrain } from "../src/map/gen/reach.js";
import { normalizeMap } from "../src/map/normalize.js";
import { validateMap } from "../src/map/validate.js";
import { DEFAULT_TUNING } from "../src/tuning/index.js";

const OPTS: GenerateOptions = { width: 43, height: 31, timeLimitSec: 300, theme: "ice", traps: 8, obstacles: 2, doors: 3 };
const count = (rows: string[], chars: string) => [...rows.join("")].filter((c) => chars.includes(c)).length;

describe("generateMap", () => {
  it("is the same map for the same seed and a different one for another", () => {
    expect(generateMap(5, OPTS)).toEqual(generateMap(5, OPTS));
    expect(generateMap(6, OPTS).rows).not.toEqual(generateMap(5, OPTS).rows);
  });

  it("always passes the map validator, at the default size and a smaller one", () => {
    for (let seed = 1; seed <= 12; seed++) {
      expect(validateMap(generateMap(seed, OPTS)), `seed ${seed}`).toEqual([]);
      expect(validateMap(generateMap(seed, { ...OPTS, width: 31, height: 23 })), `small seed ${seed}`).toEqual([]);
    }
  });

  it("is a hard map of the asked size and theme, with stairs, bridges and fixtures", () => {
    const map = generateMap(3, OPTS);
    expect(map).toMatchObject({ difficulty: "hard", theme: "ice", timeLimitSec: 300 });
    expect(map.rows).toHaveLength(31);
    expect(map.rows.every((r) => r.length === 43)).toBe(true);
    expect(count(map.rows, "S")).toBeGreaterThanOrEqual(3);
    expect(count(map.rows, "=")).toBeGreaterThanOrEqual(1);
    expect(count(map.rows, "A")).toBe(OPTS.traps);
    expect(count(map.rows, "O")).toBeLessThanOrEqual(OPTS.obstacles);
    expect(count(map.rows, "^v<>")).toBeLessThanOrEqual(OPTS.doors);
    const spawns = normalizeMap(map).spawns;
    expect(spawns.keys.some((k) => k.layer === "wallTop")).toBe(true);
  });

  it("is fair: every candidate is reachable without a hammer, and nothing reachable is a trap with no way back", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const map = generateMap(seed, OPTS);
      const steps = new Terrain(map.rows).fairSteps();
      expect(steps, `seed ${seed}`).not.toBeNull();
      const spawns = normalizeMap(map).spawns;
      for (const t of [...spawns.keys, ...spawns.itemBoxes, ...spawns.lightSwitches]) {
        expect(steps!.has(`${t.x},${t.y},${t.layer === "road" ? "r" : "w"}`), `seed ${seed} ${t.x},${t.y}`).toBe(true);
      }
    }
  });

  it("puts the keys far from the tower", () => {
    const map = generateMap(9, OPTS);
    const steps = new Terrain(map.rows).fairSteps()!;
    const keys = normalizeMap(map).spawns.keys.map((k) => steps.get(`${k.x},${k.y},${k.layer === "road" ? "r" : "w"}`)!);
    const median = [...keys].sort((a, b) => a - b)[Math.floor(keys.length / 2)]!;
    expect(keys.length).toBeGreaterThanOrEqual(DEFAULT_TUNING.round.maxParticipants);
    expect(median).toBeGreaterThan(25);
  });
});
