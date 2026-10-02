import { CLIENT_TUNING } from "../tuning.js";
import type { CameraMode } from "./camera.js";
import { climbPhase } from "./climbSequence.js";
import { platformTopY } from "./elevation.js";

/** What the local player's own climb asks of the camera and the screen this frame. */
export interface ClimbShot {
  camera: CameraMode;
  /** How far to raise the follow focus above the character, world units. */
  lift: number;
  /** Fade the tower's canopy and the like for the top-down view. */
  towerOverview: boolean;
  /** Keep the tower see-through while it may hide the character walking in. */
  watchTower: boolean;
  /** The climb is still being shown: hold the result screen back. */
  busy: boolean;
}

/**
 * Your own climb, as a shot: the camera keeps following while the door opens
 * and you walk in, rides up the tower with the light, then swings slowly down
 * to the overview. The result screen waits until the swing has settled; the
 * rank itself was decided by the simulation the moment you pressed the button.
 */
export class ClimbCamera {
  private wasClimbing = false;
  private endedAtSec: number | null = null;

  /** `climbT`: seconds into your climb animation, or null when none is playing. */
  update(climbT: number | null, onTower: boolean, nowSec: number): ClimbShot {
    const c = CLIENT_TUNING.climb;
    if (climbT !== null) {
      this.wasClimbing = true;
      const ph = climbPhase(climbT);
      const eased = ph.ascent * ph.ascent * (3 - 2 * ph.ascent);
      return { camera: "follow", lift: eased * platformTopY(), towerOverview: false, watchTower: ph.walkIn < 1, busy: true };
    }
    if (this.wasClimbing) {
      this.wasClimbing = false;
      this.endedAtSec = nowSec;
    }
    const settling = this.endedAtSec !== null && nowSec - this.endedAtSec < c.settleSec;
    return { camera: onTower ? "overview" : "follow", lift: 0, towerOverview: onTower, watchTower: !onTower, busy: settling };
  }
}
