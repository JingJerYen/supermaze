import { SeededRandom } from "./random/seeded.js";
import { DEFAULT_TUNING, type Tuning } from "./tuning/index.js";
import type { Participant, Tick } from "./types.js";

/**
 * Player intent for one tick. The client and the CPU controller both produce this;
 * the simulation never sees raw keyboard or touch events.
 */
export interface PlayerInput {
  /** Desired movement direction in tile space, each axis in {-1, 0, 1}. */
  moveX: number;
  moveY: number;
}

export interface SimulationOptions {
  seed: number;
  participants: Participant[];
  tuning?: Tuning;
}

export interface SimulationState {
  tick: Tick;
  participants: Participant[];
}

/**
 * Authoritative game simulation. Phase-0 skeleton: it only advances a tick counter,
 * but the shape (seeded RNG, fixed tick, inputs in, state out) is the contract
 * every later system builds on.
 */
export class Simulation {
  readonly tuning: Tuning;
  readonly rng: SeededRandom;
  private state: SimulationState;

  constructor(options: SimulationOptions) {
    this.tuning = options.tuning ?? DEFAULT_TUNING;
    this.rng = new SeededRandom(options.seed);
    this.state = {
      tick: 0,
      participants: options.participants.map((p) => ({ ...p })),
    };
  }

  /** Advance exactly one tick using the given inputs. */
  step(_inputs: ReadonlyMap<string, PlayerInput>): void {
    this.state = { ...this.state, tick: this.state.tick + 1 };
  }

  getState(): Readonly<SimulationState> {
    return this.state;
  }
}
