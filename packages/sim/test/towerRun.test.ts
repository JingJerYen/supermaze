import { describe, expect, it } from "vitest";
import type { MapData } from "../src/map/types.js";
import { continueRun, judgeFloor, passRank, planFloor, recordFloor, startTowerRun, type FloorPlan } from "../src/run/towerRun.js";
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

const outcome = (passed: boolean, score = 50) => ({ rank: passed ? 1 : 2, passed, score });
const plan = (run = startTowerRun(1), tuning: Tuning = DEFAULT_TUNING) => planFloor(run, POOL, tuning) as FloorPlan;

describe("passRank", () => {
  it("is the first half, at least first", () => {
    expect([2, 3, 4, 5, 6].map((n) => passRank(n))).toEqual([1, 1, 2, 2, 3]);
  });
});

describe("default floor table", () => {
  it("has 20 floors with an odd number of CPUs so the first half is exact", () => {
    const floors = DEFAULT_TUNING.towerRun.floors;
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
    const first = DEFAULT_TUNING.towerRun.floors[0]!;
    const a = plan(run);
    expect(a.map.difficulty).toBe(first.map);
    expect(a.participants).toBe(first.cpus + 1);
    expect(a.tuning.cpu.visionTiles).toBe(first.cpuVisionTiles);
    expect(a.tuning.cpu.speedMultiplier).toBe(first.cpuSpeed);
    expect(plan(run)).toEqual(a);
  });

  it("avoids the map just played when another fits", () => {
    let run = startTowerRun(7);
    const first = plan(run);
    run = recordFloor(run, first, outcome(true));
    expect(plan(run).map.id).not.toBe(first.map.id);
  });

  it("falls back to the nearest difficulty, harder first, when a floor has no map", () => {
    const tuning: Tuning = {
      ...DEFAULT_TUNING,
      towerRun: { ...DEFAULT_TUNING.towerRun, floors: [{ map: "medium", cpus: 5, cpuVisionTiles: 3, cpuSpeed: 0.5 }] },
    };
    // m1 takes at most 4 players, so six falls back to hard before easy.
    expect(plan(startTowerRun(1), tuning).map.difficulty).toBe("hard");
    // A map without a difficulty never appears.
    expect(planFloor(startTowerRun(1), [map("x", null)], tuning)).toBeNull();
  });
});

describe("recordFloor and continueRun", () => {
  it("moves up a floor on a pass and adds the score", () => {
    const run = recordFloor(startTowerRun(1), plan(), outcome(true, 120));
    expect(run).toMatchObject({ floor: 2, totalScore: 120, status: "playing", continues: 0 });
  });

  it("stops on a fail; continuing goes on to the next floor with the score kept", () => {
    let run = recordFloor(startTowerRun(1), plan(), outcome(false, 30));
    expect(run).toMatchObject({ floor: 2, totalScore: 30, status: "stopped" });
    expect(recordFloor(run, plan(run), outcome(true))).toBe(run); // nothing is played while stopped
    run = continueRun(run);
    expect(run).toMatchObject({ floor: 2, totalScore: 30, status: "playing", continues: 1 });
    run = recordFloor(run, plan(run), outcome(true, 70));
    expect(run).toMatchObject({ floor: 3, totalScore: 100, status: "playing", continues: 1 });
    expect(continueRun(run)).toBe(run); // only a stopped run continues
  });

  it("clears after the last floor, passed or not", () => {
    const tuning: Tuning = { ...DEFAULT_TUNING, towerRun: { ...DEFAULT_TUNING.towerRun, floors: DEFAULT_TUNING.towerRun.floors.slice(0, 2) } };
    let run = startTowerRun(1);
    run = recordFloor(run, plan(run, tuning), outcome(true), tuning);
    run = recordFloor(run, plan(run, tuning), outcome(false), tuning);
    expect(run.status).toBe("cleared");
    expect(run.floor).toBe(2);
  });
});

describe("judgeFloor", () => {
  /** Players as [id, final score, 0-based tower arrival or null]. */
  const state = (players: [string, number, number | null][]) =>
    ({
      players: Object.fromEntries(players.map(([id, score, arrival]) => [id, { score, towerArrival: arrival }])),
      result: { winnerTeamId: null, reason: "solo:score", finalScores: Object.fromEntries(players.map(([id, s]) => [id, s])) },
    }) as unknown as SimulationState;

  it("ranks by score, whoever climbed", () => {
    const s = state([["me", 60, null], ["a", 100, 0], ["b", 40, 1], ["c", 20, 2]]);
    expect(judgeFloor(s, "me", 2)).toEqual({ rank: 2, passed: true, score: 60 });
    expect(judgeFloor(s, "b", 2)).toEqual({ rank: 3, passed: false, score: 40 });
  });

  it("breaks a score tie by who climbed first, and shares the rank when both are equal", () => {
    expect(judgeFloor(state([["me", 50, 1], ["a", 50, 0]]), "me", 1)).toMatchObject({ rank: 2, passed: false });
    expect(judgeFloor(state([["me", 50, 0], ["a", 50, null]]), "me", 1)).toMatchObject({ rank: 1, passed: true });
    expect(judgeFloor(state([["me", 50, null], ["a", 50, null]]), "me", 1)).toMatchObject({ rank: 1, passed: true });
  });
});
