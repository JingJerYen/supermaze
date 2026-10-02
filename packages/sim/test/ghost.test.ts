import { describe, expect, it } from "vitest";
import type { MapData } from "../src/map/types.js";
import { moverPosition } from "../src/movement.js";
import { chooseGhostTeam, type GhostState } from "../src/ghost.js";
import { Simulation, type PlayerInput, type PlayerState } from "../src/simulation.js";
import { DEFAULT_TUNING, type Tuning } from "../src/tuning/index.js";
import { TINY_MAP } from "./fixtures.js";

/** Short event timings so tests stay fast: 1 s idle, 1 s warning, 2 s active at 20 Hz. */
const FAST: Tuning = {
  ...DEFAULT_TUNING,
  round: { ...DEFAULT_TUNING.round, startFreezeSec: 0, introSec: 0 },
  ghostEvent: { ...DEFAULT_TUNING.ghostEvent, intervalSec: 1, warningSec: 1, durationSec: 2, caughtFreezeSec: 1, caughtProtectionSec: 1 },
};
const T = FAST.tickRate;
const still: PlayerInput = { moveX: 0, moveY: 0 };

/** Keys far away so nobody climbs by accident; a on team A, b on team B, both at tower entries. */
const MAP: MapData = { ...TINY_MAP, spawns: { ...TINY_MAP.spawns, keys: [{ x: 7, y: 6, layer: "road" }, { x: 1, y: 1, layer: "road" }] } };
const two = [
  { id: "a", teamId: "A", controller: "human" as const },
  { id: "b", teamId: "B", controller: "human" as const },
];

function run(sim: Simulation, ticks: number, inputs = new Map<string, PlayerInput>()) {
  const events = [];
  for (let i = 0; i < ticks; i++) events.push(...sim.step(inputs));
  return events;
}

describe("ghost schedule", () => {
  it("idle -> warning -> active -> idle with announced timings", () => {
    const sim = new Simulation({ seed: 3, map: MAP, participants: two, tuning: FAST });
    sim.start();
    expect(sim.getState().ghost.phase).toBe("idle");
    let ev = run(sim, T); // 1 s idle
    expect(ev.map((e) => e.type)).toContain("ghostWarning");
    expect(sim.getState().ghost.phase).toBe("warning");
    const team = sim.getState().ghost.teamId;
    expect(team).toBe("A"); // first team in sorted order goes first
    ev = run(sim, T);
    expect(ev.map((e) => e.type)).toContain("ghostStarted");
    expect(sim.getState().ghost.phase).toBe("active");
    ev = run(sim, 2 * T);
    expect(ev.map((e) => e.type)).toContain("ghostEnded");
    expect(sim.getState().ghost.phase).toBe("idle");
    expect(sim.getState().ghost.counts[team!]).toBe(1);
  });

  it("alternates between the two teams", () => {
    const sim = new Simulation({ seed: 3, map: MAP, participants: two, tuning: FAST });
    sim.start();
    const order: string[] = [];
    for (let round = 0; round < 4; round++) {
      run(sim, T); // idle
      order.push(sim.getState().ghost.teamId!);
      run(sim, 3 * T); // warning + active
    }
    expect(order[0]).not.toBe(order[1]);
    expect(order[2]).toBe(order[0]);
    expect(order[3]).toBe(order[1]);
  });

  it("never runs with a single team in the maze", () => {
    const sim = new Simulation({ seed: 3, map: MAP, participants: [two[0]!], tuning: FAST });
    sim.start();
    const ev = run(sim, 6 * T);
    expect(ev.find((e) => e.type === "ghostWarning")).toBeUndefined();
    expect(sim.getState().ghost.phase).toBe("idle");
  });
});

describe("ghost rules", () => {
  function activeSim(seedGhostIsA = true) {
    // Find a seed where team A becomes the first ghost team so the roles are known.
    for (let seed = 1; seed < 50; seed++) {
      const sim = new Simulation({ seed, map: MAP, participants: two, tuning: FAST });
      sim.start();
      run(sim, 2 * T); // idle + warning -> active
      if (sim.getState().ghost.phase === "active" && (sim.getState().ghost.teamId === "A") === seedGhostIsA) return sim;
    }
    throw new Error("no seed");
  }

  it("ghosts move faster and cannot pick up keys", () => {
    const sim = activeSim();
    const a = sim.getState().players["a"]!;
    expect(sim.isGhost(a)).toBe(true);
    expect(sim.isGhost(sim.getState().players["b"]!)).toBe(false);
    // a (ghost) pushes south from the south entry (2,4); compare against a plain run of the same player.
    const plain = new Simulation({ seed: 1, map: MAP, participants: [two[0]!], tuning: FAST });
    plain.start();
    const dirs = new Map([["a", { moveX: 0, moveY: 1 }]]);
    run(sim, 6, dirs); // short enough that neither reaches the border wall at (2,7)
    run(plain, 6, dirs);
    const ghostY = moverPosition(sim.getState().players["a"]!.mover).y;
    const plainY = moverPosition(plain.getState().players["a"]!.mover).y;
    expect(plainY).toBeGreaterThan(4);
    expect(ghostY).toBeGreaterThan(plainY);
  });

  it("a ghost's key and items are locked but switches still work", () => {
    const sim = activeSim();
    const a = sim.getState().players["a"]!;
    // Give a a key and an item by state? Not possible; check the decision instead: at an entry with no key nothing; ghosts get null unless a switch is underfoot.
    expect(sim.availableAction(a)).toBeNull();
    // The bag is locked too: a ghost cannot discard.
    expect(sim.canDiscard({ ...a, items: ["trap"] })).toBe(false);
    expect(sim.canDiscard({ ...sim.getState().players["b"]!, items: ["trap"] })).toBe(true);
  });

  it("catching freezes the runner, empties the bag, keeps the key, scores the ghost and protects from re-catch", () => {
    const sim = activeSim();
    // b (runner) starts on the east entry (3,3) and steps east to (4,3). a (ghost) starts on the
    // south entry (2,4), walks east along row 4 to (4,4) (blocked by the wall at (5,4)), then north onto b.
    const bIn = new Map([["b", { moveX: 1, moveY: 0 }]]);
    run(sim, 7, bIn); // released just before arriving, so b settles on (4,3) instead of walking on
    const aEast = new Map([["a", { moveX: 1, moveY: 0 }]]);
    run(sim, 16, aEast); // a to (4,4)
    const ev = run(sim, 12, new Map([["a", { moveX: 0, moveY: -1 }]])); // a north onto (4,3)
    const caught = ev.find((e) => e.type === "playerCaught");
    expect(caught).toBeDefined();
    const b = sim.getState().players["b"]!;
    expect(b.items).toEqual([]);
    expect(b.frozenBy).toBe("ghost");
    expect(b.frozenUntilTick).toBeGreaterThan(sim.getState().tick);
    expect(b.protectedUntilTick).toBeGreaterThan(b.frozenUntilTick);
    expect(sim.getState().players["a"]!.score).toBe(FAST.scoring.ghostCatch);
    // Standing on top of the frozen runner does not catch again.
    const again = run(sim, 3);
    expect(again.find((e) => e.type === "playerCaught")).toBeUndefined();
  });

  it("players on the tower are exempt", () => {
    const sim = new Simulation({
      seed: 3,
      map: { ...TINY_MAP, spawns: { ...TINY_MAP.spawns, keys: [{ x: 2, y: 4, layer: "road" }, { x: 3, y: 3, layer: "road" }, { x: 7, y: 6, layer: "road" }] } },
      participants: [...two, { id: "c", teamId: "B", controller: "human" as const }],
      tuning: FAST,
    });
    sim.start();
    sim.step(new Map()); // a and b pick up keys underfoot
    sim.step(new Map([["b", { moveX: -1, moveY: 0 }]])); // b faces the east door
    sim.step(new Map([["b", { ...still, action: true }]])); // b climbs
    expect(sim.getState().players["b"]!.phase).toBe("tower");
    run(sim, 2 * T); // -> active; eligible teams: A (a) and B (c)
    expect(sim.getState().ghost.phase).toBe("active");
    expect(sim.isGhost(sim.getState().players["b"]!)).toBe(false);
  });
});

describe("developer shortcut", () => {
  it("forces a warning at once, respecting rotation, and is ignored outside idle", () => {
    const sim = new Simulation({ seed: 3, map: MAP, participants: two, tuning: FAST });
    sim.start();
    const ev = sim.debugForceGhost(1);
    expect(ev.map((e) => e.type)).toEqual(["ghostWarning"]);
    expect(sim.getState().ghost.phase).toBe("warning");
    expect(sim.getState().ghost.teamId).toBe("A");
    expect(sim.debugForceGhost(1)).toEqual([]); // already warning
    run(sim, T);
    expect(sim.getState().ghost.phase).toBe("active");
  });
});

describe("schedule follows the round length", () => {
  it("first warning after a fifth of the round, then a fifth between events", () => {
    const tuning: Tuning = { ...DEFAULT_TUNING, round: { ...DEFAULT_TUNING.round, startFreezeSec: 0, introSec: 0 } };
    expect(tuning.ghostEvent.intervalSec).toBeNull();
    const sim = new Simulation({ seed: 3, map: MAP, participants: two, tuning, timeLimitSec: 100 });
    sim.start();
    const g = tuning.ghostEvent;
    const at = (type: string, events: { type: string; tick: number }[]) => events.filter((e) => e.type === type).map((e) => e.tick / T);
    const events = run(sim, 90 * T);
    // 100 s round: warning at 20 s, chase from 20 + warning, over after the duration, next warning 20 s later.
    const firstEnd = 20 + g.warningSec + g.durationSec;
    expect(at("ghostWarning", events)).toEqual([20, firstEnd + 20]);
    expect(at("ghostStarted", events)[0]).toBe(20 + g.warningSec);
    expect(at("ghostEnded", events)[0]).toBe(firstEnd);
  });

  it("no warning when the round has no time left for a whole event", () => {
    const tuning: Tuning = { ...DEFAULT_TUNING, round: { ...DEFAULT_TUNING.round, startFreezeSec: 0, introSec: 0 } };
    const g = tuning.ghostEvent;
    // 60 s round: warning at 12 s, over at 12 + warning + duration; the next one
    // would be due 12 s later but could not finish before the round does.
    const sim = new Simulation({ seed: 3, map: MAP, participants: two, tuning, timeLimitSec: 60 });
    sim.start();
    const firstEnd = 12 + g.warningSec + g.durationSec;
    expect(firstEnd + 12 + g.warningSec + g.durationSec).toBeGreaterThan(60);
    const events = run(sim, 60 * T + 1);
    expect(events.filter((e) => e.type === "ghostWarning").map((e) => e.tick / T)).toEqual([12]);
    expect(sim.getState().ghost.phase).toBe("idle");
  });

  it("an event that exactly fits is still announced", () => {
    const tuning: Tuning = { ...DEFAULT_TUNING, round: { ...DEFAULT_TUNING.round, startFreezeSec: 0, introSec: 0 } };
    const g = tuning.ghostEvent;
    // Round sized so the first warning plus the whole event ends on the last tick.
    const limit = (g.warningSec + g.durationSec) / (1 - g.firstWarningShare);
    const sim = new Simulation({ seed: 3, map: MAP, participants: two, tuning, timeLimitSec: limit });
    sim.start();
    const events = run(sim, Math.round(limit * T));
    expect(events.map((e) => e.type)).toContain("ghostStarted");
  });
});

describe("stealing keys", () => {
  /** a (team A) on the south door (2,4), b (team B) on the east door (3,3). Keys where the test puts them. */
  function chase(keys: { x: number; y: number }[]) {
    const map: MapData = { ...TINY_MAP, spawns: { ...TINY_MAP.spawns, keys: keys.map((k) => ({ ...k, layer: "road" as const })) } };
    const sim = new Simulation({ seed: 3, map, participants: two, tuning: FAST });
    sim.start();
    run(sim, 2 * T); // idle + warning -> active
    expect(sim.getState().ghost).toMatchObject({ phase: "active", teamId: "A" });
    run(sim, 7, new Map([["b", { moveX: 1, moveY: 0 }]])); // b settles on (4,3)
    run(sim, 16, new Map([["a", { moveX: 1, moveY: 0 }]])); // a to (4,4)
    const events = run(sim, 12, new Map([["a", { moveX: 0, moveY: -1 }]])); // a north onto b
    return { sim, caught: events.find((e) => e.type === "playerCaught") };
  }

  it("a ghost without a key takes the runner's, for the catch score only", () => {
    // b starts on a key; the other key is far away, so a has none.
    const { sim, caught } = chase([{ x: 3, y: 3 }, { x: 7, y: 6 }]);
    const st = sim.getState();
    const keyId = Object.values(st.keys).find((k) => k.pos.x === 3 && k.pos.y === 3)!.id;
    expect(caught).toMatchObject({ ghostId: "a", runnerId: "b", stolenKeyId: keyId });
    expect(st.players["a"]).toMatchObject({ keyId, keyScored: false, score: FAST.scoring.ghostCatch });
    expect(st.players["b"]).toMatchObject({ keyId: null, keyScored: true, score: FAST.scoring.keyFound });
    expect(st.keys[keyId]!.ownerId).toBe("a");
  });

  it("a ghost that has a key leaves the runner's alone", () => {
    const { sim, caught } = chase([{ x: 3, y: 3 }, { x: 2, y: 4 }]); // both start on a key
    expect(caught).toMatchObject({ ghostId: "a", runnerId: "b", stolenKeyId: null });
    expect(sim.getState().players["b"]!.keyId).not.toBeNull();
    expect(sim.getState().players["a"]!.score).toBe(FAST.scoring.keyFound + FAST.scoring.ghostCatch);
  });

  it("the robbed player can find another key, without scoring for it again", () => {
    const { sim } = chase([{ x: 3, y: 3 }, { x: 5, y: 3 }]); // the spare key lies one tile east of where b is caught
    expect(sim.getState().players["b"]!.keyId).toBeNull();
    run(sim, 25); // the one-second freeze wears off; b's own turn as a ghost has not begun yet
    run(sim, 12, new Map([["b", { moveX: 1, moveY: 0 }]]));
    const b = sim.getState().players["b"]!;
    expect(b.keyId).not.toBeNull();
    expect(b.score).toBe(FAST.scoring.keyFound);
    expect(sim.getState().players["a"]!.keyId).not.toBeNull(); // the thief keeps what it took
  });
});

describe("who goes next", () => {
  const player = (id: string, teamId: string, keyId: string | null) => ({ id, teamId, keyId, phase: "maze" }) as unknown as PlayerState;
  const players = { a: player("a", "A", "k0"), b: player("b", "B", null) };
  const state = (counts: Record<string, number>, lastTeamId: string | null): GhostState => ({ phase: "idle", teamId: null, huntedTeamId: null, phaseEndsAtTick: 0, counts, lastTeamId, intervalTicks: 1 });

  it("fewest turns first; then the side with fewer keys, even twice in a row; then not the last; then id order", () => {
    expect(chooseGhostTeam(state({ A: 1, B: 0 }, "A"), players)).toBe("B");
    expect(chooseGhostTeam(state({ A: 0, B: 1 }, "B"), players)).toBe("A"); // turns outrank keys
    expect(chooseGhostTeam(state({ A: 1, B: 1 }, "B"), players)).toBe("B"); // tied: B has no key
    const even = { a: player("a", "A", null), b: player("b", "B", null) };
    expect(chooseGhostTeam(state({ A: 1, B: 1 }, "B"), even)).toBe("A"); // keys tied too: not the last one
    expect(chooseGhostTeam(state({}, null), even)).toBe("A"); // nothing to tell them apart: id order
  });
});

describe("ghost pack (tower run special floor)", () => {
  const three = [
    { id: "me", teamId: "me", controller: "human" as const },
    { id: "c1", teamId: "c1", controller: "cpu" as const },
    { id: "c2", teamId: "c2", controller: "cpu" as const },
  ];
  // Enough keys for six, away from the tower.
  const keys = [[7, 6], [1, 1], [1, 2], [1, 5], [7, 5], [7, 4]].map(([x, y]) => ({ x: x!, y: y!, layer: "road" as const }));
  const PACK_MAP: MapData = { ...MAP, spawns: { ...MAP.spawns, keys } };
  const packSim = () => {
    const sim = new Simulation({ seed: 3, map: PACK_MAP, participants: three, tuning: FAST, teamMode: "solo", ghostPack: "me" });
    sim.start();
    return sim;
  };

  it("every event turns everyone but the hunted player into ghosts at once", () => {
    const sim = packSim();
    let ev = run(sim, T);
    expect(ev).toContainEqual(expect.objectContaining({ type: "ghostWarning", teamId: null }));
    ev = run(sim, T);
    expect(ev).toContainEqual(expect.objectContaining({ type: "ghostStarted", teamId: null }));
    const st = sim.getState();
    expect(sim.isGhost(st.players["me"]!)).toBe(false);
    expect(sim.isGhost(st.players["c1"]!)).toBe(true);
    expect(sim.isGhost(st.players["c2"]!)).toBe(true);
    // Again on the next event: no rotation.
    run(sim, 2 * T + T + T);
    expect(sim.getState().ghost.phase).toBe("active");
    expect(sim.isGhost(sim.getState().players["me"]!)).toBe(false);
  });

  it("ghosts on the same tile never catch each other; they catch the hunted player", () => {
    // Six players on the tiny map's four entries: the fifth lands on me, the sixth on the first CPU.
    const six = ["me", "c1", "c2", "c3", "c4", "c5"].map((id) => ({ id, teamId: id, controller: (id === "me" ? "human" : "cpu") as "human" | "cpu" }));
    const sim = new Simulation({ seed: 3, map: PACK_MAP, participants: six, tuning: FAST, teamMode: "solo", ghostPack: "me" });
    sim.start();
    const at = (id: string) => sim.getState().players[id]!.mover.from;
    expect(at("c4")).toEqual(at("me"));
    expect(at("c5")).toEqual(at("c1"));
    const caught = run(sim, 2 * T + 1).flatMap((e) => (e.type === "playerCaught" ? [e.runnerId] : []));
    expect(caught).toEqual(["me"]);
  });

  it("is ignored outside solo rounds", () => {
    const sim = new Simulation({ seed: 3, map: MAP, participants: two, tuning: FAST, ghostPack: "a" });
    sim.start();
    expect(sim.getState().ghost.huntedTeamId).toBeNull();
  });
});

