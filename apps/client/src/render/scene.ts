import * as THREE from "three";
import { CLIENT_TUNING } from "../tuning.js";

/** Empty lit scene. Map and players are added by the caller. */
export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CLIENT_TUNING.render.clearColor);

  const ambient = new THREE.HemisphereLight(0xdfe8ff, 0x303540, 1.0);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(6, 12, 4);
  scene.add(ambient, sun);
  return scene;
}
