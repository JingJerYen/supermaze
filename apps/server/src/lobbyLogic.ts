import type { LobbyPlayer } from "@supermaze/protocol";

/**
 * Pure lobby rules (CLAUDE.md 2.1). No Colyseus here so they can be unit-tested.
 * Two fixed teams, "A" and "B".
 */
export const TEAMS = ["A", "B"] as const;
export type TeamId = (typeof TEAMS)[number];

export interface LobbyRules {
  minPlayers: number;
  maxPlayers: number;
  maxTeamSizeDifference: number;
}

export function teamSizes(players: readonly LobbyPlayer[]): Record<TeamId, number> {
  const sizes: Record<TeamId, number> = { A: 0, B: 0 };
  for (const p of players) if (p.teamId === "A" || p.teamId === "B") sizes[p.teamId]++;
  return sizes;
}

/** Newcomers join the smaller team; ties go to A. */
export function teamForNewPlayer(players: readonly LobbyPlayer[]): TeamId {
  const s = teamSizes(players);
  return s.B < s.A ? "B" : "A";
}

/** Whether `playerId` may move to the other team without breaking the size rule. */
export function canSwitchTeam(players: readonly LobbyPlayer[], playerId: string, rules: LobbyRules): boolean {
  const me = players.find((p) => p.id === playerId);
  if (!me) return false;
  const s = teamSizes(players);
  const from = me.teamId as TeamId;
  const to: TeamId = from === "A" ? "B" : "A";
  s[from]--;
  s[to]++;
  return Math.abs(s.A - s.B) <= rules.maxTeamSizeDifference;
}

export function teamsBalanced(players: readonly LobbyPlayer[], rules: LobbyRules): boolean {
  const s = teamSizes(players);
  return Math.abs(s.A - s.B) <= rules.maxTeamSizeDifference;
}

/**
 * Why the match cannot start right now, or null if it can. Used both for the
 * automatic countdown and for a private host's manual start.
 */
export function startBlocker(players: readonly LobbyPlayer[], rules: LobbyRules, requireReady: boolean): string | null {
  const connected = players.filter((p) => p.connected);
  if (connected.length < rules.minPlayers) return `至少需要 ${rules.minPlayers} 人`;
  if (connected.length > rules.maxPlayers) return `最多 ${rules.maxPlayers} 人`;
  if (!teamsBalanced(connected, rules)) return `兩隊人數差不能超過 ${rules.maxTeamSizeDifference}`;
  if (requireReady && !connected.every((p) => p.ready)) return "還有人沒準備好";
  return null;
}

/**
 * Should the automatic countdown be running? Quick rooms count down as soon as
 * they are full regardless of readiness; otherwise everyone must be ready.
 */
export function shouldCountDown(players: readonly LobbyPlayer[], rules: LobbyRules, mode: "quick" | "private"): boolean {
  const connected = players.filter((p) => p.connected);
  if (mode === "quick" && connected.length >= rules.maxPlayers && teamsBalanced(connected, rules)) return true;
  return startBlocker(players, rules, true) === null;
}

/** Four characters, no ambiguous glyphs (0/O, 1/I). */
export function makeRoomCode(random: () => number = Math.random): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += alphabet[Math.floor(random() * alphabet.length)];
  return code;
}
