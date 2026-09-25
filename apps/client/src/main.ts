import * as THREE from "three";
import { DEFAULT_TUNING, Simulation, type MapData, type MoverState } from "@supermaze/sim";
import testMap from "../../../content/maps/test-01.json";
import { DebugOverlay } from "./debug.js";
import { InputSource } from "./input/index.js";
import { startLoop } from "./loop.js";
import { FollowCamera } from "./render/camera.js";
import { buildMapMesh } from "./render/mapMesh.js";
import { PlayerView } from "./render/playerView.js";
import { createScene } from "./render/scene.js";
import { CLIENT_TUNING } from "./tuning.js";

const root = document.getElementById("app");
if (!root) throw new Error("#app not found");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, CLIENT_TUNING.render.maxPixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
root.appendChild(renderer.domElement);

// Local single-player simulation. In phase 2 the server owns this and the client
// only renders snapshots.
const LOCAL_ID = "local";
const sim = new Simulation({
  seed: 1,
  map: testMap as MapData,
  participants: [{ id: LOCAL_ID, teamId: "t1", controller: "human" }],
});

const scene = createScene();
scene.add(buildMapMesh(sim.grid));
const playerView = new PlayerView(0xffb347);
scene.add(playerView.mesh);

const follow = new FollowCamera(window.innerWidth / window.innerHeight);
const input = new InputSource(root);
const debug = new DebugOverlay(root);

window.addEventListener("resize", () => {
  follow.resize(window.innerWidth / window.innerHeight);
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const tickSec = 1 / DEFAULT_TUNING.tickRate;
let lastFrame = performance.now();
// Mover state from the previous tick, kept for render interpolation.
let prevMover: MoverState | null = null;

startLoop(
  DEFAULT_TUNING.tickRate,
  () => {
    prevMover = sim.getState().players[LOCAL_ID]?.mover ?? null;
    sim.step(new Map([[LOCAL_ID, input.read()]]));
  },
  (alpha) => {
    const now = performance.now();
    const dt = Math.min((now - lastFrame) / 1000, tickSec * 4);
    lastFrame = now;

    const me = sim.getState().players[LOCAL_ID];
    if (!me) return;
    playerView.update(sim.grid, prevMover ?? me.mover, me.mover, alpha);
    follow.update(playerView.mesh.position, dt);
    renderer.render(scene, follow.camera);
    debug.frame({
      tick: sim.getState().tick,
      objects: scene.children.length,
      extra: {
        tile: `${me.mover.from.x},${me.mover.from.y}`,
        layer: me.mover.from.layer,
        moving: me.mover.target ? "yes" : "no",
      },
    });
  },
);
