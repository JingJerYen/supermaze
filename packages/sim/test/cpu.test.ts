import { describe, expect, it } from "vitest";
import { CpuController, cpuVisionTiles } from "../src/cpu/controller.js";
import { shortestPath } from "../src/cpu/pathfind.js";
import { MapGrid } from "../src/map/grid.js";
import type { MapData } from "../src/map/types.js";
import { Simulation, type PlayerInput } from "../src/simulation.js";
import { DEFAULT_TUNING, withCpuDifficulty, type Tuning } from "../src/tuning/index.js";
import { NO_FREEZE, TINY_MAP } from "./fixtures.js";

const grid = MapGrid.fromMapData(TINY_MAP);

/** Run `ticks` steps, feeding the CPU controller plus any fixed human inputs. */
function run(sim: Simulation, cpu: CpuController, ticks: number, human = new Map<string, PlayerInput>()) {
  const events = [];
  for (let i = 0; i < ticks; i++) {
    const inputs = cpu.inputs();
    for (const [id, input] of human) inputs.set(id, input);
    events.push(...sim.step(inputs));
    if (sim.getState().status === "finished") break;
  }
  return events;
}

describe("shortestPath", () => {
  it("walks around walls and up stairs onto the wall top", () => {
    // From the south entry (2,4) to the wall top (4,5): south onto the stairs, then east twice.
    const path = shortestPath(grid, { x: 2, y: 4, layer: "road" }, (t) => t.x === 4 && t.y === 5 && t.layer === "wallTop");
    expect(path).toEqual([
      { x: 2, y: 5, layer: "road" },
      { x: 3, y: 5, layer: "wallTop" },
      { x: 4, y: 5, layer: "wallTop" },
    ]);
    expect(shortestPath(grid, { x: 2, y: 4, layer: "road" }, (t) => t.x === 2 && t.y === 4)).toEqual([]);
    expect(shortestPath(grid, { x: 2, y: 4, layer: "road" }, (t) => t.x === 0 && t.y === 0)).toBeNull();
  });
});

describe("cpu strength", () => {
  // The preset numbers are playtest values that change often, so these tests read
  // them from the table and check the mechanism, not the numbers.
  it("difficulty presets replace vision and speed and leave the rest alone", () => {
    const presets = DEFAULT_TUNING.cpu.difficulties;
    for (const level of ["easy", "hard"] as const) {
      const t = withCpuDifficulty(level);
      expect(t.cpu).toMatchObject(presets[level]);
      expect(t.cpu.pauseMaxSec).toBe(DEFAULT_TUNING.cpu.pauseMaxSec);
      expect(t.round).toBe(DEFAULT_TUNING.round);
    }
    // Hard is never weaker than easy on either knob.
    expect(presets.hard.visionTiles).toBeGreaterThanOrEqual(presets.easy.visionTiles);
    expect(presets.hard.speedMultiplier).toBeGreaterThanOrEqual(presets.easy.speedMultiplier);
  });

  it("sees one tile less in the dark, never below zero", () => {
    const hard = withCpuDifficulty("hard");
    const penalty = hard.cpu.darkVisionPenaltyTiles;
    expect(cpuVisionTiles(hard, true)).toBe(hard.cpu.visionTiles);
    expect(cpuVisionTiles(hard, false)).toBe(Math.max(0, hard.cpu.visionTiles - penalty));
    const blind: Tuning = { ...DEFAULT_TUNING, cpu: { ...DEFAULT_TUNING.cpu, visionTiles: 0 } };
    expect(cpuVisionTiles(blind, false)).toBe(0);
  });
});

describe("CpuController", () => {
  const cpuOnly = [{ id: "c", teamId: "A", controller: "cpu" as const }];

  it("fetches a key, returns to a door, faces it and climbs", () => {
    // One key far away at (7,6), out of sight from the spawn: the CPU must explore, find it and come back.
    const map: MapData = { ...TINY_MAP, spawns: { ...TINY_MAP.spawns, keys: [{ x: 7, y: 6, layer: "road" }] } };
    const tuning: Tuning = { ...NO_FREEZE, cpu: { ...DEFAULT_TUNING.cpu, visionTiles: 2 } };
    const sim = new Simulation({ seed: 4, map, participants: cpuOnly, tuning });
    sim.start();
    const cpu = new CpuController(sim, 4);
    const events = run(sim, cpu, 20 * 60);
    expect(events.map((e) => e.type)).toContain("keyPickedUp");
    expect(events.map((e) => e.type)).toContain("towerClimbed");
    expect(sim.getState().players["c"]!.phase).toBe("tower");
    expect(sim.getState().status).toBe("finished");
  });

  it("is deterministic for the same seed", () => {
    const go = () => {
      const sim = new Simulation({ seed: 7, map: TINY_MAP, participants: cpuOnly, tuning: NO_FREEZE });
      sim.start();
      const cpu = new CpuController(sim, 7);
      run(sim, cpu, 200);
      return sim.getState();
    };
    expect(go()).toEqual(go());
  });

  it("stands on a key until it is picked up, then turns to the door and climbs", () => {
    const map: MapData = { ...TINY_MAP, spawns: { ...TINY_MAP.spawns, keys: [{ x: 2, y: 4, layer: "road" }] } };
    const sim = new Simulation({ seed: 2, map, participants: cpuOnly, tuning: NO_FREEZE });
    sim.start();
    const cpu = new CpuController(sim, 2);
    expect(cpu.input("c")).toEqual({ moveX: 0, moveY: 0 }); // already on the key: no reason to move
    run(sim, cpu, 5 + Math.ceil(DEFAULT_TUNING.cpu.pauseMaxSec * DEFAULT_TUNING.tickRate)); // a think pause follows the pickup
    expect(sim.getState().players["c"]!.phase).toBe("tower");
  });

  it("ignores keys it has not seen and goes for one once it is in sight", () => {
    // Key at (7,6); with vision 0 nothing is ever noticed, with vision 20 it is noticed at once.
    const map: MapData = { ...TINY_MAP, spawns: { ...TINY_MAP.spawns, keys: [{ x: 7, y: 6, layer: "road" }] } };
    const blind = new Simulation({ seed: 5, map, participants: cpuOnly, tuning: { ...NO_FREEZE, cpu: { ...DEFAULT_TUNING.cpu, visionTiles: 0 } } });
    blind.start();
    const blindCpu = new CpuController(blind, 5);
    const sharp = new Simulation({ seed: 5, map, participants: cpuOnly, tuning: { ...NO_FREEZE, cpu: { ...DEFAULT_TUNING.cpu, visionTiles: 20 } } });
    sharp.start();
    const sharpCpu = new CpuController(sharp, 5);
    // The sharp one heads east/south toward the key straight away; the blind one picks a random explore target.
    const firstSharp = sharpCpu.input("c");
    expect(firstSharp.moveX !== 0 || firstSharp.moveY !== 0).toBe(true);
    run(sharp, sharpCpu, 20 * 6);
    expect(sharp.getState().players["c"]!.keyId).not.toBeNull();
    run(blind, blindCpu, 20 * 6);
    // Not a guarantee in general, but for this seed the blind CPU has not stumbled onto the far corner yet.
    expect(blind.getState().players["c"]!.keyId).toBeNull();
  });

  it("walks slower than a human by cpu.speedMultiplier", () => {
    const tuning: Tuning = { ...NO_FREEZE, cpu: { ...DEFAULT_TUNING.cpu, speedMultiplier: 0.5 } };
    const sim = new Simulation({
      seed: 1,
      map: TINY_MAP,
      participants: [
        { id: "h", teamId: "A", controller: "human" },
        { id: "c", teamId: "B", controller: "cpu" },
      ],
      tuning,
    });
    sim.start();
    // Both spawn facing south with open road to the south: h at (2,4) -> (2,5); c at (3,3) -> (3,4). Push south 6 ticks.
    const south: PlayerInput = { moveX: 0, moveY: 1 };
    for (let i = 0; i < 6; i++) sim.step(new Map([["h", south], ["c", south]]));
    const h = sim.getState().players["h"]!.mover;
    const c = sim.getState().players["c"]!.mover;
    expect(h.progress + (h.from.y - 4)).toBeCloseTo(2 * (c.progress + (c.from.y - 3)), 5);
  });

  it("wanders when its goal is unreachable", () => {
    // No tower at all: no doors to walk to once the key is in hand, so it roams.
    const map: MapData = {
      ...TINY_MAP,
      rows: TINY_MAP.rows.map((r) => r.replace("T", ".")),
      spawns: { ...TINY_MAP.spawns, keys: [{ x: 1, y: 1, layer: "road" }] }, // (1,1) is the fallback spawn
    };
    const sim = new Simulation({ seed: 2, map, participants: cpuOnly, tuning: NO_FREEZE });
    sim.start();
    const cpu = new CpuController(sim, 2);
    const visited = new Set<string>();
    for (let i = 0; i < 120; i++) {
      sim.step(cpu.inputs());
      const m = sim.getState().players["c"]!.mover.from;
      visited.add(`${m.x},${m.y},${m.layer}`);
    }
    expect(sim.getState().players["c"]!.keyId).not.toBeNull();
    expect(visited.size).toBeGreaterThan(4);
  });

  it("as a ghost it chases and catches an idle runner", () => {
    const FAST: Tuning = {
      ...NO_FREEZE,
      ghostEvent: { ...DEFAULT_TUNING.ghostEvent, intervalSec: 0.5, warningSec: 0.5, durationSec: 6 },
    };
    // Keys far away so nobody climbs; team A (cpu) becomes the first ghost team.
    const map: MapData = { ...TINY_MAP, spawns: { ...TINY_MAP.spawns, keys: [{ x: 7, y: 6, layer: "road" }, { x: 1, y: 1, layer: "road" }] } };
    const sim = new Simulation({
      seed: 3,
      map,
      participants: [
        { id: "c", teamId: "A", controller: "cpu" },
        { id: "h", teamId: "B", controller: "human" },
      ],
      tuning: FAST,
    });
    sim.start();
    const cpu = new CpuController(sim, 3);
    // The human walks to (7,6) region and stands still; the cpu must find them.
    const events = run(sim, cpu, 20 * 8, new Map([["h", { moveX: 1, moveY: 0 }]]));
    expect(events.map((e) => e.type)).toContain("ghostStarted");
    expect(events.find((e) => e.type === "playerCaught")).toMatchObject({ ghostId: "c", runnerId: "h" });
  });
});
