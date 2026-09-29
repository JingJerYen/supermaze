import { DEFAULT_TUNING, planFloor, recordFloor, startTowerRun } from "@supermaze/sim";
import { describe, expect, it } from "vitest";
import { MAP_POOL } from "../src/maps.js";

describe("tower run on the bundled maps", () => {
  it("every floor draws a map of its own difficulty that takes that many players", () => {
    const floors = DEFAULT_TUNING.towerRun.floors;
    for (const seed of [1, 2, 3]) {
      let run = startTowerRun(seed);
      for (let floor = 1; floor <= floors.length; floor++) {
        const plan = planFloor(run, MAP_POOL);
        expect(plan, `floor ${floor}`).not.toBeNull();
        expect(plan!.map.difficulty, `floor ${floor}`).toBe(floors[floor - 1]!.map);
        expect(plan!.map.supportedParticipants).toContain(plan!.participants);
        run = recordFloor(run, plan!, { rank: 1, passed: true, score: 10 });
      }
      expect(run.status).toBe("cleared");
    }
  });
});
