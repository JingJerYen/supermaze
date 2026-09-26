import * as THREE from "three";
import type { MapGrid, PlaceableState, TeleportNodeState } from "@supermaze/sim";
import { tileElevation } from "./elevation.js";
import { TEAM_COLORS, teamColorIndex } from "./teamColors.js";

/**
 * Doors, obstacles, traps and teleport nodes. Placeholder shapes; swap the
 * factories for models later like keys and boxes.
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
      if (p.kind === "trap") m.rotation.y = timeSec * 0.8;
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
      const ring = m.children[1] as THREE.Mesh | undefined;
      if (ring) {
        ring.visible = n.pairedWith !== null;
        ring.rotation.z = timeSec * 1.5;
      }
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
  const g = new THREE.Group();
  if (p.placeholder) {
    // Effects disabled: one generic, passable, translucent block; colour tells the kind apart.
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 0.7),
      new THREE.MeshLambertMaterial({ color: PLACEHOLDER_COLORS[p.kind] ?? 0xffffff, transparent: true, opacity: 0.6 }),
    );
    m.position.y = 0.35;
    g.add(m);
    return g;
  }
  switch (p.kind) {
    case "obstacle": {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.9), new THREE.MeshLambertMaterial({ color: 0x6b7280 }));
      m.position.y = 0.4;
      g.add(m);
      break;
    }
    case "oneWayDoor": {
      // A thin frame across the tile plus an arrow on the floor showing the allowed direction.
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.12), new THREE.MeshLambertMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.55 }));
      frame.position.y = 0.45;
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 3), new THREE.MeshBasicMaterial({ color: 0xbfdbfe }));
      arrow.rotation.x = Math.PI / 2;
      arrow.position.y = 0.06;
      g.add(frame, arrow);
      // Rotate the whole door so its frame is perpendicular to the passage direction and the arrow points along it.
      g.rotation.y = Math.atan2(p.dir.dx, p.dir.dy);
      break;
    }
    case "trap": {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 6), new THREE.MeshLambertMaterial({ color: 0xb91c1c }));
      disc.position.y = 0.03;
      const spikes = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 4), new THREE.MeshLambertMaterial({ color: 0xfca5a5 }));
      spikes.position.y = 0.17;
      g.add(disc, spikes);
      break;
    }
    case "hammer":
      break; // hammers are never placed with effects enabled
  }
  return g;
}

function createNode(n: TeleportNodeState): THREE.Object3D {
  const g = new THREE.Group();
  const color = TEAM_COLORS[teamColorIndex(n.teamId) % TEAM_COLORS.length] as number;
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.8), new THREE.MeshLambertMaterial({ color }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.36, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  g.add(pad, ring);
  return g;
}
