import * as THREE from "three";
import type { MapGrid, PlaceableState, TeleportNodeState } from "@supermaze/sim";
import { tileElevation } from "./elevation.js";
import { createObstacle, createOneWayDoor, createTeleportNode, createTrap } from "./itemModels.js";
import { TEAM_COLORS, teamColorIndex } from "./teamColors.js";
import { CLIENT_TUNING } from "../tuning.js";

/** Doors, obstacles, traps and teleport nodes, all drawn in code (itemModels.ts). */
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

function createPlaceable(p: PlaceableState): THREE.Object3D {
  const m = p.kind === "oneWayDoor" ? createOneWayDoor(p.dir) : p.kind === "obstacle" ? createObstacle() : createTrap();
  if (p.permanent) weather(m);
  return m;
}

/**
 * Map fixtures get their own colour so players can tell them from what someone
 * just put down and know they will not time out: every colour (the trap's glow
 * too) is turned violet, which no placed item uses, and slightly darkened.
 * Same shapes, so the kind still reads at once.
 */
function weather(root: THREE.Object3D): void {
  const t = CLIENT_TUNING.fixtureLook;
  const hsl = { h: 0, s: 0, l: 0 };
  const recolor = (c: THREE.Color, darken: number): void => {
    c.getHSL(hsl);
    c.setHSL(t.hue, hsl.s, hsl.l * darken);
  };
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mesh.material = mats.map((src) => {
      const mat = src.clone() as THREE.MeshLambertMaterial | THREE.MeshBasicMaterial;
      if (mat.color) recolor(mat.color, t.darken);
      if ("emissive" in mat) recolor(mat.emissive, 1);
      return mat;
    });
    if (mesh.material.length === 1) mesh.material = mesh.material[0] as THREE.Material;
  });
}

function animatePlaceable(m: THREE.Object3D, p: PlaceableState, timeSec: number): void {
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
