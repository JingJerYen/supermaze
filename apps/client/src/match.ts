import * as THREE from "three";
import { DEFAULT_TUNING, type SimulationState } from "@supermaze/sim";
import { DebugOverlay } from "./debug.js";
import { Hud } from "./hud/hud.js";
import { Minimap } from "./hud/minimap.js";
import { ResultsPanel } from "./hud/results.js";
import { buildHudModel } from "./hud/model.js";
import { diffToasts } from "./hud/toasts.js";
import { InputSource } from "./input/index.js";
import { startLoop } from "./loop.js";
import type { GameMode } from "./modes/mode.js";
import { BoxViews } from "./render/boxes.js";
import { FollowCamera } from "./render/camera.js";
import { KeyViews } from "./render/keys.js";
import { SceneLighting } from "./render/lighting.js";
import { buildMapMesh } from "./render/mapMesh.js";
import { PlaceableViews } from "./render/placeables.js";
import { PlayerViews } from "./render/players.js";
import { createScene } from "./render/scene.js";
import { SwitchViews } from "./render/switches.js";
import { CLIENT_TUNING } from "./tuning.js";

/**
 * One match on screen: scene, views, HUD, input and the fixed-step loop for a
 * given GameMode. Built when a match starts and disposed when it ends, so a
 * room can play many matches on different maps without reloading the page.
 */
export class Match {
  private readonly scene: THREE.Scene;
  private readonly follow: FollowCamera;
  private readonly input: InputSource;
  private readonly hud: Hud;
  private readonly results: ResultsPanel;
  private readonly minimap: Minimap;
  private readonly debug: DebugOverlay;
  private readonly players: PlayerViews;
  private readonly keys: KeyViews;
  private readonly boxes: BoxViews;
  private readonly placeables: PlaceableViews;
  private readonly switches: SwitchViews;
  private readonly lighting: SceneLighting;
  private readonly mapMesh: ReturnType<typeof buildMapMesh>;
  private readonly stopLoop: () => void;
  private readonly onResize: () => void;
  private lastToastState: SimulationState | null = null;
  private lastFrame = performance.now();

  constructor(
    private readonly root: HTMLElement,
    private readonly renderer: THREE.WebGLRenderer,
    private readonly mode: GameMode,
  ) {
    this.scene = createScene();
    this.mapMesh = buildMapMesh(mode.grid);
    this.scene.add(this.mapMesh.group);
    this.players = new PlayerViews(this.scene, mode.grid);
    this.keys = new KeyViews(this.scene, mode.grid);
    this.boxes = new BoxViews(this.scene, mode.grid);
    this.placeables = new PlaceableViews(this.scene, mode.grid);
    this.switches = new SwitchViews(this.scene, mode.grid);
    this.lighting = new SceneLighting(this.scene, DEFAULT_TUNING.lighting.darkRadiusMazeTiles);
    this.follow = new FollowCamera(window.innerWidth / window.innerHeight, mode.grid.width, mode.grid.height);
    this.input = new InputSource(root);
    this.debug = new DebugOverlay(root);
    this.hud = new Hud(root);
    this.results = new ResultsPanel(root);
    this.minimap = new Minimap(root, mode.grid);

    this.onResize = () => {
      this.follow.resize(window.innerWidth / window.innerHeight);
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", this.onResize);

    this.stopLoop = startLoop(
      mode.tickRate,
      () => mode.tick(this.input.read()),
      (alpha) => this.render(alpha),
    );
  }

  private render(alpha: number): void {
    const now = performance.now();
    const tickSec = 1 / this.mode.tickRate;
    const dt = Math.min((now - this.lastFrame) / 1000, tickSec * 4);
    this.lastFrame = now;

    const s = this.mode.sample(now, alpha);
    const meId = this.mode.localPlayerId();
    if (s) {
      this.players.update(s.from.players, s.to.players, s.alpha, s.to.tick);
      this.keys.update(s.to.keys, now / 1000);
      this.boxes.update(s.to.boxes, now / 1000);
      this.placeables.update(s.to.placeables, s.to.nodes, now / 1000);
      this.switches.update(s.to.switches, now / 1000);
      const dark = !s.to.lightsOn;
      this.lighting.setDark(dark);
      this.scene.background = new THREE.Color(dark ? CLIENT_TUNING.dark.clearColor : CLIENT_TUNING.render.clearColor);

      const model = buildHudModel(s.to, meId, this.mode.grid, this.mode.tickRate, DEFAULT_TUNING.inventory.capacity);
      this.hud.update(model);
      this.input.actionButton.setAction(this.hud.actionLabel(model));
      if (this.lastToastState !== s.to) {
        for (const t of diffToasts(this.lastToastState, s.to, meId)) this.hud.toast(t);
        this.lastToastState = s.to;
      }
      this.results.update(s.to, meId, this.mode.results());
      this.minimap.update(s.to, meId);
    }

    const mePos = meId ? this.players.position(meId) : null;
    const meState = meId && s ? s.to.players[meId] : undefined;
    const onTower = meState?.phase === "tower";
    this.follow.setMode(onTower ? "overview" : "follow");
    this.mapMesh.tower.setOverview(onTower);
    this.lighting.setRadius(onTower ? DEFAULT_TUNING.lighting.darkRadiusTowerTiles : DEFAULT_TUNING.lighting.darkRadiusMazeTiles);
    if (mePos) {
      this.follow.update(mePos, dt);
      this.lighting.follow(mePos);
    }

    this.renderer.render(this.scene, this.follow.camera);
    this.debug.frame({ tick: s?.to.tick ?? 0, objects: this.scene.children.length, extra: { mode: this.mode.label, ...this.mode.hud() } });
    this.debug.banner(this.mode.banner?.() ?? null);
  }

  dispose(): void {
    this.stopLoop();
    window.removeEventListener("resize", this.onResize);
    this.hud.dispose();
    this.results.dispose();
    this.minimap.dispose();
    this.debug.dispose();
    this.input.dispose();
    this.renderer.clear();
  }
}
