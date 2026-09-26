import * as THREE from "three";
import type { Dir } from "@supermaze/sim";
import { CLIENT_TUNING } from "../tuning.js";

/**
 * Programmatic models for placed items: low-poly, flat colours, clear outlines,
 * matching the toon characters. Each factory returns a group whose origin is the
 * tile centre on the ground. Animated parts are found by name in PlaceableViews.
 */

const lambert = (color: number, extra: Partial<THREE.MeshLambertMaterialParameters> = {}) =>
  new THREE.MeshLambertMaterial({ color, ...extra });

/** One-way door: two posts and a lintel, a translucent energy pane, and a floor arrow showing the way through. */
export function createOneWayDoor(dir: Dir): THREE.Object3D {
  const g = new THREE.Group();
  const frame = lambert(0x2f3b52);
  const post = new THREE.BoxGeometry(0.1, 0.95, 0.1);
  for (const x of [-0.42, 0.42]) {
    const p = new THREE.Mesh(post, frame);
    p.position.set(x, 0.475, 0);
    g.add(p);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.1, 0.12), frame);
  lintel.position.set(0, 0.95, 0);
  g.add(lintel);

  const pane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.76, 0.86),
    new THREE.MeshBasicMaterial({ color: 0x5eb8ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  pane.position.set(0, 0.47, 0);
  pane.name = "pane";
  g.add(pane);

  // Floor arrow along +Z (the pass direction): a stem plus a triangular head.
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.9, depthWrite: false });
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.45), arrowMat);
  stem.position.set(0, 0.02, -0.05);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.28, 3), arrowMat);
  head.rotation.x = Math.PI / 2; // cone axis along +Z, tip toward +Z
  head.position.set(0, 0.02, 0.3);
  g.add(stem, head);

  g.rotation.y = Math.atan2(dir.dx, dir.dy);
  return g;
}

/** Obstacle: a striped road barrier on two feet, spanning the whole tile. */
export function createObstacle(): THREE.Object3D {
  const g = new THREE.Group();
  const orange = lambert(0xf28c28);
  const white = lambert(0xf4f1ea);
  const dark = lambert(0x2b2f3a);
  const segments = 5;
  const segW = 0.9 / segments;
  for (let i = 0; i < segments; i++) {
    const upper = new THREE.Mesh(new THREE.BoxGeometry(segW, 0.26, 0.12), i % 2 ? white : orange);
    upper.position.set(-0.45 + segW * (i + 0.5), 0.58, 0);
    const lower = new THREE.Mesh(new THREE.BoxGeometry(segW, 0.16, 0.1), i % 2 ? orange : white);
    lower.position.set(-0.45 + segW * (i + 0.5), 0.28, 0);
    g.add(upper, lower);
  }
  for (const x of [-0.4, 0.4]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.36), dark);
    leg.position.set(x, 0.36, 0);
    g.add(leg);
  }
  return g;
}

/** Trap: a dark red disc with four spikes that slowly turn and a pulsing core. */
export function createTrap(): THREE.Object3D {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.06, 8), lambert(0x7f1d1d));
  disc.position.y = 0.03;
  const spikes = new THREE.Group();
  spikes.name = "spikes";
  const spikeMat = lambert(0xfca5a5);
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.26, 4), spikeMat);
    const a = (i / 4) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.2, 0.19, Math.sin(a) * 0.2);
    spikes.add(s);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshLambertMaterial({ color: 0xff3b3b, emissive: 0x5a0000 }));
  core.position.y = 0.12;
  core.name = "core";
  g.add(disc, spikes, core);
  return g;
}

/** Teleport node: team-coloured floor pad, white inner ring (turns when paired) and a beam like the keys'. */
export function createTeleportNode(teamColor: number): THREE.Object3D {
  const g = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 10), lambert(teamColor));
  pad.position.y = 0.03;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 24), lambert(0x1b1f2a));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.06;

  // Ring lies flat; notches make its rotation visible.
  const ring = new THREE.Group();
  ring.name = "ring";
  ring.position.y = 0.075;
  const ringMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 0.3, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
  );
  ringMesh.rotation.x = -Math.PI / 2;
  ring.add(ringMesh);
  for (const a of [0, Math.PI]) {
    const notch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.06), new THREE.MeshBasicMaterial({ color: 0x1b1f2a }));
    notch.position.set(Math.cos(a) * 0.25, 0.002, Math.sin(a) * 0.25);
    notch.rotation.y = -a;
    ring.add(notch);
  }

  const beam = createBeam(teamColor, CLIENT_TUNING.teleportBeam.height, CLIENT_TUNING.teleportBeam.opacity);
  beam.name = "beam";
  beam.visible = false;
  g.add(pad, rim, ring, beam);
  return g;
}

/** Vertical unlit beam fading toward the top; shared by keys and paired teleport nodes. */
export function createBeam(color: number, height: number, opacity: number, radius = 0.12): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(radius, radius * 0.6, height, 12, 1, true);
  const pos = geo.attributes["position"] as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 4);
  const c = new THREE.Color(color);
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) + height / 2) / height;
    colors[i * 4] = c.r;
    colors[i * 4 + 1] = c.g;
    colors[i * 4 + 2] = c.b;
    colors[i * 4 + 3] = (1 - t) * opacity;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 4));
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(geo, mat);
  beam.position.y = height / 2 + 0.1;
  return beam;
}
