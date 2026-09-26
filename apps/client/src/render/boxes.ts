import * as THREE from "three";
import type { BoxState, MapGrid } from "@supermaze/sim";
import { createBoxModel } from "./assets.js";
import { tileElevation } from "./elevation.js";
import { CLIENT_TUNING } from "../tuning.js";

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
      m.position.y = tileElevation(this.grid, b.pos) + Math.sin(timeSec * 2 + b.pos.x) * 0.03;
      animateBox(m, timeSec, b.pos.x + b.pos.y);
    }
    for (const [id, m] of this.views) {
      if (!boxes[id]) {
        this.scene.remove(m);
        this.views.delete(id);
      }
    }
  }
}

/** Spin the corner-standing cube and its question mark; cycle the glass tint like a Mario Kart item box. */
function animateBox(root: THREE.Object3D, timeSec: number, phase: number): void {
  const t = CLIENT_TUNING.itemBox;
  const spin = root.getObjectByName("spin");
  if (spin) {
    spin.rotation.set(Math.atan(Math.SQRT2), Math.PI / 4 + timeSec * t.spinPerSec * Math.PI * 2 + phase, 0, "ZYX");
    const glass = spin.children[0] as THREE.Mesh | undefined;
    if (glass && t.hueCyclePerSec > 0) {
      (glass.material as THREE.MeshLambertMaterial).color.setHSL((timeSec * t.hueCyclePerSec + phase * 0.1) % 1, 0.75, 0.62);
    }
  }
  const mark = root.getObjectByName("mark");
  if (mark) mark.rotation.y = timeSec * t.markSpinPerSec * Math.PI * 2 + phase;
}
