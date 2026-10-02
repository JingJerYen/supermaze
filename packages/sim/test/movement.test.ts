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

  it("a diagonal push while walking turns at the first opening and goes straight until then", () => {
    // Along the bottom row eastwards with east+north held: the wall above ends at x = 6.
    const upRight = { moveX: 1, moveY: -1 };
    let m = createMover({ x: 3, y: 6, layer: "road" }, { dx: 1, dy: 0 });
    let turnedAt: number | null = null;
    for (let i = 0; i < 40 && turnedAt === null; i++) {
      m = stepMover(m, upRight, grid, 0.5, undefined, 2);
      if (m.target && m.target.y === 5) turnedAt = m.from.x;
    }
    expect(turnedAt).toBe(6);
  });

  it("after the turn the old heading becomes the turn: a staircase", () => {
    // Walking north up x = 6 with north+east held: arriving at (6, 5), east is open, so it turns east.
    const walking = { ...createMover({ x: 6, y: 6, layer: "road" }, { dx: 0, dy: -1 }), target: { x: 6, y: 5, layer: "road" as const }, progress: 0.9 };
    const m = stepMover(walking, { moveX: 1, moveY: -1 }, grid, 0.5, undefined, 2);
    expect(m.from).toEqual({ x: 6, y: 5, layer: "road" });
    expect(m.target).toEqual({ x: 7, y: 5, layer: "road" });
  });

  it("a diagonal push from a standstill walks the way the player faces, without flipping", () => {
    let m = createMover({ x: 6, y: 3, layer: "road" }, { dx: 0, dy: 1 });
    // Facing south with south and east both open: walks south at once, no turning on the spot.
    m = stepMover(m, { moveX: 1, moveY: 1 }, grid, 0.5, undefined, 2);
    expect(m.facing).toEqual({ dx: 0, dy: 1 });
    expect(m.target).toEqual({ x: 6, y: 4, layer: "road" });
  });

  it("a diagonal push from a standstill does not turn to face a wall", () => {
    // Facing east under the wall: north is blocked, so it walks east without turning.
    const m = stepMover(createMover({ x: 3, y: 6, layer: "road" }, { dx: 1, dy: 0 }), { moveX: 1, moveY: -1 }, grid, 0.5, undefined, 2);
    expect(m.facing).toEqual({ dx: 1, dy: 0 });
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
