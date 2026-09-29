import { isGhost, type GhostState } from "./ghost.js";
import type { MapGrid } from "./map/grid.js";
import { stepMover, type MoveIntent, type MoverState } from "./movement.js";
import { placeableMoveFilter, type PlaceableState } from "./placeables.js";
import type { PlayerState, RoundStatus } from "./simulation.js";
import type { Tuning } from "./tuning/index.js";
import type { Tick } from "./types.js";

/** What one player's movement for one tick depends on, besides the player and the input. */
export interface MoveContext {
  /** The tick being computed. */
  tick: Tick;
  status: RoundStatus;
  freezeUntilTick: Tick;
  ghost: GhostState;
  placeables: Record<string, PlaceableState>;
}

/**
 * Where a player's mover is after one tick of `input`: the movement rule of
 * the simulation in one place. Nobody moves during the start freeze or while
 * held by a trap or a catch; on the tower top the platform is walked freely;
 * in the maze placeables block, CPU-driven players are slower and ghosts
 * faster. Effects of arriving on a tile (traps, teleports) are not part of it.
 *
 * The authoritative step uses it, and so does a client predicting its own
 * player ahead of the server, which is why it is a pure function.
 */
export function movePlayer(grid: MapGrid, tuning: Tuning, ctx: MoveContext, p: PlayerState, input: MoveIntent): MoverState {
  if (ctx.status === "finished") return p.mover;
  if (ctx.status === "running" && ctx.tick < ctx.freezeUntilTick) return p.mover;
  const speed = tuning.movement.speedTilesPerSec / tuning.tickRate;
  const turnTicks = Math.round(tuning.movement.turnDelaySec * tuning.tickRate);
  if (p.phase === "tower") return stepMover(p.mover, input, grid, speed, undefined, turnTicks);
  if (ctx.tick < p.frozenUntilTick) return p.mover;
  const base = p.controller === "cpu" ? speed * tuning.cpu.speedMultiplier : speed;
  const mine = isGhost(ctx.ghost, p) ? base * tuning.ghostEvent.speedMultiplier : base;
  return stepMover(p.mover, input, grid, mine, placeableMoveFilter(ctx.placeables), turnTicks);
}
