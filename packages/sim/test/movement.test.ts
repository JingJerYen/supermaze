import { describe, expect, it } from "vitest";
import { MapGrid } from "../src/map/grid.js";
import { createMover, intentDirections, moverPosition, stepMover } from "../src/movement.js";
import { TINY_MAP } from "./fixtures.js";

const grid = MapGrid.fromMapData(TINY_MAP);
const east = { moveX: 1, moveY: 0 };
const none = { moveX: 0, moveY: 0 };

describe("stepMover", () => {
  it("starts moving on the first tick", () => {
    const m = stepMover(createMover({ x: 1, y: 1, layer: "road" }), east, grid, 0.25);
    expect(m.target).toEqual({ x: 2, y: 1, layer: "road" });
    expect(m.progress).toBe(0.25);
  });

  it("arrives after 1/speed ticks and immediately begins the next tile", () => {
    let m = createMover({ x: 1, y: 1, layer: "road" });
    for (let i = 0; i < 4; i++) m = stepMover(m, east, grid, 0.25);
    expect(m.from).toEqual({ x: 2, y: 1, layer: "road" });
    expect(m.target).toEqual({ x: 3, y: 1, layer: "road" });
    expect(m.progress).toBe(0);
  });

  it("carries leftover distance across a tile boundary", () => {
    let m = createMover({ x: 1, y: 1, layer: "road" });
    for (let i = 0; i < 3; i++) m = stepMover(m, east, grid, 0.4);
    expect(m.from).toEqual({ x: 2, y: 1, layer: "road" });
    expect(m.progress).toBeCloseTo(0.2, 10);
  });

  it("keeps moving while the intent is held", () => {
    let m = createMover({ x: 1, y: 1, layer: "road" });
    for (let i = 0; i < 8; i++) m = stepMover(m, east, grid, 0.25);
    expect(m.from.x).toBe(3);
  });

  it("stays put when blocked", () => {
    const m = stepMover(createMover({ x: 3, y: 6, layer: "road" }), { moveX: 0, moveY: 1 }, grid, 0.25);
    expect(m.target).toBeNull();
  });

  it("falls back to the secondary axis when the primary is blocked", () => {
    const m = stepMover(createMover({ x: 3, y: 6, layer: "road" }), { moveX: 0.5, moveY: 1 }, grid, 0.25);
    expect(m.target).toEqual({ x: 4, y: 6, layer: "road" });
  });

  it("finishes the current step even when the intent is released", () => {
    let m = stepMover(createMover({ x: 1, y: 1, layer: "road" }), east, grid, 0.25);
    for (let i = 0; i < 4; i++) m = stepMover(m, none, grid, 0.25);
    expect(m.from).toEqual({ x: 2, y: 1, layer: "road" });
    expect(m.target).toBeNull();
  });

  it("interpolates position", () => {
    let m = stepMover(createMover({ x: 1, y: 1, layer: "road" }), east, grid, 0.25);
    m = stepMover(m, east, grid, 0.25);
    expect(moverPosition(m)).toEqual({ x: 1.5, y: 1 });
  });
});

describe("intentDirections", () => {
  it("orders the dominant axis first", () => {
    expect(intentDirections({ moveX: 0.3, moveY: -1 })).toEqual([
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
    ]);
  });

  it("returns nothing for no intent", () => {
    expect(intentDirections(none)).toEqual([]);
  });
});
