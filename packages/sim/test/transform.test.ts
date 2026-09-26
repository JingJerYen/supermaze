import { describe, expect, it } from "vitest";
import { MapGrid } from "../src/map/grid.js";
import { rotateMap } from "../src/map/transform.js";
import { validateMap } from "../src/map/validate.js";
import { LATTICE_MAP } from "./fixtures.js";

describe("rotateMap", () => {
  it("four quarter turns give back the original", () => {
    const back = rotateMap(LATTICE_MAP, 3);
    const full = rotateMap(back, 1);
    expect(full.rows).toEqual(LATTICE_MAP.rows);
    expect(full.spawns).toEqual(LATTICE_MAP.spawns);
    expect(full.rotation).toBe(0);
  });

  it("keeps every rotation valid and preserves cell kinds under spawns", () => {
    for (const turns of [1, 2, 3] as const) {
      const r = rotateMap(LATTICE_MAP, turns);
      expect(validateMap(r)).toEqual([]);
      const g0 = MapGrid.fromMapData(LATTICE_MAP);
      const g1 = MapGrid.fromMapData(r);
      LATTICE_MAP.spawns.keys.forEach((k, i) => {
        const rk = r.spawns.keys[i]!;
        expect(g1.kindAt(rk.x, rk.y)).toBe(g0.kindAt(k.x, k.y));
      });
    }
  });

  it("rotates a non-square map to the swapped dimensions", () => {
    const wide = { ...LATTICE_MAP, rows: ["XXXXX", "X.T.X", "XXXXX"], spawns: { keys: [], itemBoxes: [], lightSwitches: [] } };
    const r = rotateMap(wide, 1);
    expect(r.rows).toEqual(["XXX", "X.X", "XTX", "X.X", "XXX"]);
  });
});
