import { describe, expect, it } from "vitest";
import type { MapData } from "../src/map/types.js";
import { Simulation, type PlayerInput } from "../src/simulation.js";
import { DEFAULT_TUNING } from "../src/tuning/index.js";
import { TINY_MAP } from "./fixtures.js";
import { walk } from "./walk.js";

const N: PlayerInput = { moveX: 0, moveY: -1 };
const press: PlayerInput = { moveX: 0, moveY: 0, action: true };


describe("placeholder items (effects disabled)", () => {
  it("any non-teleport item drops a passable block that expires after placeholderLifetimeSec", () => {
    const map: MapData = {
      ...TINY_MAP,
      spawns: { ...TINY_MAP.spawns, keys: [{ x: 7, y: 6, layer: "road" }], itemBoxes: [{ x: 2, y: 2, layer: "road" }, { x: 7, y: 4, layer: "road" }, { x: 6, y: 6, layer: "road" }] },
    };
    const tuning = {
      ...DEFAULT_TUNING,
      itemBoxes: { perParticipant: 1, weights: { oneWayDoor: 0, obstacle: 1, hammer: 0, trap: 0, teleportNode: 0 } },
      placeables: { ...DEFAULT_TUNING.placeables, effectsEnabled: false, placeholderLifetimeSec: 1 },
    };
    let seed = 0;
    let sim: Simulation;
    for (;;) {
      sim = new Simulation({ seed: ++seed, map, participants: [{ id: "a", teamId: "A", controller: "human" }], tuning });
      sim.start();
      if (Object.values(sim.getState().boxes).some((b) => b.pos.x === 2 && b.pos.y === 2)) break;
    }
    walk(sim, "a", [N]); // (2,2), holding an "obstacle", facing north
    const ev = sim.step(new Map([["a", press]]));
    expect(ev).toContainEqual(expect.objectContaining({ type: "placeablePlaced", kind: "obstacle", placeholder: true }));
    const block = Object.values(sim.getState().placeables)[0]!;
    expect(block.placeholder).toBe(true);
    expect(block.pos).toEqual({ x: 2, y: 1, layer: "road" });

    // Passable: a walks straight through it.
    walk(sim, "a", [N]);
    expect(sim.getState().players["a"]!.mover.from).toEqual({ x: 2, y: 1, layer: "road" });

    // Gone after its lifetime.
    for (let i = 0; i < DEFAULT_TUNING.tickRate; i++) sim.step(new Map());
    expect(Object.values(sim.getState().placeables)).toHaveLength(0);
  });
});
