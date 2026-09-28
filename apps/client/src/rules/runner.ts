import { DEFAULT_TUNING, Simulation, type PlayerInput, type SimEvent, type SimulationState } from "@supermaze/sim";
import { Puppet } from "./puppet.js";
import type { DemoScene } from "./scenes.js";

/**
 * Runs one rules demo: the real simulation on the scene's small map, every
 * player driven by its script, restarting from the top once the scripts are
 * done and the ending has been on screen for `holdSec`. No DOM, no rendering,
 * so the same class is exercised by the tests.
 */
export class DemoRunner {
  sim!: Simulation;
  /** How many times the scene has started over. */
  loops = 0;
  private puppets: Puppet[] = [];
  private held = 0;

  constructor(readonly scene: DemoScene) {
    this.reset();
  }

  get tickRate(): number {
    return this.sim.tuning.tickRate;
  }

  getState(): Readonly<SimulationState> {
    return this.sim.getState();
  }

  /** One tick. Returns the events of that tick; an empty list on the tick the scene restarts. */
  step(): SimEvent[] {
    if (this.puppets.every((p) => p.done)) {
      if (++this.held > Math.round(this.scene.holdSec * this.tickRate)) {
        this.loops++;
        this.reset();
        return [];
      }
    }
    const state = this.sim.getState();
    const inputs = new Map<string, PlayerInput>();
    this.scene.participants.forEach((who, i) => inputs.set(who.id, (this.puppets[i] as Puppet).input(state, this.sim.grid, this.tickRate)));
    return this.sim.step(inputs);
  }

  private reset(): void {
    const s = this.scene;
    this.sim = new Simulation({
      seed: s.seed,
      map: s.map,
      teamMode: s.teamMode,
      timeLimitSec: 600,
      tuning: s.tuning(DEFAULT_TUNING),
      participants: s.participants.map((p) => ({ ...p, controller: "human" as const })),
    });
    this.sim.start();
    this.puppets = s.participants.map((p) => new Puppet(p.id, s.scripts[p.id] ?? []));
    this.held = 0;
  }
}
