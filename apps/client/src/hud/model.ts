import type { ItemKind, MapGrid, PlayerAction, PlayerState, SimulationState } from "@supermaze/sim";
import { availableAction, canDiscard, isGhost } from "@supermaze/sim";
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
  climbed: number;
  total: number;
  lightsOn: boolean;
  myTeam: TeamRow | null;
  otherTeams: TeamRow[];
  items: ItemKind[];
  capacity: number;
  action: PlayerAction | null;
  /** Whether the discard button would throw away the oldest item. */
  canDiscard: boolean;
  onTower: boolean;
  ghost: {
    phase: "idle" | "warning" | "active";
    teamLabel: string | null;
    secondsLeft: number;
    /** The local player is one of the ghosts right now. */
    iAmGhost: boolean;
    /** The local player's team is the announced or active ghost team. */
    myTeamIsGhost: boolean;
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
    climbed: state.towerArrivals.length,
    total: Object.keys(state.players).length,
    lightsOn: state.lightsOn,
    myTeam: teams.find((t) => t.teamId === me?.teamId) ?? null,
    otherTeams: teams.filter((t) => t.teamId !== me?.teamId),
    items: me?.items ?? [],
    capacity,
    action: me ? availableAction(grid, state, me, capacity) : null,
    canDiscard: !!me && canDiscard(state, me),
    onTower: me?.phase === "tower",
    // A round that ends mid-warning or mid-chase leaves the schedule where it
    // stopped; the HUD shows no event once the round is over.
    ghost: running
      ? {
          phase: state.ghost.phase,
          teamLabel: state.ghost.teamId ? nameOfTeam(state.ghost.teamId) : null,
          secondsLeft: Math.max(0, state.ghost.phaseEndsAtTick - state.tick) / tickRate,
          iAmGhost: !!me && isGhost(state.ghost, me),
          myTeamIsGhost: !!me && state.ghost.teamId === me.teamId && state.ghost.phase !== "idle",
        }
      : { phase: "idle", teamLabel: null, secondsLeft: 0, iAmGhost: false, myTeamIsGhost: false },
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
