import { describe, expect, it } from "vitest";
import { MapGrid } from "../src/map/grid.js";
import type { MapData } from "../src/map/types.js";
import { Simulation, type PlayerInput } from "../src/simulation.js";
import { NO_FREEZE, TINY_MAP } from "./fixtures.js";
import { faceTower } from "./walk.js";

const press: PlayerInput = { moveX: 0, moveY: 0, action: true };

/** Keys under the first two spawn tiles (south and east entries) so everyone can climb at once. */
const INSTANT: MapData = {
  ...TINY_MAP,
  spawns: {
    ...TINY_MAP.spawns,
    keys: [
      { x: 2, y: 4, layer: "road" },
      { x: 3, y: 3, layer: "road" },
    ],
  },
};

describe("tower platform", () => {
  const grid = MapGrid.fromMapData(TINY_MAP);

  it("is the footprint plus a one-tile ring, and only exists on the towerTop layer", () => {
    // Tower at (2,3): platform spans x 1..3, y 2..4.
    expect(grid.isWalkable(2, 3, "towerTop")).toBe(true);
    expect(grid.isWalkable(1, 4, "towerTop")).toBe(true);
    expect(grid.isWalkable(3, 2, "towerTop")).toBe(true);
    expect(grid.isWalkable(4, 3, "towerTop")).toBe(false);
    expect(grid.isWalkable(2, 3, "road")).toBe(false);
    expect(grid.platformTiles()).toHaveLength(9);
    expect(grid.platformTiles()[0]).toEqual({ x: 2, y: 3, layer: "towerTop" });
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
    faceTower(sim, ["a", "b"]);
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
    faceTower(solo, ["a"]);
    solo.step(new Map([["a", press]]));
    expect(solo.getState().status).toBe("running");
    const start = solo.getState().players["a"]!.mover.from;
    expect(start).toEqual({ x: 2, y: 3, layer: "towerTop" });
    const n = Math.ceil(solo.tuning.tickRate / solo.tuning.movement.speedTilesPerSec);
    // Walk east twice: (3,3) is the platform edge, (4,3) is off it.
    for (let i = 0; i < n * 4; i++) solo.step(new Map([["a", { moveX: 1, moveY: 0 }]]));
    expect(solo.getState().players["a"]!.mover.from).toEqual({ x: 3, y: 3, layer: "towerTop" });
    expect(solo.getState().players["a"]!.mover.target).toBeNull();
    // Still counted as climbed and immune to maze interactions.
    expect(solo.getState().players["a"]!.phase).toBe("tower");
    expect(solo.availableAction(solo.getState().players["a"]!)).toBeNull();
  });
});
