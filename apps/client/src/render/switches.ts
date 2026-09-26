import * as THREE from "three";
import type { LightSwitchState, MapGrid } from "@supermaze/sim";

const PANEL_ON = 0x3ddc84;
const PANEL_OFF = 0x555a63;
const GLOW = 0x9be7ff;

/**
 * A light switch is used from a road tile but drawn on the adjacent wall face
 * it hangs on, plus a floor glow on the tile so it can be spotted from any
 * map orientation. Both dim once the switch is spent.
 */
export class SwitchViews {
  private readonly views = new Map<string, { panel: THREE.Mesh; glow: THREE.Mesh }>();
  private readonly panelGeo = new THREE.BoxGeometry(0.28, 0.36, 0.06);
  private readonly glowGeo = new THREE.CircleGeometry(0.42, 24);

  constructor(private readonly scene: THREE.Scene, private readonly grid: MapGrid) {}

  update(switches: Record<string, LightSwitchState>, timeSec: number): void {
    for (const s of Object.values(switches)) {
      let v = this.views.get(s.id);
      if (!v) {
        v = this.create(s);
        this.views.set(s.id, v);
      }
      const panelMat = v.panel.material as THREE.MeshLambertMaterial;
      panelMat.color.setHex(s.used ? PANEL_OFF : PANEL_ON);
      panelMat.emissive.setHex(s.used ? 0x000000 : 0x0b3d22);
      v.glow.visible = !s.used;
      if (!s.used) {
        const pulse = 0.35 + 0.15 * Math.sin(timeSec * 3);
        (v.glow.material as THREE.MeshBasicMaterial).opacity = pulse;
      }
    }
    for (const [id, v] of this.views) {
      if (!switches[id]) {
        this.scene.remove(v.panel, v.glow);
        this.views.delete(id);
      }
    }
  }

  private create(s: LightSwitchState): { panel: THREE.Mesh; glow: THREE.Mesh } {
    void this.grid;
    const panel = new THREE.Mesh(this.panelGeo, new THREE.MeshLambertMaterial({ color: PANEL_ON }));
    // Flush against the wall face: half a tile toward the wall, minus half the panel depth.
    const inset = 0.5 - 0.03;
    panel.position.set(s.pos.x + s.facing.dx * inset, 0.55, s.pos.y + s.facing.dy * inset);
    // Face the tile: the panel's +Z looks back along -facing.
    panel.rotation.y = Math.atan2(-s.facing.dx, -s.facing.dy);

    const glow = new THREE.Mesh(
      this.glowGeo,
      new THREE.MeshBasicMaterial({ color: GLOW, transparent: true, opacity: 0.4, depthWrite: false }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(s.pos.x, 0.02, s.pos.y);

    this.scene.add(panel, glow);
    return { panel, glow };
  }
}
