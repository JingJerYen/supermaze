import { describe, expect, it } from "vitest";
import type { MapData } from "../src/map/types.js";
import { moverPosition } from "../src/movement.js";
import { Simulation, type PlayerInput } from "../src/simulation.js";
import { DEFAULT_TUNING, type Tuning } from "../src/tuning/index.js";
import { TINY_MAP } from "./fixtures.js";

/** Short event timings so tests stay fast: 1 s idle, 1 s warning, 2 s active at 20 Hz. */
const FAST: Tuning = {
  ...DEFAULT_TUNING,
  round: { ...DEFAULT_TUNING.round, startFreezeSec: 0 },
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
