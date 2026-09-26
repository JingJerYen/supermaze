import * as THREE from "three";
import { CLIENT_TUNING } from "../tuning.js";
import { models } from "./models.js";

/**
 * Model factories. Each returns an Object3D whose origin sits on the ground at
 * the tile centre. A real .glb from public/models/ (see models.ts) is used when
 * present; otherwise the hand-built placeholder below.
 */

export function createKeyModel(): THREE.Object3D {
  const real = models.instantiate("key");
  if (real) return real;
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffd23f });
  const head = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.04, 8, 16), mat);
  head.position.y = 0.55;
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.06), mat);
  shaft.position.y = 0.3;
  const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.06), mat);
  tooth.position.set(0.06, 0.2, 0);
  group.add(head, shaft, tooth);
  return group;
}

/** Tall, unlit beam so a key is visible from afar even when the map is dark. */
export function createKeyBeam(): THREE.Object3D {
  const { height, radius, opacity, color } = CLIENT_TUNING.keyBeam;
  const geo = new THREE.CylinderGeometry(radius, radius * 0.6, height, 12, 1, true);
  // Fade toward the top by baking alpha into vertex colours.
  const pos = geo.attributes["position"] as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 4);
  const c = new THREE.Color(color);
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) + height / 2) / height; // 0 bottom .. 1 top
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
  beam.position.y = height / 2 + 0.3;
  return beam;
}

export function createBoxModel(): THREE.Object3D {
  const real = models.instantiate("box");
  if (real) return real;
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.36, 0.42), new THREE.MeshLambertMaterial({ color: 0x8a5a2b }));
  body.position.y = 0.18;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.14, 0.46), new THREE.MeshLambertMaterial({ color: 0xb07a3c }));
  lid.position.y = 0.43;
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.1), new THREE.MeshLambertMaterial({ color: 0xd9c27a }));
  band.position.y = 0.3;
  group.add(body, lid, band);
  return group;
}
