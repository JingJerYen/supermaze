import { describe, expect, it } from "vitest";
import { ACHIEVEMENT_IDS } from "@supermaze/sim";
import { ACHIEVEMENT_ICONS, achievementDesc } from "../src/achievements/info.js";
import { LOCALES, t, type MessageKey } from "../src/i18n/index.js";

describe("achievement text", () => {
  it("every achievement has an icon, and a name and a filled-in description in every language", () => {
    for (const id of ACHIEVEMENT_IDS) {
      expect(ACHIEVEMENT_ICONS[id]).toBeTruthy();
      for (const lang of LOCALES) {
        const name = t(`ach.${id}.name` as MessageKey, undefined, lang);
        expect(name).not.toBe(`ach.${id}.name`);
      }
      expect(achievementDesc(id)).not.toMatch(/\{\w+\}/);
    }
  });
});
