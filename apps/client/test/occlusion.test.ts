import { describe, expect, it } from "vitest";
import { sightBlocked, type Box3 } from "../src/render/occlusion.js";
import { CLIENT_TUNING } from "../src/tuning.js";

// A shaft like the game's: centred on (10,7), 1.6 wide, 12 tall.
const shaft: Box3 = { min: { x: 9.2, y: 0, z: 6.2 }, max: { x: 10.8, y: 12, z: 7.8 } };
const { height, distance } = CLIENT_TUNING.camera;
/** The follow camera for a player standing on (x, z): above and to the south. */
const eyeFor = (x: number, z: number) => ({ x, y: height + 0.45, z: z + distance });
const chest = (x: number, z: number) => ({ x, y: 0.45, z });

describe("sightBlocked", () => {
  it("hides a player straight behind the tower, near or far", () => {
    expect(sightBlocked(eyeFor(10, 5), chest(10, 5), shaft, 0.3)).toBe(true); // the north door
    expect(sightBlocked(eyeFor(10, 1), chest(10, 1), shaft, 0.3)).toBe(true);
  });

  it("does not hide a player in front of it or beside it", () => {
    expect(sightBlocked(eyeFor(10, 9), chest(10, 9), shaft, 0.3)).toBe(false); // the south door
    expect(sightBlocked(eyeFor(12, 7), chest(12, 7), shaft, 0.3)).toBe(false); // the east door
    expect(sightBlocked(eyeFor(13, 3), chest(13, 3), shaft, 0.3)).toBe(false);
  });

  it("stops hiding once the player is far enough behind for the camera to see over the top", () => {
    // The sight line climbs `height` per `distance`; beyond this the line clears a 12-tall shaft.
    const clear = 7 - (12 / height) * distance - 2;
    expect(sightBlocked(eyeFor(10, clear), chest(10, clear), shaft, 0.3)).toBe(false);
  });
});
