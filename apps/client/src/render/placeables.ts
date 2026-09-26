import * as THREE from "three";
import type { MapGrid, PlaceableState, TeleportNodeState } from "@supermaze/sim";
import { tileElevation } from "./elevation.js";
import { createObstacle, createOneWayDoor, createTeleportNode, createTrap } from "./itemModels.js";
import { TEAM_COLORS, teamColorIndex } from "./teamColors.js";

/**
 * Doors, obstacles, traps and teleport nodes, all drawn in code (itemModels.ts).
 * With item effects disabled they fall back to a translucent placeholder block.
 */
export class PlaceableViews {
  private readonly views = new Map<string, THREE.Object3D>();

  constructor(private readonly scene: THREE.Scene, private readonly grid: MapGrid) {}

  update(placeables: Record<string, PlaceableState>, nodes: Record<string, TeleportNodeState>, timeSec: number): void {
    const live = new Set<string>();
    for (const p of Object.values(placeables)) {
      live.add(p.id);
      let m = this.views.get(p.id);
      if (!m) {
        m = createPlaceable(p);
        m.position.set(p.pos.x, tileElevation(this.grid, p.pos), p.pos.y);
        this.scene.add(m);
        this.views.set(p.id, m);
      }
      animatePlaceable(m, p, timeSec);
    }
    for (const n of Object.values(nodes)) {
      const id = `node:${n.id}`;
      live.add(id);
      let m = this.views.get(id);
      if (!m) {
        m = createNode(n);
        m.position.set(n.pos.x, tileElevation(this.grid, n.pos) + 0.03, n.pos.y);
        this.scene.add(m);
        this.views.set(id, m);
      }
      const paired = n.pairedWith !== null;
      const ring = m.getObjectByName("ring");
      if (ring) ring.rotation.y = paired ? timeSec * 1.5 : 0;
      const beam = m.getObjectByName("beam");
      if (beam) beam.visible = paired;
    }
    for (const [id, m] of this.views) {
      if (!live.has(id)) {
        this.scene.remove(m);
        this.views.delete(id);
      }
    }
  }
}

const PLACEHOLDER_COLORS: Record<string, number> = {
  oneWayDoor: 0x3b82f6,
  obstacle: 0x6b7280,
  hammer: 0xf59e0b,
  trap: 0xb91c1c,
};

function createPlaceable(p: PlaceableState): THREE.Object3D {
  if (p.placeholder) {
    // Effects disabled: one generic, passable, translucent block; colour tells the kind apart.
    const g = new THREE.Group();
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 0.7),
      new THREE.MeshLambertMaterial({ color: PLACEHOLDER_COLORS[p.kind] ?? 0xffffff, transparent: true, opacity: 0.6 }),
    );
    m.position.y = 0.35;
    g.add(m);
    return g;
  }
  switch (p.kind) {
    case "oneWayDoor":
      return createOneWayDoor(p.dir);
    case "obstacle":
      return createObstacle();
    case "trap":
      return createTrap();
    case "hammer":
      return new THREE.Group(); // hammers are never placed with effects enabled
  }
}

function animatePlaceable(m: THREE.Object3D, p: PlaceableState, timeSec: number): void {
  if (p.placeholder) return;
  if (p.kind === "trap") {
    const spikes = m.getObjectByName("spikes");
    if (spikes) spikes.rotation.y = timeSec * 0.9;
    const core = m.getObjectByName("core");
    if (core) core.position.y = 0.12 + Math.sin(timeSec * 4) * 0.02;
  } else if (p.kind === "oneWayDoor") {
    const pane = m.getObjectByName("pane") as THREE.Mesh | undefined;
    if (pane) (pane.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.12 * Math.sin(timeSec * 3);
  }
}

function createNode(n: TeleportNodeState): THREE.Object3D {
  const color = TEAM_COLORS[teamColorIndex(n.teamId) % TEAM_COLORS.length] as number;
  return createTeleportNode(color);
}
