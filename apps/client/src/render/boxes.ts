import * as THREE from "three";
import type { BoxState, MapGrid } from "@supermaze/sim";
import { createBoxModel } from "./assets.js";
import { tileElevation } from "./elevation.js";

/** One box model per unopened box; opened boxes disappear, replacements appear. */
export class BoxViews {
  private readonly views = new Map<string, THREE.Object3D>();

  constructor(private readonly scene: THREE.Scene, private readonly grid: MapGrid) {}

  update(boxes: Record<string, BoxState>, timeSec: number): void {
    for (const b of Object.values(boxes)) {
      let m = this.views.get(b.id);
      if (!m) {
        m = createBoxModel();
        m.position.set(b.pos.x, tileElevation(this.grid, b.pos), b.pos.y);
        m.rotation.y = ((b.pos.x * 7 + b.pos.y * 13) % 8) * (Math.PI / 16); // slight per-box variety
        this.scene.add(m);
        this.views.set(b.id, m);
      }
      m.position.y = tileElevation(this.grid, b.pos) + Math.sin(timeSec * 2 + b.pos.x) * 0.02;
    }
    for (const [id, m] of this.views) {
      if (!boxes[id]) {
        this.scene.remove(m);
        this.views.delete(id);
      }
    }
  }
}
