import type { SimEvent } from "./events.js";
import type { MapGrid } from "./map/grid.js";
import type { TilePos } from "./map/types.js";
import { placeableMoveFilter, type PlaceableState } from "./placeables.js";
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
 * - jump: up onto the wall in front, or down from a wall top onto the road in
 *   front, without stairs; only usable where there is such a tile.
 */
export type SkillKind = "sprint" | "eagleEye" | "amulet" | "lantern" | "timeStop" | "jump";

export const SKILL_KINDS: readonly SkillKind[] = ["sprint", "eagleEye", "amulet", "lantern", "timeStop", "jump"];

/** A timed skill in effect (sprint, eagle eye, lantern). */
export interface SkillEffect {
  kind: SkillKind;
  untilTick: Tick;
}

/** Whether `p` may cast the skill they hold right now. */
export function canUseSkill(
  ctx: { tick: Tick; freezeUntilTick: Tick; lightsOn: boolean; running: boolean; placeables: Record<string, PlaceableState> },
  p: PlayerState,
  grid: MapGrid,
): boolean {
  if (!p.skill || !ctx.running || p.phase !== "maze") return false;
  if (ctx.tick < ctx.freezeUntilTick || ctx.tick < p.frozenUntilTick) return false;
  // A lantern in the light, or a jump with nowhere to land, would be wasted.
  if (p.skill === "lantern" && ctx.lightsOn) return false;
  if (p.skill === "jump" && !jumpTarget(grid, ctx.placeables, p)) return false;
  return true;
}

/**
 * Where a jump from where `p` stands lands: the tile in front on the other
 * level, that is a wall top when standing on the road and facing a wall, or
 * the road when standing on a wall top (or a bridge) and facing a road cell.
 * Null when there is no such tile, when `p` is walking, or on stairs (they
 * change level already). An obstacle or a one-way door against the jump
 * blocks the landing, the same as a step; a trap does not, it springs.
 */
export function jumpTarget(grid: MapGrid, placeables: Record<string, PlaceableState>, p: PlayerState): TilePos | null {
  const m = p.mover;
  if (p.phase !== "maze" || m.target || grid.kindAt(m.from.x, m.from.y) === "stairs") return null;
  const x = m.from.x + m.facing.dx;
  const y = m.from.y + m.facing.dy;
  const kind = grid.kindAt(x, y);
  const layer = m.from.layer === "road" && kind === "wall" ? "wallTop" : m.from.layer === "wallTop" && kind === "road" ? "road" : null;
  if (!layer) return null;
  const to: TilePos = { x, y, layer };
  return placeableMoveFilter(placeables)(m.from, to, m.facing) ? to : null;
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
export function castSkill(
  p: PlayerState,
  tick: Tick,
  tuning: Tuning,
  grid: MapGrid,
  placeables: Record<string, PlaceableState>,
): { caster: PlayerState; event: SimEvent; timeStopUntil: Tick | null } {
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
    case "jump": {
      // The jump is an ordinary move to a tile the stairs rule would not allow;
      // it takes as long as a step and lands with the usual arrival effects.
      const to = jumpTarget(grid, placeables, p) as TilePos;
      return { caster: { ...caster, mover: { ...p.mover, target: to, progress: 0, turnHold: 0 } }, event, timeStopUntil: null };
    }
  }
}

/** Everyone in the maze but the caster stops where they stand, mid-step included; a longer freeze already running is kept. */
export function applyTimeStop(players: Record<PlayerId, PlayerState>, casterId: PlayerId, until: Tick): void {
  for (const o of Object.values(players)) {
    if (o.id === casterId || o.phase !== "maze" || o.frozenUntilTick >= until) continue;
    players[o.id] = { ...o, frozenUntilTick: until, frozenBy: "skill" };
  }
}
