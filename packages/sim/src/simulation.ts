import { availableAction, canDiscard } from "./actions.js";
import { boxAt, drawBoxTiles, drawItem, tileId, type BoxState, canDrawItem } from "./boxes.js";
import type { SimEvent } from "./events.js";
import { applyTimeStop, canUseSkill, castSkill, type SkillEffect, type SkillKind } from "./skills.js";
import { beginWarning, initialGhostState, isGhost, stepGhost, type GhostState } from "./ghost.js";
import { movePlayer } from "./playerMove.js";
import { pickUpNode, teamNodeCount, useOldestItem, type ItemWork } from "./items.js";
import { createKeys, selectKeySpawns, unownedKeyAt, type KeyState } from "./keys.js";
import { createLightSwitches, usableSwitchAt, type LightSwitchState } from "./lighting.js";
import { MapGrid } from "./map/grid.js";
import { normalizeMap } from "./map/normalize.js";
import type { MapData, NormalizedMapData, TilePos } from "./map/types.js";
import { createMover, moverPosition, sameTile, type MoveIntent, type MoverState } from "./movement.js";
import { nodeAt, placeableAt, placeableMoveFilter, type PlaceableState, type TeleportNodeState } from "./placeables.js";
import { SeededRandom } from "./random/seeded.js";
import { decideSoloWinner, decideTimeoutWinner, finalScores, teamProgress, type RoundResult } from "./round.js";
import { DEFAULT_TUNING, type ItemKind, type Tuning } from "./tuning/index.js";
import type { Controller, Participant, PlayerId, PlayerPhase, TeamId, TeamMode, Tick } from "./types.js";

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
  /**
   * Throw away the oldest carried item this tick (section 9). It vanishes; it is
   * not dropped on the floor. Ignored on a tick that also presses `action`.
   */
  discard?: boolean;
  /** Cast the one-shot skill this tick, if the player holds one (tower run; `canUseSkill`). */
  skill?: boolean;
}

export const NO_INPUT: PlayerInput = { moveX: 0, moveY: 0 };

export interface SimulationOptions {
  seed: number;
  map: MapData;
  participants: Participant[];
  tuning?: Tuning;
  /**
   * Developer override of the round length, seconds. Default: the map's
   * `timeLimitSec` plus `round.extraSecPerParticipant` per participant beyond two.
   */
  timeLimitSec?: number;
  /** Two equal teams (default) or everyone for themselves; see `TeamMode`. */
  teamMode?: TeamMode;
  /**
   * Solo only: the round ends the moment this player climbs, without waiting
   * for the others (the tower run ends a floor when you climb; section 4.1).
   */
  endWhenClimbed?: PlayerId;
}

export interface PlayerState extends Participant {
  mover: MoverState;
  phase: PlayerPhase;
  /** Whether the score for finding a key has been given; it is given once per round, whatever happens to the key later. */
  keyScored: boolean;
  /** Key this player holds (or used to climb). Bound for the whole round; never transferable. */
  keyId: string | null;
  /** 0-based order of arrival on the tower top, null while still in the maze. */
  towerArrival: number | null;
  score: number;
  /** Carried items, oldest first, at most tuning.inventory.capacity. */
  items: ItemKind[];
  /** Cannot move until this tick (trap or ghost catch). 0 when free. */
  frozenUntilTick: Tick;
  /** What caused the latest freeze; meaningful while `frozenUntilTick` is in the future. Clients pick the look from it. */
  frozenBy: "trap" | "ghost" | "skill" | null;
  /** Node the player just arrived on by teleport; no bounce-back until they step off it. */
  teleportImmunity: string | null;
  /** Cannot be caught by a ghost until this tick (covers the post-catch freeze and protection). */
  protectedUntilTick: Tick;
  /** Skill still to cast this round; null once cast or when none was given. */
  skill: SkillKind | null;
  /** The timed skill cast this round (sprint, eagle eye, lantern), kept after it runs out. */
  skillEffect: SkillEffect | null;
  /** The amulet is up: the next trap or ghost catch is shrugged off. */
  shielded: boolean;
}

export type RoundStatus = "lobby" | "running" | "finished";

export interface SimulationState {
  tick: Tick;
  status: RoundStatus;
  /** Fixed for the whole round. In `solo` every player's teamId is their own id. */
  teamMode: TeamMode;
  /** Tick the round started and the tick at which time runs out (exclusive). */
  startTick: Tick;
  endsAtTick: Tick;
  /**
   * Start freeze: until this tick nobody moves or acts (section 4). Set by
   * `start()` from `round.introSec` + `round.startFreezeSec`; 0 in the lobby.
   * Clients derive the opening fly-in and countdown from it, so no event is
   * needed when it ends.
   */
  freezeUntilTick: Tick;
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
  /** Periodic ghost-tag event (section 13). */
  ghost: GhostState;
  /** Per team: tick at which its 1st, 2nd, ... member climbed. */
  teamClimbTicks: Record<TeamId, Tick[]>;
  /**
   * Teams: set the moment the first team has every member on the tower. Solo:
   * null during the round, decided by score when it ends.
   */
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
  private readonly timeLimitOverrideSec: number | undefined;
  private readonly teamMode: TeamMode;
  private readonly endWhenClimbed: PlayerId | undefined;
  private nextBoxIndex = 0;
  private nextPlaceableIndex = 0;
  private nextNodeIndex = 0;
  /** Points earned this tick by players other than the one being stepped (trap owners); applied after the player loop. */
  private pendingScores: { playerId: PlayerId; points: number }[] = [];

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

    this.timeLimitOverrideSec = options.timeLimitSec;

    this.teamMode = options.teamMode ?? "teams";
    this.endWhenClimbed = this.teamMode === "solo" ? options.endWhenClimbed : undefined;
    this.state = {
      tick: 0,
      status: "lobby",
      teamMode: this.teamMode,
      startTick: 0,
      endsAtTick: 0,
      freezeUntilTick: 0,
      players: {},
      keys: {},
      towerArrivals: [],
      lightsOn: true,
      switches: {},
      boxes: {},
      placeables: {},
      nodes: {},
      ghost: { phase: "idle", teamId: null, phaseEndsAtTick: 0, counts: {}, lastTeamId: null, intervalTicks: 0 },
      teamClimbTicks: {},
      winnerTeamId: null,
      result: null,
    };
    for (const p of options.participants) this.addPlayer(p);
  }

  /** Round length for the current number of participants, in ticks. Fixed once the round starts. */
  private timeLimitTicks(): number {
    const extra = Math.max(0, Object.keys(this.state.players).length - 2) * this.tuning.round.extraSecPerParticipant;
    const sec = this.timeLimitOverrideSec ?? this.map.timeLimitSec + extra;
    return Math.max(1, Math.round(sec * this.tuning.tickRate));
  }

  /** Seconds left in the round, clamped at 0. */
  remainingSec(): number {
    if (this.state.status !== "running") return this.state.status === "lobby" ? this.timeLimitTicks() / this.tuning.tickRate : 0;
    return Math.max(0, this.state.endsAtTick - this.state.tick) / this.tuning.tickRate;
  }

  /** Add a participant at the next spawn tile. Idempotent for an existing id. */
  addPlayer(p: Participant): void {
    if (this.state.players[p.id]) return;
    const at = this.spawns[this.spawnCursor % this.spawns.length] as TilePos;
    this.spawnCursor++;
    const player: PlayerState = {
      ...p,
      // Solo: a team of one, whatever team the lobby had them in.
      teamId: this.teamMode === "solo" ? p.id : p.teamId,
      mover: createMover(at),
      phase: "maze",
      keyId: null,
      towerArrival: null,
      score: 0,
      items: [],
      frozenUntilTick: 0,
      frozenBy: null,
      teleportImmunity: null,
      protectedUntilTick: 0,
      keyScored: false,
      skill: p.skill ?? null,
      skillEffect: null,
      shielded: false,
    };
    this.state = { ...this.state, players: { ...this.state.players, [p.id]: player } };
    // Keep "keys == participants" if someone joins after the round started (dev-only path;
    // real matchmaking fills the room before start).
    if (this.state.status === "running") {
      this.spawnKeys(this.tuning.keys.perParticipant);
      this.reserveTiles();
      if (this.map.itemBoxCount === undefined) this.spawnBoxes(this.tuning.itemBoxes.perParticipant);
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
    // The opening fly-in comes first and is not part of the round: the clock and the ghost schedule start after it.
    const introTicks = Math.round(this.tuning.round.introSec * this.tuning.tickRate);
    const clockStart = this.state.tick + introTicks;
    this.state = {
      ...this.state,
      status: "running",
      startTick: this.state.tick,
      endsAtTick: clockStart + this.timeLimitTicks(),
      freezeUntilTick: clockStart + Math.round(this.tuning.round.startFreezeSec * this.tuning.tickRate),
      switches,
      ghost: initialGhostState(clockStart, this.tuning, this.timeLimitTicks()),
    };
    this.spawnKeys(count);
    // The map's own box count when it has one, otherwise so many per participant (section 9).
    this.spawnBoxes(this.map.itemBoxCount ?? Object.keys(this.state.players).length * this.tuning.itemBoxes.perParticipant);
    this.placeFixtures();
    this.reserveTiles();
    return [{ type: "roundStarted", tick: this.state.tick, keyCount: count }];
  }

  /** Fix where placeables may not go this round: once, here, never per tick (section 9). */
  private reserveTiles(): void {
    this.grid.reserveForRound(
      Object.values(this.state.keys).map((k) => k.pos),
      Object.values(this.state.switches).map((s) => s.pos),
    );
  }

  /** Every map fixture, every round: permanent doors, obstacles and traps (section 10.6). */
  private placeFixtures(): void {
    const placeables = { ...this.state.placeables };
    this.map.fixtures.forEach((f, i) => {
      const id = `f${i}`;
      placeables[id] = {
        id,
        kind: f.kind,
        pos: { x: f.x, y: f.y, layer: f.layer },
        dir: f.dir ?? { dx: 0, dy: 1 },
        ownerId: null,
        expiresAtTick: 0,
        permanent: true,
      };
    });
    this.state = { ...this.state, placeables };
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
    // Start freeze (section 4): the world keeps ticking but no player moves, picks up or acts.
    const startFrozen = this.state.status === "running" && tick < this.state.freezeUntilTick;

    // Ghost-tag schedule advances first so this tick's movement uses the right roles and speeds.
    let ghost = this.state.ghost;
    if (this.state.status === "running") {
      const g = stepGhost(ghost, this.state.players, tick, this.tuning, this.state.endsAtTick);
      ghost = g.ghost;
      work.events.push(...g.events);
    }

    // Placeables time out first so nothing acts on a stale one this tick (section 9).
    for (const pl of Object.values(work.placeables)) {
      if (!pl.permanent && pl.expiresAtTick <= tick) {
        delete work.placeables[pl.id];
        work.events.push({ type: "placeableExpired", tick, placeableId: pl.id, kind: pl.kind });
      }
    }

    const timeStops: { casterId: PlayerId; until: Tick }[] = [];
    const moveCtx = { tick, status: this.state.status, freezeUntilTick: this.state.freezeUntilTick, ghost, placeables: work.placeables };

    // Sorted ids make simultaneous pickups resolve identically on every replay.
    for (const id of Object.keys(this.state.players).sort()) {
      let p = this.state.players[id] as PlayerState;
      const input = inputs.get(id) ?? NO_INPUT;

      if (startFrozen) {
        work.players[id] = p;
        continue;
      }

      if (p.phase === "tower") {
        // On the platform the commander walks freely (section 5); nothing else applies up there.
        work.players[id] = { ...p, mover: movePlayer(this.grid, this.tuning, moveCtx, p, input) };
        continue;
      }

      const ghostly = isGhost(ghost, p);
      if (tick >= p.frozenUntilTick) {
        const before = p.mover.from;
        p = { ...p, mover: movePlayer(this.grid, this.tuning, moveCtx, p, input) };
        if (!sameTile(before, p.mover.from)) p = this.onArrive(work, p, tick);
      }
      if (p.teleportImmunity && !sameTile(p.mover.from, work.nodes[p.teleportImmunity]?.pos ?? p.mover.from)) {
        p = { ...p, teleportImmunity: null };
      }

      if (this.state.status === "running") {
        // Ghosts cannot collect anything while the chase is on (section 13).
        if (!ghostly) p = this.pickUps(work, p, id, tick);

        if (input.action) {
          work.players[id] = p; // the action decision must see this player's current tile
          const action = availableAction(
            this.grid,
            {
              tick,
              freezeUntilTick: this.state.freezeUntilTick,
              switches: work.switches,
              nodes: work.nodes,
              placeables: work.placeables,
              players: work.players,
              boxes: work.boxes,
              keys: work.keys,
              ghost,
            },
            p,
            this.tuning.inventory.capacity,
          );
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
            p = { ...p, score: p.score + this.tuning.scoring.lightSwitch };
            work.events.push({ type: "lightsToggled", tick, playerId: id, switchId: sw.id, lightsOn: work.lightsOn });
          } else if (action === "pickUpNode") {
            p = pickUpNode(work, p);
          } else if (action === "useItem") {
            p = useOldestItem(this.grid, this.tuning, work, p);
          }
        } else if (input.discard && canDiscard({ tick, freezeUntilTick: this.state.freezeUntilTick, ghost }, p)) {
          const item = p.items[0] as ItemKind;
          p = { ...p, items: p.items.slice(1) };
          work.events.push({ type: "itemDiscarded", tick, playerId: id, item });
        }
        if (input.skill && canUseSkill({ tick, freezeUntilTick: this.state.freezeUntilTick, lightsOn: work.lightsOn, running: true, placeables: work.placeables }, p, this.grid)) {
          const cast = castSkill(p, tick, this.tuning, this.grid, work.placeables);
          p = cast.caster;
          work.events.push(cast.event);
          if (cast.timeStopUntil !== null) timeStops.push({ casterId: id, until: cast.timeStopUntil });
        }
      }

      work.players[id] = p;
    }
    // Everyone has moved from last tick's state; now a time stop can hold them.
    for (const t of timeStops) applyTimeStop(work.players, t.casterId, t.until);

    const players = work.players;
    for (const s of this.pendingScores) {
      const scorer = players[s.playerId];
      if (scorer) players[s.playerId] = { ...scorer, score: scorer.score + s.points };
    }
    this.pendingScores = [];

    // Catches: a ghost overlapping an unprotected runner freezes them and empties their bag.
    if (ghost.phase === "active" && this.state.status === "running") {
      const radius = this.tuning.ghostEvent.catchRadiusTiles;
      const ghosts = Object.values(players).filter((p) => isGhost(ghost, p)).sort((a, b) => a.id.localeCompare(b.id));
      for (const g of ghosts) {
        const gp = moverPosition(g.mover);
        for (const r of Object.values(players).sort((a, b) => a.id.localeCompare(b.id))) {
          if (r.teamId === g.teamId || r.phase !== "maze" || tick < r.protectedUntilTick) continue;
          if (r.mover.from.layer !== g.mover.from.layer) continue;
          const rp = moverPosition(r.mover);
          if (Math.hypot(rp.x - gp.x, rp.y - gp.y) > radius) continue;
          if (r.shielded) {
            // The amulet takes the catch: nothing lost, nobody scores, and the usual protection follows.
            players[r.id] = { ...r, shielded: false, protectedUntilTick: tick + Math.round(this.tuning.ghostEvent.caughtProtectionSec * this.tuning.tickRate) };
            work.events.push({ type: "shieldBlocked", tick, playerId: r.id, by: "ghost" });
            continue;
          }
          const frozenUntilTick = tick + Math.round(this.tuning.ghostEvent.caughtFreezeSec * this.tuning.tickRate);
          const protectedUntilTick = frozenUntilTick + Math.round(this.tuning.ghostEvent.caughtProtectionSec * this.tuning.tickRate);
          // A ghost without a key takes the runner's (section 13); a ghost that has one leaves it.
          const scorer = players[g.id] as PlayerState;
          const stolenKeyId = scorer.keyId === null ? r.keyId : null;
          players[r.id] = {
            ...r,
            items: [], // everything carried is lost, teleport nodes included
            keyId: stolenKeyId === null ? r.keyId : null,
            frozenUntilTick,
            frozenBy: "ghost",
            protectedUntilTick,
            mover: { ...r.mover, target: null, progress: 0 },
          };
          // Stealing pays the catch only, never the finder's score.
          players[g.id] = { ...scorer, keyId: stolenKeyId ?? scorer.keyId, score: scorer.score + this.tuning.scoring.ghostCatch };
          if (stolenKeyId !== null) {
            const key = work.keys[stolenKeyId];
            if (key) work.keys = { ...work.keys, [stolenKeyId]: { ...key, ownerId: g.id } };
          }
          work.events.push({ type: "playerCaught", tick, ghostId: g.id, runnerId: r.id, frozenUntilTick, stolenKeyId });
        }
      }
    }

    // Team completion: every member on the tower. The first complete team wins (CLAUDE.md section 3).
    // Solo rounds have no such moment; their winner is the top score at the end.
    if (this.state.status === "running" && this.teamMode === "teams") {
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
      ghost,
      towerArrivals,
      teamClimbTicks,
      winnerTeamId,
    };

    if (next.status === "running") {
      // The round stops once all but one participant (CPUs included) are on the tower:
      // the last one never gets to climb (section 3). A lone participant must climb.
      const everyone = Object.values(players);
      const climbed = everyone.filter((p) => p.phase === "tower").length;
      const enoughClimbed = everyone.length > 0 && climbed >= Math.max(1, everyone.length - 1);
      const keyClimbed = this.endWhenClimbed !== undefined && players[this.endWhenClimbed]?.phase === "tower";
      const timeUp = tick >= next.endsAtTick;
      if (enoughClimbed || keyClimbed || timeUp) {
        let reason: RoundResult["reason"];
        if (this.teamMode === "solo") {
          winnerTeamId = decideSoloWinner(players);
          reason = enoughClimbed ? "solo:score" : keyClimbed ? "solo:climbed" : "solo:timeout";
        } else if (winnerTeamId !== null) {
          reason = enoughClimbed && climbed < everyone.length ? "lastOneLeft" : "allClimbed";
        } else {
          const decided = decideTimeoutWinner(teamProgress(players, teamClimbTicks), this.tuning);
          winnerTeamId = decided.winnerTeamId;
          reason = decided.reason;
        }
        const result: RoundResult = { winnerTeamId, reason, finalScores: finalScores(players, winnerTeamId, this.tuning, this.teamMode) };
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
    if (trap?.kind === "trap" && p.shielded) {
      // The amulet takes the trap: it springs and is gone, nobody is held and nobody scores.
      delete work.placeables[trap.id];
      work.events.push({ type: "shieldBlocked", tick, playerId: p.id, by: "trap" });
      p = { ...p, shielded: false };
    } else if (trap?.kind === "trap") {
      delete work.placeables[trap.id];
      const frozenUntilTick = tick + Math.round(this.tuning.placeables.trapFreezeSec * this.tuning.tickRate);
      // The owner scores only for catching another team; trapping yourself or a teammate is worth nothing.
      // A fixture trap has no owner and scores for nobody.
      const owner = trap.ownerId === null ? undefined : this.state.players[trap.ownerId];
      const ownerScored = !!owner && owner.teamId !== p.teamId;
      if (owner && ownerScored) this.pendingScores.push({ playerId: owner.id, points: this.tuning.scoring.trapCatch });
      work.events.push({ type: "trapTriggered", tick, playerId: p.id, placeableId: trap.id, frozenUntilTick, ownerId: trap.ownerId, ownerScored });
      // Arriving cancels any queued movement; the player stands frozen on the trap tile.
      p = { ...p, frozenUntilTick, frozenBy: "trap", mover: { ...p.mover, target: null, progress: 0 } };
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
        // The finder's score is given once per round: a key found after being robbed is worth nothing more.
        p = { ...p, keyId: key.id, keyScored: true, score: p.score + (p.keyScored ? 0 : this.tuning.scoring.keyFound) };
        work.events.push({ type: "keyPickedUp", tick, playerId: id, keyId: key.id });
      }
    }
    if (p.items.length < this.tuning.inventory.capacity) {
      const box = boxAt(work.boxes, p.mover.from);
      // A team already holding its two teleport nodes cannot draw a third (section 9).
      const owned = box ? teamNodeCount({ ...work.players, [id]: p }, work.nodes, p.teamId) : 0;
      const excluded: ItemKind[] = owned >= this.tuning.teleport.maxNodesPerTeam ? ["teleportNode"] : [];
      // With nothing left to draw (every weighted kind excluded) the box stays shut.
      if (box && canDrawItem(this.tuning, excluded)) {
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
    return availableAction(this.grid, this.state, p, this.tuning.inventory.capacity);
  }

  /** Whether `p` could throw away its oldest item right now. */
  canDiscard(p: PlayerState): boolean {
    return canDiscard(this.state, p);
  }

  /** Whether `p` is currently a ghost. */
  isGhost(p: PlayerState): boolean {
    return isGhost(this.state.ghost, p);
  }

  /**
   * Developer shortcut: start the next ghost event now with a short warning.
   * Only acts while the schedule is idle so the fair rotation is untouched.
   */
  debugForceGhost(warningSec = 3): SimEvent[] {
    if (this.state.status !== "running" || this.state.ghost.phase !== "idle") return [];
    const { ghost, events } = beginWarning(this.state.ghost, this.state.players, this.state.tick, this.tuning, Math.round(warningSec * this.tuning.tickRate));
    this.state = { ...this.state, ghost };
    return events;
  }

  getState(): Readonly<SimulationState> {
    return this.state;
  }
}
