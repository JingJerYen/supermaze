import type { ItemKind, MapGrid, PlayerAction, PlayerState, SimulationState } from "@supermaze/sim";
import { availableAction, canDiscard, canUseSkill, isGhost, skillIn, type SkillKind, type SkillSlot } from "@supermaze/sim";
import { openingOf } from "../opening.js";
import { teamColorIndex } from "../render/teamColors.js";

/** Everything the HUD draws, derived from authoritative state; no rules live here. */
export interface HudModel {
  remainingSec: number;
  /** Seconds of the 3-2-1 countdown left; 0 during the opening fly-in and once play has begun. */
  freezeSec: number;
  /** Seconds of the opening fly-in left; the HUD stays out of the shot meanwhile. */
  introSec: number;
  status: SimulationState["status"];
  /** Everyone for themselves: rosters carry no team headers and labels are player names. */
  solo: boolean;
  lightsOn: boolean;
  myTeam: TeamRow | null;
  otherTeams: TeamRow[];
  items: ItemKind[];
  capacity: number;
  action: PlayerAction | null;
  /** Whether the discard button would throw away the oldest item. */
  canDiscard: boolean;
  onTower: boolean;
  /** Skill the local player can still cast this floor; `ready` false while it cannot be cast yet. */
  mySkill: { kind: SkillKind; ready: boolean } | null;
  /** The second skill (tower run, full version). */
  mySkill2: { kind: SkillKind; ready: boolean } | null;
  /** A skill of the local player's at work: seconds left, or null for the amulet (up until it blocks). */
  skillStatus: { kind: SkillKind; sec: number | null } | null;
  /** The local player is frozen: seconds left and why; null otherwise. */
  myFreeze: { sec: number; by: PlayerState["frozenBy"] } | null;
  ghost: {
    phase: "idle" | "warning" | "active";
    teamLabel: string | null;
    secondsLeft: number;
    /** The local player is one of the ghosts right now. */
    iAmGhost: boolean;
    /** The local player's team is the announced or active ghost team. */
    myTeamIsGhost: boolean;
    /** Who the warning names: "你" in solo, "A 隊（我方）" for your own team, else the team label. */
    warningSubject: string | null;
  };
}

export interface TeamRow {
  teamId: string;
  label: string;
  colorIndex: number;
  players: PlayerRow[];
}

export interface PlayerRow {
  id: string;
  name: string;
  isMe: boolean;
  hasKey: boolean;
  onTower: boolean;
  arrival: number | null;
  cpu: boolean;
  score: number;
  ghost: boolean;
  frozen: boolean;
}

/** "A", "B", ... follow the same first-seen order as the 3D team colours. */
const teamIndex = teamColorIndex;
const LETTERS = "ABCDEFGH";

export function buildHudModel(
  state: SimulationState,
  meId: string | null,
  grid: MapGrid,
  tickRate: number,
  capacity: number,
): HudModel {
  const me = meId ? state.players[meId] : undefined;
  const solo = state.teamMode === "solo";
  const nameOfTeam = (teamId: string): string => {
    if (!solo) return `${LETTERS[teamIndex(teamId) % LETTERS.length]} 隊`;
    const owner = Object.values(state.players).find((p) => p.teamId === teamId);
    return owner?.name ?? teamId.slice(0, 6);
  };
  const byTeam = new Map<string, PlayerRow[]>();
  for (const p of Object.values(state.players)) {
    const rows = byTeam.get(p.teamId) ?? [];
    rows.push(toRow(state, p, p.id === meId));
    byTeam.set(p.teamId, rows);
  }
  const teams: TeamRow[] = [...byTeam.entries()]
    .map(([teamId, players]) => ({
      teamId,
      label: solo ? "" : nameOfTeam(teamId),
      colorIndex: teamIndex(teamId),
      players: players.sort((a, b) => (a.isMe ? -1 : b.isMe ? 1 : b.score - a.score)),
    }))
    .sort((a, b) => a.colorIndex - b.colorIndex);

  const opening = openingOf(state, tickRate);
  const running = state.status === "running";
  const remainingTicks = running ? Math.max(0, state.endsAtTick - state.tick) : 0;
  return {
    remainingSec: state.status === "lobby" ? 0 : remainingTicks / tickRate,
    freezeSec: opening.countdownSec,
    introSec: opening.introLeftSec,
    status: state.status,
    solo,
    lightsOn: state.lightsOn,
    myTeam: teams.find((t) => t.teamId === me?.teamId) ?? null,
    otherTeams: teams.filter((t) => t.teamId !== me?.teamId),
    items: me?.items ?? [],
    capacity,
    action: me ? availableAction(grid, state, me, capacity) : null,
    canDiscard: !!me && canDiscard(state, me),
    onTower: me?.phase === "tower",
    mySkill: skillSlot(state, me, grid, running, capacity, 1),
    mySkill2: skillSlot(state, me, grid, running, capacity, 2),
    skillStatus: running && me ? skillStatusOf(state, me, tickRate) : null,
    myFreeze: running && me && me.phase === "maze" && me.frozenUntilTick > state.tick ? { sec: (me.frozenUntilTick - state.tick) / tickRate, by: me.frozenBy } : null,
    // A round that ends mid-warning or mid-chase leaves the schedule where it
    // stopped; the HUD shows no event once the round is over.
    ghost: running
      ? {
          phase: state.ghost.phase,
          teamLabel: state.ghost.teamId ? nameOfTeam(state.ghost.teamId) : null,
          secondsLeft: Math.max(0, state.ghost.phaseEndsAtTick - state.tick) / tickRate,
          iAmGhost: !!me && isGhost(state.ghost, me),
          myTeamIsGhost: !!me && state.ghost.teamId === me.teamId && state.ghost.phase !== "idle",
          warningSubject: warningSubject(state, me, nameOfTeam),
        }
      : { phase: "idle", teamLabel: null, secondsLeft: 0, iAmGhost: false, myTeamIsGhost: false, warningSubject: null },
  };
}

function toRow(state: SimulationState, p: PlayerState, isMe: boolean): PlayerRow {
  return {
    id: p.id,
    name: p.name ?? p.id.slice(0, 6),
    isMe,
    hasKey: p.keyId !== null && p.phase === "maze",
    onTower: p.phase === "tower",
    arrival: p.towerArrival,
    cpu: p.controller === "cpu",
    score: p.score,
    ghost: isGhost(state.ghost, p),
    frozen: p.frozenUntilTick > state.tick,
  };
}

function warningSubject(state: SimulationState, me: PlayerState | undefined, nameOfTeam: (teamId: string) => string): string | null {
  const teamId = state.ghost.teamId;
  if (!teamId) return null;
  if (!me || me.teamId !== teamId) return nameOfTeam(teamId);
  return state.teamMode === "solo" ? "你" : `${nameOfTeam(teamId)}（我方）`;
}

/** The skill `me` holds in `slot` and whether it can be cast now. */
function skillSlot(state: SimulationState, me: PlayerState | undefined, grid: MapGrid, running: boolean, capacity: number, slot: SkillSlot): { kind: SkillKind; ready: boolean } | null {
  const kind = me ? skillIn(me, slot) : null;
  if (!me || !kind) return null;
  const ctx = { tick: state.tick, freezeUntilTick: state.freezeUntilTick, lightsOn: state.lightsOn, running, placeables: state.placeables, ghost: state.ghost, capacity };
  return { kind, ready: canUseSkill(ctx, me, grid, slot) };
}

function skillStatusOf(state: SimulationState, me: PlayerState, tickRate: number): { kind: SkillKind; sec: number | null } | null {
  if (me.shielded) return { kind: "amulet", sec: null };
  const e = me.skillEffect;
  if (e && state.tick < e.untilTick) return { kind: e.kind, sec: (e.untilTick - state.tick) / tickRate };
  // A time stop shows as everyone else frozen by a skill (only the player casts skills).
  const stopped = Object.values(state.players).filter((p) => p.id !== me.id && p.frozenBy === "skill" && p.frozenUntilTick > state.tick);
  if (stopped.length) return { kind: "timeStop", sec: Math.max(...stopped.map((p) => p.frozenUntilTick - state.tick)) / tickRate };
  return null;
}
