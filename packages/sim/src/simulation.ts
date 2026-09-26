import { availableAction } from "./actions.js";
import type { SimEvent } from "./events.js";
import { createKeys, selectKeySpawns, unownedKeyAt, type KeyState } from "./keys.js";
import { createLightSwitches, usableSwitchAt, type LightSwitchState } from "./lighting.js";
import { MapGrid } from "./map/grid.js";
import { normalizeMap } from "./map/normalize.js";
import type { MapData, NormalizedMapData, TilePos } from "./map/types.js";
import { createMover, stepMover, type MoveIntent, type MoverState } from "./movement.js";
import { SeededRandom } from "./random/seeded.js";
import { decideTimeoutWinner, finalScores, teamProgress, type RoundResult } from "./round.js";
import { DEFAULT_TUNING, type Tuning } from "./tuning/index.js";
import type { Controller, Participant, PlayerId, PlayerPhase, TeamId, Tick } from "./types.js";

/**
 * Player intent for one tick. The client and the CPU controller both produce this;
 * the simulation never sees raw keyboard or touch events.
 */
export interface PlayerInput extends MoveIntent {
  /**
   * Press the context action this tick: climb the tower when standing at an
   * entry with a key, or flip the light switch under the player. See `availableAction`.
   */
  action?: boolean;
}

export const NO_INPUT: PlayerInput = { moveX: 0, moveY: 0 };

export interface SimulationOptions {
  seed: number;
  map: MapData;
  participants: Participant[];
  tuning?: Tuning;
  /** Developer override of the round length, seconds. Defaults to tuning.round.timeLimitSec. */
  timeLimitSec?: number;
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

export type RoundStatus = "lobby" | "running" | "finished";

export interface SimulationState {
  tick: Tick;
  status: RoundStatus;
  /** Tick the round started and the tick at which time runs out (exclusive). */
  startTick: Tick;
  endsAtTick: Tick;
  players: Record<PlayerId, PlayerState>;
  keys: Record<string, KeyState>;
  /** Player ids in the order they reached the tower top. */
  towerArrivals: PlayerId[];
  /** Map-wide lighting (CLAUDE.md section 8). Starts lit. */
  lightsOn: boolean;
  switches: Record<string, LightSwitchState>;
  /** Per team: tick at which its 1st, 2nd, ... member climbed. */
  teamClimbTicks: Record<TeamId, Tick[]>;
  /** Set the moment the first team has every member on the tower. */
  winnerTeamId: TeamId | null;
  /** Present once status is "finished". */
  result: RoundResult | null;
}

/**
 * Authoritative game simulation: seeded RNG, fixed tick, inputs in, state and
 * events out. Phase 1 so far: movement, keys, tower climb and their scores.
 */
export class Simulation {
  readonly tuning: Tuning;
  readonly rng: SeededRandom;
  readonly grid: MapGrid;
  private readonly map: NormalizedMapData;
  private state: SimulationState;
  private readonly spawns: TilePos[];
  private spawnCursor = 0;
  private readonly timeLimitTicks: number;

  constructor(options: SimulationOptions) {
    this.tuning = options.tuning ?? DEFAULT_TUNING;
    this.rng = new SeededRandom(options.seed);
    this.map = normalizeMap(options.map);
    this.grid = MapGrid.fromMapData(this.map);

    this.spawns = this.grid.spawnTiles();
    if (this.spawns.length === 0) {
      const road = this.grid.findCells("road")[0];
      if (!road) throw new Error("map has no walkable spawn");
      this.spawns = [{ ...road, layer: "road" }];
    }

    const limitSec = options.timeLimitSec ?? this.tuning.round.timeLimitSec;
    this.timeLimitTicks = Math.max(1, Math.round(limitSec * this.tuning.tickRate));

    this.state = {
      tick: 0,
      status: "lobby",
      startTick: 0,
      endsAtTick: 0,
      players: {},
      keys: {},
      towerArrivals: [],
      lightsOn: true,
      switches: {},
      teamClimbTicks: {},
      winnerTeamId: null,
      result: null,
    };
    for (const p of options.participants) this.addPlayer(p);
  }

  /** Seconds left in the round, clamped at 0. */
  remainingSec(): number {
    if (this.state.status !== "running") return this.state.status === "lobby" ? this.timeLimitTicks / this.tuning.tickRate : 0;
    return Math.max(0, this.state.endsAtTick - this.state.tick) / this.tuning.tickRate;
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

  /**
   * Begin the round: one key per participant (section 5) and the map's even
   * number of one-shot light switches (section 8).
   */
  start(): SimEvent[] {
    if (this.state.status !== "lobby") return [];
    const count = Object.keys(this.state.players).length * this.tuning.keys.perParticipant;
    const switches = createLightSwitches(this.rng, this.grid, this.map.spawns.lightSwitches, this.map.lightSwitchCount);
    this.state = {
      ...this.state,
      status: "running",
      startTick: this.state.tick,
      endsAtTick: this.state.tick + this.timeLimitTicks,
      switches,
    };
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
    if (this.state.status === "finished") return [];
    const events: SimEvent[] = [];
    const tick = this.state.tick + 1;
    const speed = this.tuning.movement.speedTilesPerSec / this.tuning.tickRate;
    const players: Record<PlayerId, PlayerState> = {};
    let keys = this.state.keys;
    let switches = this.state.switches;
    let lightsOn = this.state.lightsOn;
    const towerArrivals = [...this.state.towerArrivals];
    const teamClimbTicks: Record<TeamId, Tick[]> = { ...this.state.teamClimbTicks };
    let winnerTeamId = this.state.winnerTeamId;

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
        if (input.action) {
          const action = availableAction(this.grid, switches, p);
          if (action === "climb") {
            const arrival = towerArrivals.length;
            towerArrivals.push(id);
            const table = this.tuning.scoring.towerPlacement;
            const placementScore = table[Math.min(arrival, table.length - 1)] ?? 0;
            p = { ...p, phase: "tower", towerArrival: arrival, score: p.score + placementScore };
            teamClimbTicks[p.teamId] = [...(teamClimbTicks[p.teamId] ?? []), tick];
            events.push({ type: "towerClimbed", tick, playerId: id, arrival });
          } else if (action === "switch") {
            const sw = usableSwitchAt(switches, p.mover.from) as LightSwitchState;
            switches = { ...switches, [sw.id]: { ...sw, used: true } };
            lightsOn = !lightsOn;
            events.push({ type: "lightsToggled", tick, playerId: id, switchId: sw.id, lightsOn });
          }
        }
      }

      players[id] = p;
    }

    // Team completion: every member on the tower. The first complete team wins (CLAUDE.md section 3).
    if (this.state.status === "running") {
      for (const team of teamProgress(players, teamClimbTicks)) {
        const wasComplete = teamProgress(this.state.players, this.state.teamClimbTicks).find((t) => t.teamId === team.teamId)?.climbed === team.size;
        if (team.climbed === team.size && !wasComplete) {
          const isWinner = winnerTeamId === null;
          if (isWinner) winnerTeamId = team.teamId;
          events.push({ type: "teamCompleted", tick, teamId: team.teamId, isWinner });
        }
      }
    }

    let next: SimulationState = { ...this.state, tick, players, keys, switches, lightsOn, towerArrivals, teamClimbTicks, winnerTeamId };

    if (next.status === "running") {
      const everyoneClimbed = Object.values(players).length > 0 && Object.values(players).every((p) => p.phase === "tower");
      const timeUp = tick >= next.endsAtTick;
      if (everyoneClimbed || timeUp) {
        let reason: RoundResult["reason"] = "allClimbed";
        if (winnerTeamId === null) {
          const decided = decideTimeoutWinner(teamProgress(players, teamClimbTicks), this.tuning);
          winnerTeamId = decided.winnerTeamId;
          reason = decided.reason;
        } else if (timeUp && !everyoneClimbed) {
          reason = "allClimbed"; // a team already won; timeout merely closes the round
        }
        const result: RoundResult = { winnerTeamId, reason, finalScores: finalScores(players, winnerTeamId, this.tuning) };
        next = { ...next, status: "finished", winnerTeamId, result };
        events.push({ type: "roundEnded", tick, winnerTeamId, reason });
      }
    }

    this.state = next;
    return events;
  }

  /** What the context action would do for `p` right now. */
  availableAction(p: PlayerState) {
    return availableAction(this.grid, this.state.switches, p);
  }

  getState(): Readonly<SimulationState> {
    return this.state;
  }
}
