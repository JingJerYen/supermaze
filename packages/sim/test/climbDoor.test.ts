import { describe, expect, it } from "vitest";
import { DIRS, MapGrid } from "../src/map/grid.js";
import type { MapData } from "../src/map/types.js";
import { validateMap } from "../src/map/validate.js";
import { Simulation, type PlayerInput } from "../src/simulation.js";
import { LATTICE_MAP, NO_FREEZE } from "./fixtures.js";
import { walk } from "./walk.js";

const still: PlayerInput = { moveX: 0, moveY: 0 };
const press: PlayerInput = { ...still, action: true };

/**
 * Open floor around a 3x3 tower, so entry tiles that are not doors exist.
 *
 *   012345678
 * 3 X..TTT..X   doors: north (4,2), east (6,4), west (2,4), south (4,6)
 * 4 X..TTT..X
 * 5 X..TTT..X
 */
const BIG: MapData = {
  id: "big-tower",
  name: "big tower",
  supportedParticipants: [1],
  lightSwitchCount: 2,
  rows: ["XXXXXXXXX", "X.......X", "X.......X", "X..TTT..X", "X..TTT..X", "X..TTT..X", "X.......X", "X.#...#.X", "XXXXXXXXX"],
  spawns: {
    keys: [{ x: 4, y: 6, layer: "road" }], // under the first spawn (south door)
    itemBoxes: [{ x: 1, y: 1, layer: "road" }, { x: 7, y: 1, layer: "road" }],
    lightSwitches: [{ x: 1, y: 7, layer: "road" }, { x: 7, y: 7, layer: "road" }], // walls at (2,7) and (6,7)
  },
};
const one = [{ id: "a", teamId: "A", controller: "human" as const }];

describe("tower doors (CLAUDE.md section 5)", () => {
  const grid = MapGrid.fromMapData(BIG);

  it("are the centre tile outside each face, and only those", () => {
    expect(grid.doorTiles()).toEqual([
      { x: 4, y: 6, layer: "road" },
      { x: 6, y: 4, layer: "road" },
      { x: 2, y: 4, layer: "road" },
      { x: 4, y: 2, layer: "road" },
    ]);
    expect(grid.doorDir(4, 6)).toEqual(DIRS.north);
    expect(grid.doorDir(6, 4)).toEqual(DIRS.west);
    // A corner-adjacent entry tile is still an entry (no placements there) but not a door.
    expect(grid.isTowerEntry(3, 6)).toBe(true);
    expect(grid.doorDir(3, 6)).toBeNull();
    expect(grid.doorDir(4, 7)).toBeNull();
  });

  it("climbing needs a key, a door tile and facing the door", () => {
    const sim = new Simulation({ seed: 1, map: BIG, participants: one, tuning: NO_FREEZE });
    sim.start();
    sim.step(new Map()); // key underfoot on the south door tile (4,6); facing south by default
    const a = () => sim.getState().players["a"]!;
    expect(a().keyId).not.toBeNull();
    expect(sim.availableAction(a())).toBeNull();
    sim.step(new Map([["a", press]]));
    expect(a().phase).toBe("maze");

    // Tap north: turns to face the door without moving.
    sim.step(new Map([["a", { moveX: 0, moveY: -1 }]]));
    expect(a().mover.from).toEqual({ x: 4, y: 6, layer: "road" });
    expect(sim.availableAction(a())).toBe("climb");

    // Step aside to (3,6): touches the tower but is no door, whichever way a faces.
    walk(sim, "a", [{ moveX: -1, moveY: 0 }]);
    expect(a().mover.from).toEqual({ x: 3, y: 6, layer: "road" });
    sim.step(new Map([["a", { moveX: 0, moveY: -1 }]]));
    expect(sim.availableAction(a())).toBeNull();

    // Back on the door, facing it: climbs.
    walk(sim, "a", [{ moveX: 1, moveY: 0 }]);
    sim.step(new Map([["a", { moveX: 0, moveY: -1 }]]));
    const ev = sim.step(new Map([["a", press]]));
    expect(ev.map((e) => e.type)).toContain("towerClimbed");
    expect(a().phase).toBe("tower");
  });

  it("validator rejects even-sided or hollow tower footprints", () => {
    const even = { ...LATTICE_MAP, rows: LATTICE_MAP.rows.map((r, y) => (y === 5 ? "X.=..TT.X" : r)) };
    expect(validateMap(even).join("\n")).toMatch(/both sides must be odd/);
    const hollow = { ...BIG, rows: BIG.rows.map((r, y) => (y === 4 ? "X..T.T..X" : r)) };
    expect(validateMap(hollow).join("\n")).toMatch(/filled rectangle/);
  });
});
