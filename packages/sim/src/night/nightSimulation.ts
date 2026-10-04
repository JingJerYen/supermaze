import type { CatchRules } from "../catches.js";
import type { SimEvent, RoundEndReason } from "../events.js";
import type { GhostState } from "../ghost.js";
import type { ItemWork } from "../items.js";
import type { MapData } from "../map/types.js";
import { createMover, frontTile, sameTile } from "../movement.js";
import type { PlaceableState } from "../placeables.js";
import { Simulation, type PlayerInput, type StepWork } from "../simulation.js";
import type { PlayerState } from "../state.js";
import { DEFAULT_TUNING, type Tuning } from "../tuning/index.js";
import type { Participant, PlayerId, TeamId, Tick } from "../types.js";
import { ghostStartTiles } from "./spread.js";

export interface NightOptions {
  seed: number;
  map: MapData;
  /** The one player; every other participant is a ghost. */
  player: Participant;
  tuning?: Tuning;
  /** What the ghosts are called on screen (the client's language). */
  ghostName?: string;
}

/** The race's tuning with the night parade's own ghosts and boxes (section 4.4). */
export function nightTuning(base: Tuning = DEFAULT_TUNING): Tuning {
  const n = base.night;
  return {
    ...base,
    itemBoxes: { ...base.itemBoxes, weights: n.boxWeights },
    // Ghosts are CPU-driven and always ghosts: their speed is the CPU factor alone.
    cpu: { ...base.cpu, speedMultiplier: n.ghostSpeed, visionTiles: n.ghostVisionTiles },
    ghostEvent: { ...base.ghostEvent, speedMultiplier: 1 },
  };
}

/**
 * Night parade (CLAUDE.md section 4.4): one player in the dark with eight
 * ghosts hunting from the start. A trap, or a hammer on a ghost lying down, banishes it for good; each of
 * the map's light switches lights the maze for a while and knocks every ghost
 * down meanwhile, time to lay traps in their way or hammer the fallen, then it is dark again. The key opens the door only when no ghost is left; three catches end
 * the round. The race's rules carry everything else.
 */
export class NightSimulation extends Simulation {
  readonly playerId: PlayerId;
  /** Set by a switch this tick: when the lights go out again. */
  private lightsOffAtTick: Tick | null = null;
  /** Ghosts banished during this tick's moves, removed before the catches. */
  private banished = new Set<PlayerId>();

  constructor(options: NightOptions) {
    const tuning = nightTuning(options.tuning ?? DEFAULT_TUNING);
    const ghosts: Participant[] = Array.from({ length: tuning.night.ghostCount }, (_, i) => ({
      id: `ghost${i + 1}`,
      teamId: `ghost${i + 1}`,
      controller: "cpu",
      monster: true,
      ...(options.ghostName ? { name: options.ghostName } : {}),
    }));
    super({
      seed: options.seed,
      map: options.map,
      tuning,
      teamMode: "solo",
      startDark: true,
      timeLimitSec: tuning.night.timeLimitSec,
      participants: [options.player, ...ghosts],
    });
    this.playerId = options.player.id;
  }

  /** Begin: the race's start, then the ghosts move out into the maze and the player gets their lives. */
  override start(): SimEvent[] {
    const events = super.start();
    if (events.length === 0) return events;
    const players = { ...this.state.players };
    const me = players[this.playerId] as PlayerState;
    players[this.playerId] = { ...me, lives: this.tuning.night.lives };
    const ghostIds = Object.keys(players).filter((id) => players[id]?.monster).sort();
    const tiles = ghostStartTiles(this.grid, me.mover.from, ghostIds.length, this.tuning.night.ghostMinStartSteps, this.rng);
    ghostIds.forEach((id, i) => {
      const g = players[id] as PlayerState;
      players[id] = { ...g, mover: createMover(tiles[i] ?? g.mover.from, g.mover.facing) };
    });
    this.state = { ...this.state, players };
    return events;
  }

  /** Ghosts hold no key: one key for the player. */
  protected override keyCount(): number {
    return Object.values(this.state.players).filter((p) => !p.monster).length * this.tuning.keys.perParticipant;
  }

  /** The hunt is on all round: every ghost hunts the player from the first tick. */
  protected override initialGhost(_clockStart: Tick): GhostState {
    return { phase: "active", teamId: null, huntedTeamId: this.playerId, phaseEndsAtTick: Number.MAX_SAFE_INTEGER, counts: {}, lastTeamId: null, intervalTicks: 0 };
  }

  protected override scheduleGhost(ghost: GhostState): { ghost: GhostState; events: SimEvent[] } {
    return { ghost, events: [] };
  }

  /** A ghost on a trap is gone for good, and whoever set it scores; anyone else is held as usual. */
  protected override springTrap(work: ItemWork, p: PlayerState, trap: PlaceableState, tick: Tick): PlayerState {
    if (!p.monster) return super.springTrap(work, p, trap, tick);
    delete work.placeables[trap.id];
    if (trap.ownerId !== null) this.pendingScores.push({ playerId: trap.ownerId, points: this.tuning.scoring.trapCatch });
    this.banished.add(p.id);
    work.events.push({ type: "ghostBanished", tick, ghostId: p.id, by: "trap", playerId: trap.ownerId });
    return { ...p, mover: { ...p.mover, target: null, progress: 0 } };
  }

  /**
   * A hammer finishes off every ghost the lights knocked down on the tile ahead
   * or underfoot, for good, and scores like a trap (section 4.4). A ghost on its feet shrugs it off.
   */
  protected override hammerSwung(work: StepWork, p: PlayerState, tick: Tick): void {
    const ahead = frontTile(p.mover);
    const down = Object.values(work.players).filter(
      (g) =>
        g.monster &&
        !this.banished.has(g.id) &&
        g.frozenBy === "light" &&
        tick < g.frozenUntilTick &&
        (sameTile(g.mover.from, ahead) || sameTile(g.mover.from, p.mover.from)),
    );
    for (const g of down.sort((a, b) => a.id.localeCompare(b.id))) {
      this.banished.add(g.id);
      this.pendingScores.push({ playerId: p.id, points: this.tuning.scoring.trapCatch });
      work.events.push({ type: "ghostBanished", tick, ghostId: g.id, by: "hammer", playerId: p.id });
    }
  }

  /**
   * A switch always lights the maze (one pressed while it is lit starts the
   * time again): every ghost drops where it is for `night.lightStunSec`, time
   * to lay traps, and then the lights go out again by themselves (`step`).
   */
  protected override lightsToggled(work: StepWork, playerId: PlayerId, tick: Tick): void {
    if (!work.lightsOn) {
      work.lightsOn = true;
      const last = work.events[work.events.length - 1];
      if (last?.type === "lightsToggled") work.events[work.events.length - 1] = { ...last, lightsOn: true };
    }
    const untilTick = tick + Math.round(this.tuning.night.lightStunSec * this.tuning.tickRate);
    this.lightsOffAtTick = untilTick;
    for (const g of Object.values(work.players).filter((p) => p.monster)) {
      work.players[g.id] = { ...g, frozenUntilTick: Math.max(g.frozenUntilTick, untilTick), frozenBy: "light", mover: { ...g.mover, target: null, progress: 0 } };
    }
    work.events.push({ type: "ghostsStunned", tick, untilTick, playerId });
  }

  /** One tick; the lights go out again when their time is up, as the ghosts get back up. */
  override step(inputs: ReadonlyMap<PlayerId, PlayerInput>): SimEvent[] {
    const events = super.step(inputs);
    let s = this.state;
    if (this.lightsOffAtTick !== null) s = { ...s, lightsOffAtTick: this.lightsOffAtTick };
    if (s.status === "running" && s.lightsOn && s.lightsOffAtTick !== undefined && s.tick >= s.lightsOffAtTick) {
      const { lightsOffAtTick: _, ...rest } = s;
      s = { ...rest, lightsOn: false };
      events.push({ type: "lightsOut", tick: s.tick });
    }
    this.lightsOffAtTick = null;
    this.state = s;
    return events;
  }

  protected override afterMoves(players: Record<PlayerId, PlayerState>): void {
    for (const id of this.banished) delete players[id];
    this.banished = new Set();
  }

  /** Ghosts here never climb, so there is no key to steal. */
  protected override catchRules(): CatchRules {
    // A ghost the lights knocked down cannot catch anyone until it is back up.
    return { stealKeys: false, heldGhostsCatch: false };
  }

  /** Each catch costs a life. */
  protected override afterCatches(players: Record<PlayerId, PlayerState>, caught: PlayerId[]): void {
    for (const id of caught) {
      const p = players[id];
      if (p?.lives !== undefined) players[id] = { ...p, lives: Math.max(0, p.lives - 1) };
    }
  }

  /** Cleared when the player climbs; lost on the last life or when time runs out. */
  protected override decideEnd(
    players: Record<PlayerId, PlayerState>,
    tick: Tick,
    endsAtTick: Tick,
  ): { winnerTeamId: TeamId | null; reason: RoundEndReason } | null {
    const me = players[this.playerId];
    if (me?.phase === "tower") return { winnerTeamId: me.teamId, reason: "night:cleared" };
    if (me?.lives !== undefined && me.lives <= 0) return { winnerTeamId: null, reason: "night:caught" };
    if (tick >= endsAtTick) return { winnerTeamId: null, reason: "night:timeout" };
    return null;
  }

  /** Ghosts still in the maze. */
  ghostsLeft(): number {
    return Object.values(this.getState().players).filter((p) => p.monster).length;
  }
}
