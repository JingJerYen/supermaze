import type { SimEvent } from "./events.js";
import { createKeys, selectKeySpawns, unownedKeyAt, type KeyState } from "./keys.js";
import { MapGrid } from "./map/grid.js";
import type { MapData, TilePos } from "./map/types.js";
import { createMover, stepMover, type MoveIntent, type MoverState } from "./movement.js";
import { SeededRandom } from "./random/seeded.js";
import { DEFAULT_TUNING, type Tuning } from "./tuning/index.js";
import type { Controller, Participant, PlayerId, PlayerPhase, Tick } from "./types.js";

/**
 * Player intent for one tick. The client and the CPU controller both produce this;
 * the simulation never sees raw keyboard or touch events.
 */
export interface PlayerInput extends MoveIntent {
  /** Ask to climb the tower this tick. Only honoured when standing at a tower entry with a key. */
  climb?: boolean;
}

export const NO_INPUT: PlayerInput = { moveX: 0, moveY: 0 };

export interface SimulationOptions {
  seed: number;
  map: MapData;
  participants: Participant[];
  tuning?: Tuning;
}

export interface PlayerState extends Participant {
  mover: MoverState;
  phase: PlayerPhase;
  /** Key this player holds (or used to climb). Bound for the whole round; never transferable. */
  keyId: string | null;
  /** 0-based order of arrival on the tower top, null while still in the maze. */
  towerArrival: number | null;
  score: number;
}

export type RoundStatus = "lobby" | "running";

export interface SimulationState {
  tick: Tick;
  status: RoundStatus;
  players: Record<PlayerId, PlayerState>;
  keys: Record<string, KeyState>;
  /** Player ids in the order they reached the tower top. */
  towerArrivals: PlayerId[];
}

/**
 * Authoritative game simulation: seeded RNG, fixed tick, inputs in, state and
 * events out. Phase 1 so far: movement, keys, tower climb and their scores.
 */
export class Simulation {
  readonly tuning: Tuning;
  readonly rng: SeededRandom;
  readonly grid: MapGrid;
  private readonly map: MapData;
  private state: SimulationState;
  private readonly spawns: TilePos[];
  private spawnCursor = 0;

  constructor(options: SimulationOptions) {
    this.tuning = options.tuning ?? DEFAULT_TUNING;
    this.rng = new SeededRandom(options.seed);
    this.map = options.map;
    this.grid = MapGrid.fromMapData(options.map);

    this.spawns = this.grid.spawnTiles();
    if (this.spawns.length === 0) {
      const road = this.grid.findCells("road")[0];
      if (!road) throw new Error("map has no walkable spawn");
      this.spawns = [{ ...road, layer: "road" }];
    }

    this.state = { tick: 0, status: "lobby", players: {}, keys: {}, towerArrivals: [] };
    for (const p of options.participants) this.addPlayer(p);
  }

  /** Add a participant at the next spawn tile. Idempotent for an existing id. */
  addPlayer(p: Participant): void {
    if (this.state.players[p.id]) return;
    const at = this.spawns[this.spawnCursor % this.spawns.length] as TilePos;
    this.spawnCursor++;
    const player: PlayerState = { ...p, mover: createMover(at), phase: "maze", keyId: null, towerArrival: null, score: 0 };
    this.state = { ...this.state, players: { ...this.state.players, [p.id]: player } };
    // Keep "keys == participants" if someone joins after the round started (dev-only path;
    // real matchmaking fills the room before start).
    if (this.state.status === "running") this.spawnKeys(this.tuning.keys.perParticipant);
  }

  /**
   * Switch who drives a player. A disconnected human becomes `cpu` and keeps
   * position, team and everything else (CLAUDE.md section 2); reconnecting
   * switches back to `human`.
   */
  setController(id: PlayerId, controller: Controller): void {
    const p = this.state.players[id];
    if (!p || p.controller === controller) return;
    this.state = { ...this.state, players: { ...this.state.players, [id]: { ...p, controller } } };
  }

  /** Remove a player entirely. Only for lobby-phase leaves; mid-round leaves use setController. */
  removePlayer(id: PlayerId): void {
    if (!this.state.players[id]) return;
    const players = { ...this.state.players };
    delete players[id];
    this.state = { ...this.state, players };
  }

  /** Begin the round: spawn exactly one key per participant (CLAUDE.md section 5). */
  start(): SimEvent[] {
    if (this.state.status === "running") return [];
    const count = Object.keys(this.state.players).length * this.tuning.keys.perParticipant;
    this.state = { ...this.state, status: "running" };
    this.spawnKeys(count);
    return [{ type: "roundStarted", tick: this.state.tick, keyCount: count }];
  }

  private spawnKeys(count: number): void {
    if (count <= 0) return;
    const taken = new Set(Object.values(this.state.keys).map((k) => `${k.pos.x},${k.pos.y},${k.pos.layer}`));
    const free = this.map.spawns.keys.filter((t) => !taken.has(`${t.x},${t.y},${t.layer}`));
    const chosen = selectKeySpawns(this.rng, free, count);
    const startIndex = Object.keys(this.state.keys).length;
    this.state = { ...this.state, keys: { ...this.state.keys, ...createKeys(chosen, startIndex) } };
  }

  /** Advance exactly one tick using the given inputs. Missing players get NO_INPUT. */
  step(inputs: ReadonlyMap<PlayerId, PlayerInput>): SimEvent[] {
    const events: SimEvent[] = [];
    const tick = this.state.tick + 1;
    const speed = this.tuning.movement.speedTilesPerSec / this.tuning.tickRate;
    const players: Record<PlayerId, PlayerState> = {};
    let keys = this.state.keys;
    const towerArrivals = [...this.state.towerArrivals];

    // Sorted ids make simultaneous pickups resolve identically on every replay.
    for (const id of Object.keys(this.state.players).sort()) {
      let p = this.state.players[id] as PlayerState;
      const input = inputs.get(id) ?? NO_INPUT;

      if (p.phase === "tower") {
        players[id] = p;
        continue;
      }

      p = { ...p, mover: stepMover(p.mover, input, this.grid, speed) };

      if (this.state.status === "running") {
        if (p.keyId === null) {
          const key = unownedKeyAt(keys, p.mover.from);
          if (key) {
            keys = { ...keys, [key.id]: { ...key, ownerId: id } };
            p = { ...p, keyId: key.id, score: p.score + this.tuning.scoring.keyFound };
            events.push({ type: "keyPickedUp", tick, playerId: id, keyId: key.id });
          }
        }
        if (input.climb && this.canClimb(p)) {
          const arrival = towerArrivals.length;
          towerArrivals.push(id);
          const table = this.tuning.scoring.towerPlacement;
          const placementScore = table[Math.min(arrival, table.length - 1)] ?? 0;
          p = { ...p, phase: "tower", towerArrival: arrival, score: p.score + placementScore };
          events.push({ type: "towerClimbed", tick, playerId: id, arrival });
        }
      }

      players[id] = p;
    }

    this.state = { ...this.state, tick, players, keys, towerArrivals };
    return events;
  }

  /** Standing still on a tower entry tile, in the maze, holding a key. */
  canClimb(p: PlayerState): boolean {
    return (
      p.phase === "maze" &&
      p.keyId !== null &&
      p.mover.target === null &&
      p.mover.from.layer === "road" &&
      this.grid.isTowerEntry(p.mover.from.x, p.mover.from.y)
    );
  }

  getState(): Readonly<SimulationState> {
    return this.state;
  }
}
