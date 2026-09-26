import * as THREE from "three";
import type { KeyState, MapGrid } from "@supermaze/sim";
import { tileElevation } from "./elevation.js";

/** One spinning marker per unowned key. Owned keys vanish (they live in the owner's pocket). */
export class KeyViews {
  private readonly meshes = new Map<string, THREE.Mesh>();
  private readonly geo = new THREE.OctahedronGeometry(0.22);
  private readonly mat = new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x6b5200 });

  constructor(private readonly scene: THREE.Scene, private readonly grid: MapGrid) {}

  /** Emissive markers would glow through the darkness, so switch them off while dark. */
  setDark(dark: boolean): void {
    this.mat.emissive.setHex(dark ? 0x000000 : 0x6b5200);
  }

  update(keys: Record<string, KeyState>, timeSec: number): void {
    for (const k of Object.values(keys)) {
      if (k.ownerId !== null) {
        this.remove(k.id);
        continue;
      }
      let m = this.meshes.get(k.id);
      if (!m) {
        m = new THREE.Mesh(this.geo, this.mat);
        m.position.set(k.pos.x, tileElevation(this.grid, k.pos) + 0.45, k.pos.y);
        this.scene.add(m);
        this.meshes.set(k.id, m);
      }
      m.rotation.y = timeSec * 2;
      m.position.y = tileElevation(this.grid, k.pos) + 0.45 + Math.sin(timeSec * 3) * 0.05;
    }
    for (const id of this.meshes.keys()) if (!keys[id]) this.remove(id);
  }

  private remove(id: string): void {
    const m = this.meshes.get(id);
    if (!m) return;
    this.scene.remove(m);
    this.meshes.delete(id);
  }
}
