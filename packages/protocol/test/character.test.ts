import { describe, expect, it } from "vitest";
import { CHARACTER_IDS, sanitizeCharacter } from "../src/index.js";

describe("sanitizeCharacter", () => {
  it("keeps a listed character and refuses anything else", () => {
    expect(sanitizeCharacter(CHARACTER_IDS[3])).toBe(CHARACTER_IDS[3]);
    for (const bad of ["", "character-male-z", "../../secret", 3, null, undefined, { id: "character-male-a" }]) {
      expect(sanitizeCharacter(bad)).toBeNull();
    }
  });
});
