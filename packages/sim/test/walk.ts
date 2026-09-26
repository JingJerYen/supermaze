import type { PlayerInput, Simulation } from "../src/simulation.js";

/** Ticks a full tile takes at the sim's speed. */
export function ticksPerTile(sim: Simulation): number {
  return Math.ceil(sim.tuning.tickRate / sim.tuning.movement.speedTilesPerSec);
}

export function turnTicks(sim: Simulation): number {
  return Math.round(sim.tuning.movement.turnDelaySec * sim.tuning.tickRate);
}

/**
 * Drive `id` along `dirs`, exactly one tile each, ending at rest. Handles the
 * tap-to-turn rule: a new direction is held through the turn delay first. The
 * intent is released one tick before arrival because holding it through the
 * arrival tick would immediately start the next tile (continuous movement).
 */
export function walk(sim: Simulation, id: string, dirs: PlayerInput[]): void {
  const n = ticksPerTile(sim);
  for (const d of dirs) {
    const facing = sim.getState().players[id]!.mover.facing;
    const turning = Math.sign(d.moveX) !== facing.dx || Math.sign(d.moveY) !== facing.dy;
    const extra = turning ? turnTicks(sim) + 1 : 0; // 1 tick to turn + hold through the delay
    for (let i = 0; i < extra + n - 1; i++) sim.step(new Map([[id, d]]));
    for (let i = 0; i < n; i++) sim.step(new Map());
  }
}

/**
 * One tick of pushing toward the tower door each player stands in front of: a
 * tap that turns without moving. Players not on a door tile get no input.
 */
export function faceTower(sim: Simulation, ids: string[]): void {
  const inputs = new Map<string, PlayerInput>();
  for (const id of ids) {
    const p = sim.getState().players[id]!;
    const d = sim.grid.doorDir(p.mover.from.x, p.mover.from.y);
    if (d) inputs.set(id, { moveX: d.dx, moveY: d.dy });
  }
  sim.step(inputs);
}

/** Hold a direction for a while without settling (to test being blocked). */
export function push(sim: Simulation, id: string, d: PlayerInput, ticks?: number): void {
  const t = ticks ?? ticksPerTile(sim) * 2 + turnTicks(sim) + 1;
  for (let i = 0; i < t; i++) sim.step(new Map([[id, d]]));
}
