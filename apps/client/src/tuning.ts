/**
 * Client-only feel parameters: camera, rendering, interpolation.
 * Game-rule numbers live in @supermaze/sim, not here.
 */
export const CLIENT_TUNING = {
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
    shaftHeight: 7,
    /** Shaft footprint side length; the map footprint can be wider than this. */
    shaftWidth: 1.2,
    /** How much wider than the map footprint the top platform is, per side. */
    platformOverhang: 0.8,
    platformThickness: 0.35,
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
