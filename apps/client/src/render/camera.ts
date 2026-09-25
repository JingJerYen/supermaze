import * as THREE from "three";
import { CLIENT_TUNING } from "../tuning.js";

/**
 * 2.5D follow camera. The orientation is fixed once at construction and never
 * changes; only the position translates, so the view never tilts or rotates.
 * The focus point is smoothed exponentially and the camera sits at a constant
 * offset from it.
 */
export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  private readonly offset: THREE.Vector3;
  private readonly focus = new THREE.Vector3();
  private snapped = false;

  constructor(aspect: number) {
    const { fovDeg, height, distance } = CLIENT_TUNING.camera;
    this.camera = new THREE.PerspectiveCamera(fovDeg, aspect, 0.1, 200);
    this.offset = new THREE.Vector3(0, height, distance);
    this.camera.position.copy(this.offset);
    this.camera.lookAt(0, 0, 0);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
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
    this.camera.position.copy(this.focus).add(this.offset);
  }
}
