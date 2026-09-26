import { describe, expect, it } from "vitest";
import { decideTimeoutWinner, type TeamProgress } from "../src/round.js";
import { Simulation, type PlayerInput } from "../src/simulation.js";
import { DEFAULT_TUNING, type Tuning } from "../src/tuning/index.js";
import type { MapData } from "../src/map/types.js";
import { TINY_MAP } from "./fixtures.js";

const still: PlayerInput = { moveX: 0, moveY: 0 };
const climb: PlayerInput = { ...still, action: true };

/** Tower-entry tiles of TINY_MAP in spawn order, then a couple of far tiles for a 5th/6th player. */
const ENTRY_TILES = [
  { x: 2, y: 3, layer: "road" as const },
  { x: 2, y: 5, layer: "road" as const },
  { x: 1, y: 4, layer: "road" as const },
  { x: 3, y: 4, layer: "road" as const },
];
const EXTRA_TILES = [
  { x: 7, y: 1, layer: "road" as const },
  { x: 1, y: 6, layer: "road" as const },
];

/**
 * Keys placed directly under the first N spawn tiles, and exactly N candidates
 * so the seeded selection has no choice: every player picks up a key on the
 * first tick and can climb on the next. Not a legal map for the validator;
 * perfect for exercising end-of-round rules quickly.
 */
function instantMap(playerCount: number): MapData {
  const n = Math.min(playerCount, ENTRY_TILES.length);
  const keys = [...ENTRY_TILES.slice(0, n), ...EXTRA_TILES.slice(0, Math.max(0, playerCount - n))];
  return { ...TINY_MAP, spawns: { ...TINY_MAP.spawns, keys } };
}

function make(teams: Record<string, string>, tuning?: Partial<Tuning["round"]>, timeLimitSec?: number) {
  const participants = Object.entries(teams).map(([id, teamId]) => ({ id, teamId, controller: "human" as const }));
  const t: Tuning = { ...DEFAULT_TUNING, round: { ...DEFAULT_TUNING.round, startFreezeSec: 0, ...tuning } };
  const sim = new Simulation({ seed: 5, map: instantMap(participants.length), participants, tuning: t, timeLimitSec: timeLimitSec ?? 10 });
  sim.start();
  sim.step(new Map()); // everyone picks up the key under their feet
  return sim;
}

const climbers = (ids: string[]) => new Map(ids.map((id) => [id, climb]));

describe("round end by everyone climbing", () => {
  it("first complete team wins, others keep climbing and scoring, round ends when all are up", () => {
    const sim = make({ a1: "A", a2: "A", b1: "B", b2: "B" });
    let events = sim.step(climbers(["a1", "b1"]));
    expect(events.filter((e) => e.type === "teamCompleted")).toHaveLength(0);
    expect(sim.getState().winnerTeamId).toBeNull();

    events = sim.step(climbers(["a2"]));
    expect(events).toContainEqual({ type: "teamCompleted", tick: expect.any(Number), teamId: "A", isWinner: true });
    expect(sim.getState().winnerTeamId).toBe("A");
    expect(sim.getState().status).toBe("running");

    events = sim.step(climbers(["b2"]));
    expect(events).toContainEqual({ type: "teamCompleted", tick: expect.any(Number), teamId: "B", isWinner: false });
    expect(events).toContainEqual({ type: "roundEnded", tick: expect.any(Number), winnerTeamId: "A", reason: "allClimbed" });
    expect(sim.getState().status).toBe("finished");

    const placement = sim.tuning.scoring.towerPlacement;
    const key = sim.tuning.scoring.keyFound;
    const b2 = sim.getState().players["b2"]!;
    expect(b2.towerArrival).toBe(3);
    expect(b2.score).toBe(key + placement[3]!);
  });

  it("applies the 2x multiplier to the winning team only", () => {
    const sim = make({ a1: "A", b1: "B" });
    sim.step(climbers(["a1"])); // A complete and wins; everyone not yet up
    sim.step(climbers(["b1"]));
    const r = sim.getState().result!;
    const a1 = sim.getState().players["a1"]!;
    const b1 = sim.getState().players["b1"]!;
    expect(r.finalScores["a1"]).toBe(a1.score * sim.tuning.scoring.winningTeamMultiplier);
    expect(r.finalScores["b1"]).toBe(b1.score);
  });

  it("ignores inputs once finished", () => {
    const sim = make({ a1: "A" });
    sim.step(climbers(["a1"]));
    expect(sim.getState().status).toBe("finished");
    const tick = sim.getState().tick;
    expect(sim.step(new Map([["a1", { moveX: 1, moveY: 0 }]]))).toEqual([]);
    expect(sim.getState().tick).toBe(tick);
  });
});

describe("round end by timeout", () => {
  it("counts down from start and ends at the limit", () => {
    const sim = make({ a1: "A", b1: "B" }, undefined, 1); // 1 s = 20 ticks
    expect(sim.remainingSec()).toBeCloseTo(0.95, 5);
    for (let i = 0; i < 18; i++) sim.step(new Map());
    expect(sim.getState().status).toBe("running");
    const events = sim.step(new Map());
    expect(sim.getState().status).toBe("finished");
    expect(sim.remainingSec()).toBe(0);
    expect(events.at(-1)?.type).toBe("roundEnded");
  });

  it("most climbed members wins on timeout", () => {
    const sim = make({ a1: "A", a2: "A", b1: "B", b2: "B" }, undefined, 1);
    sim.step(climbers(["a1"]));
    for (let i = 0; i < 20; i++) sim.step(new Map());
    expect(sim.getState().result).toMatchObject({ winnerTeamId: "A", reason: "timeout:climbed" });
  });

  it("a team that already completed stays the winner when time runs out", () => {
    const sim = make({ a1: "A", b1: "B", b2: "B" }, undefined, 1);
    sim.step(climbers(["a1"]));
    for (let i = 0; i < 20; i++) sim.step(new Map());
    expect(sim.getState().result).toMatchObject({ winnerTeamId: "A", reason: "allClimbed" });
  });

  // 2v3, one climber each. b1 climbs first so B has the higher team score.
  //   count metric: 1 == 1 -> tie -> B wins on score
  //   ratio metric: 1/2 > 1/3 -> A wins outright
  function unevenScenario(metric: Tuning["round"]["timeoutClimbMetric"]) {
    const sim = make({ a1: "A", a2: "A", b1: "B", b2: "B", b3: "B" }, { timeoutClimbMetric: metric }, 1);
    sim.step(climbers(["b1"]));
    sim.step(climbers(["a1"]));
    for (let i = 0; i < 20; i++) sim.step(new Map());
    return sim.getState().result;
  }

  it("count metric: equal climbed counts fall through to team score", () => {
    expect(unevenScenario("count")).toMatchObject({ winnerTeamId: "B", reason: "timeout:score" });
  });

  it("ratio metric: the smaller team's higher fraction wins", () => {
    expect(unevenScenario("ratio")).toMatchObject({ winnerTeamId: "A", reason: "timeout:climbed" });
  });
});

describe("decideTimeoutWinner tie-breaks", () => {
  const team = (teamId: string, climbed: number, score: number, climbTicks: number[], size = 2): TeamProgress => ({
    teamId,
    size,
    climbed,
    score,
    climbTicks,
  });

  it("falls through count -> score -> earlier -> draw", () => {
    const t = DEFAULT_TUNING;
    expect(decideTimeoutWinner([team("A", 1, 10, [5]), team("B", 0, 99, [])], t)).toEqual({ winnerTeamId: "A", reason: "timeout:climbed" });
    expect(decideTimeoutWinner([team("A", 1, 10, [5]), team("B", 1, 20, [3])], t)).toEqual({ winnerTeamId: "B", reason: "timeout:score" });
    expect(decideTimeoutWinner([team("A", 1, 10, [5]), team("B", 1, 10, [3])], t)).toEqual({ winnerTeamId: "B", reason: "timeout:earlier" });
    expect(decideTimeoutWinner([team("A", 0, 10, []), team("B", 0, 10, [])], t)).toEqual({ winnerTeamId: null, reason: "timeout:draw" });
  });
});
