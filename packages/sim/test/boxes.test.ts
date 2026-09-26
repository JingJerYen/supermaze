import { describe, expect, it } from "vitest";
import { Simulation, type PlayerInput } from "../src/simulation.js";
import { DEFAULT_TUNING, type Tuning } from "../src/tuning/index.js";
import type { MapData } from "../src/map/types.js";
import { TINY_MAP } from "./fixtures.js";

const one = [{ id: "a", teamId: "t1", controller: "human" as const }];

/** Drive `id` one tile per direction, ending at rest. */
function walk(sim: Simulation, id: string, dirs: PlayerInput[]): void {
  const n = Math.ceil(sim.tuning.tickRate / sim.tuning.movement.speedTilesPerSec);
  for (const d of dirs) {
    for (let i = 0; i < n - 1; i++) sim.step(new Map([[id, d]]));
    for (let i = 0; i < n; i++) sim.step(new Map());
  }
}

/**
 * a spawns at (2,3). Row 1 is open road: (1,1)...(7,1). Boxes on (1,1),(3,1),(5,1),(7,1)
 * plus far spares; with one player x 2 per participant = 2 boxes on the field.
 */
const BOX_MAP: MapData = {
  ...TINY_MAP,
  spawns: {
    ...TINY_MAP.spawns,
    keys: [{ x: 7, y: 6, layer: "road" }],
    itemBoxes: [
      { x: 2, y: 2, layer: "road" }, // the stairs tile north of a's spawn
      { x: 2, y: 1, layer: "road" },
      { x: 1, y: 1, layer: "road" },
      { x: 4, y: 1, layer: "road" },
      { x: 6, y: 1, layer: "road" },
      { x: 1, y: 6, layer: "road" },
    ],
  },
};

const tuningWith = (patch: Partial<Tuning>): Tuning => ({ ...DEFAULT_TUNING, ...patch });

describe("item boxes", () => {
  it("spawns participants x perParticipant boxes on distinct candidate tiles", () => {
    const sim = new Simulation({ seed: 4, map: BOX_MAP, participants: one });
    sim.start();
    const boxes = Object.values(sim.getState().boxes);
    expect(boxes).toHaveLength(1 * DEFAULT_TUNING.itemBoxes.perParticipant);
    expect(new Set(boxes.map((b) => `${b.pos.x},${b.pos.y}`)).size).toBe(boxes.length);
  });

  it("opening a box gives one item and a replacement box appears the same tick", () => {
    // Three candidates, two boxes: at least one box is on a's path (2,2)->(2,1), one candidate stays free for the replacement.
    const map = { ...BOX_MAP, spawns: { ...BOX_MAP.spawns, itemBoxes: [{ x: 2, y: 2, layer: "road" as const }, { x: 2, y: 1, layer: "road" as const }, { x: 1, y: 1, layer: "road" as const }] } };
    const sim = new Simulation({ seed: 4, map, participants: one });
    sim.start();
    const before = Object.keys(sim.getState().boxes).length;

    let opened = 0;
    let spawned = 0;
    const n = Math.ceil(sim.tuning.tickRate / sim.tuning.movement.speedTilesPerSec);
    for (let i = 0; i < n * 2; i++) {
      const ev = sim.step(new Map([["a", { moveX: 0, moveY: -1 }]]));
      opened += ev.filter((e) => e.type === "boxOpened").length;
      spawned += ev.filter((e) => e.type === "boxSpawned").length;
      if (opened) break;
    }
    expect(opened).toBe(1);
    expect(spawned).toBe(1);
    expect(Object.keys(sim.getState().boxes)).toHaveLength(before);
    expect(sim.getState().players["a"]!.items).toHaveLength(1);
  });

  it("a full bag cannot open a box; the box stays", () => {
    const tuning = tuningWith({ inventory: { capacity: 1 } });
    const map = { ...BOX_MAP, spawns: { ...BOX_MAP.spawns, itemBoxes: [{ x: 2, y: 2, layer: "road" as const }, { x: 2, y: 1, layer: "road" as const }, { x: 1, y: 1, layer: "road" as const }] } };
    const sim = new Simulation({ seed: 4, map, participants: one, tuning });
    sim.start();
    walk(sim, "a", [{ moveX: 0, moveY: -1 }, { moveX: 0, moveY: -1 }]); // (2,2) then (2,1)
    const a = sim.getState().players["a"]!;
    expect(a.items).toHaveLength(1);
    // One of the two walked tiles still holds a box (either the untouched one or a replacement).
    const onPath = Object.values(sim.getState().boxes).filter((b) => b.pos.x === 2 && (b.pos.y === 1 || b.pos.y === 2));
    expect(onPath.length).toBeGreaterThanOrEqual(1);
  });

  it("never draws a zero-weight item and respects the weights table", () => {
    const tuning = tuningWith({
      itemBoxes: { perParticipant: 2, weights: { oneWayDoor: 0, obstacle: 0, hammer: 1, trap: 0, teleportNode: 0 } },
    });
    const map = { ...BOX_MAP, spawns: { ...BOX_MAP.spawns, itemBoxes: [{ x: 2, y: 2, layer: "road" as const }, { x: 2, y: 1, layer: "road" as const }, { x: 1, y: 1, layer: "road" as const }] } };
    const sim = new Simulation({ seed: 9, map, participants: one, tuning });
    sim.start();
    walk(sim, "a", [{ moveX: 0, moveY: -1 }, { moveX: 0, moveY: -1 }]);
    expect(sim.getState().players["a"]!.items.every((i) => i === "hammer")).toBe(true);
    expect(sim.getState().players["a"]!.items.length).toBeGreaterThan(0);
  });

  it("leftover items turn into flat score when climbing", () => {
    const map = {
      ...BOX_MAP,
      // Exactly two candidates for two boxes, so (2,1) is guaranteed to hold one; no spare means no replacement, which must not crash.
      spawns: { ...BOX_MAP.spawns, keys: [{ x: 2, y: 2, layer: "road" as const }], itemBoxes: [{ x: 2, y: 1, layer: "road" as const }, { x: 1, y: 1, layer: "road" as const }] },
    };
    const sim = new Simulation({ seed: 4, map, participants: one });
    sim.start();
    walk(sim, "a", [{ moveX: 0, moveY: -1 }, { moveX: 0, moveY: -1 }]); // key at (2,2), box at (2,1)
    const carried = sim.getState().players["a"]!.items.length;
    expect(carried).toBeGreaterThan(0);
    walk(sim, "a", [{ moveX: 0, moveY: 1 }, { moveX: 0, moveY: 1 }]); // back to entry (2,3)
    sim.step(new Map([["a", { moveX: 0, moveY: 0, action: true }]]));
    const a = sim.getState().players["a"]!;
    expect(a.phase).toBe("tower");
    expect(a.items).toEqual([]);
    expect(a.score).toBe(
      sim.tuning.scoring.keyFound + sim.tuning.scoring.towerPlacement[0]! + carried * sim.tuning.scoring.leftoverItem,
    );
  });

  it("is deterministic", () => {
    const run = () => {
      const sim = new Simulation({ seed: 21, map: BOX_MAP, participants: one });
      sim.start();
      walk(sim, "a", [{ moveX: 0, moveY: -1 }, { moveX: 0, moveY: -1 }, { moveX: -1, moveY: 0 }]);
      return sim.getState();
    };
    expect(run()).toEqual(run());
  });
});
