import { describe, expect, it } from "vitest";
import { SeededRandom } from "../src/random/seeded.js";

describe("SeededRandom", () => {
  it("produces the same sequence for the same seed", () => {
    const a = new SeededRandom(12345);
    const b = new SeededRandom(12345);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = new SeededRandom(1);
    const b = new SeededRandom(2);
    expect(a.next()).not.toBe(b.next());
  });

  it("nextInt stays within the inclusive range", () => {
    const r = new SeededRandom(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.nextInt(3, 5);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(5);
    }
  });

  it("pickWeighted never returns zero-weight items", () => {
    const r = new SeededRandom(99);
    for (let i = 0; i < 500; i++) {
      expect(r.pickWeighted(["a", "b", "c"], [0, 1, 0])).toBe("b");
    }
  });
});
