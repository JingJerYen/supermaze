import { describe, expect, it } from "vitest";
import { drawDark } from "../src/render/flicker.js";
import { CLIENT_TUNING } from "../src/tuning.js";

describe("night parade lights", () => {
  const rate = 20;
  const flickerTicks = CLIENT_TUNING.nightLights.flickerSec * rate;
  const darkShare = (ticksLeft: number) => {
    let dark = 0;
    for (let i = 0; i < 1000; i++) if (drawDark(true, 1000, 1000 - ticksLeft, rate, i / 997)) dark++;
    return dark / 1000;
  };

  it("are steady until the flicker, then go dark more and more often", () => {
    expect(drawDark(true, undefined, 0, rate, 1.23)).toBe(false);
    expect(drawDark(false, undefined, 0, rate, 1.23)).toBe(true);
    expect(darkShare(flickerTicks + 1)).toBe(0);
    const early = darkShare(flickerTicks - 1);
    const late = darkShare(2);
    expect(early).toBeGreaterThan(0.15);
    expect(late).toBeGreaterThan(early);
  });
});
