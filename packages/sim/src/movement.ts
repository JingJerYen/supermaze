import { DIRS, type Dir, type MapGrid } from "./map/grid.js";
import type { TilePos } from "./map/types.js";

/**
 * Tile-to-tile movement. A mover always sits on a tile or travels between two
 * adjacent tiles, so the map topology is enforced by construction: there is no
 * free position that could clip a wall or skip a stairs.
 */
export interface MoverState {
  /** Last tile the mover stood on. */
  from: TilePos;
  /** Tile being moved to, or null when standing still. */
  target: TilePos | null;
  /** 0..1 fraction of the way from `from` to `target`. */
  progress: number;
  /** Last direction the player pushed; items are placed one tile this way. */
  facing: Dir;
}

export interface MoveIntent {
  moveX: number;
  moveY: number;
}

/** Extra veto on a topologically legal step (obstacles, one-way doors). */
export type MoveFilter = (from: TilePos, to: TilePos, dir: Dir) => boolean;

export function createMover(at: TilePos, facing: Dir = DIRS.south): MoverState {
  return { from: at, target: null, progress: 0, facing };
}

/** Advance one tick. `speed` is tiles per tick. */
export function stepMover(
  m: MoverState,
  intent: MoveIntent,
  grid: MapGrid,
  speed: number,
  allow?: MoveFilter,
): MoverState {
  let { from, target, progress, facing } = m;
  // Distance still available this tick. Carrying the remainder across a tile
  // boundary keeps speed constant instead of pausing for a tick at every tile.
  let budget = speed;

  if (target) {
    progress += budget;
    if (progress < 1) return { from, target, progress, facing };
    budget = progress - 1;
    from = target;
    target = null;
    progress = 0;
  }

  const dirs = intentDirections(intent);
  if (dirs[0]) facing = dirs[0];
  for (const dir of dirs) {
    const dest = grid.tryMove(from, dir);
    if (dest && (!allow || allow(from, dest, dir))) {
      return { from, target: dest, progress: Math.min(budget, MAX_PROGRESS_PER_TICK), facing: dir };
    }
  }
  return { from, target: null, progress: 0, facing };
}

/** A single tick never completes a whole tile; speeds are expected to stay well below 1 tile/tick. */
const MAX_PROGRESS_PER_TICK = 0.999;

/**
 * Turn a stick/keys intent into up to two candidate directions: the dominant
 * axis first, the other axis as a fallback so cornering feels forgiving.
 */
export function intentDirections(intent: MoveIntent): Dir[] {
  const sx = Math.sign(intent.moveX);
  const sy = Math.sign(intent.moveY);
  const x: Dir | null = sx ? { dx: sx, dy: 0 } : null;
  const y: Dir | null = sy ? { dx: 0, dy: sy } : null;
  const first = Math.abs(intent.moveX) >= Math.abs(intent.moveY) ? x : y;
  const second = first === x ? y : x;
  return [first, second].filter((d): d is Dir => d !== null);
}

/** Continuous tile-space position for rendering and distance checks. */
export function moverPosition(m: MoverState): { x: number; y: number } {
  if (!m.target) return { x: m.from.x, y: m.from.y };
  const t = m.progress;
  return {
    x: m.from.x + (m.target.x - m.from.x) * t,
    y: m.from.y + (m.target.y - m.from.y) * t,
  };
}

/** The tile directly in front of a standing mover, on the same layer. */
export function frontTile(m: MoverState): TilePos {
  return { x: m.from.x + m.facing.dx, y: m.from.y + m.facing.dy, layer: m.from.layer };
}

export function sameTile(a: TilePos, b: TilePos): boolean {
  return a.x === b.x && a.y === b.y && a.layer === b.layer;
}
