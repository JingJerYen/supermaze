import { describe, expect, it } from "vitest";
import { Simulation } from "../src/simulation.js";

const participants = [
  { id: "p1", teamId: "t1", controller: "human" as const },
  { id: "p2", teamId: "t2", controller: "cpu" as const },
];

describe("Simulation", () => {
  it("advances one tick per step", () => {
    const sim = new Simulation({ seed: 1, participants });
    sim.step(new Map());
    sim.step(new Map());
    expect(sim.getState().tick).toBe(2);
  });

  it("is deterministic: same seed and inputs give identical state", () => {
    const a = new Simulation({ seed: 42, participants });
    const b = new Simulation({ seed: 42, participants });
    const inputs = new Map([["p1", { moveX: 1, moveY: 0 }]]);
    for (let i = 0; i < 50; i++) {
      a.step(inputs);
      b.step(inputs);
    }
    expect(a.getState()).toEqual(b.getState());
    expect(a.rng.next()).toBe(b.rng.next());
  });
});
