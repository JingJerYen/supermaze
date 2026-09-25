import { describe, expect, it } from "vitest";
import { DIRS, MapGrid } from "../src/map/grid.js";
import { validateMap } from "../src/map/validate.js";
import { TINY_MAP } from "./fixtures.js";

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
  it("accepts the tiny fixture", () => {
    expect(validateMap(TINY_MAP)).toEqual([]);
  });

  it("rejects ragged rows", () => {
    expect(validateMap({ ...TINY_MAP, rows: ["XXX", "XX"] })[0]).toMatch(/row 1/);
  });

  it("rejects key spawns that are unreachable or too few", () => {
    const tooFew = { ...TINY_MAP, supportedParticipants: [4] };
    expect(validateMap(tooFew).join("\n")).toMatch(/only 3 key spawns/);
    const onWall = { ...TINY_MAP, spawns: { ...TINY_MAP.spawns, keys: [{ x: 3, y: 2, layer: "road" as const }] } };
    expect(validateMap(onWall).join("\n")).toMatch(/not walkable/);
  });

  it("rejects stairs without a wall", () => {
    const rows = [...TINY_MAP.rows];
    rows[2] = "X.S.....X";
    expect(validateMap({ ...TINY_MAP, rows }).join("\n")).toMatch(/exactly one adjacent wall/);
  });
});
