import { describe, expect, it } from "vitest";
import { CHARACTER_IDS, capName } from "@supermaze/protocol";
import { DEFAULT_NAMES } from "../src/characterNames.js";

describe("default character names", () => {
  it("every character has one, not empty and within the name limit", () => {
    for (const id of CHARACTER_IDS) {
      const name = DEFAULT_NAMES[id];
      expect(name.trim(), id).not.toBe("");
      expect(capName(name), `${id}: "${name}" is longer than the name limit`).toBe(name);
    }
  });
});
