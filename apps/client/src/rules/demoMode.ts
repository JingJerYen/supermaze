import type { SimulationState } from "@supermaze/sim";
import { switchTileSet, type GameMode } from "../modes/mode.js";
import { DemoRunner } from "./runner.js";
import type { DemoScene } from "./scenes.js";

/** A rules demo as a GameMode, so the ordinary Match draws it with the ordinary renderer. */
export function createDemoMode(scene: DemoScene): GameMode {
  const runner = new DemoRunner(scene);
  let prev: SimulationState = runner.getState();
  return {
    label: `rules:${scene.id}`,
    grid: runner.sim.grid,
    theme: scene.map.theme,
    plazaRadius: scene.map.plazaRadius ?? 0,
    switchTiles: switchTileSet(scene.map),
    tickRate: runner.tickRate,
    localPlayerId: () => scene.me,
    tick() {
      const loops = runner.loops;
      const before = runner.getState();
      runner.step();
      // On the restart tick blend from the fresh state, not from the end of the last run.
      prev = runner.loops === loops ? before : runner.getState();
    },
    sample(_now, alpha) {
      return { from: prev, to: runner.getState(), alpha };
    },
    hud: () => ({ scene: scene.id, loops: runner.loops }),
    results: () => ({ endsAt: null, buttons: [] }),
  };
}
