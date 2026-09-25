import * as THREE from "three";
import type { MapData } from "@supermaze/sim";
import testMap from "../../../content/maps/test-01.json";
import { DebugOverlay } from "./debug.js";
import { InputSource } from "./input/index.js";
import { startLoop } from "./loop.js";
import { createLocalMode } from "./modes/local.js";
import { createOnlineMode } from "./modes/online.js";
import { FollowCamera } from "./render/camera.js";
import { buildMapMesh } from "./render/mapMesh.js";
import { PlayerViews } from "./render/players.js";
import { createScene } from "./render/scene.js";
import { CLIENT_TUNING } from "./tuning.js";

const root = document.getElementById("app");
if (!root) throw new Error("#app not found");

// `?online` joins the server; default is a local single-player simulation.
const params = new URLSearchParams(location.search);
const endpoint = params.get("server") ?? `ws://${location.hostname}:2567`;
const mode = params.has("online")
  ? createOnlineMode(testMap as MapData, endpoint)
  : createLocalMode(testMap as MapData);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, CLIENT_TUNING.render.maxPixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
root.appendChild(renderer.domElement);

const scene = createScene();
scene.add(buildMapMesh(mode.grid));
const players = new PlayerViews(scene, mode.grid);
const follow = new FollowCamera(window.innerWidth / window.innerHeight);
const input = new InputSource(root);
const debug = new DebugOverlay(root);

window.addEventListener("resize", () => {
  follow.resize(window.innerWidth / window.innerHeight);
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const tickSec = 1 / mode.tickRate;
let lastFrame = performance.now();

startLoop(
  mode.tickRate,
  () => mode.tick(input.read()),
  (alpha) => {
    const now = performance.now();
    const dt = Math.min((now - lastFrame) / 1000, tickSec * 4);
    lastFrame = now;

    const s = mode.sample(now, alpha);
    if (s) players.update(s.from, s.to, s.alpha);
    const meId = mode.localPlayerId();
    const mePos = meId ? players.position(meId) : null;
    if (mePos) follow.update(mePos, dt);

    renderer.render(scene, follow.camera);
    debug.frame({ tick: 0, objects: scene.children.length, extra: { mode: mode.label, ...mode.hud() } });
    debug.banner(mode.banner?.() ?? null);
  },
);
