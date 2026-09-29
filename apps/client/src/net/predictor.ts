import { movePlayer, moverPosition, type MapGrid, type MoveIntent, type MoverState, type SimulationState, type Tuning } from "@supermaze/sim";

/** Unacknowledged inputs beyond this many (3 s at 20 Hz) mean no acknowledgements are coming: stop predicting. */
const MAX_PENDING = 60;

/**
 * Client-side prediction of the local player's own movement (CLAUDE.md section
 * 17.3). Every input is applied here at once with the simulation's own
 * movement rule, so the player moves the moment a key is pressed instead of a
 * round trip later. When the server reports which input its state includes,
 * the prediction is rebuilt from that state plus the inputs sent since; with
 * nothing unexpected in between the result is identical and nothing visibly
 * changes. Only the mover is predicted: pickups, items, catches, scores and
 * every other player still come from the server alone.
 *
 * No DOM, no rendering, no clock: ticks in, movers out.
 */
export class Predictor {
  private seq = 0;
  private pending: { seq: number; input: MoveIntent }[] = [];
  private base: SimulationState | null = null;
  private prev: MoverState | null = null;
  private curr: MoverState | null = null;
  private acked = false;

  constructor(
    private readonly grid: MapGrid,
    private readonly tuning: Tuning,
    private readonly meId: string,
  ) {}

  /** True once the server has acknowledged an input and the player is there to predict. */
  get active(): boolean {
    return this.acked && this.curr !== null && this.pending.length <= MAX_PENDING;
  }

  /** The latest state from the server. */
  setState(state: SimulationState): void {
    this.base = state;
    if (!this.curr) this.curr = this.prev = state.players[this.meId]?.mover ?? null;
  }

  /** Register the input being sent this client tick, apply it, and return its number. */
  push(input: MoveIntent): number {
    const seq = ++this.seq;
    this.pending.push({ seq, input: { moveX: input.moveX, moveY: input.moveY } });
    if (this.pending.length > MAX_PENDING + 20) this.pending.splice(0, this.pending.length - MAX_PENDING - 20);
    if (this.base && this.curr) {
      this.prev = this.curr;
      this.curr = this.advance(this.curr, input, this.pending.length);
    }
    return seq;
  }

  /**
   * The state last given to `setState` includes every input up to `seq`.
   * Rebuilds the prediction and returns how far it moved from what was being
   * shown, in tiles on x and y: zero when the prediction was right.
   */
  reconcile(seq: number): { x: number; y: number } {
    this.acked = true;
    this.pending = this.pending.filter((p) => p.seq > seq);
    const me = this.base?.players[this.meId];
    if (!me) return { x: 0, y: 0 };
    let mover = me.mover;
    this.pending.forEach((p, i) => (mover = this.advance(mover, p.input, i + 1)));
    const shown = this.curr;
    this.curr = mover;
    // Keep the pair one tick apart, so drawing between them keeps flowing.
    if (!this.prev || !shown) this.prev = mover;
    if (!shown || shown.from.layer !== mover.from.layer) return { x: 0, y: 0 };
    const a = moverPosition(shown);
    const b = moverPosition(mover);
    return { x: a.x - b.x, y: a.y - b.y };
  }

  /** The predicted mover `alpha` (0..1) of the way from the previous client tick to the current one. */
  blended(alpha: number): MoverState | null {
    if (!this.curr) return null;
    return this.prev ? blendMover(this.prev, this.curr, alpha) : this.curr;
  }

  current(): MoverState | null {
    return this.curr;
  }

  private advance(mover: MoverState, input: MoveIntent, ticksAhead: number): MoverState {
    const s = this.base as SimulationState;
    const me = s.players[this.meId];
    if (!me) return mover;
    const ctx = { tick: s.tick + ticksAhead, status: s.status, freezeUntilTick: s.freezeUntilTick, ghost: s.ghost, placeables: s.placeables };
    return movePlayer(this.grid, this.tuning, ctx, { ...me, mover }, input);
  }
}

const same = (a: { x: number; y: number; layer: string } | null, b: { x: number; y: number; layer: string } | null) =>
  a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.layer === b.layer);

/**
 * A mover part of the way between two consecutive ticks' movers, itself a
 * valid mover (on one tile edge), so everything that draws movers can draw it.
 * Handles standing, walking along one edge, and crossing onto the next edge.
 */
export function blendMover(prev: MoverState, curr: MoverState, alpha: number): MoverState {
  const a = Math.min(Math.max(alpha, 0), 1);
  if (!curr.target) {
    // Arrived (or standing): finish the edge that was being walked, if any.
    if (prev.target && same(prev.target, curr.from) && a < 1) {
      const progress = prev.progress + (1 - prev.progress) * a;
      return { ...prev, progress, facing: curr.facing };
    }
    return curr;
  }
  if (same(prev.from, curr.from) && same(prev.target, curr.target)) {
    return { ...curr, progress: prev.progress + (curr.progress - prev.progress) * a };
  }
  if (prev.target && same(prev.target, curr.from)) {
    // Crossed a tile boundary during the tick: walk the rest of the old edge, then the new one.
    const total = 1 - prev.progress + curr.progress;
    const walked = total * a;
    if (walked < 1 - prev.progress) return { ...prev, progress: prev.progress + walked, facing: curr.facing };
    return { ...curr, progress: walked - (1 - prev.progress) };
  }
  if (!prev.target && same(prev.from, curr.from)) return { ...curr, progress: curr.progress * a };
  return curr; // unrelated (teleport, correction): no blending
}
