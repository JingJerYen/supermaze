import type { SnapshotMessage } from "@supermaze/protocol";

/**
 * Keeps the two most recent snapshots and tells the renderer how far between
 * them to draw. Rendering runs one snapshot interval behind arrival so there
 * is always a "next" state to interpolate toward; the cost is a small, constant
 * visual delay, the gain is motion without stepping.
 */
export class SnapshotBuffer {
  private prev: { snap: SnapshotMessage; at: number } | null = null;
  private curr: { snap: SnapshotMessage; at: number } | null = null;

  constructor(private readonly intervalMs: number) {}

  push(snap: SnapshotMessage, receivedAt: number): void {
    if (this.curr && snap.state.tick <= this.curr.snap.state.tick) return; // late or duplicate
    this.prev = this.curr;
    this.curr = { snap, at: receivedAt };
  }

  /** Latest snapshot, for HUD and non-interpolated data. */
  latest(): SnapshotMessage | null {
    return this.curr?.snap ?? null;
  }

  /** Pair to interpolate between and the 0..1 blend, or null before two snapshots exist. */
  sample(now: number): { from: SnapshotMessage; to: SnapshotMessage; alpha: number } | null {
    if (!this.curr) return null;
    if (!this.prev) return { from: this.curr.snap, to: this.curr.snap, alpha: 1 };
    const renderTime = now - this.intervalMs;
    const span = Math.max(this.curr.at - this.prev.at, 1);
    const alpha = Math.min(Math.max((renderTime - this.prev.at) / span, 0), 1);
    return { from: this.prev.snap, to: this.curr.snap, alpha };
  }
}
