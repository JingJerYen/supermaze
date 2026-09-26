import * as THREE from "three";
import { CLIENT_TUNING } from "../tuning.js";

/** Empty scene with the background colour. Lights are owned by SceneLighting. */
export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CLIENT_TUNING.render.clearColor);
  return scene;
}
