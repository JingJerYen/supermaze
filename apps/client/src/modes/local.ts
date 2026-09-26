import { DEFAULT_TUNING, Simulation, type MapData, type SimulationState } from "@supermaze/sim";
import { formatSeconds, roundBanner } from "./roundHud.js";
import type { GameMode } from "./mode.js";

/** Single-player: the simulation runs inside the page. Same code the server runs. */
export function createLocalMode(map: MapData, options: { players?: number; seed?: number } = {}): GameMode {
  const id = "local";
  // Extra participants are idle CPUs (no behaviour yet); they only make the round
  // spawn as many keys and boxes as a real match with that many players would.
  const players = Math.max(1, Math.min(options.players ?? 1, DEFAULT_TUNING.round.maxParticipants));
  const idle = Array.from({ length: players - 1 }, (_, i) => ({
    id: `cpu${i + 1}`,
    teamId: i % 2 === 0 ? "t2" : "t1",
    controller: "cpu" as const,
  }));
  const sim = new Simulation({
    seed: options.seed ?? 1,
    map,
    participants: [{ id, teamId: "t1", controller: "human" }, ...idle],
  });
  sim.start();
  let prev: SimulationState = sim.getState();

  return {
    label: "local",
    grid: sim.grid,
    tickRate: DEFAULT_TUNING.tickRate,
    localPlayerId: () => id,
    tick(input) {
      prev = sim.getState();
      sim.step(new Map([[id, input]]));
    },
    sample(_now, alpha) {
      return { from: prev, to: sim.getState(), alpha };
    },
    hud: () => {
      const st = sim.getState();
      const me = st.players[id];
      return {
        status: st.status,
        time: formatSeconds(sim.remainingSec()),
        layer: me?.mover.from.layer ?? "-",
        key: me?.keyId ? "yes" : "no",
        score: me?.score ?? 0,
        climb: me && sim.canClimb(me) ? "ready (E)" : "-",
      };
    },
    banner: () => roundBanner(sim.getState()),
  };
}
