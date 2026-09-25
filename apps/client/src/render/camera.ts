import * as THREE from "three";
import { CLIENT_TUNING } from "../tuning.js";

/**
 * 2.5D camera: high, tilted, looking toward the focus point.
 * Rotation is fixed so walls read consistently; only the position follows.
 */
export function createGameCamera(aspect: number): THREE.PerspectiveCamera {
  const { fovDeg } = CLIENT_TUNING.camera;
  const camera = new THREE.PerspectiveCamera(fovDeg, aspect, 0.1, 200);
  updateCameraFocus(camera, new THREE.Vector3(0, 0, 0), 1);
  return camera;
}

/** Move the camera toward `focus` with exponential smoothing. `dtSec` may be 1 for an instant snap. */
export function updateCameraFocus(camera: THREE.PerspectiveCamera, focus: THREE.Vector3, dtSec: number): void {
  const { height, distance, followLerpPerSec } = CLIENT_TUNING.camera;
  const target = new THREE.Vector3(focus.x, focus.y + height, focus.z + distance);
  const t = 1 - Math.exp(-followLerpPerSec * dtSec);
  camera.position.lerp(target, t);
  camera.lookAt(focus);
}
