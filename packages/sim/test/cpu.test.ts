import { describe, expect, it } from "vitest";
import { CpuController } from "../src/cpu/controller.js";
import { shortestPath } from "../src/cpu/pathfind.js";
import { MapGrid } from "../src/map/grid.js";
import type { MapData } from "../src/map/types.js";
import { Simulation, type PlayerInput } from "../src/simulation.js";
import { DEFAULT_TUNING, type Tuning } from "../src/tuning/index.js";
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

describe("CpuController", () => {
  const cpuOnly = [{ id: "c", teamId: "A", controller: "cpu" as const }];

  it("fetches a key, returns to a door, faces it and climbs", () => {
    // One key far away at (7,6); the CPU must cross the map and come back.
    const map: MapData = { ...TINY_MAP, spawns: { ...TINY_MAP.spawns, keys: [{ x: 7, y: 6, layer: "road" }] } };
    const sim = new Simulation({ seed: 4, map, participants: cpuOnly, tuning: NO_FREEZE });
    sim.start();
    const cpu = new CpuController(sim, 4);
    const events = run(sim, cpu, 20 * 30);
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
    run(sim, cpu, 5);
    expect(sim.getState().players["c"]!.phase).toBe("tower");
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
