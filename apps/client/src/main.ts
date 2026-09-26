import * as THREE from "three";
import { rotateMap, type QuarterTurns } from "@supermaze/sim";
import { DEFAULT_MAP_ID, loadMapById } from "./maps.js";
import { Match } from "./match.js";
import { createLocalMode } from "./modes/local.js";
import { characters } from "./render/characters.js";
import { models } from "./render/models.js";
import { Session } from "./session.js";
import { CLIENT_TUNING } from "./tuning.js";

const root = document.getElementById("app");
if (!root) throw new Error("#app not found");

// Real models (if any) must be in hand before the first key, box or player is created.
await Promise.all([models.load(), characters.load()]);

const renderer = new THREE.WebGLRenderer({ antialias: true });
// ?dpr=1 forces a pixel ratio, to check whether fill rate is what limits the frame rate.
const params = new URLSearchParams(location.search);
const dprOverride = Number(params.get("dpr"));
renderer.setPixelRatio(dprOverride > 0 ? dprOverride : Math.min(window.devicePixelRatio, CLIENT_TUNING.render.maxPixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
root.appendChild(renderer.domElement);

// URL parameters (see README). `?local` runs the single-player sandbox in the page;
// otherwise the online flow starts at the home screen.
const playerName = resolveName(params.get("name"));

if (params.has("local")) {
  const rot = (Number(params.get("rot") ?? 0) % 4) as QuarterTurns;
  const map = rotateMap(loadMapById(params.get("map") ?? DEFAULT_MAP_ID), rot);
  const mode = createLocalMode(map, {
    players: Number(params.get("players") ?? 1),
    seed: Number(params.get("seed") ?? 1),
    name: playerName,
  });
  new Match(root, renderer, mode);
} else {
  const endpoint = params.get("server") ?? `ws://${location.hostname}:2567`;
  void new Session(root, renderer, endpoint, playerName).start();
}

/** ?name= wins, else the last name used in this browser, else a default the home screen lets you edit. */
function resolveName(fromUrl: string | null): string {
  const KEY = "supermaze.name";
  let name = fromUrl?.trim() || "";
  try {
    if (!name) name = localStorage.getItem(KEY) ?? "";
    if (name) localStorage.setItem(KEY, name);
  } catch {
    /* storage unavailable */
  }
  return (name || "玩家").slice(0, 12);
}
