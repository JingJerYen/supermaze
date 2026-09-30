import { describe, expect, it } from "vitest";
import { CHARACTER_IDS, capName } from "@supermaze/protocol";
import { DEFAULT_NAMES, FALLBACK_NAME } from "../src/characterNames.js";

describe("default character names", () => {
  it("are real characters' names, not empty, within the name limit and all different", () => {
    const names = [...Object.values(DEFAULT_NAMES), FALLBACK_NAME];
    for (const [id, name] of Object.entries(DEFAULT_NAMES)) {
      expect(CHARACTER_IDS as readonly string[]).toContain(id);
      expect(name.trim(), id).not.toBe("");
      expect(capName(name), `${id}: "${name}" is longer than the name limit`).toBe(name);
    }
    expect(new Set(names).size).toBe(names.length);
  });
});
