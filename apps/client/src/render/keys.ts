import * as THREE from "three";
import type { KeyState, MapGrid } from "@supermaze/sim";
import { createKeyBeam, createKeyModel } from "./assets.js";
import { tileElevation } from "./elevation.js";

/**
 * One key model plus a vertical beam per unowned key. The beam is unlit, so it
 * stays visible while the map is dark; owned keys vanish into the owner's pocket.
 */
export class KeyViews {
  private readonly views = new Map<string, THREE.Group>();

  constructor(private readonly scene: THREE.Scene, private readonly grid: MapGrid) {}

  update(keys: Record<string, KeyState>, timeSec: number): void {
    for (const k of Object.values(keys)) {
      if (k.ownerId !== null) {
        this.remove(k.id);
        continue;
      }
      let g = this.views.get(k.id);
      if (!g) {
        g = new THREE.Group();
        g.add(createKeyModel(), createKeyBeam());
        g.position.set(k.pos.x, tileElevation(this.grid, k.pos), k.pos.y);
        this.scene.add(g);
        this.views.set(k.id, g);
      }
      const model = g.children[0];
      if (model) {
        model.rotation.y = timeSec * 1.5;
        model.position.y = Math.sin(timeSec * 3) * 0.05;
      }
    }
    for (const id of this.views.keys()) if (!keys[id]) this.remove(id);
  }

  private remove(id: string): void {
    const g = this.views.get(id);
    if (!g) return;
    this.scene.remove(g);
    this.views.delete(id);
  }
}
