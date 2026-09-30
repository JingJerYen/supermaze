import { CLIENT_TUNING } from "../tuning.js";

/**
 * How fast the match music plays: a little faster in a round's last seconds
 * (the faster of the two wins) and while a ghost chase is on; normal before
 * the round starts and once it is over.
 */
export function musicRate(m: { status: string; remainingSec: number; freezeSec: number; ghost: { phase: string } | null }): number {
  const a = CLIENT_TUNING.audio;
  if (m.status !== "running" || m.freezeSec > 0) return 1;
  let rate = 1;
  if (m.remainingSec > 0 && m.remainingSec <= a.musicHurrySec) rate = Math.max(rate, a.musicHurryRate);
  if (m.ghost?.phase === "active") rate = Math.max(rate, a.musicGhostRate);
  return rate;
}
