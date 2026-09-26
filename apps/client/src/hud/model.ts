import type { ItemKind, MapGrid, PlayerAction, PlayerState, SimulationState } from "@supermaze/sim";
import { availableAction, tileLabel } from "@supermaze/sim";
import { teamColorIndex } from "../render/teamColors.js";

/** Everything the HUD draws, derived from authoritative state; no rules live here. */
export interface HudModel {
  remainingSec: number;
  status: SimulationState["status"];
  climbed: number;
  total: number;
  lightsOn: boolean;
  myTeam: TeamRow | null;
  otherTeams: TeamRow[];
  items: ItemKind[];
  capacity: number;
  action: PlayerAction | null;
  onTower: boolean;
  /** Board coordinate of the local player's tile, e.g. "C7"; null on the tower. */
  myCoord: string | null;
  /** Whether rosters may show everyone's coordinates (only the tower top sees the whole map). */
  showCoords: boolean;
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
  /** Board coordinate while in the maze; null once on the tower. */
  coord: string | null;
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
  const byTeam = new Map<string, PlayerRow[]>();
  for (const p of Object.values(state.players)) {
    const rows = byTeam.get(p.teamId) ?? [];
    rows.push(toRow(p, p.id === meId));
    byTeam.set(p.teamId, rows);
  }
  const teams: TeamRow[] = [...byTeam.entries()]
    .map(([teamId, players]) => ({
      teamId,
      label: `${LETTERS[teamIndex(teamId) % LETTERS.length]} 隊`,
      colorIndex: teamIndex(teamId),
      players: players.sort((a, b) => (a.isMe ? -1 : b.isMe ? 1 : b.score - a.score)),
    }))
    .sort((a, b) => a.colorIndex - b.colorIndex);

  const remainingTicks = state.status === "running" ? Math.max(0, state.endsAtTick - state.tick) : 0;
  return {
    remainingSec: state.status === "lobby" ? 0 : remainingTicks / tickRate,
    status: state.status,
    climbed: state.towerArrivals.length,
    total: Object.keys(state.players).length,
    lightsOn: state.lightsOn,
    myTeam: teams.find((t) => t.teamId === me?.teamId) ?? null,
    otherTeams: teams.filter((t) => t.teamId !== me?.teamId),
    items: me?.items ?? [],
    capacity,
    action: me ? availableAction(grid, state, me, capacity) : null,
    onTower: me?.phase === "tower",
    myCoord: me && me.phase === "maze" ? tileLabel(me.mover.from.x, me.mover.from.y) : null,
    showCoords: me?.phase === "tower",
  };
}

function toRow(p: PlayerState, isMe: boolean): PlayerRow {
  return {
    id: p.id,
    name: p.name ?? p.id.slice(0, 6),
    isMe,
    hasKey: p.keyId !== null && p.phase === "maze",
    onTower: p.phase === "tower",
    arrival: p.towerArrival,
    cpu: p.controller === "cpu",
    score: p.score,
    coord: p.phase === "maze" ? tileLabel(p.mover.from.x, p.mover.from.y) : null,
  };
}
