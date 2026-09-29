import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CpuController, Simulation, type MapData, type SimulationState } from "@supermaze/sim";
import { SnapshotDelta, applySnapshot, decodeMover, encodeMover } from "../src/index.js";

const map = JSON.parse(readFileSync(new URL("../../../content/maps/maze-01.json", import.meta.url), "utf8")) as MapData;

function match(players = 4) {
  const sim = new Simulation({
    seed: 11,
    map,
    teamMode: "solo",
    participants: Array.from({ length: players }, (_, i) => ({ id: `p${i}`, teamId: `p${i}`, controller: "cpu" as const, name: `P${i}` })),
  });
  sim.start();
  return { sim, cpu: new CpuController(sim, 12) };
}

/** The wire rounds `progress` to thousandths; everything else must arrive exactly. */
function rounded(state: SimulationState): SimulationState {
  const players = Object.fromEntries(
    Object.entries(state.players).map(([id, p]) => [id, { ...p, mover: { ...p.mover, progress: Math.round(p.mover.progress * 1000) / 1000 } }]),
  );
  return { ...state, players };
}

describe("mover packing", () => {
  it("round-trips standing and walking movers on every layer", () => {
    const walking = { from: { x: 3, y: 9, layer: "wallTop" as const }, target: { x: 4, y: 9, layer: "road" as const }, progress: 0.4, facing: { dx: 1, dy: 0 }, turnHold: 0 };
    const standing = { from: { x: 0, y: 0, layer: "towerTop" as const }, target: null, progress: 0, facing: { dx: 0, dy: -1 }, turnHold: 2 };
    expect(decodeMover(encodeMover(walking))).toEqual(walking);
    expect(decodeMover(encodeMover(standing))).toEqual(standing);
  });
});

describe("snapshot deltas", () => {
  it("a client that applies every message holds the server's state, tick after tick", () => {
    const { sim, cpu } = match();
    const delta = new SnapshotDelta();
    // The client starts from the full state it is sent on joining; the room has broadcast that state too.
    delta.next(sim.getState(), 0);
    let client: SimulationState = sim.getState();
    for (let i = 0; i < 20 * 90 && sim.getState().status === "running"; i++) {
      sim.step(cpu.inputs());
      client = applySnapshot(client, delta.next(sim.getState(), i));
      if (i % 50 === 0) expect(rounded(client)).toEqual(rounded(sim.getState()));
    }
    expect(rounded(client)).toEqual(rounded(sim.getState()));
    expect(sim.getState().tick).toBeGreaterThan(200);
  });

  it("sends nothing about a player who stands still and nothing about what did not change", () => {
    const { sim } = match(2);
    const delta = new SnapshotDelta();
    delta.next(sim.getState(), 0);
    sim.step(new Map()); // the start freeze: nobody moves
    const msg = delta.next(sim.getState(), 1);
    expect(Object.keys(msg).sort()).toEqual(["serverTime", "tick"]);
  });

  it("is far smaller than sending every player whole", () => {
    const { sim, cpu } = match(6);
    const delta = new SnapshotDelta();
    delta.next(sim.getState(), 0);
    let bytes = 0;
    let whole = 0;
    let n = 0;
    for (let i = 0; i < 20 * 40 && sim.getState().status === "running"; i++) {
      sim.step(cpu.inputs());
      bytes += JSON.stringify(delta.next(sim.getState(), i)).length;
      whole += JSON.stringify({ serverTime: i, tick: sim.getState().tick, players: sim.getState().players }).length;
      n++;
    }
    expect(n).toBeGreaterThan(100);
    expect(bytes / whole).toBeLessThan(0.35);
  });
});
