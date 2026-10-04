import { describe, expect, it } from "vitest";
import { ACHIEVEMENT_GOALS, ACHIEVEMENT_IDS, newRoundTracker, trackRound } from "../src/achievements.js";
import type { SimEvent } from "../src/events.js";
import { runAchievements } from "../src/run/runAchievements.js";
import { startTowerRun, type TowerRunState } from "../src/run/towerRun.js";
import { Simulation, type SimulationState } from "../src/simulation.js";
import { DEFAULT_TUNING } from "../src/tuning/index.js";
import { NO_FREEZE, TINY_MAP } from "./fixtures.js";

const T = NO_FREEZE.tickRate;
const players = [
  { id: "me", teamId: "me", controller: "human" as const },
  { id: "cpu", teamId: "cpu", controller: "cpu" as const },
];
const MAP = { ...TINY_MAP, spawns: { ...TINY_MAP.spawns, keys: [{ x: 7, y: 6, layer: "road" as const }, { x: 1, y: 1, layer: "road" as const }] } };

function running(): SimulationState {
  const sim = new Simulation({ seed: 1, map: MAP, participants: players, tuning: NO_FREEZE, teamMode: "solo" });
  sim.start();
  return sim.getState();
}

/** One tick: `next` is `prev` moved on to `tick` with `patch` applied. */
function step(prev: SimulationState, tick: number, events: SimEvent[], patch: Partial<SimulationState> = {}) {
  return { prev, next: { ...prev, tick, ...patch }, events };
}

describe("round achievements", () => {
  it("climbing: first, first place, fast, in the dark and with a full bag", () => {
    const s = running();
    const prev = { ...s, players: { ...s.players, me: { ...s.players["me"]!, items: ["trap", "trap", "hammer"] as const } } } as SimulationState;
    const tick = s.freezeUntilTick + 30 * T;
    const { next, events } = step(prev, tick, [{ type: "towerClimbed", tick, playerId: "me", arrival: 0 }], { lightsOn: false });
    const got = trackRound(newRoundTracker(), prev, next, events, "me", NO_FREEZE);
    expect(got.sort()).toEqual(["champion", "darkClimb", "firstClimb", "fullBag", "speedClimb"]);
  });

  it("a late climb in second place is the photo finish only", () => {
    const s = running();
    const tick = s.endsAtTick - 5 * T;
    const { prev, next, events } = step(s, tick, [{ type: "towerClimbed", tick, playerId: "me", arrival: 1 }]);
    expect(trackRound(newRoundTracker(), prev, next, events, "me", NO_FREEZE).sort()).toEqual(["firstClimb", "lastSecond"]);
  });

  it("someone else climbing earns nothing", () => {
    const s = running();
    const { prev, next, events } = step(s, 10, [{ type: "towerClimbed", tick: 10, playerId: "cpu", arrival: 0 }]);
    expect(trackRound(newRoundTracker(), prev, next, events, "me", NO_FREEZE)).toEqual([]);
  });

  it("a ghost stealing a key, and three catches in one event", () => {
    const s = running();
    const tr = newRoundTracker();
    const caught = (n: number, stolen: string | null): SimEvent => ({ type: "playerCaught", tick: n, ghostId: "me", runnerId: `r${n}`, frozenUntilTick: n + 1, stolenKeyId: stolen });
    expect(trackRound(tr, s, s, [{ type: "ghostStarted", tick: 1, teamId: "me", endsAtTick: 99 }, caught(1, "k0")], "me", NO_FREEZE)).toEqual(["keyThief"]);
    expect(trackRound(tr, s, s, [caught(2, null)], "me", NO_FREEZE)).toEqual([]);
    expect(trackRound(tr, s, s, [caught(3, null)], "me", NO_FREEZE)).toEqual(["multiCatch"]);
    // Earned once a round.
    expect(trackRound(tr, s, s, [caught(4, "k1")], "me", NO_FREEZE)).toEqual([]);
  });

  it("catches in separate events do not add up", () => {
    const s = running();
    const tr = newRoundTracker();
    const caught = (n: number): SimEvent => ({ type: "playerCaught", tick: n, ghostId: "me", runnerId: "cpu", frozenUntilTick: n, stolenKeyId: null });
    trackRound(tr, s, s, [{ type: "ghostStarted", tick: 1, teamId: "me", endsAtTick: 9 }, caught(1), caught(2)], "me", NO_FREEZE);
    expect(trackRound(tr, s, s, [{ type: "ghostStarted", tick: 20, teamId: "me", endsAtTick: 29 }, caught(21)], "me", NO_FREEZE)).toEqual([]);
  });

  it("your trap catching a ghost", () => {
    const s = running();
    const next = { ...s, ghost: { ...s.ghost, phase: "active" as const, teamId: "cpu" } };
    const ev: SimEvent = { type: "trapTriggered", tick: 1, playerId: "cpu", placeableId: "p0", frozenUntilTick: 9, ownerId: "me", ownerScored: true };
    expect(trackRound(newRoundTracker(), s, next, [ev], "me", NO_FREEZE)).toEqual(["trapGhost"]);
    // Not a ghost: nothing.
    expect(trackRound(newRoundTracker(), s, s, [ev], "me", NO_FREEZE)).toEqual([]);
  });

  it("every switch flipped by you", () => {
    const s = running();
    const tr = newRoundTracker();
    const flip = (id: string, by: string): SimEvent => ({ type: "lightsToggled", tick: 1, playerId: by, switchId: id, lightsOn: false });
    expect(Object.keys(s.switches)).toHaveLength(2);
    expect(trackRound(tr, s, s, [flip("s0", "me")], "me", NO_FREEZE)).toEqual([]);
    expect(trackRound(tr, s, s, [flip("s1", "me")], "me", NO_FREEZE)).toEqual(["lightsMaster"]);
  });

  it("teleporting, and smashing a map fixture (not a player's placeable)", () => {
    const s = running();
    const placed = { id: "p0", kind: "obstacle" as const, pos: { x: 1, y: 1, layer: "road" as const }, dir: { dx: 0, dy: 1 }, ownerId: "cpu", expiresAtTick: 99 };
    const prev = { ...s, placeables: { f0: { ...placed, id: "f0", ownerId: null, expiresAtTick: 0, permanent: true }, p0: { ...placed, permanent: false } } };
    const smash = (id: string): SimEvent => ({ type: "placeableDestroyed", tick: 1, playerId: "me", placeableId: id, kind: "obstacle" });
    expect(trackRound(newRoundTracker(), prev, s, [smash("p0")], "me", NO_FREEZE)).toEqual([]);
    expect(trackRound(newRoundTracker(), prev, s, [smash("f0")], "me", NO_FREEZE)).toEqual(["breaker"]);
    expect(trackRound(newRoundTracker(), s, s, [{ type: "teleported", tick: 1, playerId: "me", fromNodeId: "n0", toNodeId: "n1" }], "me", NO_FREEZE)).toEqual(["teleport"]);
  });

  it("at the end: a perfect score, and coming through a ghost pack uncaught", () => {
    const s = running();
    const finished = (score: number) => ({ ...s, status: "finished" as const, result: { finalScores: { me: score } } as unknown as SimulationState["result"] });
    expect(trackRound(newRoundTracker(), s, finished(ACHIEVEMENT_GOALS.perfectScore), [], "me", NO_FREEZE)).toEqual(["perfectRound"]);
    expect(trackRound(newRoundTracker(), s, finished(ACHIEVEMENT_GOALS.perfectScore - 1), [], "me", NO_FREEZE)).toEqual([]);

    const pack = { ...s, ghost: { ...s.ghost, huntedTeamId: "me" } };
    const survivor = newRoundTracker();
    trackRound(survivor, pack, pack, [{ type: "ghostStarted", tick: 1, teamId: null, endsAtTick: 9 }], "me", NO_FREEZE);
    expect(trackRound(survivor, pack, { ...pack, ...finished(0), ghost: pack.ghost }, [], "me", NO_FREEZE)).toEqual(["packSurvivor"]);

    const caught = newRoundTracker();
    trackRound(caught, pack, pack, [{ type: "ghostStarted", tick: 1, teamId: null, endsAtTick: 9 }, { type: "playerCaught", tick: 2, ghostId: "cpu", runnerId: "me", frozenUntilTick: 9, stolenKeyId: null }], "me", NO_FREEZE);
    expect(trackRound(caught, pack, { ...pack, ...finished(0), ghost: pack.ghost }, [], "me", NO_FREEZE)).toEqual([]);
  });

  it("every achievement id is distinct", () => {
    expect(new Set(ACHIEVEMENT_IDS).size).toBe(ACHIEVEMENT_IDS.length);
  });
});

describe("tower run achievements", () => {
  const floors = DEFAULT_TUNING.towerRun.floors.length;
  const record = (floor: number, passed = true) => ({ floor, mapId: "m", participants: 2, rank: 1, passRank: 1, passed, score: 10 });
  const run = (patch: Partial<TowerRunState>): TowerRunState => ({ ...startTowerRun(1), ...patch });

  it("halfway on passing floor 10", () => {
    expect(runAchievements(run({ history: [record(9)] }))).toEqual([]);
    expect(runAchievements(run({ history: [record(10)] }))).toEqual(["halfway"]);
    expect(runAchievements(run({ history: [record(10, false)] }))).toEqual([]);
  });

  it("summit on passing the top floor; flawless when every floor from the first passed without continuing", () => {
    const all = Array.from({ length: floors }, (_, i) => record(i + 1));
    expect(runAchievements(run({ history: all })).sort()).toEqual(["flawless", "halfway", "summit"]);
    expect(runAchievements(run({ history: all, continues: 1 })).sort()).toEqual(["halfway", "summit"]);
    expect(runAchievements(run({ history: [...all.slice(0, -1), record(floors, false)] }))).toEqual([]);
  });
});
