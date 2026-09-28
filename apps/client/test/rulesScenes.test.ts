import { describe, expect, it } from "vitest";
import { validateMap } from "@supermaze/sim";
import { DemoRunner } from "../src/rules/runner.js";
import { RULE_SCENES } from "../src/rules/scenes.js";

/** Event types of one full run of a scene, up to the moment it starts over. */
function play(runner: DemoRunner): string[] {
  const types: string[] = [];
  for (let i = 0; i < 20 * 120 && runner.loops === 0; i++) types.push(...runner.step().map((e) => e.type));
  return types;
}

describe("rules demos", () => {
  for (const scene of RULE_SCENES) {
    it(`${scene.id}: plays out what the card describes, then loops identically`, () => {
      const runner = new DemoRunner(scene);
      const first = play(runner);
      expect(runner.loops).toBe(1); // it did finish and start over
      // The expected events appear in order (other events may sit between them).
      let from = 0;
      for (const type of scene.expect) {
        const at = first.indexOf(type, from);
        expect(at, `${scene.id}: "${type}" missing after position ${from} in ${first.join(",")}`).toBeGreaterThanOrEqual(0);
        from = at + 1;
      }
      const again = new DemoRunner(scene);
      expect(play(again)).toEqual(first);
    });

    it(`${scene.id}: text and duration fit a card`, () => {
      expect(scene.text.length).toBeLessThanOrEqual(3);
      const runner = new DemoRunner(scene);
      let ticks = 0;
      while (runner.loops === 0 && ticks < 20 * 120) {
        runner.step();
        ticks++;
      }
      expect(ticks / runner.tickRate).toBeLessThan(30);
      // The little maps keep to the real geometry rules where it matters for looks.
      expect(validateMap(scene.map).filter((e) => /corridor wider/.test(e))).toEqual([]);
    });
  }
});
