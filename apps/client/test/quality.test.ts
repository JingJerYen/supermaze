import { describe, expect, it } from "vitest";
import { QualityGovernor, type GovernorConfig } from "../src/render/quality.js";

const cfg: GovernorConfig = { warmupSec: 3, windowSec: 4, settleSec: 1, slowFps: 45, minGain: 0.1 };
const STEPS = [2, 1.5, 1.25, 1, 0.8];

/** Feed `sec` seconds of frames at `fps`; returns every ratio change. */
function play(g: QualityGovernor, sec: number, fps: number | ((ratio: number) => number)): number[] {
  const out: number[] = [];
  let t = 0;
  while (t < sec) {
    const f = typeof fps === "number" ? fps : fps(g.ratio);
    const r = g.frame(1 / f);
    if (r !== null) out.push(r);
    t += 1 / f;
  }
  return out;
}

describe("automatic quality", () => {
  it("leaves a smooth device alone", () => {
    const g = new QualityGovernor(STEPS, 0, cfg);
    expect(play(g, 30, 60)).toEqual([]);
    expect(g.ratio).toBe(2);
  });

  it("ignores the warm-up: a slow start of a match does not count", () => {
    const g = new QualityGovernor(STEPS, 0, cfg);
    expect(play(g, 2.9, 20)).toEqual([]);
    expect(play(g, 20, 60)).toEqual([]);
  });

  it("steps down one ratio at a time while slow, stopping once fast enough", () => {
    // Frame rate grows as pixels shrink: 30 fps at 2x, 60 fps at 1.25x.
    const g = new QualityGovernor(STEPS, 0, cfg);
    const fill = (r: number) => Math.min(60, 30 * (2 / r) ** 2 * 0.6);
    const changes = play(g, 60, fill);
    expect(changes).toEqual([1.5, 1.25]);
    expect(g.ratio).toBe(1.25);
  });

  it("undoes a step that does not help and stops (a 30 fps cap, or CPU-bound)", () => {
    const g = new QualityGovernor(STEPS, 0, cfg);
    const changes = play(g, 60, 30);
    expect(changes).toEqual([1.5, 2]);
    expect(g.state).toBe("stopped");
    expect(g.ratio).toBe(2);
  });

  it("a single long hitch does not trigger it (median, not mean)", () => {
    const g = new QualityGovernor(STEPS, 0, cfg);
    play(g, 3.5, 60);
    g.frame(0.2); // one 200 ms hitch
    expect(play(g, 10, 60)).toEqual([]);
  });

  it("counts even very slow frames, but not a tab switch", () => {
    const g = new QualityGovernor(STEPS, 0, cfg);
    g.frame(5); // back from another tab
    expect(g.state).toBe("warmup");
    expect(play(g, 20, 3)).toContain(1.5);
  });

  it("stops at the lowest ratio", () => {
    const g = new QualityGovernor(STEPS, 3, cfg);
    const changes = play(g, 60, (r) => (r === 1 ? 20 : 25));
    expect(changes).toEqual([0.8]);
    expect(g.state).toBe("stopped");
  });
});
