import { describe, expect, it } from "vitest";
import { CHARACTER_IDS, capName } from "@supermaze/protocol";
import { cpuCast, DEFAULT_NAMES, FALLBACK_NAME } from "../src/characterNames.js";

describe("default character names", () => {
  it("every character has one, not empty, within the name limit and all different", () => {
    const names = [...Object.values(DEFAULT_NAMES), FALLBACK_NAME];
    for (const id of CHARACTER_IDS) {
      const name = DEFAULT_NAMES[id];
      expect(name.trim(), id).not.toBe("");
      expect(capName(name), `${id}: "${name}" is longer than the name limit`).toBe(name);
    }
    expect(new Set(names).size).toBe(names.length);
  });

  it("CPUs are distinct characters, never yours, named after them, the same for the same seed", () => {
    const cast = cpuCast(5, 7, ["character-male-b"]);
    expect(new Set(cast.map((c) => c.character)).size).toBe(5);
    expect(cast.map((c) => c.character)).not.toContain("character-male-b");
    for (const c of cast) expect(c.name).toBe(DEFAULT_NAMES[c.character]);
    expect(cpuCast(5, 7, ["character-male-b"])).toEqual(cast);
    expect(cpuCast(5, 8, ["character-male-b"])).not.toEqual(cast);
  });
});
