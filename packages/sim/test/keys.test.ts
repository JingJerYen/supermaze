import { describe, expect, it } from "vitest";
import { SeededRandom } from "../src/random/seeded.js";
import { selectKeySpawns } from "../src/keys.js";
import { Simulation, type PlayerInput } from "../src/simulation.js";
import { TINY_MAP } from "./fixtures.js";

const two = [
  { id: "a", teamId: "t1", controller: "human" as const },
  { id: "b", teamId: "t2", controller: "human" as const },
];
const still: PlayerInput = { moveX: 0, moveY: 0 };

/**
 * Drive `id` along `dirs`, exactly one tile each, ending at rest. The intent is
 * released one tick before arrival because holding it through the arrival tick
 * would immediately start the next tile (continuous movement).
 */
function walk(sim: Simulation, id: string, dirs: PlayerInput[]): void {
  const n = Math.ceil(sim.tuning.tickRate / sim.tuning.movement.speedTilesPerSec);
  for (const d of dirs) {
    for (let i = 0; i < n - 1; i++) sim.step(new Map([[id, d]]));
    for (let i = 0; i < n; i++) sim.step(new Map());
  }
}

describe("selectKeySpawns", () => {
  it("is reproducible for the same seed and picks distinct tiles", () => {
    const c = TINY_MAP.spawns!.keys!;
    const a = selectKeySpawns(new SeededRandom(9), c, 2);
    const b = selectKeySpawns(new SeededRandom(9), c, 2);
    expect(a).toEqual(b);
    expect(new Set(a.map((t) => `${t.x},${t.y},${t.layer}`)).size).toBe(2);
  });

  it("throws when the map has too few candidates", () => {
    expect(() => selectKeySpawns(new SeededRandom(1), TINY_MAP.spawns!.keys!, 4)).toThrow(/needed/);
  });
});

describe("keys in the simulation", () => {
  it("spawns exactly one key per participant when the round starts", () => {
    const sim = new Simulation({ seed: 3, map: TINY_MAP, participants: two });
    expect(Object.keys(sim.getState().keys)).toHaveLength(0);
    const events = sim.start();
    expect(events).toEqual([{ type: "roundStarted", tick: 0, keyCount: 2 }]);
    expect(Object.keys(sim.getState().keys)).toHaveLength(2);
    expect(Object.values(sim.getState().keys).every((k) => k.ownerId === null)).toBe(true);
  });

  it("does not hand out keys before the round starts", () => {
    const sim = new Simulation({ seed: 3, map: TINY_MAP, participants: two });
    walk(sim, "a", [{ moveX: 0, moveY: -1 }, { moveX: 0, moveY: -1 }]);
    expect(sim.getState().players["a"]!.keyId).toBeNull();
  });

  it("binds a key to the first player who steps on it and scores it once", () => {
    // Put one key right next to a's spawn so we can walk onto it deterministically.
    const map = { ...TINY_MAP, spawns: { ...TINY_MAP.spawns, keys: [{ x: 2, y: 2, layer: "road" as const }] } };
    const sim = new Simulation({ seed: 1, map, participants: [two[0]!] });
    sim.start();
    const keyId = Object.keys(sim.getState().keys)[0]!;
    // a spawns at (2,3); north is (2,2) = the stairs tile holding the key.
    walk(sim, "a", [{ moveX: 0, moveY: -1 }]);
    const a = sim.getState().players["a"]!;
    expect(a.keyId).toBe(keyId);
    expect(a.score).toBe(sim.tuning.scoring.keyFound);
    expect(sim.getState().keys[keyId]!.ownerId).toBe("a");

    // Walking away and back does not score again or change ownership.
    walk(sim, "a", [{ moveX: 0, moveY: 1 }, { moveX: 0, moveY: -1 }]);
    expect(sim.getState().players["a"]!.score).toBe(sim.tuning.scoring.keyFound);
  });

  it("never lets a player hold two keys", () => {
    const map = {
      ...TINY_MAP,
      spawns: { ...TINY_MAP.spawns, keys: [{ x: 2, y: 2, layer: "road" as const }, { x: 1, y: 2, layer: "road" as const }] },
    };
    const sim = new Simulation({ seed: 1, map, participants: two });
    sim.start();
    walk(sim, "a", [{ moveX: 0, moveY: -1 }, { moveX: -1, moveY: 0 }]); // onto (2,2) then (1,2)
    const owned = Object.values(sim.getState().keys).filter((k) => k.ownerId === "a");
    expect(owned).toHaveLength(1);
    expect(Object.values(sim.getState().keys).some((k) => k.ownerId === null)).toBe(true);
  });

  it("is deterministic across two instances", () => {
    const run = () => {
      const sim = new Simulation({ seed: 77, map: TINY_MAP, participants: two });
      sim.start();
      for (let i = 0; i < 40; i++) sim.step(new Map([["a", { moveX: 1, moveY: 0 }], ["b", { moveX: 0, moveY: 1 }]]));
      return sim.getState();
    };
    expect(run()).toEqual(run());
  });
});

describe("tower climb", () => {
  function simWithKeyInHand() {
    const map = { ...TINY_MAP, spawns: { ...TINY_MAP.spawns, keys: [{ x: 2, y: 2, layer: "road" as const }] } };
    const sim = new Simulation({ seed: 1, map, participants: [two[0]!] });
    sim.start();
    walk(sim, "a", [{ moveX: 0, moveY: -1 }]); // pick up at (2,2)
    return sim;
  }

  it("refuses to climb without a key or away from the tower", () => {
    const sim = new Simulation({ seed: 1, map: TINY_MAP, participants: [two[0]!] });
    sim.start();
    sim.step(new Map([["a", { ...still, action: true }]])); // at entry (2,3) but no key
    expect(sim.getState().players["a"]!.phase).toBe("maze");

    const withKey = simWithKeyInHand(); // now standing on (2,2), not an entry tile
    withKey.step(new Map([["a", { ...still, action: true }]]));
    expect(withKey.getState().players["a"]!.phase).toBe("maze");
  });

  it("climbs from an entry tile with a key, scores the placement and becomes immovable", () => {
    const sim = simWithKeyInHand();
    walk(sim, "a", [{ moveX: 0, moveY: 1 }]); // back to entry (2,3)
    const events = sim.step(new Map([["a", { ...still, action: true }]]));
    expect(events).toContainEqual({ type: "towerClimbed", tick: expect.any(Number), playerId: "a", arrival: 0 });
    // A one-player team completes on the spot, which also ends a one-player round.
    expect(events.map((e) => e.type)).toEqual(["towerClimbed", "teamCompleted", "roundEnded"]);
    const a = sim.getState().players["a"]!;
    expect(a.phase).toBe("tower");
    expect(a.towerArrival).toBe(0);
    expect(a.score).toBe(sim.tuning.scoring.keyFound + sim.tuning.scoring.towerPlacement[0]!);
    expect(sim.getState().towerArrivals).toEqual(["a"]);

    const before = a.mover;
    sim.step(new Map([["a", { moveX: 1, moveY: 0 }]]));
    expect(sim.getState().players["a"]!.mover).toEqual(before);
  });
});
