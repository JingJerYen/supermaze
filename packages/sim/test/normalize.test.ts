import { describe, expect, it } from "vitest";
import { MapGrid } from "../src/map/grid.js";
import { normalizeMap } from "../src/map/normalize.js";
import { rotateMap } from "../src/map/transform.js";
import { validateMap } from "../src/map/validate.js";
import type { MapData } from "../src/map/types.js";
import { LATTICE_MAP } from "./fixtures.js";

/** LATTICE_MAP with its spawn lists redrawn as markers in the rows. */
const { spawns: _lists, ...LATTICE_BASE } = LATTICE_MAP;
const MARKED: MapData = {
  ...LATTICE_BASE,
  rows: [
    "XXXXXXXXX",
    "X..B...KX",
    "X##k#.##X",
    "XS.B...LX",
    "X.###.##X",
    "XL=..T..X",
    "X##.#.#.X",
    "XK...B.BX",
    "XXXXXXXXX",
  ],
};

describe("normalizeMap", () => {
  it("turns markers into spawn lists and plain cells", () => {
    const n = normalizeMap(MARKED);
    expect(n.rows[1]).toBe("X.......X");
    expect(n.rows[2]).toBe("X####.##X");
    expect(n.rows).toEqual(LATTICE_MAP.rows);
    expect(n.spawns.keys).toEqual([
      { x: 7, y: 1, layer: "road" },
      { x: 3, y: 2, layer: "wallTop" },
      { x: 1, y: 7, layer: "road" },
    ]);
    expect(n.spawns.itemBoxes).toEqual(LATTICE_MAP.spawns!.itemBoxes);
    expect(n.spawns.lightSwitches).toEqual([
      { x: 7, y: 3, layer: "road" },
      { x: 1, y: 5, layer: "road" },
    ]);
  });

  it("appends markers after explicit lists and is idempotent", () => {
    const withList: MapData = { ...MARKED, spawns: { keys: [{ x: 5, y: 7, layer: "road" }] } };
    const n = normalizeMap(withList);
    expect(n.spawns.keys[0]).toEqual({ x: 5, y: 7, layer: "road" });
    expect(n.spawns.keys).toHaveLength(4);
    expect(normalizeMap(n)).toEqual(n);
  });

  it("is accepted by the grid, validator and rotation without normalising first", () => {
    expect(() => MapGrid.fromMapData(MARKED)).not.toThrow();
    expect(validateMap(MARKED)).toEqual([]);
    const r = rotateMap(MARKED, 1);
    expect(validateMap(r)).toEqual([]);
    expect(r.spawns.keys).toHaveLength(3);
  });
});
