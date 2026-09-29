import * as THREE from "three";
import type { MapGrid } from "@supermaze/sim";
import { CLIENT_TUNING } from "../tuning.js";
import { platformTopY as platformTopYWorld } from "./elevation.js";
import { sightBlocked, type Box3, type Point3 } from "./occlusion.js";
import type { TowerAnimations } from "./climbSequence.js";

/** What every tower style hands back to the map builder. */
export interface TowerBuild {
  group: THREE.Group;
  view: TowerView;
  animations: TowerAnimations | null;
  center: THREE.Vector3;
}

/**
 * Handle to the tower's materials so the view can see through it: from above
 * when the player is a commander, and from the maze whenever the tower stands
 * between the camera and the local player.
 */
export class TowerView {
  /** Solid parts of the tower (shaft, base tiers, bands, doors...); glowing and already see-through parts keep their own opacity. */
  private solid: THREE.Material[] = [];
  /** What can hide a character: the base tiers and the shaft, as boxes. */
  private boxes: Box3[] = [];
  private overview = false;
  private hiding = false;
  /** 0 solid .. 1 fully faded, eased. */
  private fade = 0;
  private applied = -1;

  constructor(
    private readonly platform: THREE.MeshLambertMaterial,
    private readonly shaft: THREE.MeshLambertMaterial,
    /** Parts that thin out with the shaft in the overview (a tree's canopy round the platform). */
    private readonly overviewFade: THREE.Material[] = [],
  ) {}

  /** Called once the tower is assembled. */
  attach(group: THREE.Object3D, boxes: Box3[]): void {
    const seen = new Set<THREE.Material>();
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (!m.transparent && m !== this.shaft && !this.overviewFade.includes(m)) seen.add(m);
      }
    });
    this.solid = [...seen];
    this.boxes = boxes;
  }

  /** Overview: the commander stands on the slab and must see the plaza beneath it. */
  setOverview(overview: boolean): void {
    this.overview = overview;
    this.platform.opacity = overview ? CLIENT_TUNING.tower.platformOpacityOverview : CLIENT_TUNING.tower.platformOpacityFollow;
  }

  /** Tell the tower where the camera and the local player are; it fades while it hides that player. */
  watch(eye: Point3, feet: Point3, height: number): void {
    const margin = CLIENT_TUNING.tower.occlusionMargin;
    const low = { x: feet.x, y: feet.y + 0.1, z: feet.z };
    const high = { x: feet.x, y: feet.y + height, z: feet.z };
    this.hiding = this.boxes.some((b) => sightBlocked(eye, low, b, margin) || sightBlocked(eye, high, b, margin));
  }

  /** Nobody to watch (no local player, or the player is on the tower). */
  unwatch(): void {
    this.hiding = false;
  }

  update(dtSec: number): void {
    const t = CLIENT_TUNING.tower;
    const want = this.hiding && !this.overview ? 1 : 0;
    this.fade += (want - this.fade) * (1 - Math.exp(-t.occlusionFadePerSec * dtSec));
    if (Math.abs(want - this.fade) < 0.002) this.fade = want;
    const opacity = 1 - this.fade * (1 - t.occludedOpacity);
    const shaftOpacity = this.overview ? t.shaftOpacityOverview : opacity;
    const key = Math.round(opacity * 1000) + (this.overview ? 5000 : 0);
    if (key === this.applied) return;
    this.applied = key;
    setOpacity(this.shaft, shaftOpacity);
    for (const m of this.overviewFade) setOpacity(m, this.overview ? t.shaftOpacityOverview : opacity);
    for (const m of this.solid) setOpacity(m, opacity);
  }
}

function setOpacity(m: THREE.Material, opacity: number): void {
  const transparent = opacity < 0.999;
  if (m.transparent !== transparent) {
    m.transparent = transparent;
    m.needsUpdate = true;
  }
  m.opacity = opacity;
}

/** Footprint centre and size of the tower, and the world height of its platform top. */
export function towerGeometry(grid: MapGrid): { center: THREE.Vector3; footW: number; footD: number; platformTopY: number } {
  const cells = grid.findCells("tower");
  const platformTopY = platformTopYWorld();
  if (cells.length === 0) return { center: new THREE.Vector3(), footW: 0, footD: 0, platformTopY };
  const minX = Math.min(...cells.map((c) => c.x));
  const maxX = Math.max(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  const maxY = Math.max(...cells.map((c) => c.y));
  return {
    center: new THREE.Vector3((minX + maxX) / 2, 0, (minY + maxY) / 2),
    footW: maxX - minX + 1,
    footD: maxY - minY + 1,
    platformTopY,
  };
}
