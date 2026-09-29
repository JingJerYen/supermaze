import { describe, expect, it } from "vitest";
import type { MapData } from "../src/map/types.js";
import { floorsCleared, judgeFloor, passRank, planFloor, recordFloor, startTowerRun, type FloorPlan } from "../src/run/towerRun.js";
import type { SimulationState } from "../src/simulation.js";
import { DEFAULT_TUNING, type Tuning } from "../src/tuning/index.js";
import { TINY_MAP } from "./fixtures.js";

const map = (id: string, difficulty: MapData["difficulty"] | null, supported = [2, 3, 4, 5, 6]): MapData => ({
  ...TINY_MAP,
  id,
  ...(difficulty ? { difficulty } : {}),
  supportedParticipants: supported,
});
const POOL = [map("e1", "easy"), map("e2", "easy"), map("m1", "medium", [2, 3, 4]), map("h1", "hard"), map("h2", "hard")];

const outcome = (passed: boolean, score = 50) => ({ place: passed ? 1 : null, passed, score });

describe("passRank", () => {
  it("is the first half, at least first", () => {
    expect([2, 3, 4, 5, 6].map((n) => passRank(n))).toEqual([1, 1, 2, 2, 3]);
  });
});

describe("default floor table", () => {
  const floors = DEFAULT_TUNING.towerRun.floors;
  it("has 20 floors with an odd number of CPUs so the first half is exact", () => {
    expect(floors).toHaveLength(20);
    for (const f of floors) {
      expect(f.cpus % 2).toBe(1);
      expect(f.cpus + 1).toBeLessThanOrEqual(DEFAULT_TUNING.round.maxParticipants);
    }
  });
});

describe("planFloor", () => {
  it("draws the floor's difficulty, sets its CPU strength and is reproducible", () => {
    const run = startTowerRun(42);
    const a = planFloor(run, POOL)!;
    expect(a.map.difficulty).toBe(DEFAULT_TUNING.towerRun.floors[0]!.map);
    expect(a.participants).toBe(DEFAULT_TUNING.towerRun.floors[0]!.cpus + 1);
    expect(a.tuning.cpu.visionTiles).toBe(DEFAULT_TUNING.towerRun.floors[0]!.cpuVisionTiles);
    expect(a.tuning.cpu.speedMultiplier).toBe(DEFAULT_TUNING.towerRun.floors[0]!.cpuSpeed);
    expect(planFloor(run, POOL)).toEqual(a);
  });

  it("gives a retry a different seed and avoids the map just played", () => {
    let run = startTowerRun(7);
    const first = planFloor(run, POOL)!;
    run = recordFloor(run, first, outcome(false));
    const retry = planFloor(run, POOL)!;
    expect(retry.seed).not.toBe(first.seed);
    expect(retry.map.id).not.toBe(first.map.id);
  });

  it("falls back to the nearest difficulty, harder first, when a floor has no map", () => {
    const tuning: Tuning = {
      ...DEFAULT_TUNING,
      towerRun: { ...DEFAULT_TUNING.towerRun, floors: [{ map: "medium", cpus: 5, cpuVisionTiles: 3, cpuSpeed: 0.5 }] },
    };
    // m1 takes at most 4 players, so six falls back to hard before easy.
    expect(planFloor(startTowerRun(1), POOL, tuning)!.map.difficulty).toBe("hard");
    // A map without a difficulty never appears.
    expect(planFloor(startTowerRun(1), [map("x", null)], tuning)).toBeNull();
  });
});

describe("recordFloor", () => {
  const plan = (run = startTowerRun(1)) => planFloor(run, POOL) as FloorPlan;

  it("moves up a floor on a pass and adds the score", () => {
    const run = recordFloor(startTowerRun(1), plan(), outcome(true, 120));
    expect(run).toMatchObject({ floor: 2, attempt: 0, hearts: 3, totalScore: 120, status: "playing" });
    expect(floorsCleared(run)).toBe(1);
  });

  it("costs a heart on a fail, stays on the floor, and ends the run at zero", () => {
    let run = startTowerRun(1);
    for (let i = 1; i <= 3; i++) {
      run = recordFloor(run, plan(run), outcome(false, 10));
      expect(run.floor).toBe(1);
      expect(run.hearts).toBe(3 - i);
    }
    expect(run.status).toBe("over");
    expect(run.totalScore).toBe(30);
    expect(recordFloor(run, plan(run), outcome(true))).toBe(run);
  });

  it("clears the run after the last floor", () => {
    const tuning: Tuning = { ...DEFAULT_TUNING, towerRun: { ...DEFAULT_TUNING.towerRun, floors: DEFAULT_TUNING.towerRun.floors.slice(0, 2) } };
    let run = startTowerRun(1, tuning);
    run = recordFloor(run, planFloor(run, POOL, tuning)!, outcome(true), tuning);
    run = recordFloor(run, planFloor(run, POOL, tuning)!, outcome(true), tuning);
    expect(run.status).toBe("cleared");
    expect(run.floor).toBe(2);
  });
});

describe("judgeFloor", () => {
  const state = (arrival: number | null) =>
    ({
      players: { me: { phase: arrival === null ? "maze" : "tower", towerArrival: arrival, score: 33 } },
      result: { winnerTeamId: null, reason: "solo:score", finalScores: { me: 40 } },
    }) as unknown as SimulationState;

  it("passes within the rank, fails beyond it or without climbing", () => {
    expect(judgeFloor(state(0), "me", 2)).toEqual({ place: 1, passed: true, score: 40 });
    expect(judgeFloor(state(1), "me", 2)).toEqual({ place: 2, passed: true, score: 40 });
    expect(judgeFloor(state(2), "me", 2)).toEqual({ place: 3, passed: false, score: 40 });
    expect(judgeFloor(state(null), "me", 2)).toEqual({ place: null, passed: false, score: 40 });
  });
});
