import { isGhost } from "../ghost.js";
import { tileKey } from "../map/grid.js";
import type { TilePos } from "../map/types.js";
import { sameTile } from "../movement.js";
import { placeableMoveFilter, sameDir } from "../placeables.js";
import { SeededRandom } from "../random/seeded.js";
import { NO_INPUT, type PlayerInput, type PlayerState, type Simulation, type SimulationState } from "../simulation.js";
import type { PlayerId, Tick } from "../types.js";
import { shortestPath, tilesFromKeys } from "./pathfind.js";

interface Memory {
  /** What the current path leads to; a change forces a replan. */
  goal: string;
  path: TilePos[];
  plannedAt: Tick;
  wander: TilePos | null;
  /** Consecutive ticks spent standing while trying to move; a few is a turn, more is stuck. */
  standing: number;
}

/** Paths are recomputed at least this often so moving targets and new obstacles are noticed. */
const REPLAN_TICKS = 10;
const STUCK_TICKS = 8;

/**
 * Minimal CPU (CLAUDE.md section 18: the smallest slice of phase 5, pulled
 * forward so the sandbox has opponents). Fetch the nearest key, walk to the
 * nearest tower door, turn to it and climb; as a ghost chase the nearest
 * catchable runner; with nothing to do, wander. Never uses items; picks up
 * whatever it walks over. The same class drives the sandbox's CPUs and the
 * server's takeover of dropped players, and is deterministic for a given
 * simulation and seed.
 */
export class CpuController {
  private readonly rng: SeededRandom;
  private readonly memory = new Map<PlayerId, Memory>();
  private wanderPool: TilePos[] | null = null;

  constructor(
    private readonly sim: Simulation,
    seed: number,
  ) {
    this.rng = new SeededRandom(seed);
  }

  /** Inputs for every cpu-controlled player this tick. */
  inputs(): Map<PlayerId, PlayerInput> {
    const out = new Map<PlayerId, PlayerInput>();
    for (const p of Object.values(this.sim.getState().players).sort((a, b) => a.id.localeCompare(b.id))) {
      if (p.controller === "cpu") out.set(p.id, this.input(p.id));
    }
    return out;
  }

  /** Input for one player for the next step. */
  input(id: PlayerId): PlayerInput {
    const state = this.sim.getState();
    const p = state.players[id];
    if (!p || state.status !== "running" || p.phase !== "maze") return NO_INPUT;
    const tick = state.tick + 1; // the input is applied by the next step
    if (tick < state.freezeUntilTick || tick < p.frozenUntilTick) return NO_INPUT;

    const grid = this.sim.grid;
    const anchor = p.mover.target ?? p.mover.from;
    let mem = this.memory.get(id);
    if (!mem) {
      mem = { goal: "", path: [], plannedAt: -1, wander: null, standing: 0 };
      this.memory.set(id, mem);
    }

    // On a door tile with the key: turn toward the door, then climb (section 5).
    if (p.keyId !== null && p.mover.target === null && !isGhost(state.ghost, p) && anchor.layer === "road") {
      const door = grid.doorDir(anchor.x, anchor.y);
      if (door) {
        if (sameDir(door, p.mover.facing)) return { moveX: 0, moveY: 0, action: true };
        return { moveX: door.dx, moveY: door.dy };
      }
    }

    mem.standing = p.mover.target === null ? mem.standing + 1 : 0;
    const stuck = mem.standing > STUCK_TICKS;
    if (stuck) {
      mem.wander = null;
      mem.standing = 0;
    }

    while (mem.path.length > 0 && sameTile(mem.path[0] as TilePos, anchor)) mem.path.shift();
    const { goal, isGoal } = this.chooseGoal(state, p, anchor, mem);
    const next = mem.path[0];
    const adjacent = !!next && Math.abs(next.x - anchor.x) + Math.abs(next.y - anchor.y) === 1;
    if (stuck || goal !== mem.goal || tick - mem.plannedAt >= REPLAN_TICKS || !adjacent) {
      mem.goal = goal;
      mem.plannedAt = tick;
      const path = shortestPath(grid, anchor, isGoal, placeableMoveFilter(state.placeables));
      if (path) {
        mem.path = path; // empty when already on the goal: stand there (the pickup or catch happens by itself)
      } else {
        // Goal unreachable: drift somewhere else until the situation changes.
        mem.wander = null;
        const w = this.wanderGoal(anchor, mem);
        mem.goal = w.goal;
        mem.path = shortestPath(grid, anchor, w.isGoal, placeableMoveFilter(state.placeables)) ?? [];
      }
    }
    const step = mem.path[0];
    if (!step) return NO_INPUT;
    return { moveX: Math.sign(step.x - anchor.x), moveY: Math.sign(step.y - anchor.y) };
  }

  private chooseGoal(state: SimulationState, p: PlayerState, anchor: TilePos, mem: Memory): { goal: string; isGoal: (t: TilePos) => boolean } {
    if (isGhost(state.ghost, p)) {
      const tick = state.tick + 1;
      const runners = Object.values(state.players)
        .filter((r) => r.teamId !== p.teamId && r.phase === "maze" && tick >= r.protectedUntilTick)
        .map((r) => r.mover.target ?? r.mover.from);
      if (runners.length > 0) return { goal: "chase", isGoal: (t) => runners.some((r) => sameTile(r, t)) };
    } else if (p.keyId === null) {
      const keys = Object.values(state.keys)
        .filter((k) => k.ownerId === null)
        .map((k) => k.pos);
      if (keys.length > 0) return { goal: "key", isGoal: (t) => keys.some((k) => sameTile(k, t)) };
    } else {
      const doors = this.sim.grid.doorTiles();
      if (doors.length > 0) return { goal: "door", isGoal: (t) => doors.some((d) => sameTile(d, t)) };
    }
    return this.wanderGoal(anchor, mem);
  }

  /** A random reachable tile, kept until reached; the pool is every tile reachable from the tower. */
  private wanderGoal(anchor: TilePos, mem: Memory): { goal: string; isGoal: (t: TilePos) => boolean } {
    if (!this.wanderPool) {
      const spawn = this.sim.grid.spawnTiles()[0] ?? anchor;
      this.wanderPool = tilesFromKeys(this.sim.grid.reachableFrom(spawn)).sort((a, b) => a.layer.localeCompare(b.layer) || a.y - b.y || a.x - b.x);
    }
    if (!mem.wander || sameTile(mem.wander, anchor)) {
      const pool = this.wanderPool;
      mem.wander = pool.length > 0 ? (pool[Math.floor(this.rng.next() * pool.length)] as TilePos) : anchor;
    }
    const target = mem.wander;
    return { goal: `wander:${tileKey(target.x, target.y, target.layer)}`, isGoal: (t) => sameTile(t, target) };
  }
}
