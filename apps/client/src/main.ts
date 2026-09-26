import * as THREE from "three";
import { DEFAULT_TUNING, rotateMap, type QuarterTurns, type SimulationState } from "@supermaze/sim";
import { DebugOverlay } from "./debug.js";
import { Hud } from "./hud/hud.js";
import { buildHudModel } from "./hud/model.js";
import { diffToasts } from "./hud/toasts.js";
import { DEFAULT_MAP_ID, loadMapById } from "./maps.js";
import { InputSource } from "./input/index.js";
import { startLoop } from "./loop.js";
import { createLocalMode } from "./modes/local.js";
import { createOnlineMode } from "./modes/online.js";
import { FollowCamera } from "./render/camera.js";
import { BoxViews } from "./render/boxes.js";
import { KeyViews } from "./render/keys.js";
import { models } from "./render/models.js";
import { SceneLighting } from "./render/lighting.js";
import { buildMapMesh } from "./render/mapMesh.js";
import { PlaceableViews } from "./render/placeables.js";
import { PlayerViews } from "./render/players.js";
import { createScene } from "./render/scene.js";
import { SwitchViews } from "./render/switches.js";
import { CLIENT_TUNING } from "./tuning.js";

const root = document.getElementById("app");
if (!root) throw new Error("#app not found");

// `?online` joins the server; default is a local single-player simulation.
const params = new URLSearchParams(location.search);
const endpoint = params.get("server") ?? `ws://${location.hostname}:2567`;
// Sandbox URL parameters (see README): ?rot=0..3 map orientation, ?players=N pretend
// participant count (idle CPUs), ?seed=N reproducible spawn draw. Online play takes the
// server's rotation and seed instead.
const rot = (Number(params.get("rot") ?? 0) % 4) as QuarterTurns;
const map = rotateMap(loadMapById(params.get("map") ?? DEFAULT_MAP_ID), rot);
const playerName = resolveName(params.get("name"));
const mode = params.has("online")
  ? createOnlineMode(map, endpoint, rot, playerName)
  : createLocalMode(map, {
      players: Number(params.get("players") ?? 1),
      seed: Number(params.get("seed") ?? 1),
      name: playerName,
    });

/** ?name= wins, else the last name used in this browser, else ask once. */
function resolveName(fromUrl: string | null): string {
  const KEY = "supermaze.name";
  let name = fromUrl?.trim() || "";
  try {
    if (!name) name = localStorage.getItem(KEY) ?? "";
    if (!name) name = (window.prompt("你的暱稱？") ?? "").trim();
    if (name) localStorage.setItem(KEY, name);
  } catch {
    /* storage unavailable */
  }
  return (name || "玩家").slice(0, 12);
}

// Real models (if any) must be in hand before the first key or box is created.
await models.load();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, CLIENT_TUNING.render.maxPixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
root.appendChild(renderer.domElement);

const scene = createScene();
const mapMesh = buildMapMesh(mode.grid);
scene.add(mapMesh.group);
const players = new PlayerViews(scene, mode.grid);
const keys = new KeyViews(scene, mode.grid);
const boxes = new BoxViews(scene, mode.grid);
const placeables = new PlaceableViews(scene, mode.grid);
const switches = new SwitchViews(scene, mode.grid);
const lighting = new SceneLighting(scene, DEFAULT_TUNING.lighting.darkRadiusMazeTiles);
const follow = new FollowCamera(window.innerWidth / window.innerHeight, mode.grid.width, mode.grid.height);
const input = new InputSource(root);
const debug = new DebugOverlay(root);
const hud = new Hud(root);
let lastToastState: SimulationState | null = null;

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
    const meId = mode.localPlayerId();
    if (s) {
      players.update(s.from.players, s.to.players, s.alpha, s.to.tick);
      keys.update(s.to.keys, now / 1000);
      boxes.update(s.to.boxes, now / 1000);
      placeables.update(s.to.placeables, s.to.nodes, now / 1000);
      switches.update(s.to.switches, now / 1000);
      const dark = !s.to.lightsOn;
      lighting.setDark(dark);
      scene.background = new THREE.Color(dark ? CLIENT_TUNING.dark.clearColor : CLIENT_TUNING.render.clearColor);
      const model = buildHudModel(s.to, meId, mode.grid, mode.tickRate, DEFAULT_TUNING.inventory.capacity);
      hud.update(model);
      input.actionButton.setAction(hud.actionLabel(model));
      if (lastToastState !== s.to) {
        for (const t of diffToasts(lastToastState, s.to, meId)) hud.toast(t);
        lastToastState = s.to;
      }
    }
    const mePos = meId ? players.position(meId) : null;
    const meState = meId && s ? s.to.players[meId] : undefined;
    const onTower = meState?.phase === "tower";
    follow.setMode(onTower ? "overview" : "follow");
    mapMesh.tower.setOverview(onTower);
    lighting.setRadius(onTower ? DEFAULT_TUNING.lighting.darkRadiusTowerTiles : DEFAULT_TUNING.lighting.darkRadiusMazeTiles);
    if (mePos) {
      follow.update(mePos, dt);
      lighting.follow(mePos);
    }

    renderer.render(scene, follow.camera);
    debug.frame({ tick: 0, objects: scene.children.length, extra: { mode: mode.label, ...mode.hud() } });
    debug.banner(mode.banner?.() ?? null);
  },
);
