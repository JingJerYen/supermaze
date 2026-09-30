import { describe, expect, it } from "vitest";
import { loopable } from "../src/audio/music.js";
import { musicRate } from "../src/audio/musicMood.js";
import { CLIENT_TUNING } from "../src/tuning.js";

/** Just enough of an AudioBuffer for `loopable`. */
function fakeBuffer(data: number[][], sampleRate = 10) {
  const channels = data.map((d) => Float32Array.from(d));
  return { numberOfChannels: channels.length, length: channels[0]!.length, sampleRate, getChannelData: (c: number) => channels[c]! } as unknown as AudioBuffer;
}
const fakeCtx = {
  createBuffer: (n: number, length: number, sampleRate: number) => fakeBuffer(Array.from({ length: n }, () => new Array(length).fill(0)), sampleRate),
} as unknown as BaseAudioContext;

describe("music loop", () => {
  it("trims silent ends and blends the tail into the head, so the loop point does not jump", () => {
    // 3 silent samples, then a ramp 1..30, then 2 silent samples; blend 0.4 s at 10 Hz = 4 samples.
    const ramp = Array.from({ length: 30 }, (_, i) => i + 1);
    const out = loopable(fakeCtx, fakeBuffer([[0, 0, 0, ...ramp, 0, 0]]), 0.4);
    const d = out.getChannelData(0);
    expect(out.length).toBe(30 - 4);
    // Starts right after the blended opening...
    expect(d[0]).toBe(5);
    // ...and ends blended almost wholly into the opening's last sample (4), the one just before d[0] (5).
    expect(d[out.length - 1]).toBeCloseTo(30 * 0.25 + 4 * 0.75, 5);
    expect(d[out.length - 4]).toBe(27); // the first blended sample is still all tail
  });

  it("leaves a buffer too short to blend alone", () => {
    const b = fakeBuffer([[1, 2]]);
    expect(loopable(fakeCtx, b, 1)).toBe(b);
  });
});

describe("music rate", () => {
  const a = CLIENT_TUNING.audio;
  const base = { status: "running", remainingSec: 120, freezeSec: 0, ghost: { phase: "idle" } };
  it("is normal most of the time, before the start and after the end", () => {
    expect(musicRate(base)).toBe(1);
    expect(musicRate({ ...base, freezeSec: 2, remainingSec: 10 })).toBe(1);
    expect(musicRate({ ...base, status: "finished", remainingSec: 0 })).toBe(1);
  });
  it("speeds up in the last seconds and during a chase, the faster winning", () => {
    expect(musicRate({ ...base, remainingSec: a.musicHurrySec })).toBe(a.musicHurryRate);
    expect(musicRate({ ...base, ghost: { phase: "active" } })).toBe(a.musicGhostRate);
    expect(musicRate({ ...base, ghost: { phase: "warning" } })).toBe(1);
    expect(musicRate({ ...base, remainingSec: 5, ghost: { phase: "active" } })).toBe(Math.max(a.musicHurryRate, a.musicGhostRate));
  });
});
