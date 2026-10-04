import { availableAction, canDiscard } from "./actions.js";
import { boxAt, drawBoxTiles, drawItem, tileId, type BoxState, canDrawItem } from "./boxes.js";
import { resolveCatches, type CatchRules } from "./catches.js";
import type { SimEvent } from "./events.js";
import { applyTimeStop, canUseSkill, castSkill, piercing, type SkillSlot } from "./skills.js";
import { beginWarning, initialGhostState, isGhost, stepGhost, type GhostState } from "./ghost.js";
import { movePlayer } from "./playerMove.js";
import { pickUpNode, teamNodeCount, useOldestItem, type ItemWork } from "./items.js";
import { createKeys, selectKeySpawns, unownedKeyAt, type KeyState } from "./keys.js";
import { createLightSwitches, usableSwitchAt, type LightSwitchState } from "./lighting.js";
import { MapGrid } from "./map/grid.js";
import { normalizeMap } from "./map/normalize.js";
import type { NormalizedMapData, TilePos } from "./map/types.js";
import { createMover, sameTile } from "./movement.js";
import { nodeAt, placeableAt, type PlaceableState } from "./placeables.js";
import { SeededRandom } from "./random/seeded.js";
import type { RoundEndReason } from "./events.js";
import { decideSoloWinner, decideTimeoutWinner, finalScores, teamProgress, type RoundResult } from "./round.js";
import { DEFAULT_TUNING, type ItemKind, type Tuning } from "./tuning/index.js";
import type { Controller, Participant, PlayerId, TeamId, TeamMode, Tick } from "./types.js";

export * from "./state.js";
import { NO_INPUT, type PlayerInput, type PlayerState, type SimulationOptions, type SimulationState } from "./state.js";

/** One tick's working copies while the step is being computed. */
export type StepWork = ItemWork & {
  keys: Record<string, KeyState>;
  boxes: Record<string, BoxState>;
  switches: Record<string, LightSwitchState>;
  lightsOn: boolean;
  openedBoxes: string[];
};

/**
 * Authoritative game simulation: seeded RNG, fixed tick, inputs in, state and
 * events out. Every rule lives here or in the modules it calls; clients only
 * render this state.
 *
 * This class runs the race to the tower (sections 3-13). Other kinds of round
 * extend it and override the protected hooks below (keyCount, chooseSwitches,
 * scheduleGhost, springTrap, lightsToggled, afterMoves, catchRules, afterCatches,
 * decideEnd); everything else, from movement to items, is shared.
 */
export class Simulation {
  readonly tuning: Tuning;
  readonly rng: SeededRandom;
  readonly grid: MapGrid;
  protected readonly map: NormalizedMapData;
  protected state: SimulationState;
  private readonly spawns: TilePos[];
  private spawnCursor = 0;
  private readonly timeLimitOverrideSec: number | undefined;
  protected readonly teamMode: TeamMode;
  protected readonly endWhenClimbed: PlayerId | undefined;
  protected readonly startDark: boolean;
  private readonly ghostPack: PlayerId | undefined;
  private nextBoxIndex = 0;
  private nextPlaceableIndex = 0;
  private nextNodeIndex = 0;
  /** Points earned this tick by players other than the one being stepped (trap owners); applied after the player loop. */
  protected pendingScores: { playerId: PlayerId; points: number }[] = [];

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
    this.startDark = options.startDark ?? false;
    this.ghostPack = this.teamMode === "solo" ? options.ghostPack : undefined;
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
      ghost: { phase: "idle", teamId: null, huntedTeamId: null, phaseEndsAtTick: 0, counts: {}, lastTeamId: null, intervalTicks: 0 },
      teamClimbTicks: {},
      winnerTeamId: null,
      result: null,
    };
    for (const p of options.participants) this.addPlayer(p);
  }

  /** Round length for the current number of participants, in ticks. Fixed once the round starts. */
  protected timeLimitTicks(): number {
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
      skill2: p.skill2 ?? null,
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
    const count = this.keyCount();
    const switches = this.chooseSwitches();
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
      lightsOn: !this.startDark,
      // Solo: the hunted player's team is their own id.
      ghost: this.initialGhost(clockStart),
    };
    this.spawnKeys(count);
    // The map's own box count when it has one, otherwise so many per participant (section 9).
    this.spawnBoxes(this.map.itemBoxCount ?? this.keyCount() * this.tuning.itemBoxes.perParticipant);
    this.placeFixtures();
    this.reserveTiles();
    return [{ type: "roundStarted", tick: this.state.tick, keyCount: count }];
  }

  /** Keys for the round: one per participant (section 5). Boxes default to so many per key holder too. */
  protected keyCount(): number {
    return Object.keys(this.state.players).length * this.tuning.keys.perParticipant;
  }

  /** The round's light switches: the map's even number of them, drawn from its candidates (section 8). */
  protected chooseSwitches(): Record<string, LightSwitchState> {
    return createLightSwitches(this.rng, this.grid, this.map.spawns.lightSwitches, this.map.lightSwitchCount);
  }

  /** Ghost-tag state at the start: the schedule's first warning, after the opening fly-in (section 13). */
  protected initialGhost(clockStart: Tick): GhostState {
    // Solo: the hunted player's team is their own id.
    return initialGhostState(clockStart, this.tuning, this.timeLimitTicks(), this.ghostPack ?? null);
  }

  /** Advance the ghost-tag schedule by a tick (section 13). */
  protected scheduleGhost(ghost: GhostState, tick: Tick): { ghost: GhostState; events: SimEvent[] } {
    return stepGhost(ghost, this.state.players, tick, this.tuning, this.state.endsAtTick);
  }

  /** How catches are treated (section 13). */
  protected catchRules(): CatchRules {
    return { stealKeys: true, heldGhostsCatch: true };
  }

  /** Called once every player has moved and acted this tick, before the catches; `players` is the working copy. */
  protected afterMoves(_players: Record<PlayerId, PlayerState>, _tick: Tick, _events: SimEvent[]): void {}

  /** Called with the runners caught this tick, after the catches; `players` is the working copy. */
  protected afterCatches(_players: Record<PlayerId, PlayerState>, _caught: PlayerId[], _tick: Tick, _events: SimEvent[]): void {}

  /** Called after a light switch flipped the lights this tick; `work.lightsOn` is the new state. */
  protected lightsToggled(_work: StepWork, _playerId: PlayerId, _tick: Tick): void {}

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
  protected spawnBoxes(count: number, players: Record<PlayerId, PlayerState> = this.state.players, strict = true): string[] {
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
    const work: StepWork = {
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
      const g = this.scheduleGhost(ghost, tick);
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
            this.lightsToggled(work, id, tick);
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
        const skillCtx = {
          tick,
          freezeUntilTick: this.state.freezeUntilTick,
          lightsOn: work.lightsOn,
          running: true,
          placeables: work.placeables,
          ghost,
          capacity: this.tuning.inventory.capacity,
        };
        // One cast a tick: the first slot when both are pressed together.
        const slot: SkillSlot | null = input.skill ? 1 : input.skill2 ? 2 : null;
        if (slot !== null && canUseSkill(skillCtx, p, this.grid, slot)) {
          const world = { grid: this.grid, placeables: work.placeables, nodes: work.nodes, players: work.players, rng: this.rng };
          const cast = castSkill(p, tick, this.tuning, world, slot);
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
    this.afterMoves(players, tick, work.events);

    // Catches: a ghost overlapping an unprotected runner freezes them and empties their bag.
    if (this.state.status === "running") {
      const c = resolveCatches(players, work.keys, ghost, tick, this.tuning, work.events, this.catchRules());
      work.keys = c.keys;
      this.afterCatches(players, c.caught, tick, work.events);
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
      const end = this.decideEnd(players, tick, next.endsAtTick, winnerTeamId, teamClimbTicks);
      if (end) {
        winnerTeamId = end.winnerTeamId;
        const result: RoundResult = { winnerTeamId, reason: end.reason, finalScores: finalScores(players, winnerTeamId, this.tuning, this.teamMode) };
        next = { ...next, status: "finished", winnerTeamId, result };
        work.events.push({ type: "roundEnded", tick, winnerTeamId, reason: end.reason });
      }
    }

    this.state = next;
    return work.events;
  }

  /**
   * Whether the round ends this tick, and how (section 3): all but one on the
   * tower, the waited-on player climbed (tower run), or the time ran out.
   */
  protected decideEnd(
    players: Record<PlayerId, PlayerState>,
    tick: Tick,
    endsAtTick: Tick,
    winnerTeamId: TeamId | null,
    teamClimbTicks: Record<TeamId, Tick[]>,
  ): { winnerTeamId: TeamId | null; reason: RoundEndReason } | null {
    // The round stops once all but one participant (CPUs included) are on the tower:
    // the last one never gets to climb (section 3). A lone participant must climb.
    // Not when the round waits on one player (the tower run): that player may still
    // climb and outscore the others, so it ends when they climb or time runs out.
    const everyone = Object.values(players);
    const climbed = everyone.filter((p) => p.phase === "tower").length;
    const enoughClimbed = this.endWhenClimbed === undefined && everyone.length > 0 && climbed >= Math.max(1, everyone.length - 1);
    const keyClimbed = this.endWhenClimbed !== undefined && players[this.endWhenClimbed]?.phase === "tower";
    const timeUp = tick >= endsAtTick;
    if (!enoughClimbed && !keyClimbed && !timeUp) return null;
    if (this.teamMode === "solo") {
      return { winnerTeamId: decideSoloWinner(players), reason: enoughClimbed ? "solo:score" : keyClimbed ? "solo:climbed" : "solo:timeout" };
    }
    if (winnerTeamId !== null) return { winnerTeamId, reason: enoughClimbed && climbed < everyone.length ? "lastOneLeft" : "allClimbed" };
    return decideTimeoutWinner(teamProgress(players, teamClimbTicks), this.tuning);
  }

  /** Effects of stepping onto a new tile: traps fire, own paired nodes teleport. */
  private onArrive(work: ItemWork, p: PlayerState, tick: Tick): PlayerState {
    // A piercing player walks over a trap and leaves it where it is.
    const trap = piercing(p, tick) ? undefined : placeableAt(work.placeables, p.mover.from);
    if (trap?.kind === "trap" && p.shielded) {
      // The amulet takes the trap: it springs and is gone, nobody is held and nobody scores.
      delete work.placeables[trap.id];
      work.events.push({ type: "shieldBlocked", tick, playerId: p.id, by: "trap" });
      p = { ...p, shielded: false };
    } else if (trap?.kind === "trap") {
      p = this.springTrap(work, p, trap, tick);
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

  /** `p` walked onto `trap` without an amulet: it springs and is gone, and holds them (section 10.4). */
  protected springTrap(work: ItemWork, p: PlayerState, trap: PlaceableState, tick: Tick): PlayerState {
    delete work.placeables[trap.id];
    const frozenUntilTick = tick + Math.round(this.tuning.placeables.trapFreezeSec * this.tuning.tickRate);
    // The owner scores only for catching another team; trapping yourself or a teammate is worth nothing.
    // A fixture trap has no owner and scores for nobody.
    const owner = trap.ownerId === null ? undefined : this.state.players[trap.ownerId];
    const ownerScored = !!owner && owner.teamId !== p.teamId;
    if (owner && ownerScored) this.pendingScores.push({ playerId: owner.id, points: this.tuning.scoring.trapCatch });
    work.events.push({ type: "trapTriggered", tick, playerId: p.id, placeableId: trap.id, frozenUntilTick, ownerId: trap.ownerId, ownerScored });
    // Arriving cancels any queued movement; the player stands frozen on the trap tile.
    return { ...p, frozenUntilTick, frozenBy: "trap", mover: { ...p.mover, target: null, progress: 0 } };
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
