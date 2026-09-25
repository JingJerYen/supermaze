import type { MapData } from "../src/map/types.js";

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
  spawns: { keys: [], itemBoxes: [], lightSwitches: [] },
};
