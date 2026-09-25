import { MapGrid } from "./map/grid.js";
import type { MapData, TilePos } from "./map/types.js";
import { createMover, stepMover, type MoveIntent, type MoverState } from "./movement.js";
import { SeededRandom } from "./random/seeded.js";
import { DEFAULT_TUNING, type Tuning } from "./tuning/index.js";
import type { Participant, PlayerId, Tick } from "./types.js";

/**
 * Player intent for one tick. The client and the CPU controller both produce this;
 * the simulation never sees raw keyboard or touch events.
 */
export type PlayerInput = MoveIntent;

export const NO_INPUT: PlayerInput = { moveX: 0, moveY: 0 };

export interface SimulationOptions {
  seed: number;
  map: MapData;
  participants: Participant[];
  tuning?: Tuning;
}

export interface PlayerState extends Participant {
  mover: MoverState;
}

export interface SimulationState {
  tick: Tick;
  players: Record<PlayerId, PlayerState>;
}

/**
 * Authoritative game simulation: seeded RNG, fixed tick, inputs in, state out.
 * Phase 0 implements movement only; every later system plugs into `step`.
 */
export class Simulation {
  readonly tuning: Tuning;
  readonly rng: SeededRandom;
  readonly grid: MapGrid;
  private state: SimulationState;

  constructor(options: SimulationOptions) {
    this.tuning = options.tuning ?? DEFAULT_TUNING;
    this.rng = new SeededRandom(options.seed);
    this.grid = MapGrid.fromMapData(options.map);

    let spawns: TilePos[] = this.grid.spawnTiles();
    if (spawns.length === 0) {
      const road = this.grid.findCells("road")[0];
      if (!road) throw new Error("map has no walkable spawn");
      spawns = [{ ...road, layer: "road" }];
    }

    const players: Record<PlayerId, PlayerState> = {};
    options.participants.forEach((p, i) => {
      players[p.id] = { ...p, mover: createMover(spawns[i % spawns.length] as TilePos) };
    });
    this.state = { tick: 0, players };
  }

  /** Advance exactly one tick using the given inputs. Missing players get NO_INPUT. */
  step(inputs: ReadonlyMap<PlayerId, PlayerInput>): void {
    const speed = this.tuning.movement.speedTilesPerSec / this.tuning.tickRate;
    const players: Record<PlayerId, PlayerState> = {};
    for (const [id, p] of Object.entries(this.state.players)) {
      const input = inputs.get(id) ?? NO_INPUT;
      players[id] = { ...p, mover: stepMover(p.mover, input, this.grid, speed) };
    }
    this.state = { tick: this.state.tick + 1, players };
  }

  getState(): Readonly<SimulationState> {
    return this.state;
  }
}
