import * as THREE from "three";
import type { Dir } from "@supermaze/sim";

/**
 * Stairs and bridges as small built structures instead of a bare wedge and slab.
 * Each factory returns a group whose origin is the tile centre on the ground.
 */

const STEP = 0xc2a96a;
const STEP_ALT = 0xb39a5e;
const CURB = 0x8e9bb3;
const PLANK = 0xb08a5a;
const PLANK_ALT = 0xa07c4f;
const RAIL = 0x6d5436;

/** `rise` points from the stairs tile toward the wall it climbs onto. */
export function createStairs(rise: Dir, steps = 5): THREE.Object3D {
  const g = new THREE.Group();
  const stepMat = new THREE.MeshLambertMaterial({ color: STEP });
  const stepAltMat = new THREE.MeshLambertMaterial({ color: STEP_ALT });
  const curbMat = new THREE.MeshLambertMaterial({ color: CURB });
  const width = 0.9;
  const depth = 1 / steps;
  // Local frame: +Z is the rise direction (toward the wall); the tile spans z in [-0.5, 0.5].
  for (let i = 0; i < steps; i++) {
    const h = ((i + 1) / steps) * 1.0;
    const box = new THREE.Mesh(new THREE.BoxGeometry(width, h, depth), i % 2 ? stepAltMat : stepMat);
    box.position.set(0, h / 2, -0.5 + depth * (i + 0.5));
    g.add(box);
  }
  // Low curbs along both open sides so the run reads as a staircase from any angle.
  for (const side of [-1, 1]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 1.0), curbMat);
    curb.position.set(side * (width / 2 + 0.03), 0.5, 0);
    // Slant the curb top by using a wedge-like scale trick: simply keep it a slab; the steps carry the read.
    g.add(curb);
  }
  g.rotation.y = Math.atan2(rise.dx, rise.dy);
  return g;
}

/**
 * Plank deck at wall-top height with railings on the two open sides.
 * `along` is the direction the deck runs (from one wall to the other).
 */
export function createBridge(along: Dir, deckTopY = 1.0): THREE.Object3D {
  const g = new THREE.Group();
  const plankMat = new THREE.MeshLambertMaterial({ color: PLANK });
  const plankAltMat = new THREE.MeshLambertMaterial({ color: PLANK_ALT });
  const railMat = new THREE.MeshLambertMaterial({ color: RAIL });
  const thickness = 0.12;
  const width = 0.9;
  // Local frame: deck runs along +Z.
  const planks = 6;
  const plankLen = 1 / planks;
  for (let i = 0; i < planks; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(width, thickness, plankLen * 0.86), i % 2 ? plankAltMat : plankMat);
    p.position.set(0, deckTopY - thickness / 2, -0.5 + plankLen * (i + 0.5));
    g.add(p);
  }
  // Two stringers under the deck.
  for (const side of [-1, 1]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 1.0), railMat);
    beam.position.set(side * 0.3, deckTopY - thickness - 0.07, 0);
    g.add(beam);
  }
  // Railings: posts at both ends and a top rail, on each open side.
  const railH = 0.42;
  for (const side of [-1, 1]) {
    const x = side * (width / 2 - 0.03);
    for (const z of [-0.42, 0, 0.42]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, railH, 0.06), railMat);
      post.position.set(x, deckTopY + railH / 2, z);
      g.add(post);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 1.0), railMat);
    top.position.set(x, deckTopY + railH, 0);
    g.add(top);
  }
  g.rotation.y = Math.atan2(along.dx, along.dy);
  return g;
}
