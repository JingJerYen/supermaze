import { describe, expect, it } from "vitest";
import { DIRS, MapGrid } from "../src/map/grid.js";
import { createMover, stepMover } from "../src/movement.js";
import { TINY_MAP } from "./fixtures.js";

const grid = MapGrid.fromMapData(TINY_MAP);
const E = { moveX: 1, moveY: 0 };
const W = { moveX: -1, moveY: 0 };
const S = { moveX: 0, moveY: 1 };
const none = { moveX: 0, moveY: 0 };
const speed = 0.25;
const delay = 2;

describe("tap to turn, hold to walk", () => {
  it("a tap in a new direction turns without moving", () => {
    let m = createMover({ x: 1, y: 1, layer: "road" }); // faces south by default
    m = stepMover(m, E, grid, speed, undefined, delay);
    expect(m.facing).toEqual(DIRS.east);
    expect(m.target).toBeNull();
    m = stepMover(m, none, grid, speed, undefined, delay);
    expect(m.target).toBeNull();
    expect(m.turnHold).toBe(0);
  });

  it("holding through the delay starts walking", () => {
    let m = createMover({ x: 1, y: 1, layer: "road" });
    m = stepMover(m, E, grid, speed, undefined, delay); // turn
    for (let i = 0; i < delay; i++) {
      m = stepMover(m, E, grid, speed, undefined, delay);
      expect(m.target).toBeNull();
    }
    m = stepMover(m, E, grid, speed, undefined, delay);
    expect(m.target).toEqual({ x: 2, y: 1, layer: "road" });
  });

  it("pushing the direction already faced moves at once", () => {
    let m = createMover({ x: 1, y: 1, layer: "road" }, DIRS.east);
    m = stepMover(m, E, grid, speed, undefined, delay);
    expect(m.target).toEqual({ x: 2, y: 1, layer: "road" });
  });

  it("changing direction while already walking has no delay at the tile boundary", () => {
    let m = createMover({ x: 1, y: 1, layer: "road" }, DIRS.east);
    for (let i = 0; i < 3; i++) m = stepMover(m, E, grid, speed, undefined, delay); // 0.75 of the way
    m = stepMover(m, S, grid, speed, undefined, delay); // arrives at (2,1) and turns south... (2,2) is the stairs: walkable
    expect(m.from).toEqual({ x: 2, y: 1, layer: "road" });
    expect(m.facing).toEqual(DIRS.south);
    expect(m.target).toEqual({ x: 2, y: 2, layer: "road" });
  });

  it("a second tap another way re-turns and restarts the hold", () => {
    let m = createMover({ x: 3, y: 1, layer: "road" });
    m = stepMover(m, E, grid, speed, undefined, delay);
    m = stepMover(m, E, grid, speed, undefined, delay);
    m = stepMover(m, W, grid, speed, undefined, delay);
    expect(m.facing).toEqual(DIRS.west);
    expect(m.turnHold).toBe(delay);
    expect(m.target).toBeNull();
  });

  it("with no delay configured, behaviour is the old immediate start", () => {
    let m = createMover({ x: 1, y: 1, layer: "road" });
    m = stepMover(m, E, grid, speed);
    expect(m.target).toEqual({ x: 2, y: 1, layer: "road" });
  });
});
