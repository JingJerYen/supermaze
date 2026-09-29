import { describe, expect, it } from "vitest";
import { InputQueue, SnapshotDelta, applySnapshot, type InputMessage, type SnapshotMessage } from "@supermaze/protocol";
import { DEFAULT_TUNING, Simulation, moverPosition, type MapData, type MoveIntent, type SimulationState, type Tuning } from "@supermaze/sim";
import { Predictor, blendMover } from "../src/net/predictor.js";
import { RULE_SCENES } from "../src/rules/scenes.js";

const tuning: Tuning = {
  ...DEFAULT_TUNING,
  round: { ...DEFAULT_TUNING.round, startFreezeSec: 0, introSec: 0 },
  itemBoxes: { ...DEFAULT_TUNING.itemBoxes, perParticipant: 0 },
  ghostEvent: { ...DEFAULT_TUNING.ghostEvent, intervalSec: 9999 },
};
// The ring map of the rules cards: a loop round a one-tile tower, the first player on (5,4).
const map: MapData = { ...RULE_SCENES[0]!.map, spawns: { keys: [{ x: 9, y: 1, layer: "road" }], itemBoxes: [], lightSwitches: [] } };

/**
 * A server and one client joined by a link that takes `delay` ticks each way.
 * Runs the client's inputs through the same queue, delta and merge code as the
 * game, and reports every correction the predictor had to make.
 */
function play(script: MoveIntent[], delay: number, meddle?: (sim: Simulation, tick: number) => void) {
  const sim = new Simulation({ seed: 1, map, teamMode: "solo", tuning, timeLimitSec: 600, participants: [{ id: "me", teamId: "me", controller: "human" }] });
  sim.start();
  const queue = new InputQueue();
  const delta = new SnapshotDelta();
  delta.next(sim.getState(), 0);
  let clientState: SimulationState = sim.getState();
  const predictor = new Predictor(sim.grid, tuning, "me");
  predictor.setState(clientState);

  const up: { at: number; msg: InputMessage }[] = [];
  const down: { at: number; snapshot: SnapshotMessage; ack: number }[] = [];
  const corrections: number[] = [];
  let ackSent = 0;
  const ticks = script.length + delay * 2 + 4;
  for (let t = 0; t < ticks; t++) {
    const input = script[t] ?? { moveX: 0, moveY: 0 };
    // Client: predict and send.
    up.push({ at: t + delay, msg: { ...input, seq: predictor.push(input) } });
    // Server: what has arrived, one tick, reply.
    while (up.length && up[0]!.at <= t) queue.push(up.shift()!.msg);
    meddle?.(sim, t);
    sim.step(new Map([["me", queue.take()]]));
    down.push({ at: t + delay, snapshot: delta.next(sim.getState(), t), ack: queue.acked });
    // Client: what has arrived.
    while (down.length && down[0]!.at <= t) {
      const m = down.shift()!;
      clientState = applySnapshot(clientState, m.snapshot);
      predictor.setState(clientState);
      if (m.ack > ackSent) {
        ackSent = m.ack;
        const moved = predictor.reconcile(m.ack);
        corrections.push(Math.hypot(moved.x, moved.y));
      }
    }
  }
  return { sim, predictor, corrections };
}

const hold = (dx: number, dy: number, ticks: number): MoveIntent[] => Array.from({ length: ticks }, () => ({ moveX: dx, moveY: dy }));
const lap = [...hold(0, 1, 9), ...hold(-1, 0, 22), ...hold(0, -1, 22), ...hold(1, 0, 30), ...hold(0, 0, 3)];

describe("Predictor", () => {
  for (const delay of [0, 1, 3, 6]) {
    it(`needs no correction on a link of ${delay} tick(s) each way, and ends where the server does`, () => {
      const { sim, predictor, corrections } = play(lap, delay);
      expect(corrections.length).toBeGreaterThan(50);
      expect(Math.max(...corrections)).toBeLessThan(1e-3);
      const server = sim.getState().players["me"]!.mover;
      // The wire rounds progress to thousandths; the tiles must match exactly.
      expect(predictor.current()!.from).toEqual(server.from);
      expect(predictor.current()!.target).toEqual(server.target);
      expect(server.from).not.toEqual({ x: 5, y: 4, layer: "road" }); // it did go somewhere
    });
  }

  it("moves at once: ahead of the server's state by the round trip", () => {
    const { predictor, sim } = play(hold(0, 1, 6), 6); // six ticks of input, none of them answered yet
    expect(predictor.active).toBe(true);
    expect(moverPosition(predictor.current()!).y).toBeGreaterThanOrEqual(moverPosition(sim.getState().players["me"]!.mover).y);
  });

  it("is corrected when the server knows better, then agrees again", () => {
    // Someone freezes the player for a moment while inputs are in flight; the prediction walked on regardless.
    const { sim, predictor, corrections } = play([...hold(0, 1, 9), ...hold(-1, 0, 40), ...hold(0, 0, 20)], 3, (s, t) => {
      if (t === 20) {
        const st = s.getState() as SimulationState;
        (st.players["me"] as { frozenUntilTick: number }).frozenUntilTick = st.tick + 8;
      }
    });
    expect(Math.max(...corrections)).toBeGreaterThan(0.1);
    expect(corrections.at(-1)).toBeLessThan(1e-3);
    expect(predictor.current()!.from).toEqual(sim.getState().players["me"]!.mover.from);
  });
});

describe("blendMover", () => {
  const road = (x: number, y: number) => ({ x, y, layer: "road" as const });
  const east = { dx: 1, dy: 0 };
  const at = (m: ReturnType<typeof blendMover>) => moverPosition(m).x;

  it("moves evenly along an edge and across a tile boundary", () => {
    const a = { from: road(1, 1), target: road(2, 1), progress: 0.2, facing: east, turnHold: 0 };
    const b = { ...a, progress: 0.4 };
    expect(at(blendMover(a, b, 0.5))).toBeCloseTo(1.3);
    const c = { from: road(1, 1), target: road(2, 1), progress: 0.9, facing: east, turnHold: 0 };
    const d = { from: road(2, 1), target: road(3, 1), progress: 0.1, facing: east, turnHold: 0 };
    expect(at(blendMover(c, d, 0.25))).toBeCloseTo(1.95);
    expect(at(blendMover(c, d, 0.75))).toBeCloseTo(2.05);
  });

  it("starts from standing and comes to rest on the tile", () => {
    const still = { from: road(1, 1), target: null, progress: 0, facing: east, turnHold: 0 };
    const off = { from: road(1, 1), target: road(2, 1), progress: 0.2, facing: east, turnHold: 0 };
    expect(at(blendMover(still, off, 0.5))).toBeCloseTo(1.1);
    const nearly = { from: road(1, 1), target: road(2, 1), progress: 0.8, facing: east, turnHold: 0 };
    const there = { from: road(2, 1), target: null, progress: 0, facing: east, turnHold: 0 };
    expect(at(blendMover(nearly, there, 0.5))).toBeCloseTo(1.9);
    expect(at(blendMover(nearly, there, 1))).toBeCloseTo(2);
  });
});
