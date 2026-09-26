import * as THREE from "three";
import { CLIENT_TUNING } from "../tuning.js";

/**
 * Map-wide lighting states (CLAUDE.md section 8). Lit: hemisphere + sun.
 * Dark: ambient nearly off and a point light riding on the local player whose
 * range is the tunable darkness radius, so only a circle around them is visible.
 */
export class SceneLighting {
  private readonly hemi = new THREE.HemisphereLight(0xdfe8ff, 0x303540, 1.0);
  private readonly sun = new THREE.DirectionalLight(0xffffff, 1.4);
  private readonly lamp: THREE.PointLight;
  private dark = false;

  constructor(scene: THREE.Scene, radiusTiles: number) {
    this.sun.position.set(6, 12, 4);
    this.lamp = new THREE.PointLight(0xfff1d6, 0, radiusTiles, CLIENT_TUNING.dark.lampDecay);
    this.lamp.visible = false;
    scene.add(this.hemi, this.sun, this.lamp);
  }

  setDark(dark: boolean): void {
    if (dark === this.dark) return;
    this.dark = dark;
    this.hemi.intensity = dark ? CLIENT_TUNING.dark.ambient : 1.0;
    this.sun.intensity = dark ? 0 : 1.4;
    this.lamp.visible = dark;
    this.lamp.intensity = dark ? CLIENT_TUNING.dark.lampIntensity : 0;
  }

  /** Keep the darkness circle centred on the local player. */
  follow(pos: THREE.Vector3): void {
    this.lamp.position.set(pos.x, pos.y + 1.2, pos.z);
  }

  isDark(): boolean {
    return this.dark;
  }
}
