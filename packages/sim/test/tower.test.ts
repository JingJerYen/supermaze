import { describe, expect, it } from "vitest";
import { MapGrid } from "../src/map/grid.js";
import type { MapData } from "../src/map/types.js";
import { Simulation, type PlayerInput } from "../src/simulation.js";
import { NO_FREEZE, TINY_MAP } from "./fixtures.js";

const press: PlayerInput = { moveX: 0, moveY: 0, action: true };

/** Keys under the entry tiles so everyone can climb at once. */
const INSTANT: MapData = {
  ...TINY_MAP,
  spawns: {
    ...TINY_MAP.spawns,
    keys: [
      { x: 2, y: 3, layer: "road" },
      { x: 2, y: 5, layer: "road" },
    ],
  },
};

describe("tower platform", () => {
  const grid = MapGrid.fromMapData(TINY_MAP);

  it("is the footprint plus a one-tile ring, and only exists on the towerTop layer", () => {
    // Tower at (2,4): platform spans x 1..3, y 3..5.
    expect(grid.isWalkable(2, 4, "towerTop")).toBe(true);
    expect(grid.isWalkable(1, 3, "towerTop")).toBe(true);
    expect(grid.isWalkable(3, 5, "towerTop")).toBe(true);
    expect(grid.isWalkable(4, 4, "towerTop")).toBe(false);
    expect(grid.isWalkable(2, 4, "road")).toBe(false);
    expect(grid.platformTiles()).toHaveLength(9);
    expect(grid.platformTiles()[0]).toEqual({ x: 2, y: 4, layer: "towerTop" });
  });

  it("seats climbers on distinct platform tiles and lets them walk around but not off", () => {
    const sim = new Simulation({
      seed: 3,
      map: INSTANT,
      tuning: NO_FREEZE,
      participants: [
        { id: "a", teamId: "A", controller: "human" },
        { id: "b", teamId: "B", controller: "human" },
      ],
    });
    sim.start();
    sim.step(new Map()); // pick up keys underfoot
    sim.step(new Map([["a", press], ["b", press]]));
    const a = sim.getState().players["a"]!;
    const b = sim.getState().players["b"]!;
    expect(a.phase).toBe("tower");
    expect(a.mover.from.layer).toBe("towerTop");
    expect(b.mover.from.layer).toBe("towerTop");
    expect(a.mover.from).not.toEqual(b.mover.from);
    expect(sim.getState().status).toBe("finished"); // both one-player teams complete

    // A finished round freezes everything, so exercise platform movement on a fresh, still-running sim.
    const solo = new Simulation({
      seed: 3,
      map: INSTANT,
      tuning: NO_FREEZE,
      participants: [
        { id: "a", teamId: "A", controller: "human" },
        { id: "b", teamId: "A", controller: "human" }, // same team: round continues until both are up
      ],
    });
    solo.start();
    solo.step(new Map());
    solo.step(new Map([["a", press]]));
    expect(solo.getState().status).toBe("running");
    const start = solo.getState().players["a"]!.mover.from;
    expect(start).toEqual({ x: 2, y: 4, layer: "towerTop" });
    const n = Math.ceil(solo.tuning.tickRate / solo.tuning.movement.speedTilesPerSec);
    // Walk east twice: (3,4) is the platform edge, (4,4) is off it.
    for (let i = 0; i < n * 4; i++) solo.step(new Map([["a", { moveX: 1, moveY: 0 }]]));
    expect(solo.getState().players["a"]!.mover.from).toEqual({ x: 3, y: 4, layer: "towerTop" });
    expect(solo.getState().players["a"]!.mover.target).toBeNull();
    // Still counted as climbed and immune to maze interactions.
    expect(solo.getState().players["a"]!.phase).toBe("tower");
    expect(solo.availableAction(solo.getState().players["a"]!)).toBeNull();
  });
});
