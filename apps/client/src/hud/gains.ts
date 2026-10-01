import { isGhost, type SimulationState, type Tuning } from "@supermaze/sim";
import { t } from "../i18n/index.js";

/** One line of the big score pop-up: "+20 抓到人". */
export interface ScoreGain {
  points: number;
  label: string;
}

/**
 * Why the local player's score just went up, derived by diffing two states
 * (clients receive state, not events). Each known cause claims its share of
 * the increase; whatever cannot be explained is still shown, unlabelled, so a
 * gain is never silent. Display only: the score itself is the server's.
 */
export function diffGains(prev: SimulationState | null, next: SimulationState, meId: string | null, scoring: Tuning["scoring"]): ScoreGain[] {
  if (!prev || !meId) return [];
  const a = prev.players[meId];
  const b = next.players[meId];
  if (!a || !b) return [];
  let remaining = b.score - a.score;
  if (remaining <= 0) return [];

  const out: ScoreGain[] = [];
  const take = (points: number, label: string): void => {
    if (points <= 0 || remaining < points) return;
    remaining -= points;
    out.push({ points, label });
  };

  if (!a.keyScored && b.keyScored) take(scoring.keyFound, t("hud.gain.key"));

  if (a.phase === "maze" && b.phase === "tower" && b.towerArrival !== null) {
    const table = scoring.towerPlacement;
    take(table[Math.min(b.towerArrival, table.length - 1)] ?? 0, t("hud.climbedPlace", { n: b.towerArrival + 1 }));
    take(a.items.length * scoring.leftoverItem, t("hud.gain.leftover", { n: a.items.length }));
  }

  // A switch under my feet went from unused to used: I flipped it.
  const flipped = Object.values(next.switches).some(
    (s) => s.used && prev.switches[s.id]?.used === false && s.pos.x === b.mover.from.x && s.pos.y === b.mover.from.y && s.pos.layer === b.mover.from.layer,
  );
  if (flipped) take(scoring.lightSwitch, t(next.lightsOn ? "hud.gain.lightsOn" : "hud.gain.lightsOff"));

  // Players of other teams who were frozen this tick, by cause.
  const newlyFrozen = Object.values(next.players).filter((p) => {
    const before = prev.players[p.id];
    return p.teamId !== b.teamId && !!before && p.frozenUntilTick > before.frozenUntilTick;
  });
  if (isGhost(next.ghost, b) || isGhost(prev.ghost, a)) {
    for (const p of newlyFrozen) if (p.frozenBy === "ghost") take(scoring.ghostCatch, t("hud.gain.caught", { name: p.name ?? t("hud.player") }));
  }
  for (const p of newlyFrozen) if (p.frozenBy === "trap") take(scoring.trapCatch, t("hud.gain.trapped", { name: p.name ?? t("hud.player") }));

  if (remaining > 0) out.push({ points: remaining, label: t("hud.gain.other") });
  return out;
}
