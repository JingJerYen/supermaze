import * as THREE from "three";
import type { LightSwitchState, MapGrid } from "@supermaze/sim";

const PLATE = 0xe8e4d8;
const PLATE_USED = 0x6b6f78;
const LEVER = 0x2b2f3a;
const LED_ON = 0x3ddc84;
const LED_OFF = 0x3a3f4a;
const GLOW = 0x9be7ff;

/**
 * A light switch is used from a road tile but drawn on the adjacent wall face
 * it hangs on, plus a floor glow on the tile so it can be spotted from any
 * map orientation. Both dim once the switch is spent.
 */
export class SwitchViews {
  private readonly views = new Map<string, SwitchView>();
  private readonly plateGeo = new THREE.BoxGeometry(0.34, 0.46, 0.04);
  private readonly leverGeo = new THREE.BoxGeometry(0.12, 0.26, 0.07);
  private readonly ledGeo = new THREE.SphereGeometry(0.035, 10, 8);
  private readonly glowGeo = new THREE.CircleGeometry(0.42, 24);

  constructor(private readonly scene: THREE.Scene, private readonly grid: MapGrid) {}

  update(switches: Record<string, LightSwitchState>, timeSec: number): void {
    for (const s of Object.values(switches)) {
      let v = this.views.get(s.id);
      if (!v) {
        v = this.create(s);
        this.views.set(s.id, v);
      }
      (v.plate.material as THREE.MeshLambertMaterial).color.setHex(s.used ? PLATE_USED : PLATE);
      const led = v.led.material as THREE.MeshLambertMaterial;
      led.color.setHex(s.used ? LED_OFF : LED_ON);
      led.emissive.setHex(s.used ? 0x000000 : 0x1f7a4a);
      // Rocker: tip pointing up while live, flipped down once used.
      v.lever.rotation.x = s.used ? 0.55 : -0.55;
      v.glow.visible = !s.used;
      if (!s.used) {
        const pulse = 0.35 + 0.15 * Math.sin(timeSec * 3);
        (v.glow.material as THREE.MeshBasicMaterial).opacity = pulse;
      }
    }
    for (const [id, v] of this.views) {
      if (!switches[id]) {
        this.scene.remove(v.root, v.glow);
        this.views.delete(id);
      }
    }
  }

  private create(s: LightSwitchState): SwitchView {
    void this.grid;
    // A wall plate with a rocker lever and a small indicator light, flush against the
    // wall face: half a tile toward the wall, minus half the plate depth.
    const root = new THREE.Group();
    const inset = 0.5 - 0.02;
    root.position.set(s.pos.x + s.facing.dx * inset, 0.6, s.pos.y + s.facing.dy * inset);
    // The plate's +Z looks back into the tile (along -facing).
    root.rotation.y = Math.atan2(-s.facing.dx, -s.facing.dy);

    const plate = new THREE.Mesh(this.plateGeo, new THREE.MeshLambertMaterial({ color: PLATE }));
    const lever = new THREE.Mesh(this.leverGeo, new THREE.MeshLambertMaterial({ color: LEVER }));
    lever.position.set(0, -0.02, 0.05);
    lever.rotation.x = -0.55;
    const led = new THREE.Mesh(this.ledGeo, new THREE.MeshLambertMaterial({ color: LED_ON, emissive: 0x1f7a4a }));
    led.position.set(0, 0.17, 0.03);
    root.add(plate, lever, led);

    const glow = new THREE.Mesh(
      this.glowGeo,
      new THREE.MeshBasicMaterial({ color: GLOW, transparent: true, opacity: 0.4, depthWrite: false }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(s.pos.x, 0.02, s.pos.y);

    this.scene.add(root, glow);
    return { root, plate, lever, led, glow };
  }
}

interface SwitchView {
  root: THREE.Group;
  plate: THREE.Mesh;
  lever: THREE.Mesh;
  led: THREE.Mesh;
  glow: THREE.Mesh;
}
