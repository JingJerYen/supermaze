import * as THREE from "three";
import { CLIENT_TUNING } from "../tuning.js";
import type { Theme } from "./themes.js";

/**
 * Map-wide lighting states (CLAUDE.md section 8). Lit: hemisphere + sun.
 * Dark: ambient nearly off and a point light riding on the local player whose
 * range is the tunable darkness radius, so only a circle around them is visible.
 */
export class SceneLighting {
  private readonly hemi: THREE.HemisphereLight;
  private readonly sun: THREE.DirectionalLight;
  private readonly lamp: THREE.PointLight;
  private readonly fill: THREE.PointLight;
  private dark = false;

  constructor(scene: THREE.Scene, radiusTiles: number, private readonly theme: Theme) {
    this.hemi = new THREE.HemisphereLight(theme.hemiSky, theme.hemiGround, theme.hemiIntensity);
    this.sun = new THREE.DirectionalLight(theme.sunColor, theme.sunIntensity);
    this.sun.position.set(6, 12, 4);
    this.lamp = new THREE.PointLight(0xfff1d6, 0, radiusTiles, CLIENT_TUNING.dark.lampDecay);
    this.lamp.visible = false;
    this.fill = new THREE.PointLight(0xdfe8ff, 0, radiusTiles * 0.8, CLIENT_TUNING.dark.lampDecay);
    this.fill.visible = false;
    scene.add(this.hemi, this.sun, this.lamp, this.fill);
  }

  setDark(dark: boolean): void {
    if (dark === this.dark) return;
    this.dark = dark;
    this.hemi.intensity = dark ? CLIENT_TUNING.dark.ambient : this.theme.hemiIntensity;
    this.sun.intensity = dark ? 0 : this.theme.sunIntensity;
    this.lamp.visible = dark;
    this.lamp.intensity = dark ? CLIENT_TUNING.dark.lampIntensity : 0;
    this.fill.visible = dark && CLIENT_TUNING.dark.fillIntensity > 0;
    this.fill.intensity = dark ? CLIENT_TUNING.dark.fillIntensity : 0;
  }

  /** Keep the darkness circle centred on the local player. */
  follow(pos: THREE.Vector3): void {
    const d = CLIENT_TUNING.dark;
    this.lamp.position.set(pos.x, pos.y + d.lampOffsetY, pos.z + d.lampOffsetZ);
    this.fill.position.set(pos.x, pos.y + d.fillOffsetY, pos.z + d.fillOffsetZ);
  }

  /** Visible radius in the dark; larger on the tower top (CLAUDE.md section 8). */
  setRadius(tiles: number): void {
    this.lamp.distance = tiles;
    this.fill.distance = tiles * 0.8;
  }

  isDark(): boolean {
    return this.dark;
  }
}
