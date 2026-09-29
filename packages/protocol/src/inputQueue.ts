import type { PlayerInput } from "@supermaze/sim";
import type { InputMessage } from "./index.js";

/**
 * The inputs of one client waiting to be applied, in order, one per tick. A
 * tick that finds the queue empty repeats the last movement (a late packet
 * must not stop a walking player) without repeating one-shot presses. A queue
 * that grows beyond `limit` (a client running fast, or a burst after a stall)
 * drops its oldest entries, keeping their presses, so latency cannot build up.
 */
export class InputQueue {
  private readonly queue: InputMessage[] = [];
  private held: PlayerInput = { moveX: 0, moveY: 0 };
  /** The last numbered input applied, or 0. */
  acked = 0;

  constructor(private readonly limit = 4) {}

  push(input: InputMessage): void {
    this.queue.push(input);
    while (this.queue.length > this.limit) {
      const dropped = this.queue.shift() as InputMessage;
      const next = this.queue[0] as InputMessage;
      if (dropped.action) next.action = true;
      if (dropped.discard) next.discard = true;
    }
  }

  /** The input for this tick. */
  take(): PlayerInput {
    const next = this.queue.shift();
    if (!next) return this.held;
    if (typeof next.seq === "number") this.acked = next.seq;
    this.held = { moveX: next.moveX, moveY: next.moveY };
    const { seq: _seq, ...input } = next;
    return input;
  }

  get length(): number {
    return this.queue.length;
  }
}
