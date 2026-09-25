import * as THREE from "three";
import { DEFAULT_TUNING, Simulation } from "@supermaze/sim";
import { DebugOverlay } from "./debug.js";
import { startLoop } from "./loop.js";
import { createGameCamera, updateCameraFocus } from "./render/camera.js";
import { createPlaceholderScene } from "./render/scene.js";
import { CLIENT_TUNING } from "./tuning.js";

const root = document.getElementById("app");
if (!root) throw new Error("#app not found");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, CLIENT_TUNING.render.maxPixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
root.appendChild(renderer.domElement);

const { scene, player } = createPlaceholderScene();
const camera = createGameCamera(window.innerWidth / window.innerHeight);
const debug = new DebugOverlay(root);

// Local single-player simulation. In phase 2 the server owns this and the client
// only renders snapshots.
const sim = new Simulation({
  seed: 1,
  participants: [{ id: "local", teamId: "t1", controller: "human" }],
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const tickSec = 1 / DEFAULT_TUNING.tickRate;

startLoop(
  DEFAULT_TUNING.tickRate,
  () => {
    sim.step(new Map());
  },
  () => {
    updateCameraFocus(camera, player.position, tickSec);
    renderer.render(scene, camera);
    debug.frame({ tick: sim.getState().tick, objects: scene.children.length });
  },
);
