import type { LobbyPlayer, RoomMode, TeamMode } from "@supermaze/protocol";

/**
 * Pure lobby rules (CLAUDE.md 2.1). No Colyseus here so they can be unit-tested.
 * Lobby players always carry team "A" or "B"; in solo mode the simulation
 * ignores it and puts everyone in a team of their own.
 */
export const TEAMS = ["A", "B"] as const;
export type TeamId = (typeof TEAMS)[number];

export interface LobbyRules {
  minPlayers: number;
  maxPlayers: number;
  teamMode: TeamMode;
}

/**
 * Quick match is always two players, one against one, played as a solo round
 * (ranked by score, no winner multiplier). A private room holds up to
 * `maxParticipants` and plays whichever mode its host picked.
 */
export function rulesFor(mode: RoomMode, teamMode: TeamMode, maxParticipants: number): LobbyRules {
  if (mode === "quick") return { minPlayers: 2, maxPlayers: 2, teamMode: "solo" };
  return { minPlayers: 2, maxPlayers: maxParticipants, teamMode };
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

/** Whether `playerId` may move to the other team: teams mode only, and the other team must have a free seat. */
export function canSwitchTeam(players: readonly LobbyPlayer[], playerId: string, rules: LobbyRules): boolean {
  if (rules.teamMode !== "teams") return false;
  const me = players.find((p) => p.id === playerId);
  if (!me) return false;
  const to: TeamId = me.teamId === "A" ? "B" : "A";
  return teamSizes(players)[to] < Math.ceil(rules.maxPlayers / 2);
}

/** Teams mode starts only with the same number of players on both sides. */
export function teamsEqual(players: readonly LobbyPlayer[]): boolean {
  const s = teamSizes(players);
  return s.A === s.B;
}

/**
 * Why the match cannot start right now, or null if it can. Used both for the
 * automatic countdown and for a private host's manual start.
 */
export function startBlocker(players: readonly LobbyPlayer[], rules: LobbyRules, requireReady: boolean): string | null {
  const connected = players.filter((p) => p.connected);
  if (connected.length < rules.minPlayers) return `至少需要 ${rules.minPlayers} 人`;
  if (connected.length > rules.maxPlayers) return `最多 ${rules.maxPlayers} 人`;
  if (rules.teamMode === "teams" && !teamsEqual(connected)) return "兩隊人數必須相同";
  if (requireReady && !connected.every((p) => p.ready)) return "還有人沒準備好";
  return null;
}

/**
 * Should the automatic countdown be running? Quick rooms count down as soon as
 * they are full regardless of readiness; otherwise everyone must be ready.
 */
export function shouldCountDown(players: readonly LobbyPlayer[], rules: LobbyRules, mode: RoomMode): boolean {
  if (mode === "quick" && startBlocker(players, rules, false) === null && players.filter((p) => p.connected).length >= rules.maxPlayers) return true;
  return startBlocker(players, rules, true) === null;
}

/** Four characters, no ambiguous glyphs (0/O, 1/I). */
export function makeRoomCode(random: () => number = Math.random): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += alphabet[Math.floor(random() * alphabet.length)];
  return code;
}
