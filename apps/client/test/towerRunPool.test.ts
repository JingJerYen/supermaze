import { DEFAULT_TUNING, planFloor, recordFloor, startTowerRun, validateMap } from "@supermaze/sim";
import { describe, expect, it } from "vitest";
import { MAP_POOL } from "../src/maps.js";

describe("tower run on the bundled maps", () => {
  const floors = DEFAULT_TUNING.towerRun.floors;

  it("every floor draws a map of its own difficulty that takes that many players", () => {
    for (const seed of [1, 2, 3]) {
      let run = startTowerRun(seed);
      for (let floor = 1; floor <= floors.length; floor++) {
        const plan = planFloor(run, MAP_POOL);
        expect(plan, `floor ${floor}`).not.toBeNull();
        expect(plan!.map.difficulty, `floor ${floor}`).toBe(floors[floor - 1]!.map);
        expect(plan!.map.supportedParticipants).toContain(plan!.participants);
        run = recordFloor(run, plan!, { rank: 1, passed: true, score: 10 });
      }
      expect(run).toMatchObject({ status: "playing", floor: floors.length + 1 });
    }
  });

  it("past the table, every floor is a fresh generated map in one of the bundled themes", () => {
    const themes = new Set(MAP_POOL.map((m) => m.theme ?? "stone"));
    let run = startTowerRun(4, floors.length);
    run = recordFloor(run, planFloor(run, MAP_POOL)!, { rank: 1, passed: true, score: 10 });
    const seen = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const plan = planFloor(run, MAP_POOL)!;
      expect(plan.generated).toBe(true);
      expect(validateMap(plan.map)).toEqual([]);
      expect(themes.has(plan.map.theme!)).toBe(true);
      seen.add(plan.map.rows.join(""));
      run = recordFloor(run, plan, { rank: 1, passed: true, score: 10 });
    }
    expect(seen.size).toBe(3);
  });
});
