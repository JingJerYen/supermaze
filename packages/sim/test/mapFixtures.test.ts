import { describe, expect, it } from "vitest";
import { CpuController } from "../src/cpu/controller.js";
import { normalizeMap } from "../src/map/normalize.js";
import { rotateMap } from "../src/map/transform.js";
import type { MapData } from "../src/map/types.js";
import { validateMap } from "../src/map/validate.js";
import { Simulation, type PlayerInput } from "../src/simulation.js";
import { DEFAULT_TUNING, type ItemKind, type Tuning } from "../src/tuning/index.js";
import { LATTICE_MAP, NO_FREEZE, TINY_MAP } from "./fixtures.js";
import { push, walk } from "./walk.js";

const still: PlayerInput = { moveX: 0, moveY: 0 };
const press: PlayerInput = { ...still, action: true };
const S: PlayerInput = { moveX: 0, moveY: 1 };
const E: PlayerInput = { moveX: 1, moveY: 0 };
const one = [{ id: "a", teamId: "A", controller: "human" as const }];

const only = (kind: ItemKind, base: Tuning = NO_FREEZE): Tuning => ({
  ...base,
  itemBoxes: { perParticipant: 1, weights: { oneWayDoor: 0, obstacle: 0, hammer: 0, trap: 0, teleportNode: 0, [kind]: 1 } },
});

/** TINY_MAP with row 6 redrawn to carry fixture markers; the single box candidate sits on the stairs (2,5), one step south of the spawn. */
const withRow6 = (row: string): MapData => ({
  ...TINY_MAP,
  rows: TINY_MAP.rows.map((r, y) => (y === 6 ? row : r)),
  spawns: { keys: [{ x: 1, y: 1, layer: "road" }], itemBoxes: [{ x: 2, y: 5, layer: "road" }], lightSwitches: TINY_MAP.spawns!.lightSwitches! },
});

describe("fixture markers", () => {
  it("become fixtures and plain cells", () => {
    const n = normalizeMap(withRow6("X..O.A.^X"));
    expect(n.rows[6]).toBe("X.......X");
    expect(n.fixtures).toEqual([
      { kind: "obstacle", x: 3, y: 6, layer: "road" },
      { kind: "trap", x: 5, y: 6, layer: "road" },
      { kind: "oneWayDoor", x: 7, y: 6, layer: "road", dir: { dx: 0, dy: -1 } },
    ]);
    // Wall-top marker: lower case on a wall cell.
    const top = normalizeMap({ ...TINY_MAP, rows: TINY_MAP.rows.map((r, y) => (y === 5 ? "X.S#o#..X" : r)) });
    expect(top.rows[5]).toBe("X.S###..X");
    expect(top.fixtures).toEqual([{ kind: "obstacle", x: 4, y: 5, layer: "wallTop" }]);
  });

  it("rotate with the map, doors turning clockwise", () => {
    const r = rotateMap(withRow6("X......^X"), 1);
    const h = TINY_MAP.rows.length;
    expect(r.fixtures).toEqual([{ kind: "oneWayDoor", x: h - 1 - 6, y: 7, layer: "road", dir: { dx: 1, dy: 0 } }]);
    expect(rotateMap(withRow6("X......^X"), 2).fixtures[0]!.dir).toEqual({ dx: 0, dy: 1 });
  });
});

describe("validator and fixtures", () => {
  const errorsFor = (fixtures: NonNullable<MapData["fixtures"]>) => validateMap({ ...LATTICE_MAP, fixtures }).join("\n");

  it("accepts a fixture that blocks the only way somewhere", () => {
    // (5,2) is the single gap in LATTICE's row-2 wall on the east side; reachability ignores fixtures.
    expect(validateMap({ ...LATTICE_MAP, fixtures: [{ kind: "obstacle", x: 5, y: 2, layer: "road" }] })).toEqual([]);
  });

  it("rejects fixtures on stairs, next to the tower, on candidates, off the floor, and doors without a direction", () => {
    expect(errorsFor([{ kind: "obstacle", x: 1, y: 3, layer: "road" }])).toMatch(/sits on stairs/);
    expect(errorsFor([{ kind: "trap", x: 5, y: 4, layer: "road" }])).toMatch(/touches the tower/);
    expect(errorsFor([{ kind: "trap", x: 7, y: 1, layer: "road" }])).toMatch(/collides with keys/);
    expect(errorsFor([{ kind: "obstacle", x: 2, y: 2, layer: "road" }])).toMatch(/not walkable/);
    expect(errorsFor([{ kind: "oneWayDoor", x: 5, y: 2, layer: "road" }])).toMatch(/needs a dir/);
  });
});

describe("fixtures in the simulation", () => {
  it("are there from the start, never expire and block like any placeable", () => {
    const sim = new Simulation({ seed: 1, map: withRow6("X.O.....X"), participants: one, tuning: only("trap") });
    sim.start();
    const f = Object.values(sim.getState().placeables);
    expect(f).toEqual([{ id: "f0", kind: "obstacle", pos: { x: 2, y: 6, layer: "road" }, dir: { dx: 0, dy: 1 }, ownerId: null, expiresAtTick: 0, permanent: true }]);
    // Far longer than any placeable lifetime.
    const ticks = Math.round(DEFAULT_TUNING.placeables.lifetimeSec.obstacle * DEFAULT_TUNING.tickRate) * 3;
    for (let i = 0; i < ticks; i++) sim.step(new Map());
    expect(Object.keys(sim.getState().placeables)).toEqual(["f0"]);
    // a: (2,4) -> (2,5), then pushing south into the obstacle goes nowhere.
    walk(sim, "a", [S]);
    push(sim, "a", S);
    expect(sim.getState().players["a"]!.mover.from).toEqual({ x: 2, y: 5, layer: "road" });
  });

  it("a hammer removes one", () => {
    // The box on (2,5) yields a hammer; the obstacle fixture is right behind it on (2,6).
    const sim = new Simulation({ seed: 1, map: withRow6("X.O.....X"), participants: one, tuning: only("hammer") });
    sim.start();
    const ticksBefore = sim.getState().tick;
    walk(sim, "a", [S]);
    expect(sim.getState().players["a"]!.items).toEqual(["hammer"]);
    const ev = sim.step(new Map([["a", press]]));
    expect(ev).toContainEqual(expect.objectContaining({ type: "placeableDestroyed", placeableId: "f0", kind: "obstacle" }));
    expect(sim.getState().placeables).toEqual({});
    walk(sim, "a", [S]);
    expect(sim.getState().players["a"]!.mover.from).toEqual({ x: 2, y: 6, layer: "road" });
    expect(sim.getState().tick).toBeGreaterThan(ticksBefore);
  });

  it("a trap fixture fires once, freezes its victim and scores for nobody", () => {
    const sim = new Simulation({ seed: 1, map: withRow6("X.A.....X"), participants: one, tuning: only("trap") });
    sim.start();
    walk(sim, "a", [S]); // (2,5): a box, one item
    const before = sim.getState().players["a"]!.score;
    const events = [];
    for (let i = 0; i < 12; i++) events.push(...sim.step(new Map([["a", S]])));
    expect(events).toContainEqual(expect.objectContaining({ type: "trapTriggered", playerId: "a", placeableId: "f0", ownerId: null, ownerScored: false }));
    const a = sim.getState().players["a"]!;
    expect(a.frozenBy).toBe("trap");
    expect(a.score).toBe(before);
    expect(sim.getState().placeables).toEqual({});
  });

  it("a door fixture lets players through its way only", () => {
    // Door on (3,6) passing east. a reaches (2,6) and walks east through it; coming back west is refused.
    const sim = new Simulation({ seed: 1, map: withRow6("X..>....X"), participants: one, tuning: only("trap") });
    sim.start();
    walk(sim, "a", [S, S, E, E]);
    expect(sim.getState().players["a"]!.mover.from).toEqual({ x: 4, y: 6, layer: "road" });
    push(sim, "a", { moveX: -1, moveY: 0 });
    expect(sim.getState().players["a"]!.mover.from).toEqual({ x: 4, y: 6, layer: "road" });
  });
});

describe("CPU and fixtures", () => {
  const cpuOnly = [{ id: "c", teamId: "A", controller: "cpu" as const }];

  it("finds a hammer and breaks through to a key behind permanent obstacles", () => {
    // The east part (x 6..7) is reachable only through (5,1), (5,3) under the bridge and (5,6): all three blocked.
    const map: MapData = {
      ...TINY_MAP,
      rows: ["XXXXXXXXX", "X....O..X", "X....#..X", "X.T..=..X", "X....#..X", "X.S###..X", "X....O..X", "XXXXXXXXX"],
      fixtures: [{ kind: "obstacle", x: 5, y: 3, layer: "road" }],
      spawns: {
        keys: [{ x: 7, y: 4, layer: "road" }],
        itemBoxes: [{ x: 1, y: 1, layer: "road" }, { x: 3, y: 1, layer: "road" }, { x: 1, y: 6, layer: "road" }, { x: 3, y: 6, layer: "road" }],
        lightSwitches: TINY_MAP.spawns!.lightSwitches!,
      },
    };
    const tuning: Tuning = { ...only("hammer"), cpu: { ...DEFAULT_TUNING.cpu, visionTiles: 20, speedMultiplier: 1 } };
    const sim = new Simulation({ seed: 3, map, participants: cpuOnly, tuning });
    sim.start();
    expect(Object.keys(sim.getState().placeables)).toHaveLength(3);
    const cpu = new CpuController(sim, 3);
    const types: string[] = [];
    for (let i = 0; i < 20 * 180 && sim.getState().status !== "finished"; i++) types.push(...sim.step(cpu.inputs()).map((e) => e.type));
    expect(types).toContain("placeableDestroyed");
    expect(types).toContain("keyPickedUp");
    expect(sim.getState().players["c"]!.phase).toBe("tower");
  });

  it("puts its oldest item down when it stops to think", () => {
    const map: MapData = { ...TINY_MAP, spawns: { ...TINY_MAP.spawns, keys: [{ x: 7, y: 1, layer: "road" }] } };
    const tuning: Tuning = { ...only("obstacle"), itemBoxes: { ...only("obstacle").itemBoxes, perParticipant: 2 }, cpu: { ...DEFAULT_TUNING.cpu, visionTiles: 0 } };
    const sim = new Simulation({ seed: 6, map, participants: cpuOnly, tuning });
    sim.start();
    const cpu = new CpuController(sim, 6);
    const events = [];
    for (let i = 0; i < 20 * 90; i++) events.push(...sim.step(cpu.inputs()));
    expect(events).toContainEqual(expect.objectContaining({ type: "placeablePlaced", playerId: "c", kind: "obstacle" }));
  });
});
