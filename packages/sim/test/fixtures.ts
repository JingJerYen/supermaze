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
 * 2 X.S###..X   stairs (2,2) rises east onto the wall (3,2)-(5,2)
 * 3 X....#..X   wall continues south at x=5
 * 4 X.T..=..X   bridge (5,4) joins (5,3) and (5,5); road passes under it east-west
 * 5 X....#..X
 * 6 X.......X
 * 7 XXXXXXXXX
 */
export const TINY_MAP: MapData = {
  id: "tiny",
  name: "tiny",
  supportedParticipants: [1],
  lightSwitchCount: 2,
  rows: [
    "XXXXXXXXX",
    "X.......X",
    "X.S###..X",
    "X....#..X",
    "X.T..=..X",
    "X....#..X",
    "X.......X",
    "XXXXXXXXX",
  ],
  spawns: {
    keys: [
      { x: 7, y: 1, layer: "road" },
      { x: 1, y: 6, layer: "road" },
      { x: 4, y: 2, layer: "wallTop" },
    ],
    // Off every path the key/round tests walk; enough for a 5-player round (10) plus spares.
    itemBoxes: [
      { x: 1, y: 1, layer: "road" },
      { x: 2, y: 1, layer: "road" },
      { x: 4, y: 1, layer: "road" },
      { x: 5, y: 1, layer: "road" },
      { x: 6, y: 1, layer: "road" },
      { x: 2, y: 6, layer: "road" },
      { x: 3, y: 6, layer: "road" },
      { x: 4, y: 6, layer: "road" },
      { x: 5, y: 6, layer: "road" },
      { x: 6, y: 6, layer: "road" },
      { x: 7, y: 6, layer: "road" },
      { x: 7, y: 4, layer: "road" },
    ],
    lightSwitches: [
      { x: 3, y: 1, layer: "road" }, // wall (3,2) to the south
      { x: 6, y: 3, layer: "road" }, // wall (5,3) to the west
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
