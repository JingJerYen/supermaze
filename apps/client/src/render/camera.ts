import * as THREE from "three";
import { CLIENT_TUNING } from "../tuning.js";

export type CameraMode = "follow" | "overview";

/**
 * Two fixed-orientation views, blended smoothly when switching:
 *  - follow: 2.5D, tilted, trailing the local player; never rotates.
 *  - overview: straight down from above the map centre so the whole maze fits,
 *    for players who reached the tower top (CLAUDE.md section 7).
 */
export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  private readonly offset: THREE.Vector3;
  private readonly focus = new THREE.Vector3();
  private readonly followQuat = new THREE.Quaternion();
  private readonly overviewQuat = new THREE.Quaternion();
  private readonly overviewPos = new THREE.Vector3();
  private mode: CameraMode = "follow";
  private swingPerSec: number = CLIENT_TUNING.overview.transitionPerSec;
  private snapped = false;
  private mapW = 1;
  private mapH = 1;

  constructor(widthPx: number, heightPx: number, mapW: number, mapH: number) {
    const { fovDeg, height, distance } = CLIENT_TUNING.camera;
    this.camera = new THREE.PerspectiveCamera(fovDeg, widthPx / heightPx, 0.1, 400);
    this.offset = new THREE.Vector3(0, height, distance);
    this.fit(widthPx, heightPx);
    this.camera.position.copy(this.offset);
    this.camera.lookAt(0, 0, 0);
    this.followQuat.copy(this.camera.quaternion);
    this.setMapSize(mapW, mapH);
  }

  resize(widthPx: number, heightPx: number): void {
    this.fit(widthPx, heightPx);
    this.setMapSize(this.mapW, this.mapH);
  }

  /**
   * Field of view and follow distance for the viewport. The vertical FOV is capped so
   * the horizontal FOV never exceeds `horizontalFovDeg` (wide phones would otherwise
   * show a tiny scene), and short viewports pull the camera in.
   */
  private fit(widthPx: number, heightPx: number): void {
    const t = CLIENT_TUNING.camera;
    const aspect = widthPx / heightPx;
    const fromHorizontal = 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(t.horizontalFovDeg / 2)) / aspect));
    this.camera.aspect = aspect;
    this.camera.fov = Math.min(t.fovDeg, fromHorizontal);
    this.camera.updateProjectionMatrix();
    const zoom = heightPx < t.shortScreenMaxPx ? t.shortScreenZoom : 1;
    this.offset.set(0, t.height * zoom, t.distance * zoom);
  }

  /** `swingPerSec` overrides the blend rate of the swing between the two views. */
  setMode(mode: CameraMode, swingPerSec: number = CLIENT_TUNING.overview.transitionPerSec): void {
    this.mode = mode;
    this.swingPerSec = swingPerSec;
  }

  /** Recompute the overview pose so the whole map fits at the current aspect ratio. */
  private setMapSize(w: number, h: number): void {
    this.mapW = w;
    this.mapH = h;
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const tan = Math.tan(halfFov);
    const need = Math.max((h / 2) / tan, (w / 2) / (tan * this.camera.aspect)) * CLIENT_TUNING.overview.margin;
    const cx = (w - 1) / 2;
    const cz = (h - 1) / 2;
    this.overviewPos.set(cx, need, cz);
    // A camera probe, not a plain Object3D: cameras look down their -Z axis, plain
    // objects point +Z at the target, which would face the sky.
    const probe = new THREE.PerspectiveCamera();
    probe.position.copy(this.overviewPos);
    probe.up.set(0, 0, -1); // north (map -y) at the top of the screen
    probe.lookAt(cx, 0, cz);
    this.overviewQuat.copy(probe.quaternion);
  }

  /** Move toward `target`. The first call snaps so the round does not start with a swoop. */
  update(target: THREE.Vector3, dtSec: number): void {
    if (!this.snapped) {
      this.focus.copy(target);
      this.snapped = true;
    } else {
      const t = 1 - Math.exp(-CLIENT_TUNING.camera.followLerpPerSec * dtSec);
      this.focus.lerp(target, t);
    }
    const swing = 1 - Math.exp(-this.swingPerSec * dtSec);
    if (this.mode === "overview") {
      this.camera.position.lerp(this.overviewPos, swing);
      this.camera.quaternion.slerp(this.overviewQuat, swing);
    } else {
      const followPos = this.focus.clone().add(this.offset);
      this.camera.position.lerp(followPos, this.snapped ? Math.max(swing, 0.5) : 1);
      this.camera.quaternion.slerp(this.followQuat, swing);
    }
  }
}
