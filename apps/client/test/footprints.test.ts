import { MapGrid } from "@supermaze/sim";
import { describe, expect, it } from "vitest";
import { MAP_POOL } from "../src/maps.js";
import { FootTrail } from "../src/render/footprints.js";

const grid = MapGrid.fromMapData(MAP_POOL.find((m) => m.id === "maze-18")!);
const road = (x: number, y: number) => ({ x, y, layer: "road" as const });

describe("footprint trail", () => {
  it("records each new tile once, heading the way the player walked", () => {
    const trail = new FootTrail(30);
    for (const x of [1, 1, 2, 2, 3]) trail.visit(road(x, 1), grid);
    expect(trail.list.map((s) => s.tile.x)).toEqual([1, 2, 3]);
    expect(trail.list[2]).toMatchObject({ dx: 1, dy: 0 });
  });

  it("keeps only the last steps", () => {
    const trail = new FootTrail(3);
    for (let x = 1; x <= 6; x++) trail.visit(road(x, 1), grid);
    expect(trail.list.map((s) => s.tile.x)).toEqual([4, 5, 6]);
  });

  it("leaves no prints on stairs, and none at all when off", () => {
    const trail = new FootTrail(30);
    trail.visit(road(6, 3), grid);
    trail.visit(road(7, 3), grid); // the stair at (7, 3)
    expect(trail.list.map((s) => s.tile.x)).toEqual([6]);
    const off = new FootTrail(0);
    off.visit(road(1, 1), grid);
    expect(off.list).toHaveLength(0);
  });
});
