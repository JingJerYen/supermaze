import { CLIENT_TUNING } from "../tuning.js";
import type { CameraMode } from "./camera.js";
import { climbPhase, type Face } from "./climbSequence.js";

/** What the local player's own climb asks of the camera and the screen this frame. */
export interface ClimbShot {
  camera: CameraMode;
  /** The face the wide "front" shot looks at, when `camera` is "front". */
  face: Face | null;
  /** Fade the tower's canopy and the like for the top-down view. */
  towerOverview: boolean;
  /** Keep the tower see-through while it may hide the character walking in. */
  watchTower: boolean;
  /** The climb is still being shown: hold the result screen back. */
  busy: boolean;
}

/**
 * Your own climb, as a shot: the camera follows while the door opens and you
 * start walking in, then pulls back to a wide shot from out in front of that
 * door, so the light is seen running up the whole tower to the crystal. With
 * the round over it stays there under the result screen; with the round still
 * on it holds a moment and swings down to the overview. The result screen
 * waits until the finished climb has been on screen for a while; the rank
 * itself was decided by the simulation the moment you pressed the button.
 */
export class ClimbCamera {
  private face: Face | null = null;
  private endedAtSec: number | null = null;

  update(climb: { face: Face; t: number } | null, onTower: boolean, roundOver: boolean, nowSec: number): ClimbShot {
    const c = CLIENT_TUNING.climb;
    if (climb) {
      this.face = climb.face;
      this.endedAtSec = null;
      const pulled = climbPhase(climb.t).walkIn >= c.front.fromWalkIn;
      return pulled
        ? { camera: "front", face: climb.face, towerOverview: false, watchTower: false, busy: true }
        : { camera: "follow", face: null, towerOverview: false, watchTower: true, busy: true };
    }
    if (!onTower) {
      // A new round, or never climbed: back to the plain follow view.
      this.face = null;
      this.endedAtSec = null;
      return { camera: "follow", face: null, towerOverview: false, watchTower: true, busy: false };
    }
    if (this.face && this.endedAtSec === null) this.endedAtSec = nowSec;
    const since = this.endedAtSec === null ? Infinity : nowSec - this.endedAtSec;
    const busy = since < c.settleSec;
    if (this.face && (roundOver || since < c.front.holdSec)) {
      return { camera: "front", face: this.face, towerOverview: false, watchTower: false, busy };
    }
    return { camera: "overview", face: null, towerOverview: true, watchTower: false, busy };
  }
}
