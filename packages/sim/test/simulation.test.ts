import { describe, expect, it } from "vitest";
import { Simulation } from "../src/simulation.js";
import { TINY_MAP } from "./fixtures.js";

const participants = [
  { id: "p1", teamId: "t1", controller: "human" as const },
  { id: "p2", teamId: "t2", controller: "cpu" as const },
];

describe("Simulation", () => {
  it("advances one tick per step", () => {
    const sim = new Simulation({ seed: 1, map: TINY_MAP, participants });
    sim.step(new Map());
    sim.step(new Map());
    expect(sim.getState().tick).toBe(2);
  });

  it("is deterministic: same seed and inputs give identical state", () => {
    const a = new Simulation({ seed: 42, map: TINY_MAP, participants });
    const b = new Simulation({ seed: 42, map: TINY_MAP, participants });
    const inputs = new Map([["p1", { moveX: 1, moveY: 0 }]]);
    for (let i = 0; i < 50; i++) {
      a.step(inputs);
      b.step(inputs);
    }
    expect(a.getState()).toEqual(b.getState());
    expect(a.rng.next()).toBe(b.rng.next());
  });

  it("moves a player according to its input", () => {
    const sim = new Simulation({ seed: 1, map: TINY_MAP, participants });
    const start = sim.getState().players["p1"]!.mover.from;
    const inputs = new Map([["p1", { moveX: 0, moveY: 1 }]]); // south: away from the tower
    for (let i = 0; i < 10; i++) sim.step(inputs);
    const after = sim.getState().players["p1"]!.mover;
    expect(after.from.y).toBeGreaterThan(start.y);
    expect(sim.getState().players["p2"]!.mover.target).toBeNull();
  });

  it("adds players mid-round and switches controllers without moving them", () => {
    const sim = new Simulation({ seed: 1, map: TINY_MAP, participants: [] });
    sim.addPlayer({ id: "a", teamId: "t1", controller: "human" });
    sim.addPlayer({ id: "b", teamId: "t2", controller: "human" });
    expect(Object.keys(sim.getState().players)).toEqual(["a", "b"]);
    expect(sim.getState().players["a"]!.mover.from).not.toEqual(sim.getState().players["b"]!.mover.from);

    const before = sim.getState().players["a"]!.mover;
    sim.setController("a", "cpu");
    expect(sim.getState().players["a"]!.controller).toBe("cpu");
    expect(sim.getState().players["a"]!.mover).toEqual(before);

    sim.removePlayer("b");
    expect(sim.getState().players["b"]).toBeUndefined();
  });
});
