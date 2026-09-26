import { describe, expect, it } from "vitest";
import { DIRS, MapGrid } from "../src/map/grid.js";
import { validateMap } from "../src/map/validate.js";
import { LATTICE_MAP, TINY_MAP } from "./fixtures.js";

const grid = MapGrid.fromMapData(TINY_MAP);

describe("MapGrid.tryMove", () => {
  it("lets road players walk on road", () => {
    expect(grid.tryMove({ x: 1, y: 1, layer: "road" }, DIRS.east)).toEqual({ x: 2, y: 1, layer: "road" });
  });

  it("blocks road players from walking onto a wall", () => {
    expect(grid.tryMove({ x: 3, y: 1, layer: "road" }, DIRS.south)).toBeNull();
  });

  it("blocks wallTop players from stepping down onto road", () => {
    expect(grid.tryMove({ x: 3, y: 2, layer: "wallTop" }, DIRS.north)).toBeNull();
  });

  it("changes layer only when leaving stairs", () => {
    const ontoStairs = grid.tryMove({ x: 1, y: 2, layer: "road" }, DIRS.east);
    expect(ontoStairs).toEqual({ x: 2, y: 2, layer: "road" });
    const ontoWall = grid.tryMove(ontoStairs!, DIRS.east);
    expect(ontoWall).toEqual({ x: 3, y: 2, layer: "wallTop" });
    const backOntoStairs = grid.tryMove(ontoWall!, DIRS.west);
    expect(backOntoStairs).toEqual({ x: 2, y: 2, layer: "wallTop" });
    expect(grid.tryMove(backOntoStairs!, DIRS.west)).toEqual({ x: 1, y: 2, layer: "road" });
  });

  it("lets both layers use a bridge cell without mixing", () => {
    expect(grid.tryMove({ x: 5, y: 3, layer: "wallTop" }, DIRS.south)).toEqual({ x: 5, y: 4, layer: "wallTop" });
    expect(grid.tryMove({ x: 4, y: 4, layer: "road" }, DIRS.east)).toEqual({ x: 5, y: 4, layer: "road" });
    expect(grid.tryMove({ x: 5, y: 4, layer: "road" }, DIRS.south)).toBeNull();
    expect(grid.tryMove({ x: 5, y: 4, layer: "wallTop" }, DIRS.east)).toBeNull();
  });

  it("finds the rise direction of stairs", () => {
    expect(grid.stairsRiseDir(2, 2)).toEqual(DIRS.east);
  });

  it("spawns next to the tower", () => {
    expect(grid.spawnTiles()).toContainEqual({ x: 2, y: 3, layer: "road" });
  });
});

describe("validateMap", () => {
  it("accepts the lattice fixture", () => {
    expect(validateMap(LATTICE_MAP)).toEqual([]);
  });

  it("rejects corridors wider than one tile and walls thicker than one tile", () => {
    // TINY_MAP has open 2x2 road areas (e.g. rows 1-2 at x=6..7) and a 2x2 wall block nowhere, so only the corridor message appears.
    const msgs = validateMap(TINY_MAP).join("\n");
    expect(msgs).toMatch(/corridor wider than one tile/);
    const thick = { ...LATTICE_MAP, rows: LATTICE_MAP.rows.map((r, y) => (y === 3 ? "XS#.....X" : r)) };
    expect(validateMap(thick).join("\n")).toMatch(/wall thicker than one tile/);
  });

  it("waives the width rule inside the tower plaza", () => {
    const plaza = { ...TINY_MAP, plazaRadius: 99 };
    expect(validateMap(plaza).join("\n")).not.toMatch(/corridor wider/);
  });

  it("rejects ragged rows", () => {
    expect(validateMap({ ...TINY_MAP, rows: ["XXX", "XX"] })[0]).toMatch(/row 1/);
  });

  it("rejects key spawns that are unreachable or too few", () => {
    const tooFew = { ...TINY_MAP, supportedParticipants: [4] };
    expect(validateMap(tooFew).join("\n")).toMatch(/only 3 keys spawns/);
    const onWall = { ...TINY_MAP, spawns: { ...TINY_MAP.spawns, keys: [{ x: 3, y: 2, layer: "road" as const }] } };
    expect(validateMap(onWall).join("\n")).toMatch(/not walkable/);
  });

  it("rejects spawn tiles shared across kinds and odd or too few light switches", () => {
    const shared = {
      ...LATTICE_MAP,
      spawns: { ...LATTICE_MAP.spawns, lightSwitches: [{ x: 7, y: 1, layer: "road" as const }, { x: 7, y: 3, layer: "road" as const }] },
    };
    expect(validateMap(shared).join("\n")).toMatch(/lightSwitches spawn 7,1,road collides with keys spawn/);
    expect(validateMap({ ...LATTICE_MAP, lightSwitchCount: 3 }).join("\n")).toMatch(/must be even/);
    expect(validateMap({ ...LATTICE_MAP, lightSwitchCount: 0 }).join("\n")).toMatch(/below the minimum/);
    expect(validateMap({ ...LATTICE_MAP, lightSwitchCount: 4 }).join("\n")).toMatch(/only 2 lightSwitches spawns but 4/);
  });

  it("rejects stairs without a wall", () => {
    const rows = [...TINY_MAP.rows];
    rows[2] = "X.S.....X";
    expect(validateMap({ ...TINY_MAP, rows }).join("\n")).toMatch(/exactly one adjacent wall/);
  });
});
