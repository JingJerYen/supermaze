import type { SimEvent } from "./events.js";
import type { PlayerState } from "./simulation.js";
import type { Tuning } from "./tuning/index.js";
import type { PlayerId, Tick } from "./types.js";

/**
 * One-shot skills (CLAUDE.md section 4.1): the tower run lets the player pick
 * one before each floor and cast it once during that floor. The simulation
 * only knows what a participant was given at the start (`Participant.skill`);
 * which modes hand them out is up to the caller, and CPUs never get one.
 *
 * - sprint: faster for a while.
 * - eagleEye: a look from above for a while (the view is the client's; the timer is here).
 * - amulet: the next trap or ghost catch is shrugged off.
 * - lantern: a wider circle of light while the map is dark; only usable in the dark.
 * - timeStop: everyone else in the maze is frozen for a while.
 */
export type SkillKind = "sprint" | "eagleEye" | "amulet" | "lantern" | "timeStop";

export const SKILL_KINDS: readonly SkillKind[] = ["sprint", "eagleEye", "amulet", "lantern", "timeStop"];

/** A timed skill in effect (sprint, eagle eye, lantern). */
export interface SkillEffect {
  kind: SkillKind;
  untilTick: Tick;
}

/** Whether `p` may cast the skill they hold right now. */
export function canUseSkill(
  ctx: { tick: Tick; freezeUntilTick: Tick; lightsOn: boolean; running: boolean },
  p: PlayerState,
): boolean {
  if (!p.skill || !ctx.running || p.phase !== "maze") return false;
  if (ctx.tick < ctx.freezeUntilTick || ctx.tick < p.frozenUntilTick) return false;
  // A lantern in the light would be wasted.
  if (p.skill === "lantern" && ctx.lightsOn) return false;
  return true;
}

/** The timed effect `kind` is running for `p` at `tick`. */
export function skillActive(p: PlayerState, kind: SkillKind, tick: Tick): boolean {
  return p.skillEffect?.kind === kind && tick < p.skillEffect.untilTick;
}

/** Movement speed factor from the player's own skill. */
export function skillSpeedFactor(p: PlayerState, tick: Tick, tuning: Tuning): number {
  return skillActive(p, "sprint", tick) ? tuning.skills.sprint.speedMultiplier : 1;
}

/**
 * Cast `p`'s skill: the caster's new state, the event, and for a time stop the
 * tick everyone else stays frozen until (applied with `applyTimeStop` once
 * every player has moved this tick). The caller checks `canUseSkill` first.
 */
export function castSkill(p: PlayerState, tick: Tick, tuning: Tuning): { caster: PlayerState; event: SimEvent; timeStopUntil: Tick | null } {
  const kind = p.skill as SkillKind;
  const s = tuning.skills;
  const ticks = (sec: number) => Math.round(sec * tuning.tickRate);
  const event: SimEvent = { type: "skillUsed", tick, playerId: p.id, skill: kind };
  const caster: PlayerState = { ...p, skill: null };
  switch (kind) {
    case "sprint":
      return { caster: { ...caster, skillEffect: { kind, untilTick: tick + ticks(s.sprint.durationSec) } }, event, timeStopUntil: null };
    case "eagleEye":
      return { caster: { ...caster, skillEffect: { kind, untilTick: tick + ticks(s.eagleEye.durationSec) } }, event, timeStopUntil: null };
    case "lantern":
      return { caster: { ...caster, skillEffect: { kind, untilTick: tick + ticks(s.lantern.durationSec) } }, event, timeStopUntil: null };
    case "amulet":
      return { caster: { ...caster, shielded: true }, event, timeStopUntil: null };
    case "timeStop":
      return { caster, event, timeStopUntil: tick + ticks(s.timeStop.freezeSec) };
  }
}

/** Everyone in the maze but the caster stops where they stand, mid-step included; a longer freeze already running is kept. */
export function applyTimeStop(players: Record<PlayerId, PlayerState>, casterId: PlayerId, until: Tick): void {
  for (const o of Object.values(players)) {
    if (o.id === casterId || o.phase !== "maze" || o.frozenUntilTick >= until) continue;
    players[o.id] = { ...o, frozenUntilTick: until, frozenBy: "skill" };
  }
}
