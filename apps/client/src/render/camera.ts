import * as THREE from "three";
import { CLIENT_TUNING } from "../tuning.js";

export type CameraMode = "follow" | "overview" | "above" | "front";

/**
 * Two fixed-orientation views, blended smoothly when switching:
 *  - follow: 2.5D, tilted, trailing the local player; never rotates.
 *  - overview: straight down from above the map centre so the whole maze fits,
 *    for players who reached the tower top (CLAUDE.md section 7).
 *  - above: straight down from `eagleEye.heightTiles` over the local player,
 *    following them, north up (the Eagle Eye skill; section 4.1).
 *  - front: a wide shot of the whole tower from far out in front of one of its
 *    faces (`setFront`), for watching your own climb's light run up it (section 5).
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
  /** Height of the "above" view over the focus, world units. */
  private aboveHeight: number = CLIENT_TUNING.eagleEye.heightTiles;
  private mapW = 1;
  private mapH = 1;
  private readonly frontPos = new THREE.Vector3();
  private readonly frontQuat = new THREE.Quaternion();
  /** What the front shot frames, kept so a resize can reframe it. */
  private front: { tower: THREE.Vector3; topY: number; out: { dx: number; dy: number }; fov: number } | null = null;

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
    if (this.front) this.setFront(this.front.tower, this.front.topY, this.front.out);
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

  /** Height of the "above" view over the player (raised near the tower so the camera stays clear of it). */
  setAboveHeight(height: number): void {
    this.aboveHeight = height;
  }

  /** `swingPerSec` overrides the blend rate of the swing between the two views. */
  setMode(mode: CameraMode, swingPerSec: number = CLIENT_TUNING.overview.transitionPerSec): void {
    this.mode = mode;
    this.swingPerSec = swingPerSec;
  }

  /**
   * Pose of the "front" view: the whole tower in frame, seen from far out along
   * `out` (the face's outward direction in map terms, y pointing south).
   */
  setFront(tower: THREE.Vector3, topY: number, out: { dx: number; dy: number }): void {
    const f = this.front;
    if (f && f.topY === topY && f.out.dx === out.dx && f.out.dy === out.dy && f.tower.equals(tower) && f.fov === this.camera.fov) return;
    this.front = { tower: tower.clone(), topY, out: { ...out }, fov: this.camera.fov };
    const t = CLIENT_TUNING.climb.front;
    const h = topY + t.headroom;
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const dist = (h * 0.5 * t.margin) / tan;
    const probe = new THREE.PerspectiveCamera();
    probe.position.set(tower.x + out.dx * dist, h * t.eyeShare, tower.z + out.dy * dist);
    probe.lookAt(tower.x, h * t.aimShare, tower.z);
    this.frontPos.copy(probe.position);
    this.frontQuat.copy(probe.quaternion);
  }

  /**
   * Opening fly-in, applied after `update`: at `progress` 0 a wide shot from far
   * in front of (south of) the tower with all of it in frame, easing into the
   * follow view by 1. A short hold on the wide shot comes first.
   */
  applyIntro(progress: number, tower: THREE.Vector3, towerTopY: number): void {
    if (progress >= 1) return;
    const t = CLIENT_TUNING.intro;
    const p = Math.min(1, Math.max(0, (progress - t.holdShare) / (1 - t.holdShare)));
    const k = p * p * (3 - 2 * p);
    const h = towerTopY + t.headroom;
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const dist = (h * 0.5 * t.margin) / tan;
    const probe = new THREE.PerspectiveCamera();
    probe.position.set(tower.x, h * t.eyeShare, tower.z + dist);
    probe.lookAt(tower.x, h * 0.5, tower.z);
    const followPos = this.focus.clone().add(this.offset);
    this.camera.position.lerpVectors(probe.position, followPos, k);
    this.camera.quaternion.slerpQuaternions(probe.quaternion, this.followQuat, k);
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
    } else if (this.mode === "front") {
      this.camera.position.lerp(this.frontPos, swing);
      this.camera.quaternion.slerp(this.frontQuat, swing);
    } else if (this.mode === "above") {
      // Looking straight down is the overview's orientation, whatever the position.
      const above = this.focus.clone().setY(this.focus.y + this.aboveHeight);
      this.camera.position.lerp(above, swing);
      this.camera.quaternion.slerp(this.overviewQuat, swing);
    } else {
      const followPos = this.focus.clone().add(this.offset);
      this.camera.position.lerp(followPos, this.snapped ? Math.max(swing, 0.5) : 1);
      this.camera.quaternion.slerp(this.followQuat, swing);
    }
  }
}
