import * as THREE from "three";
import { DEFAULT_TUNING, NO_INPUT, isGhost, skillActive, type SimulationState } from "@supermaze/sim";
import { DebugOverlay } from "./debug.js";
import { Hud } from "./hud/hud.js";
import { Minimap } from "./hud/minimap.js";
import { ResultsPanel } from "./hud/results.js";
import { buildHudModel } from "./hud/model.js";
import { sfx } from "./audio/sfx.js";
import { diffSounds } from "./audio/sounds.js";
import { music } from "./audio/music.js";
import { musicRate } from "./audio/musicMood.js";
import { diffGains } from "./hud/gains.js";
import { SystemButtons } from "./hud/systemButtons.js";
import { diffToasts } from "./hud/toasts.js";
import { InputSource } from "./input/index.js";
import { startLoop } from "./loop.js";
import type { GameMode } from "./modes/mode.js";
import { BoxViews } from "./render/boxes.js";
import { FollowCamera } from "./render/camera.js";
import { ClimbCamera } from "./render/climbCamera.js";
import { platformTopY } from "./render/elevation.js";
import { openingOf, type Opening } from "./opening.js";
import { KeyViews } from "./render/keys.js";
import { SceneLighting } from "./render/lighting.js";
import { buildMapMesh } from "./render/mapMesh.js";
import { themeFor } from "./render/themes.js";
import { PlaceableViews } from "./render/placeables.js";
import { PlayerViews } from "./render/players.js";
import { qualityFrame, qualityStatus, restartQuality } from "./render/quality.js";
import { useTeams } from "./render/teamColors.js";
import { PLAYER_HEIGHT } from "./render/playerView.js";
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
  /** Null in a rules demo: nobody plays it, so there are no controls, scoreboard, minimap or exit button. */
  private readonly input: InputSource | null;
  private readonly hud: Hud;
  private readonly results: ResultsPanel | null;
  private readonly minimap: Minimap | null;
  private readonly system: SystemButtons | null;
  private readonly demo: boolean;
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
  /** F4: force the next ghost event. Developer aid; the server may ignore it. */
  private readonly onDebugKey = (e: KeyboardEvent) => {
    if (e.code === "F4") {
      e.preventDefault();
      this.hud.toast(this.mode.debug ? "除錯：強制鬼抓人" : "除錯：此模式不支援");
      this.mode.debug?.("ghost");
    }
  };
  private lastFrame = performance.now();
  private readonly climbCamera = new ClimbCamera();
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly renderer: THREE.WebGLRenderer,
    private readonly mode: GameMode,
    options: { demo?: boolean } = {},
  ) {
    this.demo = options.demo === true;
    const theme = themeFor(mode.theme);
    // The map theme's own track, or the shared one; a rules demo leaves the home screen's music alone.
    if (!this.demo) music.play(`game-${theme.id}`);
    restartQuality();
    this.scene = createScene();
    this.mapMesh = buildMapMesh(mode.grid, theme, mode.plazaRadius, mode.switchTiles);
    this.scene.background = new THREE.Color(theme.sky);
    this.scene.add(this.mapMesh.group);
    this.players = new PlayerViews(this.scene, mode.grid);
    this.players.configure({ x: this.mapMesh.towerCenter.x, z: this.mapMesh.towerCenter.z });
    this.keys = new KeyViews(this.scene, mode.grid);
    this.boxes = new BoxViews(this.scene, mode.grid);
    this.placeables = new PlaceableViews(this.scene, mode.grid);
    this.switches = new SwitchViews(this.scene, mode.grid);
    this.lighting = new SceneLighting(this.scene, DEFAULT_TUNING.lighting.darkRadiusMazeTiles, theme);
    const size0 = viewportSize(root);
    this.follow = new FollowCamera(size0.w, size0.h, mode.grid.width, mode.grid.height);
    this.input = this.demo ? null : new InputSource(root);
    this.debug = new DebugOverlay(root);
    this.hud = new Hud(root);
    this.hud.setDemo(this.demo);
    this.results = this.demo ? null : new ResultsPanel(root);
    this.minimap = this.demo ? null : new Minimap(root, mode.grid);
    this.system = this.demo ? null : new SystemButtons(root, mode.exit ? () => mode.exit?.() : null);

    this.onResize = () => {
      const { w, h } = viewportSize(root);
      this.follow.resize(w, h);
      renderer.setSize(w, h);
    };
    // Browsers differ in which of these fire on rotation, fullscreen or a collapsing URL bar.
    window.addEventListener("resize", this.onResize);
    window.addEventListener("orientationchange", this.onResize);
    window.visualViewport?.addEventListener("resize", this.onResize);
    this.resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(this.onResize) : null;
    this.resizeObserver?.observe(root);
    this.onResize();
    window.addEventListener("keydown", this.onDebugKey);

    this.stopLoop = startLoop(
      mode.tickRate,
      () => mode.tick(this.input?.read() ?? NO_INPUT),
      (alpha) => this.render(alpha),
    );
  }

  private render(alpha: number): void {
    const now = performance.now();
    const tickSec = 1 / this.mode.tickRate;
    const frameSec = (now - this.lastFrame) / 1000;
    const dt = Math.min(frameSec, tickSec * 4);
    this.lastFrame = now;
    qualityFrame(this.renderer, frameSec);

    const s = this.mode.sample(now, alpha);
    const meId = this.mode.localPlayerId();
    let opening: Opening | null = null;
    if (s) {
      useTeams(Object.values(s.to.players).map((p) => p.teamId));
      const ghostIds = new Set(Object.values(s.to.players).filter((p) => isGhost(s.to.ghost, p)).map((p) => p.id));
      this.players.update(s.from.players, s.to.players, s.alpha, s.to.tick, dt, meId, ghostIds, s.nudge ?? null);
      this.keys.update(s.to.keys, now / 1000);
      this.boxes.update(s.to.boxes, now / 1000);
      this.placeables.update(s.to.placeables, s.to.nodes, now / 1000);
      this.switches.update(s.to.switches, now / 1000);
      const dark = !s.to.lightsOn;
      this.lighting.setDark(dark);
      this.mapMesh.setDark(dark);
      this.scene.background = new THREE.Color(dark ? CLIENT_TUNING.dark.clearColor : themeFor(this.mode.theme).sky);
      opening = openingOf(s.to, this.mode.tickRate);
      // The doors open with the countdown, after the fly-in.
      this.mapMesh.update(now / 1000, this.players.activeClimbs(), opening.countdownProgress);

      const model = buildHudModel(s.to, meId, this.mode.grid, this.mode.tickRate, DEFAULT_TUNING.inventory.capacity);
      this.hud.update(model);
      if (!this.demo) music.setRate(musicRate(model));
      this.hud.setCaption(this.mode.caption?.() ?? null);
      this.input?.actionButton.setActive(model.status === "running" && !model.onTower);
      this.input?.discardButton.setVisible(model.canDiscard);
      this.input?.skillButton.setSkill(this.hud.skillButton(model));
      if (this.lastToastState !== s.to) {
        for (const t of diffToasts(this.lastToastState, s.to, meId)) this.hud.toast(t.text, t.big);
        for (const g of diffGains(this.lastToastState, s.to, meId, DEFAULT_TUNING.scoring)) this.hud.gain(g.points, g.label);
        if (!this.demo) for (const c of diffSounds(this.lastToastState, s.to, meId)) sfx.play(c.name, c.volume);
        this.lastToastState = s.to;
      }
      this.minimap?.update(s.to, meId);
    }

    const mePos = meId ? this.players.position(meId) : null;
    const meState = meId && s ? s.to.players[meId] : undefined;
    const onTower = meState?.phase === "tower";
    const climbShot = this.climbCamera.update(meId ? this.players.climbTime(meId) : null, onTower, now / 1000);
    // Eagle eye (tower run skill): the tower top's view from above for a few seconds, from the maze.
    const tickNow = s?.to.tick ?? 0;
    const eagle = !onTower && !!meState && skillActive(meState, "eagleEye", tickNow);
    const shot = eagle ? { ...climbShot, camera: "overview" as const, towerOverview: true, watchTower: false } : climbShot;
    const lantern = !!meState && skillActive(meState, "lantern", tickNow);
    // The rank is already settled; the result screen waits until every climb has been shown.
    if (s && !shot.busy && this.players.activeClimbs().length === 0) this.results?.update(s.to, meId, this.mode.results());
    this.follow.setMode(shot.camera, shot.camera === "overview" ? CLIENT_TUNING.climb.overviewPerSec : undefined);
    this.mapMesh.tower.setOverview(shot.towerOverview);
    this.lighting.setRadius(
      onTower ? DEFAULT_TUNING.lighting.darkRadiusTowerTiles : lantern ? DEFAULT_TUNING.skills.lantern.darkRadiusTiles : DEFAULT_TUNING.lighting.darkRadiusMazeTiles,
    );
    if (mePos) {
      this.follow.update(mePos.clone().setY(mePos.y + PLAYER_HEIGHT / 2 + shot.lift), dt);
      // Opening fly-in: from far in front of the tower down to the follow view.
      if (s && opening && opening.introTicks > 0 && opening.introLeftSec > 0) {
        this.follow.applyIntro((s.to.tick - s.to.startTick + s.alpha) / opening.introTicks, this.mapMesh.towerCenter, platformTopY());
      }
      this.lighting.follow(mePos);
    }
    // The tower turns see-through while it stands between the camera and the local player.
    if (mePos && shot.watchTower) this.mapMesh.tower.watch(this.follow.camera.position, mePos, PLAYER_HEIGHT);
    else this.mapMesh.tower.unwatch();
    this.mapMesh.tower.update(dt);

    this.renderer.render(this.scene, this.follow.camera);
    const r = this.renderer.info.render;
    this.debug.frame({
      tick: s?.to.tick ?? 0,
      objects: this.scene.children.length,
      extra: {
        drawCalls: r.calls,
        triangles: r.triangles,
        pixels: `${this.renderer.domElement.width}x${this.renderer.domElement.height} @${this.renderer.getPixelRatio()}`,
        quality: qualityStatus(),
        gpuObjects: `${this.renderer.info.memory.geometries} geo, ${this.renderer.info.memory.textures} tex`,
        jsHeap: jsHeapMB(),
        mode: this.mode.label,
        ...this.mode.hud(),
      },
    });
    this.debug.banner(this.mode.banner?.() ?? null);
  }

  dispose(): void {
    this.stopLoop();
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("orientationchange", this.onResize);
    window.visualViewport?.removeEventListener("resize", this.onResize);
    this.resizeObserver?.disconnect();
    window.removeEventListener("keydown", this.onDebugKey);
    this.hud.dispose();
    this.results?.dispose();
    this.minimap?.dispose();
    this.system?.dispose();
    this.debug.dispose();
    this.input?.dispose();
    this.renderer.clear();
    if (!this.demo) {
      music.setRate(1);
      music.play("menu");
    }
  }
}

/** Chrome-only JS heap size; other browsers show "-". */
function jsHeapMB(): string {
  const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  return m ? `${(m.usedJSHeapSize / 1048576).toFixed(0)} MB` : "-";
}

/** The play area's own size; window.inner* lags or lies on some mobile browsers during rotation. */
function viewportSize(root: HTMLElement): { w: number; h: number } {
  const r = root.getBoundingClientRect();
  return { w: Math.max(1, Math.round(r.width || window.innerWidth)), h: Math.max(1, Math.round(r.height || window.innerHeight)) };
}
