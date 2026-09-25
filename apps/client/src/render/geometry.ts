import * as THREE from "three";

/**
 * Unit wedge: flat at z=-0.5, one unit high at z=+0.5. Rotate about Y so +Z
 * points in the stairs' rise direction.
 */
export function createRampGeometry(): THREE.BufferGeometry {
  const A = [-0.5, 0, -0.5];
  const B = [0.5, 0, -0.5];
  const C = [0.5, 0, 0.5];
  const D = [-0.5, 0, 0.5];
  const E = [0.5, 1, 0.5];
  const F = [-0.5, 1, 0.5];
  const tris = [
    A, E, B, A, F, E, // slope
    D, C, E, D, E, F, // back
    B, E, C, // right
    A, D, F, // left
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(tris.flat(), 3));
  geo.computeVertexNormals();
  return geo;
}
