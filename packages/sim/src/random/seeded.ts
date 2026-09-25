/**
 * Deterministic PRNG (mulberry32). Same seed -> same sequence on every platform.
 * All randomness inside the simulation must go through an instance of this class
 * so that a round can be replayed from its seed plus its input log.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform integer in [min, max] inclusive. */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Pick one element. Throws on empty input. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("pick() on empty array");
    return items[this.nextInt(0, items.length - 1)] as T;
  }

  /** Weighted pick. Weights must be non-negative and not all zero. */
  pickWeighted<T>(items: readonly T[], weights: readonly number[]): T {
    if (items.length !== weights.length) throw new Error("items/weights length mismatch");
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) throw new Error("pickWeighted() total weight must be > 0");
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i] as number;
      if (r < 0) return items[i] as T;
    }
    return items[items.length - 1] as T;
  }

  /** In-place Fisher-Yates shuffle. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      const tmp = items[i] as T;
      items[i] = items[j] as T;
      items[j] = tmp;
    }
    return items;
  }
}
