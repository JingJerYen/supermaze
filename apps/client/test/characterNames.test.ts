import { describe, expect, it } from "vitest";
import { CHARACTER_IDS, capName } from "@supermaze/protocol";
import { cpuCast, DEFAULT_NAMES, namesFor } from "../src/characterNames.js";
import { LOCALES } from "../src/i18n/index.js";

describe("default character names", () => {
  it.each(LOCALES)("%s: every character has one, not empty, within the name limit and all different", (lang) => {
    const { fallback, names: byCharacter } = namesFor(lang);
    const names = [...Object.values(byCharacter), fallback];
    for (const id of [...CHARACTER_IDS, null]) {
      const name = id ? byCharacter[id] : fallback;
      expect(name.trim(), String(id)).not.toBe("");
      expect(capName(name), `${id}: "${name}" is longer than the name limit`).toBe(name);
    }
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length);
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
