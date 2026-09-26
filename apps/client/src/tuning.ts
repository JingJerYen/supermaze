/**
 * Client-only feel parameters: camera, rendering, interpolation.
 * Game-rule numbers live in @supermaze/sim, not here.
 */
export const CLIENT_TUNING = {
  overview: {
    /** Extra room around the map when looking straight down from the tower, as a factor. */
    margin: 1.08,
    /** Blend speed of the camera swing between follow and overview, per second. */
    transitionPerSec: 3,
  },
  camera: {
    /** Height above the focus point, world units (1 unit = 1 tile). Kept near the tower platform height so the platform reads edge-on and occludes little. */
    height: 8,
    /** Horizontal distance behind the focus point. */
    distance: 9,
    fovDeg: 45,
    /** Exponential follow smoothing per second. Higher = snappier, lower = floatier. */
    followLerpPerSec: 10,
  },
  tower: {
    /** Height of the slender shaft, world units (1 unit = 1 tile). */
    shaftHeight: 12,
    /** Shaft footprint side length; the map footprint can be wider than this. */
    shaftWidth: 1.2,
    /** Platform overhang per side. Must equal the sim's PLATFORM_RING (1 tile) so the walkable tiles match the slab. */
    platformOverhang: 1,
    platformThickness: 0.35,
    /** Platform slab opacity seen from the maze (follow camera). */
    platformOpacityFollow: 0.55,
    /** Platform and shaft opacity while looking straight down from the tower top. */
    platformOpacityOverview: 0.12,
    shaftOpacityOverview: 0.25,
    /** Low base covering the whole footprint so the blocked tiles read as tower ground. */
    baseHeight: 0.3,
  },
  keyBeam: {
    /** World units above the key. */
    height: 3.5,
    radius: 0.12,
    /** Alpha at the base; fades to 0 at the top. */
    opacity: 0.55,
    color: 0xffe08a,
  },
  dark: {
    /** Residual ambient light when the map is dark; 0 is pitch black outside the circle. */
    ambient: 0.04,
    lampIntensity: 12,
    /** Higher decay = sharper edge to the visible circle. */
    lampDecay: 2,
    /** Background colour while dark. */
    clearColor: 0x05060a,
  },
  render: {
    /** Cap the device pixel ratio to keep phones smooth. */
    maxPixelRatio: 2,
    clearColor: 0x101318,
  },
  loop: {
    /** Largest frame delta we accept, seconds. Tab switches must not teleport players. */
    maxFrameDeltaSec: 0.25,
  },
} as const;
