/**
 * Client-only feel parameters: camera, rendering, interpolation.
 * Game-rule numbers live in @supermaze/sim, not here.
 */
export const CLIENT_TUNING = {
  camera: {
    /** Height above the ground plane, world units (1 unit = 1 tile). */
    height: 14,
    /** Horizontal distance behind the focus point. */
    distance: 10,
    fovDeg: 45,
    /** Exponential follow smoothing per second. Higher = snappier. */
    followLerpPerSec: 8,
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
