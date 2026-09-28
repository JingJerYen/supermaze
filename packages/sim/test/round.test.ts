import { describe, expect, it } from "vitest";
import { decideTimeoutWinner, type TeamProgress } from "../src/round.js";
import { Simulation, type PlayerInput } from "../src/simulation.js";
import { DEFAULT_TUNING, type Tuning } from "../src/tuning/index.js";
import type { MapData } from "../src/map/types.js";
import { TINY_MAP } from "./fixtures.js";
import { faceTower } from "./walk.js";

const still: PlayerInput = { moveX: 0, moveY: 0 };
const climb: PlayerInput = { ...still, action: true };

/** Tower-entry tiles of TINY_MAP in spawn order, then a couple of far tiles for a 5th/6th player. */
const ENTRY_TILES = [
  { x: 2, y: 4, layer: "road" as const }, // south
  { x: 3, y: 3, layer: "road" as const }, // east
  { x: 1, y: 3, layer: "road" as const }, // west
  { x: 2, y: 2, layer: "road" as const }, // north
];
const EXTRA_TILES = [
  { x: 7, y: 6, layer: "road" as const },
  { x: 1, y: 1, layer: "road" as const },
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
  faceTower(sim, Object.keys(teams)); // and turns to face the door (climbing needs it)
  return sim;
}

const climbers = (ids: string[]) => new Map(ids.map((id) => [id, climb]));

describe("round end by everyone climbing", () => {
  it("ends as soon as all but one are on the tower; the last one keeps what they earned", () => {
    const sim = make({ a1: "A", a2: "A", b1: "B", b2: "B" });
    let events = sim.step(climbers(["a1", "b1"]));
    expect(events.filter((e) => e.type === "teamCompleted")).toHaveLength(0);
    expect(sim.getState().winnerTeamId).toBeNull();
    expect(sim.getState().status).toBe("running");

    events = sim.step(climbers(["a2"])); // 3 of 4 up: A is complete and the round stops
    expect(events).toContainEqual({ type: "teamCompleted", tick: expect.any(Number), teamId: "A", isWinner: true });
    expect(events).toContainEqual({ type: "roundEnded", tick: expect.any(Number), winnerTeamId: "A", reason: "lastOneLeft" });
    expect(sim.getState().status).toBe("finished");

    // b2 never got to climb: no placement, but the key score stays.
    const b2 = sim.getState().players["b2"]!;
    expect(b2.phase).toBe("maze");
    expect(b2.towerArrival).toBeNull();
    expect(b2.score).toBe(sim.tuning.scoring.keyFound);
    expect(sim.getState().result!.finalScores["b2"]).toBe(sim.tuning.scoring.keyFound);
    expect(sim.step(climbers(["b2"]))).toEqual([]);
  });

  it("after a team has won, the others keep climbing and scoring until one is left", () => {
    const sim = make({ a1: "A", b1: "B", b2: "B", b3: "B" });
    let events = sim.step(climbers(["a1"]));
    expect(events).toContainEqual({ type: "teamCompleted", tick: expect.any(Number), teamId: "A", isWinner: true });
    expect(sim.getState().status).toBe("running");

    sim.step(climbers(["b1"]));
    expect(sim.getState().status).toBe("running");
    const placement = sim.tuning.scoring.towerPlacement;
    const key = sim.tuning.scoring.keyFound;
    expect(sim.getState().players["b1"]!.score).toBe(key + placement[1]!);

    events = sim.step(climbers(["b2"]));
    expect(events).toContainEqual({ type: "roundEnded", tick: expect.any(Number), winnerTeamId: "A", reason: "lastOneLeft" });
    expect(sim.getState().players["b2"]!.towerArrival).toBe(2);
  });

  it("a single participant has to climb for the round to end", () => {
    const sim = make({ a1: "A" });
    for (let i = 0; i < 5; i++) sim.step(new Map());
    expect(sim.getState().status).toBe("running");
    const events = sim.step(climbers(["a1"]));
    expect(events).toContainEqual({ type: "roundEnded", tick: expect.any(Number), winnerTeamId: "A", reason: "allClimbed" });
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
    const sim = make({ a1: "A", b1: "B" }, undefined, 1); // 1 s = 20 ticks; make() already spent 2
    expect(sim.remainingSec()).toBeCloseTo(0.9, 5);
    for (let i = 0; i < 17; i++) sim.step(new Map());
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

describe("round length", () => {
  const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, teamId: i % 2 ? "B" : "A", controller: "human" as const }));
  const lengthFor = (n: number, timeLimitSec?: number) =>
    new Simulation({ seed: 1, map: { ...TINY_MAP, timeLimitSec: 180 }, participants: players(n), ...(timeLimitSec ? { timeLimitSec } : {}) }).remainingSec();

  it("is the map's own time for two, plus 30 s per extra participant", () => {
    expect(DEFAULT_TUNING.round.extraSecPerParticipant).toBe(30);
    expect(lengthFor(1)).toBe(180);
    expect(lengthFor(2)).toBe(180);
    expect(lengthFor(3)).toBe(210);
    expect(lengthFor(6)).toBe(300);
  });

  it("a developer override wins", () => {
    expect(lengthFor(6, 45)).toBe(45);
  });

  it("is fixed when the round starts", () => {
    const sim = new Simulation({ seed: 1, map: { ...instantMap(4), timeLimitSec: 180 }, participants: players(4) });
    sim.start();
    const st = sim.getState();
    expect(st.endsAtTick - st.startTick).toBe((180 + 60) * DEFAULT_TUNING.tickRate);
  });
});

describe("solo mode: everyone for themselves", () => {
  function solo(ids: string[], timeLimitSec = 10) {
    const participants = ids.map((id) => ({ id, teamId: "whatever", controller: "human" as const }));
    const sim = new Simulation({
      seed: 5,
      map: instantMap(ids.length),
      participants,
      tuning: { ...DEFAULT_TUNING, round: { ...DEFAULT_TUNING.round, startFreezeSec: 0 } },
      timeLimitSec,
      teamMode: "solo",
    });
    sim.start();
    sim.step(new Map());
    faceTower(sim, ids);
    return sim;
  }

  it("puts every player in a team of their own", () => {
    const sim = solo(["p1", "p2", "p3"]);
    expect(sim.getState().teamMode).toBe("solo");
    expect(Object.values(sim.getState().players).map((p) => p.teamId)).toEqual(["p1", "p2", "p3"]);
  });

  it("has no winner until the end, no multiplier, and ranks by score", () => {
    const sim = solo(["p1", "p2", "p3"]);
    let events = sim.step(climbers(["p2"]));
    expect(events.map((e) => e.type)).toEqual(["towerClimbed"]);
    expect(sim.getState().winnerTeamId).toBeNull();
    expect(sim.getState().status).toBe("running");

    events = sim.step(climbers(["p1"])); // 2 of 3 up: the round stops
    expect(events).toContainEqual({ type: "roundEnded", tick: expect.any(Number), winnerTeamId: "p2", reason: "solo:score" });
    const st = sim.getState();
    const { keyFound, towerPlacement } = sim.tuning.scoring;
    expect(st.result!.finalScores).toEqual({
      p1: keyFound + towerPlacement[1]!,
      p2: keyFound + towerPlacement[0]!,
      p3: keyFound,
    });
  });

  it("on timeout the top score wins; nobody climbing is a draw between equal scores", () => {
    const climbedOne = solo(["p1", "p2", "p3"], 1);
    climbedOne.step(climbers(["p3"]));
    for (let i = 0; i < 20; i++) climbedOne.step(new Map());
    expect(climbedOne.getState().result).toMatchObject({ winnerTeamId: "p3", reason: "solo:timeout" });

    const nobody = solo(["p1", "p2"], 1);
    for (let i = 0; i < 20; i++) nobody.step(new Map());
    expect(nobody.getState().result).toMatchObject({ winnerTeamId: null, reason: "solo:timeout" });
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
