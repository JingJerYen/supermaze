import { describe, expect, it } from "vitest";
import { capName } from "../src/index.js";

describe("capName", () => {
  it("keeps 6 wide characters or 10 narrow ones", () => {
    expect(capName("初四了阿伯好")).toBe("初四了阿伯好");
    expect(capName("初四了阿伯好人")).toBe("初四了阿伯好");
    expect(capName("Alexandria")).toBe("Alexandria");
    expect(capName("Alexandrina")).toBe("Alexandrin");
    expect(capName("Christopher")).toBe("Christophe");
  });

  it("mixes them in proportion and keeps emoji whole", () => {
    // Wide characters take 5 of the 30 units, narrow ones 3: 2 wide + 6 narrow = 28, a 7th narrow would overflow.
    expect(capName("杰哥~abcdef")).toBe("杰哥~abcde");
    expect(capName("8+9")).toBe("8+9");
    expect(capName("煞氣a小妹ab")).toBe("煞氣a小妹ab");
    expect(capName("😀😀😀😀😀😀😀")).toBe("😀😀😀😀😀😀");
  });
});
