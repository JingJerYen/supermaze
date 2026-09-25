import { DEFAULT_TUNING, Simulation, type MapData, type PlayerState } from "@supermaze/sim";
import type { GameMode } from "./mode.js";

/** Single-player: the simulation runs inside the page. Same code the server runs. */
export function createLocalMode(map: MapData): GameMode {
  const id = "local";
  const sim = new Simulation({ seed: 1, map, participants: [{ id, teamId: "t1", controller: "human" }] });
  let prev: Record<string, PlayerState> = sim.getState().players;

  return {
    label: "local",
    grid: sim.grid,
    tickRate: DEFAULT_TUNING.tickRate,
    localPlayerId: () => id,
    tick(input) {
      prev = sim.getState().players;
      sim.step(new Map([[id, input]]));
    },
    sample(_now, alpha) {
      return { from: prev, to: sim.getState().players, alpha };
    },
    hud: () => ({
      tick: sim.getState().tick,
      layer: sim.getState().players[id]?.mover.from.layer ?? "-",
    }),
  };
}
