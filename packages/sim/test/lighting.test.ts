import { describe, expect, it } from "vitest";
import { availableAction } from "../src/actions.js";
import { deriveSwitchFacing } from "../src/lighting.js";
import { DIRS, MapGrid } from "../src/map/grid.js";
import { validateMap } from "../src/map/validate.js";
import { Simulation, type PlayerInput } from "../src/simulation.js";
import { LATTICE_MAP, NO_FREEZE } from "./fixtures.js";
import { walk } from "./walk.js";

const grid = MapGrid.fromMapData(LATTICE_MAP);
const still: PlayerInput = { moveX: 0, moveY: 0 };
const press: PlayerInput = { ...still, action: true };

/** Drive `id` one tile per direction, ending at rest (release before the arrival tick). */

describe("deriveSwitchFacing", () => {
  it("prefers north, then east, west, south", () => {
    // (7,3): north (7,2) is wall -> north.
    expect(deriveSwitchFacing(grid, { x: 7, y: 3, layer: "road" })).toEqual(DIRS.north);
    // (1,5): north (1,4) road, east (2,5) bridge, west (0,5) void, south (1,6) wall -> south.
    expect(deriveSwitchFacing(grid, { x: 1, y: 5, layer: "road" })).toEqual(DIRS.south);
    // (3,5): north (3,4) wall and east (4,4)? no: east (4,5) road; north wins over south (3,6) road anyway.
    expect(deriveSwitchFacing(grid, { x: 3, y: 5, layer: "road" })).toEqual(DIRS.north);
    // (6,3): N (6,2) wall -> north; (4,5): N (4,4) wall -> north. West-only case: (6,1)? N is void, W (5,1) road. Use (1,1): all void/road -> null below.
  });

  it("returns null on a tile with no wall", () => {
    // (5,3): N (5,2) road, E (6,3) road, W (4,3) road, S (5,4) road.
    expect(deriveSwitchFacing(grid, { x: 5, y: 3, layer: "road" })).toBeNull();
  });
});

describe("validator: light switches", () => {
  it("rejects wall-top switches and switches touching no wall", () => {
    const wallTop = { ...LATTICE_MAP, spawns: { ...LATTICE_MAP.spawns, lightSwitches: [{ x: 3, y: 2, layer: "wallTop" as const }, { x: 5, y: 1, layer: "road" as const }] } };
    expect(validateMap(wallTop).join("\n")).toMatch(/must be on the road layer/);
    const floating = { ...LATTICE_MAP, spawns: { ...LATTICE_MAP.spawns, lightSwitches: [{ x: 5, y: 3, layer: "road" as const }, { x: 5, y: 1, layer: "road" as const }] } };
    expect(validateMap(floating).join("\n")).toMatch(/touches no wall/);
  });
});

describe("lights in the simulation", () => {
  const participants = [{ id: "a", teamId: "t1", controller: "human" as const }];

  it("starts lit with the map's number of unused switches, each facing a wall", () => {
    const sim = new Simulation({ seed: 2, map: LATTICE_MAP, participants, tuning: NO_FREEZE });
    sim.start();
    const st = sim.getState();
    expect(st.lightsOn).toBe(true);
    const switches = Object.values(st.switches);
    expect(switches).toHaveLength(LATTICE_MAP.lightSwitchCount);
    for (const s of switches) {
      expect(s.used).toBe(false);
      expect(grid.kindAt(s.pos.x + s.facing.dx, s.pos.y + s.facing.dy)).toBe("wall");
    }
  });

  /** a spawns on the south entry (5,6); the switch at (1,5) is seven tiles away round the bottom row. */
  const toFirstSwitch: PlayerInput[] = [
    { moveX: 0, moveY: 1 }, // (5,7)
    { moveX: -1, moveY: 0 }, // (4,7)
    { moveX: -1, moveY: 0 }, // (3,7)
    { moveX: 0, moveY: -1 }, // (3,6)
    { moveX: 0, moveY: -1 }, // (3,5)
    { moveX: -1, moveY: 0 }, // (2,5) under the bridge
    { moveX: -1, moveY: 0 }, // (1,5)
  ];

  it("a switch flips the lights once and then is spent", () => {
    // Both LATTICE switch candidates are used (count 2 of 2).
    const sim = new Simulation({ seed: 2, map: LATTICE_MAP, participants, tuning: NO_FREEZE });
    sim.start();
    walk(sim, "a", toFirstSwitch);
    const a = sim.getState().players["a"]!;
    expect(a.mover.from).toEqual({ x: 1, y: 5, layer: "road" });
    expect(availableAction(sim.grid, sim.getState(), a, sim.tuning.inventory.capacity)).toBe("switch");

    let events = sim.step(new Map([["a", press]]));
    expect(events).toContainEqual({ type: "lightsToggled", tick: expect.any(Number), playerId: "a", switchId: expect.any(String), lightsOn: false });
    expect(sim.getState().lightsOn).toBe(false);
    expect(Object.values(sim.getState().switches).filter((s) => s.used)).toHaveLength(1);

    // Pressing again on the spent switch does nothing.
    events = sim.step(new Map([["a", press]]));
    expect(events.find((e) => e.type === "lightsToggled")).toBeUndefined();
    expect(sim.getState().lightsOn).toBe(false);
    expect(availableAction(sim.grid, sim.getState(), a, sim.tuning.inventory.capacity)).toBeNull();
  });

  it("the last of an even number of switches leaves the map lit", () => {
    const sim = new Simulation({ seed: 2, map: LATTICE_MAP, participants, tuning: NO_FREEZE });
    sim.start();
    walk(sim, "a", toFirstSwitch);
    sim.step(new Map([["a", press]]));
    expect(sim.getState().lightsOn).toBe(false);
    // Second switch at (7,3): up the west column, then east along row 3.
    walk(sim, "a", [
      { moveX: 0, moveY: -1 }, // (1,4)
      { moveX: 0, moveY: -1 }, // (1,3) stairs, stays on the road layer
      { moveX: 1, moveY: 0 }, // (2,3)
      { moveX: 1, moveY: 0 }, // (3,3)
      { moveX: 1, moveY: 0 }, // (4,3)
      { moveX: 1, moveY: 0 }, // (5,3)
      { moveX: 1, moveY: 0 }, // (6,3)
      { moveX: 1, moveY: 0 }, // (7,3)
    ]);
    expect(sim.getState().players["a"]!.mover.from).toEqual({ x: 7, y: 3, layer: "road" });
    sim.step(new Map([["a", press]]));
    expect(sim.getState().lightsOn).toBe(true);
    expect(Object.values(sim.getState().switches).every((s) => s.used)).toBe(true);
  });
});
