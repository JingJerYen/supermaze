import { isGhost } from "../ghost.js";
import { placementContextOf, placementProblem } from "../items.js";
import { ALL_DIRS, tileKey, type Dir } from "../map/grid.js";
import type { TilePos } from "../map/types.js";
import { frontTile, moverPosition, sameTile } from "../movement.js";
import { placeableAt, placeableMoveFilter, sameDir } from "../placeables.js";
import { SeededRandom } from "../random/seeded.js";
import { NO_INPUT, type PlayerInput, type PlayerState, type Simulation, type SimulationState } from "../simulation.js";
import type { Tuning } from "../tuning/index.js";
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
  /** Keys this CPU has noticed; it only goes for those, like a player who has seen one. */
  seenKeys: Set<string>;
  /** Tiles walked over, so exploration prefers new ground. */
  visited: Set<string>;
  /** No input until this tick: thinking time after reaching somewhere or picking something up. */
  pauseUntil: Tick;
  hadKey: boolean;
}

/** Paths are recomputed at least this often so moving targets and new obstacles are noticed. */
const REPLAN_TICKS = 10;
const STUCK_TICKS = 8;

/**
 * Minimal CPU (CLAUDE.md section 18: the smallest slice of phase 5, pulled
 * forward so the sandbox has opponents). It has no map knowledge a player lacks:
 * it notices keys and runners only within `cpu.visionTiles`, explores unvisited
 * ground otherwise, and pauses briefly after reaching somewhere. With a key it
 * walks to the nearest tower door, turns to it and climbs; as a ghost it chases
 * the nearest runner it can see. It picks up whatever it walks over, puts down
 * its oldest item when it stops to think (so the bag keeps cycling), and keeps
 * a hammer for the moment something blocks the only way to its goal, which is
 * how it gets past map fixtures (section 10.6). The same class drives the sandbox's CPUs and the server's takeover of
 * dropped players, and is deterministic for a given simulation and seed.
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
      mem = { goal: "", path: [], plannedAt: -1, wander: null, standing: 0, seenKeys: new Set(), visited: new Set(), pauseUntil: 0, hadKey: false };
      this.memory.set(id, mem);
    }
    mem.visited.add(tileKey(p.mover.from.x, p.mover.from.y, p.mover.from.layer));
    this.notice(state, p, mem);
    const ghostly = isGhost(state.ghost, p);

    // Picking up the key is a moment to look around before heading back.
    const hasKey = p.keyId !== null;
    if (hasKey && !mem.hadKey) this.pause(mem, tick);
    mem.hadKey = hasKey;
    if (tick < mem.pauseUntil && !ghostly) {
      // Thinking time is also when it puts an item down; hammers are kept for blocked paths.
      const idle = p.mover.target === null && p.items.length > 0 && p.items[0] !== "hammer";
      return idle && this.sim.availableAction(p) === "useItem" ? { moveX: 0, moveY: 0, action: true } : NO_INPUT;
    }

    // On a door tile with the key: turn toward the door, then climb (section 5).
    if (hasKey && p.mover.target === null && !ghostly && anchor.layer === "road") {
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
    const { goal, isGoal } = this.chooseGoal(state, p, anchor, mem, tick);
    const next = mem.path[0];
    const adjacent = !!next && Math.abs(next.x - anchor.x) + Math.abs(next.y - anchor.y) === 1;
    if (stuck || goal !== mem.goal || tick - mem.plannedAt >= REPLAN_TICKS || !adjacent) {
      mem.goal = goal;
      mem.plannedAt = tick;
      const path =
        shortestPath(grid, anchor, isGoal, placeableMoveFilter(state.placeables)) ??
        // Blocked everywhere: with a hammer in the bag, plan straight through and break what is in the way.
        (p.items.includes("hammer") && !ghostly ? shortestPath(grid, anchor, isGoal) : null);
      if (path) {
        mem.path = path; // empty when already on the goal: stand there (the pickup or catch happens by itself)
      } else {
        // Goal unreachable: drift somewhere else until the situation changes.
        mem.wander = null;
        const w = this.wanderGoal(anchor, mem, tick);
        mem.goal = w.goal;
        mem.path = shortestPath(grid, anchor, w.isGoal, placeableMoveFilter(state.placeables)) ?? [];
      }
    }
    const step = mem.path[0];
    if (!step) return NO_INPUT;
    const dir: Dir = { dx: Math.sign(step.x - anchor.x), dy: Math.sign(step.y - anchor.y) };
    if (p.mover.target === null && !ghostly && !placeableMoveFilter(state.placeables)(anchor, step, dir) && placeableAt(state.placeables, step)) {
      const breaking = this.breakThrough(state, p, dir);
      if (breaking) return breaking;
      mem.path = []; // no hammer after all: give up on this way and think again
      mem.plannedAt = -REPLAN_TICKS;
      return NO_INPUT;
    }
    return { moveX: dir.dx, moveY: dir.dy };
  }

  /**
   * Something placed on the next tile blocks the way. With the hammer at the
   * front of the bag: face the thing and swing. With older items in front of
   * the hammer: put them down on any free neighbouring tile first (the bag is
   * first in, first out). Null when there is no hammer or nowhere to unload.
   */
  private breakThrough(state: SimulationState, p: PlayerState, dir: Dir): PlayerInput | null {
    if (!p.items.includes("hammer")) return null;
    if (p.items[0] === "hammer") {
      return sameDir(p.mover.facing, dir) ? { moveX: 0, moveY: 0, action: true } : { moveX: dir.dx, moveY: dir.dy };
    }
    const ctx = placementContextOf(state);
    const free = ALL_DIRS.find((d) => !sameDir(d, dir) && placementProblem(this.sim.grid, ctx, frontTile({ ...p.mover, facing: d })) === null);
    if (!free) return null;
    return sameDir(p.mover.facing, free) ? { moveX: 0, moveY: 0, action: true } : { moveX: free.dx, moveY: free.dy };
  }

  /** Remember unowned keys within sight. Sight is a straight-line radius: the camera shows over walls. */
  private notice(state: SimulationState, p: PlayerState, mem: Memory): void {
    const me = moverPosition(p.mover);
    const r = this.vision(state);
    for (const k of Object.values(state.keys)) {
      if (k.ownerId === null && Math.hypot(k.pos.x - me.x, k.pos.y - me.y) <= r) mem.seenKeys.add(k.id);
    }
  }

  private vision(state: SimulationState): number {
    return cpuVisionTiles(this.sim.tuning, state.lightsOn);
  }

  private pause(mem: Memory, tick: Tick): void {
    const { pauseMinSec, pauseMaxSec, } = this.sim.tuning.cpu;
    const sec = pauseMinSec + this.rng.next() * Math.max(0, pauseMaxSec - pauseMinSec);
    mem.pauseUntil = tick + Math.round(sec * this.sim.tuning.tickRate);
  }

  private chooseGoal(state: SimulationState, p: PlayerState, anchor: TilePos, mem: Memory, tick: Tick): { goal: string; isGoal: (t: TilePos) => boolean } {
    const r = this.vision(state);
    const me = moverPosition(p.mover);
    if (isGhost(state.ghost, p)) {
      const runners = Object.values(state.players)
        .filter((o) => o.teamId !== p.teamId && o.phase === "maze" && tick >= o.protectedUntilTick)
        .filter((o) => {
          const q = moverPosition(o.mover);
          return Math.hypot(q.x - me.x, q.y - me.y) <= r;
        })
        .map((o) => o.mover.target ?? o.mover.from);
      if (runners.length > 0) return { goal: "chase", isGoal: (t) => runners.some((q) => sameTile(q, t)) };
    } else if (p.keyId === null) {
      const keys = Object.values(state.keys)
        .filter((k) => k.ownerId === null && mem.seenKeys.has(k.id))
        .map((k) => k.pos);
      if (keys.length > 0) return { goal: "key", isGoal: (t) => keys.some((k) => sameTile(k, t)) };
    } else {
      const doors = this.sim.grid.doorTiles();
      if (doors.length > 0) return { goal: "door", isGoal: (t) => doors.some((d) => sameTile(d, t)) };
    }
    return this.wanderGoal(anchor, mem, tick);
  }

  /**
   * Explore: a random tile not yet visited (any reachable tile once everything
   * has been seen), kept until reached, then a short pause before the next.
   */
  private wanderGoal(anchor: TilePos, mem: Memory, tick: Tick): { goal: string; isGoal: (t: TilePos) => boolean } {
    if (!this.wanderPool) {
      const spawn = this.sim.grid.spawnTiles()[0] ?? anchor;
      this.wanderPool = tilesFromKeys(this.sim.grid.reachableFrom(spawn)).sort((a, b) => a.layer.localeCompare(b.layer) || a.y - b.y || a.x - b.x);
    }
    if (mem.wander && sameTile(mem.wander, anchor)) {
      mem.wander = null;
      this.pause(mem, tick);
    }
    if (!mem.wander) {
      const fresh = this.wanderPool.filter((t) => !mem.visited.has(tileKey(t.x, t.y, t.layer)));
      const pool = fresh.length > 0 ? fresh : this.wanderPool;
      mem.wander = pool.length > 0 ? (pool[Math.floor(this.rng.next() * pool.length)] as TilePos) : anchor;
    }
    const target = mem.wander;
    return { goal: `wander:${tileKey(target.x, target.y, target.layer)}`, isGoal: (t) => sameTile(t, target) };
  }
}

/** A CPU's sight radius right now: `cpu.visionTiles`, shorter by `cpu.darkVisionPenaltyTiles` while the map is dark. */
export function cpuVisionTiles(tuning: Tuning, lightsOn: boolean): number {
  const { visionTiles, darkVisionPenaltyTiles } = tuning.cpu;
  return Math.max(0, visionTiles - (lightsOn ? 0 : darkVisionPenaltyTiles));
}
