import * as THREE from "three";
import { CLIENT_TUNING } from "../tuning.js";

/**
 * Placeholder scene for the phase-0 render spike: a ground plane, a wall block one
 * level high, and a player marker. Real map rendering replaces this in phase 1.
 */
export function createPlaceholderScene(): { scene: THREE.Scene; player: THREE.Mesh } {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CLIENT_TUNING.render.clearColor);

  const ambient = new THREE.HemisphereLight(0xdfe8ff, 0x303540, 1.0);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(6, 12, 4);
  scene.add(ambient, sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshLambertMaterial({ color: 0x4d5a6d }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // One wall segment: 1 tile wide, 1 tile high, 6 tiles long. Its top is a walkable layer.
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 6),
    new THREE.MeshLambertMaterial({ color: 0x8e9bb3 }),
  );
  wall.position.set(2, 0.5, 0);
  scene.add(wall);

  const player = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.9, 0.6),
    new THREE.MeshLambertMaterial({ color: 0xffb347 }),
  );
  player.position.set(0, 0.45, 0);
  scene.add(player);

  return { scene, player };
}
