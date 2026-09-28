export interface Point3 {
  x: number;
  y: number;
  z: number;
}

/** Axis-aligned box in world units. */
export interface Box3 {
  min: Point3;
  max: Point3;
}

/**
 * Whether the straight line of sight from `eye` to `target` passes through
 * `box` grown by `margin` on every side (the target is a character with some
 * width, not a point). Pure geometry, slab method; no rendering involved.
 */
export function sightBlocked(eye: Point3, target: Point3, box: Box3, margin = 0): boolean {
  let tMin = 0;
  let tMax = 1;
  for (const axis of ["x", "y", "z"] as const) {
    const from = eye[axis];
    const dir = target[axis] - from;
    const lo = box.min[axis] - margin;
    const hi = box.max[axis] + margin;
    if (Math.abs(dir) < 1e-9) {
      if (from < lo || from > hi) return false;
      continue;
    }
    let a = (lo - from) / dir;
    let b = (hi - from) / dir;
    if (a > b) [a, b] = [b, a];
    tMin = Math.max(tMin, a);
    tMax = Math.min(tMax, b);
    if (tMin > tMax) return false;
  }
  return true;
}
