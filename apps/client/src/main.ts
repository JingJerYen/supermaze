import * as THREE from "three";
import { rotateMap, type QuarterTurns } from "@supermaze/sim";
import { drawMap, loadMapById } from "./maps.js";
import { Match } from "./match.js";
import { createLocalMode } from "./modes/local.js";
import { characters } from "./render/characters.js";
import { models } from "./render/models.js";
import { antialiasAtLaunch, createGovernor, installQuality, rememberRatio } from "./render/quality.js";
import { sfx } from "./audio/sfx.js";
import { fullscreenOnFirstTouch } from "./fullscreen.js";
import { RulesScreen } from "./rules/rulesScreen.js";
import { Session } from "./session.js";
import { CLIENT_TUNING } from "./tuning.js";

const root = document.getElementById("app");
if (!root) throw new Error("#app not found");

// Real models (if any) must be in hand before the first key, box or player is created.
await Promise.all([models.load(), characters.load()]);

const params = new URLSearchParams(location.search);
// ?dpr=1 forces a pixel ratio (and turns automatic quality off), to check whether fill rate limits the frame rate.
const dprOverride = Number(params.get("dpr"));
if (params.get("quality") === "reset") rememberRatio(null);
const governor = dprOverride > 0 || params.get("quality") === "off" ? null : createGovernor(window.devicePixelRatio);
installQuality(governor);
const renderer = new THREE.WebGLRenderer({ antialias: dprOverride > 0 || antialiasAtLaunch() });
renderer.setPixelRatio(dprOverride > 0 ? dprOverride : (governor?.ratio ?? Math.min(window.devicePixelRatio, CLIENT_TUNING.render.maxPixelRatio)));
renderer.setSize(root.clientWidth || window.innerWidth, root.clientHeight || window.innerHeight);
root.appendChild(renderer.domElement);

fullscreenOnFirstTouch();
sfx.init();

// URL parameters (see README). `?local` runs the single-player sandbox in the page;
// otherwise the online flow starts at the home screen.
const playerName = resolveName(params.get("name"));

if (params.has("rules")) {
  // ?rules opens the rules cards directly (handy while authoring scenes).
  new RulesScreen(root, renderer, () => (location.href = location.pathname));
} else if (params.has("local")) {
  // ?map= opens that map (even one still being drawn); otherwise the map is drawn
  // from the pool by player count and seed, like every other mode.
  const players = Number(params.get("players") ?? 1);
  const seed = Number(params.get("seed") ?? 1);
  const named = params.get("map");
  const chosen = named ? loadMapById(named) : (drawMap(players, seed) ?? loadMapById(""));
  const rot = (Number(params.get("rot") ?? (named ? 0 : seed)) % 4) as QuarterTurns;
  const map = rotateMap(chosen, rot);
  const mode = createLocalMode(map, {
    players,
    seed,
    name: playerName,
    difficulty: params.get("cpu") === "hard" ? "hard" : "easy",
  });
  new Match(root, renderer, mode);
} else {
  const endpoint = params.get("server") ?? rememberedServer() ?? `ws://${location.hostname}:2567`;
  void new Session(root, renderer, endpoint, playerName).start();
}

/** The server last typed on the home screen, if any. */
function rememberedServer(): string | null {
  try {
    return localStorage.getItem("supermaze.server");
  } catch {
    return null;
  }
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
