import type { SkillEffect, SkillKind } from "./skills.js";
import type { GhostState } from "./ghost.js";
import type { KeyState } from "./keys.js";
import type { LightSwitchState } from "./lighting.js";
import type { MapData } from "./map/types.js";
import type { MoveIntent, MoverState } from "./movement.js";
import type { PlaceableState, TeleportNodeState } from "./placeables.js";
import type { BoxState } from "./boxes.js";
import type { RoundResult } from "./round.js";
import type { ItemKind, Tuning } from "./tuning/index.js";
import type { Participant, PlayerId, PlayerPhase, TeamId, TeamMode, Tick } from "./types.js";

/*
 * The shapes of a round: what goes in each tick, how a simulation is set up,
 * and the state it publishes. Shared by every kind of round (section 17.2).
 */

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
  /** Cast the second skill this tick (tower run, full version). */
  skill2?: boolean;
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
   * It also waits for them: the others all climbing does not end it, only this
   * player climbing or the time running out.
   */
  endWhenClimbed?: PlayerId;
  /**
   * Start the round with the lights off (tower run special floor; section 4.1).
   * The switches are the map's usual ones, so with an even count the last one
   * puts the lights out for good: such a floor may end dark.
   */
  startDark?: boolean;
  /**
   * Solo only: every ghost event turns everyone else in the maze into ghosts
   * at once, all hunting this player (tower run special floor; section 4.1).
   */
  ghostPack?: PlayerId;
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
  frozenBy: "trap" | "ghost" | "skill" | "light" | null;
  /** Node the player just arrived on by teleport; no bounce-back until they step off it. */
  teleportImmunity: string | null;
  /** Cannot be caught by a ghost until this tick (covers the post-catch freeze and protection). */
  protectedUntilTick: Tick;
  /** Skill still to cast this round; null once cast or when none was given. */
  skill: SkillKind | null;
  /** Second skill still to cast (tower run, full version); null once cast or when none was given. */
  skill2: SkillKind | null;
  /** The timed skill cast this round (sprint, eagle eye, lantern), kept after it runs out. */
  skillEffect: SkillEffect | null;
  /** The amulet is up: the next trap or ghost catch is shrugged off. */
  shielded: boolean;
  /** Catches the player can still take (night parade, section 4.4); absent where catches cost no life. */
  lives?: number;
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
  /** Map-wide lighting (CLAUDE.md section 8). Starts lit, or dark on a tower run special floor. */
  lightsOn: boolean;
  /** Night parade: the lights go out again at this tick (section 4.4). Absent when they stay as they are. */
  lightsOffAtTick?: Tick;
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
