import { DEFAULT_TUNING, Simulation, type MapData, type SimulationState } from "@supermaze/sim";
import { formatSeconds, roundBanner } from "./roundHud.js";
import type { GameMode } from "./mode.js";

/** Single-player: the simulation runs inside the page. Same code the server runs. */
export function createLocalMode(map: MapData): GameMode {
  const id = "local";
  const sim = new Simulation({ seed: 1, map, participants: [{ id, teamId: "t1", controller: "human" }] });
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
