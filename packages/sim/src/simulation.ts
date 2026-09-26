import { availableAction } from "./actions.js";
import { boxAt, drawBoxTiles, drawItem, tileId, type BoxState } from "./boxes.js";
import type { SimEvent } from "./events.js";
import { pickUpNode, teamNodeCount, useOldestItem, type ItemWork } from "./items.js";
import { createKeys, selectKeySpawns, unownedKeyAt, type KeyState } from "./keys.js";
import { createLightSwitches, usableSwitchAt, type LightSwitchState } from "./lighting.js";
import { MapGrid } from "./map/grid.js";
import { normalizeMap } from "./map/normalize.js";
import type { MapData, NormalizedMapData, TilePos } from "./map/types.js";
import { createMover, sameTile, stepMover, type MoveIntent, type MoverState } from "./movement.js";
import { nodeAt, placeableAt, placeableMoveFilter, type PlaceableState, type TeleportNodeState } from "./placeables.js";
import { SeededRandom } from "./random/seeded.js";
import { decideTimeoutWinner, finalScores, teamProgress, type RoundResult } from "./round.js";
import { DEFAULT_TUNING, type ItemKind, type Tuning } from "./tuning/index.js";
import type { Controller, Participant, PlayerId, PlayerPhase, TeamId, Tick } from "./types.js";

/**
 * Player intent for one tick. The client and the CPU controller both produce this;
 * the simulation never sees raw keyboard or touch events.
 */
export interface PlayerInput extends MoveIntent {
  /**
   * Press the single context action this tick: climb, flip the light switch
   * underfoot, pick up the team's teleport node underfoot, or use the oldest
   * carried item, in that priority. See `availableAction`.
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
  /** Carried items, oldest first, at most tuning.inventory.capacity. */
  items: ItemKind[];
  /** Cannot move until this tick (trap). 0 when free. */
  frozenUntilTick: Tick;
  /** Node the player just arrived on by teleport; no bounce-back until they step off it. */
  teleportImmunity: string | null;
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
  /** Unopened boxes; always participants x perParticipant while running (section 9). */
  boxes: Record<string, BoxState>;
  /** Doors, obstacles and traps currently on the map (section 10). */
  placeables: Record<string, PlaceableState>;
  /** Quantum teleport endpoints on the floor (section 10.5). */
  nodes: Record<string, TeleportNodeState>;
  /** Per team: tick at which its 1st, 2nd, ... member climbed. */
  teamClimbTicks: Record<TeamId, Tick[]>;
  /** Set the moment the first team has every member on the tower. */
  winnerTeamId: TeamId | null;
  /** Present once status is "finished". */
  result: RoundResult | null;
}

/**
 * Authoritative game simulation: seeded RNG, fixed tick, inputs in, state and
 * events out. Every rule lives here or in the modules it calls; clients only
 * render this state.
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
  /** Every spawn candidate; placeables may never sit on one (section 9). */
  private readonly candidateTiles: ReadonlySet<string>;
  private nextBoxIndex = 0;
  private nextPlaceableIndex = 0;
  private nextNodeIndex = 0;

  constructor(options: SimulationOptions) {
    this.tuning = options.tuning ?? DEFAULT_TUNING;
    this.rng = new SeededRandom(options.seed);
    this.map = normalizeMap(options.map);
    this.grid = MapGrid.fromMapData(this.map);
    this.candidateTiles = new Set(
      [...this.map.spawns.keys, ...this.map.spawns.itemBoxes, ...this.map.spawns.lightSwitches].map(tileId),
    );

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
      boxes: {},
      placeables: {},
      nodes: {},
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
    const player: PlayerState = {
      ...p,
      mover: createMover(at),
      phase: "maze",
      keyId: null,
      towerArrival: null,
      score: 0,
      items: [],
      frozenUntilTick: 0,
      teleportImmunity: null,
    };
    this.state = { ...this.state, players: { ...this.state.players, [p.id]: player } };
    // Keep "keys == participants" if someone joins after the round started (dev-only path;
    // real matchmaking fills the room before start).
    if (this.state.status === "running") {
      this.spawnKeys(this.tuning.keys.perParticipant);
      this.spawnBoxes(this.tuning.itemBoxes.perParticipant);
    }
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
   * Begin the round: one key per participant (section 5), the map's even number
   * of one-shot light switches (section 8) and the item boxes (section 9).
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
    this.spawnBoxes(Object.keys(this.state.players).length * this.tuning.itemBoxes.perParticipant);
    return [{ type: "roundStarted", tick: this.state.tick, keyCount: count }];
  }

  private spawnKeys(count: number): void {
    if (count <= 0) return;
    const taken = new Set(Object.values(this.state.keys).map((k) => tileId(k.pos)));
    const free = this.map.spawns.keys.filter((t) => !taken.has(tileId(t)));
    const chosen = selectKeySpawns(this.rng, free, count);
    const startIndex = Object.keys(this.state.keys).length;
    this.state = { ...this.state, keys: { ...this.state.keys, ...createKeys(chosen, startIndex) } };
  }

  /** Place `count` new boxes on free candidates: no box there and nobody standing on it. */
  private spawnBoxes(count: number, players: Record<PlayerId, PlayerState> = this.state.players, strict = true): string[] {
    if (count <= 0) return [];
    const occupied = new Set<string>(Object.values(this.state.boxes).map((b) => tileId(b.pos)));
    for (const p of Object.values(players)) occupied.add(tileId(p.mover.from));
    const tiles = drawBoxTiles(this.rng, this.map.spawns.itemBoxes, occupied, count, strict);
    const boxes = { ...this.state.boxes };
    const ids: string[] = [];
    for (const pos of tiles) {
      const id = `b${this.nextBoxIndex++}`;
      boxes[id] = { id, pos };
      ids.push(id);
    }
    this.state = { ...this.state, boxes };
    return ids;
  }

  /** Advance exactly one tick using the given inputs. Missing players get NO_INPUT. */
  step(inputs: ReadonlyMap<PlayerId, PlayerInput>): SimEvent[] {
    if (this.state.status === "finished") return [];
    const tick = this.state.tick + 1;
    const speed = this.tuning.movement.speedTilesPerSec / this.tuning.tickRate;

    const work: ItemWork & {
      keys: Record<string, KeyState>;
      boxes: Record<string, BoxState>;
      switches: Record<string, LightSwitchState>;
      lightsOn: boolean;
      openedBoxes: string[];
    } = {
      tick,
      placeables: { ...this.state.placeables },
      nodes: { ...this.state.nodes },
      players: { ...this.state.players },
      candidateTiles: this.candidateTiles,
      boxTiles: new Set(Object.values(this.state.boxes).map((b) => tileId(b.pos))),
      keyTiles: new Set(Object.values(this.state.keys).filter((k) => k.ownerId === null).map((k) => tileId(k.pos))),
      nextPlaceableId: () => `p${this.nextPlaceableIndex++}`,
      nextNodeOrder: () => this.nextNodeIndex++,
      events: [],
      keys: this.state.keys,
      boxes: this.state.boxes,
      switches: this.state.switches,
      lightsOn: this.state.lightsOn,
      openedBoxes: [],
    };
    const towerArrivals = [...this.state.towerArrivals];
    const teamClimbTicks: Record<TeamId, Tick[]> = { ...this.state.teamClimbTicks };
    let winnerTeamId = this.state.winnerTeamId;

    // Placeables time out first so nothing acts on a stale one this tick (section 9).
    for (const pl of Object.values(work.placeables)) {
      if (pl.expiresAtTick <= tick) {
        delete work.placeables[pl.id];
        work.events.push({ type: "placeableExpired", tick, placeableId: pl.id, kind: pl.kind });
      }
    }

    // Sorted ids make simultaneous pickups resolve identically on every replay.
    for (const id of Object.keys(this.state.players).sort()) {
      let p = this.state.players[id] as PlayerState;
      const input = inputs.get(id) ?? NO_INPUT;

      if (p.phase === "tower") {
        // On the platform the commander walks freely (section 5); nothing else applies up there.
        work.players[id] = { ...p, mover: stepMover(p.mover, input, this.grid, speed) };
        continue;
      }

      if (tick >= p.frozenUntilTick) {
        const before = p.mover.from;
        p = { ...p, mover: stepMover(p.mover, input, this.grid, speed, placeableMoveFilter(work.placeables)) };
        if (!sameTile(before, p.mover.from)) p = this.onArrive(work, p, tick);
      }
      if (p.teleportImmunity && !sameTile(p.mover.from, work.nodes[p.teleportImmunity]?.pos ?? p.mover.from)) {
        p = { ...p, teleportImmunity: null };
      }

      if (this.state.status === "running") {
        p = this.pickUps(work, p, id, tick);

        if (input.action) {
          const action = availableAction(this.grid, work.switches, work.nodes, p, this.tuning.inventory.capacity);
          if (action === "climb") {
            const arrival = towerArrivals.length;
            towerArrivals.push(id);
            const table = this.tuning.scoring.towerPlacement;
            const placementScore = table[Math.min(arrival, table.length - 1)] ?? 0;
            // Unused items vanish and become a flat score each (section 3.1 / 5).
            const leftover = p.items.length * this.tuning.scoring.leftoverItem;
            const seats = this.grid.platformTiles();
            const seat = seats[arrival % Math.max(seats.length, 1)] ?? p.mover.from;
            p = {
              ...p,
              phase: "tower",
              towerArrival: arrival,
              score: p.score + placementScore + leftover,
              items: [],
              mover: createMover(seat, p.mover.facing),
            };
            teamClimbTicks[p.teamId] = [...(teamClimbTicks[p.teamId] ?? []), tick];
            work.events.push({ type: "towerClimbed", tick, playerId: id, arrival });
          } else if (action === "switch") {
            const sw = usableSwitchAt(work.switches, p.mover.from) as LightSwitchState;
            work.switches = { ...work.switches, [sw.id]: { ...sw, used: true } };
            work.lightsOn = !work.lightsOn;
            work.events.push({ type: "lightsToggled", tick, playerId: id, switchId: sw.id, lightsOn: work.lightsOn });
          } else if (action === "pickUpNode") {
            p = pickUpNode(work, p);
          } else if (action === "useItem") {
            work.players[id] = p; // so placement sees this player's current tile
            p = useOldestItem(this.grid, this.tuning, work, p);
          }
        }
      }

      work.players[id] = p;
    }

    const players = work.players;

    // Team completion: every member on the tower. The first complete team wins (CLAUDE.md section 3).
    if (this.state.status === "running") {
      const previous = teamProgress(this.state.players, this.state.teamClimbTicks);
      for (const team of teamProgress(players, teamClimbTicks)) {
        const wasComplete = previous.find((t) => t.teamId === team.teamId)?.climbed === team.size;
        if (team.climbed === team.size && !wasComplete) {
          const isWinner = winnerTeamId === null;
          if (isWinner) winnerTeamId = team.teamId;
          work.events.push({ type: "teamCompleted", tick, teamId: team.teamId, isWinner });
        }
      }
    }

    // Replacement boxes spawn in the same tick so the count never drops (section 9).
    this.state = { ...this.state, boxes: work.boxes };
    if (work.openedBoxes.length > 0 && this.state.status === "running") {
      for (const boxId of this.spawnBoxes(work.openedBoxes.length, players, false)) work.events.push({ type: "boxSpawned", tick, boxId });
    }

    let next: SimulationState = {
      ...this.state,
      tick,
      players,
      keys: work.keys,
      switches: work.switches,
      lightsOn: work.lightsOn,
      placeables: work.placeables,
      nodes: work.nodes,
      towerArrivals,
      teamClimbTicks,
      winnerTeamId,
    };

    if (next.status === "running") {
      const everyoneClimbed = Object.values(players).length > 0 && Object.values(players).every((p) => p.phase === "tower");
      const timeUp = tick >= next.endsAtTick;
      if (everyoneClimbed || timeUp) {
        let reason: RoundResult["reason"] = "allClimbed";
        if (winnerTeamId === null) {
          const decided = decideTimeoutWinner(teamProgress(players, teamClimbTicks), this.tuning);
          winnerTeamId = decided.winnerTeamId;
          reason = decided.reason;
        }
        const result: RoundResult = { winnerTeamId, reason, finalScores: finalScores(players, winnerTeamId, this.tuning) };
        next = { ...next, status: "finished", winnerTeamId, result };
        work.events.push({ type: "roundEnded", tick, winnerTeamId, reason });
      }
    }

    this.state = next;
    return work.events;
  }

  /** Effects of stepping onto a new tile: traps fire, own paired nodes teleport. */
  private onArrive(work: ItemWork, p: PlayerState, tick: Tick): PlayerState {
    const trap = placeableAt(work.placeables, p.mover.from);
    if (trap?.kind === "trap" && !trap.placeholder) {
      delete work.placeables[trap.id];
      const frozenUntilTick = tick + Math.round(this.tuning.placeables.trapFreezeSec * this.tuning.tickRate);
      work.events.push({ type: "trapTriggered", tick, playerId: p.id, placeableId: trap.id, frozenUntilTick });
      // Arriving cancels any queued movement; the player stands frozen on the trap tile.
      p = { ...p, frozenUntilTick, mover: { ...p.mover, target: null, progress: 0 } };
    }
    const node = nodeAt(work.nodes, p.mover.from);
    if (node && node.teamId === p.teamId && node.pairedWith && p.teleportImmunity !== node.id) {
      const partner = work.nodes[node.pairedWith];
      if (partner) {
        work.events.push({ type: "teleported", tick, playerId: p.id, fromNodeId: node.id, toNodeId: partner.id });
        p = { ...p, mover: createMover(partner.pos, p.mover.facing), teleportImmunity: partner.id };
      }
    }
    return p;
  }

  /** Keys and boxes underfoot (sections 5 and 9). */
  private pickUps(
    work: ItemWork & { keys: Record<string, KeyState>; boxes: Record<string, BoxState>; openedBoxes: string[] },
    p: PlayerState,
    id: PlayerId,
    tick: Tick,
  ): PlayerState {
    if (p.keyId === null) {
      const key = unownedKeyAt(work.keys, p.mover.from);
      if (key) {
        work.keys = { ...work.keys, [key.id]: { ...key, ownerId: id } };
        p = { ...p, keyId: key.id, score: p.score + this.tuning.scoring.keyFound };
        work.events.push({ type: "keyPickedUp", tick, playerId: id, keyId: key.id });
      }
    }
    if (p.items.length < this.tuning.inventory.capacity) {
      const box = boxAt(work.boxes, p.mover.from);
      if (box) {
        // A team already holding its two teleport nodes cannot draw a third (section 9).
        const owned = teamNodeCount({ ...work.players, [id]: p }, work.nodes, p.teamId);
        const excluded: ItemKind[] = owned >= this.tuning.teleport.maxNodesPerTeam ? ["teleportNode"] : [];
        const item = drawItem(this.rng, this.tuning, excluded);
        const rest = { ...work.boxes };
        delete rest[box.id];
        work.boxes = rest;
        work.openedBoxes.push(box.id);
        p = { ...p, items: [...p.items, item] };
        work.events.push({ type: "boxOpened", tick, playerId: id, boxId: box.id, item });
      }
    }
    return p;
  }

  /** What the context action would do for `p` right now. */
  availableAction(p: PlayerState) {
    return availableAction(this.grid, this.state.switches, this.state.nodes, p, this.tuning.inventory.capacity);
  }

  getState(): Readonly<SimulationState> {
    return this.state;
  }
}
