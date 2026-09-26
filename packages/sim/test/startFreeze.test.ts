import { describe, expect, it } from "vitest";
import type { MapData } from "../src/map/types.js";
import { Simulation, type PlayerInput } from "../src/simulation.js";
import { DEFAULT_TUNING, type Tuning } from "../src/tuning/index.js";
import { NO_FREEZE, TINY_MAP } from "./fixtures.js";

const still: PlayerInput = { moveX: 0, moveY: 0 };
const press: PlayerInput = { ...still, action: true };
const north: PlayerInput = { moveX: 0, moveY: -1 };

/** Keys under both entry tiles, so anyone free to act can pick up and climb at once. */
const INSTANT: MapData = {
  ...TINY_MAP,
  spawns: { ...TINY_MAP.spawns, keys: [{ x: 2, y: 3, layer: "road" }, { x: 2, y: 5, layer: "road" }] },
};
const two = [
  { id: "a", teamId: "A", controller: "human" as const },
  { id: "b", teamId: "B", controller: "human" as const },
];
const freezeTicks = (t: Tuning) => Math.round(t.round.startFreezeSec * t.tickRate);

function run(sim: Simulation, ticks: number, inputs = new Map<string, PlayerInput>()) {
  const events = [];
  for (let i = 0; i < ticks; i++) events.push(...sim.step(inputs));
  return events;
}

describe("start freeze (CLAUDE.md section 4)", () => {
  it("is 0 in the lobby and startTick + round.startFreezeSec after start()", () => {
    const sim = new Simulation({ seed: 1, map: INSTANT, participants: two });
    expect(sim.getState().freezeUntilTick).toBe(0);
    run(sim, 5);
    sim.start();
    const st = sim.getState();
    expect(st.startTick).toBe(5);
    expect(st.freezeUntilTick).toBe(5 + freezeTicks(DEFAULT_TUNING));
    expect(DEFAULT_TUNING.round.startFreezeSec).toBe(3);
  });

  it("nobody moves, turns, picks up or acts while frozen; ticks still advance", () => {
    const sim = new Simulation({ seed: 1, map: INSTANT, participants: two });
    sim.start();
    const before = sim.getState().players;
    const n = freezeTicks(DEFAULT_TUNING);
    // Hold a direction for a and mash the action for b for the whole freeze minus one tick.
    const events = run(sim, n - 1, new Map([["a", north], ["b", press]]));
    const st = sim.getState();
    expect(st.tick).toBe(n - 1);
    expect(st.players["a"]).toEqual(before["a"]);
    expect(st.players["b"]).toEqual(before["b"]);
    expect(st.players["a"]!.keyId).toBeNull(); // the key underfoot is not collected yet
    expect(events).toEqual([]);
    expect(sim.availableAction(st.players["b"]!)).toBeNull();
  });

  it("releases everyone exactly at freezeUntilTick", () => {
    const sim = new Simulation({ seed: 1, map: INSTANT, participants: two });
    sim.start();
    const n = freezeTicks(DEFAULT_TUNING);
    run(sim, n - 1, new Map([["a", north]]));
    const facingBefore = sim.getState().players["a"]!.mover.facing;

    // The first free tick: pickups happen, a turns to face north.
    const events = sim.step(new Map([["a", north]]));
    expect(sim.getState().tick).toBe(sim.getState().freezeUntilTick);
    expect(events.map((e) => e.type).sort()).toEqual(["keyPickedUp", "keyPickedUp"]);
    expect(sim.getState().players["a"]!.mover.facing).toEqual({ dx: 0, dy: -1 });
    expect(facingBefore).not.toEqual({ dx: 0, dy: -1 });

    // And the action key works again: b climbs.
    expect(sim.availableAction(sim.getState().players["b"]!)).toBe("climb");
    const climbed = sim.step(new Map([["b", press]]));
    expect(climbed.map((e) => e.type)).toContain("towerClimbed");
  });

  it("keeps schedules running: a ghost warning can fire during the freeze", () => {
    const tuning: Tuning = { ...DEFAULT_TUNING, ghostEvent: { ...DEFAULT_TUNING.ghostEvent, intervalSec: 1 } };
    const sim = new Simulation({ seed: 1, map: INSTANT, participants: two, tuning });
    sim.start();
    const events = run(sim, freezeTicks(tuning) - 1);
    expect(events.map((e) => e.type)).toContain("ghostWarning");
    expect(sim.getState().ghost.phase).toBe("warning");
    // Boxes were spawned by start() as usual.
    expect(Object.keys(sim.getState().boxes)).toHaveLength(two.length * tuning.itemBoxes.perParticipant);
  });

  it("startFreezeSec 0 lets players act on the first tick", () => {
    const sim = new Simulation({ seed: 1, map: INSTANT, participants: two, tuning: NO_FREEZE });
    sim.start();
    expect(sim.getState().freezeUntilTick).toBe(sim.getState().startTick);
    const events = sim.step(new Map());
    expect(events.map((e) => e.type)).toEqual(["keyPickedUp", "keyPickedUp"]);
  });

  it("is deterministic across two instances", () => {
    const go = () => {
      const sim = new Simulation({ seed: 9, map: INSTANT, participants: two });
      sim.start();
      run(sim, freezeTicks(DEFAULT_TUNING) + 10, new Map([["a", north], ["b", press]]));
      return sim.getState();
    };
    expect(go()).toEqual(go());
  });
});
