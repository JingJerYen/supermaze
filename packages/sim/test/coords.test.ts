import { describe, expect, it } from "vitest";
import { columnLabel, tileLabel } from "../src/map/coords.js";

describe("tile labels", () => {
  it("letters for columns, 1-based numbers for rows", () => {
    expect(tileLabel(0, 0)).toBe("A1");
    expect(tileLabel(2, 6)).toBe("C7");
    expect(tileLabel(20, 14)).toBe("U15");
  });

  it("keeps going past Z", () => {
    expect(columnLabel(25)).toBe("Z");
    expect(columnLabel(26)).toBe("AA");
    expect(columnLabel(27)).toBe("AB");
  });
});
