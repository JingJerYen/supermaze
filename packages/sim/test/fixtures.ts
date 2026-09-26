import type { MapData } from "../src/map/types.js";
import { DEFAULT_TUNING, type Tuning } from "../src/tuning/index.js";

/**
 * Defaults without the start freeze, so a test can move or act on the first
 * tick after `start()`. The freeze itself is covered by startFreeze.test.ts.
 */
export const NO_FREEZE: Tuning = { ...DEFAULT_TUNING, round: { ...DEFAULT_TUNING.round, startFreezeSec: 0 } };

/**
 *   012345678
 * 0 XXXXXXXXX
 * 1 X.......X
 * 2 X....#..X   wall column at x=5 continues north from the bridge
 * 3 X.T..=..X   tower (2,3); bridge (5,3) joins (5,2) and (5,4); road passes under it east-west
 * 4 X....#..X
 * 5 X.S###..X   stairs (2,5) rises east onto the wall (3,5)-(5,5)
 * 6 X.......X
 * 7 XXXXXXXXX
 *
 * The first spawn is the south entry (2,4), so tests walk south onto the stairs
 * and row 6, the straight corridor between the row-5 walls and the border.
 */
export const TINY_MAP: MapData = {
  id: "tiny",
  name: "tiny",
  supportedParticipants: [1],
  lightSwitchCount: 2,
  rows: [
    "XXXXXXXXX",
    "X.......X",
    "X....#..X",
    "X.T..=..X",
    "X....#..X",
    "X.S###..X",
    "X.......X",
    "XXXXXXXXX",
  ],
  spawns: {
    keys: [
      { x: 7, y: 6, layer: "road" },
      { x: 1, y: 1, layer: "road" },
      { x: 4, y: 5, layer: "wallTop" },
    ],
    // Off every path the key/round tests walk; enough for a 5-player round (10) plus spares.
    itemBoxes: [
      { x: 1, y: 6, layer: "road" },
      { x: 2, y: 6, layer: "road" },
      { x: 4, y: 6, layer: "road" },
      { x: 5, y: 6, layer: "road" },
      { x: 6, y: 6, layer: "road" },
      { x: 2, y: 1, layer: "road" },
      { x: 3, y: 1, layer: "road" },
      { x: 4, y: 1, layer: "road" },
      { x: 5, y: 1, layer: "road" },
      { x: 6, y: 1, layer: "road" },
      { x: 7, y: 1, layer: "road" },
      { x: 7, y: 3, layer: "road" },
    ],
    lightSwitches: [
      { x: 3, y: 6, layer: "road" }, // wall (3,5) to the north
      { x: 6, y: 4, layer: "road" }, // wall (5,4) to the west
    ],
  },
};

/**
 * Odd/even lattice fixture that satisfies every validator rule, including the
 * one-tile-wide corridor rule. Odd coordinates are junctions, even ones are
 * walls or gaps.
 *
 *   012345678
 * 0 XXXXXXXXX
 * 1 X.......X
 * 2 X####.##X   wall island A on top; gap at (5,2)
 * 3 XS......X   stairs (1,3) rises north onto (1,2)
 * 4 X.###.##X
 * 5 X.=..T..X   bridge (2,5) joins pillars (2,4) and (2,6); tower (5,5)
 * 6 X##.#.#.X
 * 7 X.......X
 * 8 XXXXXXXXX
 */
export const LATTICE_MAP: MapData = {
  id: "lattice",
  name: "lattice",
  supportedParticipants: [2],
  lightSwitchCount: 2,
  rows: [
    "XXXXXXXXX",
    "X.......X",
    "X####.##X",
    "XS......X",
    "X.###.##X",
    "X.=..T..X",
    "X##.#.#.X",
    "X.......X",
    "XXXXXXXXX",
  ],
  spawns: {
    keys: [
      { x: 7, y: 1, layer: "road" },
      { x: 1, y: 7, layer: "road" },
      { x: 3, y: 2, layer: "wallTop" },
    ],
    itemBoxes: [
      { x: 1, y: 1, layer: "road" },
      { x: 3, y: 1, layer: "road" },
      { x: 3, y: 3, layer: "road" },
      { x: 5, y: 3, layer: "road" },
      { x: 5, y: 7, layer: "road" },
      { x: 7, y: 7, layer: "road" },
    ],
    lightSwitches: [
      { x: 7, y: 3, layer: "road" }, // wall (7,2) to the north
      { x: 1, y: 5, layer: "road" }, // wall (1,6) to the south
    ],
  },
};
