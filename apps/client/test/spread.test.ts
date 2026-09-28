import { describe, expect, it } from "vitest";
import { spreadTargets, type SpreadPoint } from "../src/render/spread.js";
import { CLIENT_TUNING } from "../src/tuning.js";

const t = CLIENT_TUNING.separation;
const at = (id: string, x: number, z: number, y = 0): SpreadPoint => ({ id, x, y, z });
const crowd = (n: number) => Array.from({ length: n }, (_, i) => at(`p${i}`, 5, 7));

describe("spreadTargets", () => {
  it("leaves lone characters and distant ones alone", () => {
    expect(spreadTargets([at("a", 1, 1)], t).size).toBe(0);
    expect(spreadTargets([at("a", 1, 1), at("b", 2, 1)], t).size).toBe(0);
    // Same x/z but one on the road and one on the wall top: not overlapping on screen.
    expect(spreadTargets([at("a", 1, 1, 0), at("b", 1, 1, 1)], t).size).toBe(0);
  });

  it("puts two side by side, the lower id to the west", () => {
    const out = spreadTargets(crowd(2), t);
    expect(out.get("p0")!.x).toBeCloseTo(-t.spacing / 2);
    expect(out.get("p1")!.x).toBeCloseTo(t.spacing / 2);
    expect(out.get("p0")!.z).toBeCloseTo(0);
  });

  it("keeps a crowd of any size inside its tile and apart from each other", () => {
    for (const n of [3, 4, 5, 6]) {
      const out = [...spreadTargets(crowd(n), t).values()];
      expect(out).toHaveLength(n);
      for (const o of out) expect(Math.hypot(o.x, o.z)).toBeLessThanOrEqual(t.maxRing + 1e-9);
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          expect(Math.hypot(out[i]!.x - out[j]!.x, out[i]!.z - out[j]!.z)).toBeGreaterThan(0.29);
        }
      }
    }
  });

  it("grows smoothly as two characters approach", () => {
    const gap = (d: number) => {
      const out = spreadTargets([at("a", 0, 0), at("b", d, 0)], t);
      return Math.abs(out.get("a")?.x ?? 0);
    };
    expect(gap(t.radius - 0.001)).toBeLessThan(0.01);
    expect(gap(0.2)).toBeGreaterThan(gap(0.4));
    expect(gap(0)).toBeCloseTo(t.spacing / 2);
  });
});
