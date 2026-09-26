import * as THREE from "three";
import { moverPosition, type Dir, type MapGrid, type MoverState } from "@supermaze/sim";
import { characters, type CharacterRig } from "./characters.js";
import { tileElevation } from "./elevation.js";
import { HammerSwing } from "./hammerSwing.js";
import { models } from "./models.js";
import { CLIENT_TUNING } from "../tuning.js";

export const PLAYER_HEIGHT = 0.9;
const FROZEN_COLOR = 0x9fd3ff;

/** World-space feet position of a mover. */
function poseOf(grid: MapGrid, m: MoverState, out: THREE.Vector3): THREE.Vector3 {
  const { x, y } = moverPosition(m);
  const from = tileElevation(grid, m.from);
  const to = m.target ? tileElevation(grid, m.target) : from;
  return out.set(x, from + (to - from) * m.progress, y);
}

/**
 * One player on screen: an animated character when the models are available,
 * otherwise a box; plus a team-coloured disc at the feet. `mesh` is the root
 * whose position is the feet on the ground.
 */
export class PlayerView {
  readonly mesh: THREE.Group;
  private readonly disc: THREE.Mesh;
  private readonly rig: CharacterRig | null;
  private readonly color: number;
  private readonly prevPose = new THREE.Vector3();
  private readonly currPose = new THREE.Vector3();
  private readonly hammer = new HammerSwing();
  private walking = false;
  private oneShot: THREE.AnimationAction | null = null;
  /** "This is you" arrow above the head; only the local player's view has one. */
  private marker: THREE.Mesh | null = null;
  private markerTime = 0;
  /** The normal body (rig or box) and the ghost model that stands in for it during a chase. */
  private readonly body = new THREE.Group();
  private ghost: THREE.Object3D | null = null;
  private ghostTime = 0;

  constructor(playerId: string, color: number) {
    this.color = color;
    this.mesh = new THREE.Group();

    // Team marker: a thin translucent ring at the feet, unlit so it reads in the dark too.
    this.disc = new THREE.Mesh(
      new THREE.RingGeometry(0.26, 0.34, 28),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.disc.rotation.x = -Math.PI / 2;
    this.disc.position.y = 0.015;
    this.mesh.add(this.disc);

    this.mesh.add(this.hammer.root, this.body);
    this.rig = characters.createRig(playerId, PLAYER_HEIGHT);
    if (this.rig) {
      this.body.add(this.rig.root);
      this.rig.mixer.addEventListener("finished", (e) => {
        if (e.action !== this.oneShot) return;
        this.oneShot = null;
        e.action.fadeOut(0.1);
        this.base()?.reset().fadeIn(0.1).play();
      });
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, PLAYER_HEIGHT, 0.6), new THREE.MeshLambertMaterial({ color }));
      body.position.y = PLAYER_HEIGHT / 2;
      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.16), new THREE.MeshLambertMaterial({ color: 0xffffff }));
      nose.position.set(0, PLAYER_HEIGHT / 2 + 0.2, 0.38);
      this.body.add(body, nose);
    }
  }

  /**
   * Render between the previous and current simulation states. The simulation
   * runs at a fixed tick rate below the frame rate; without this the player
   * would visibly step once per tick.
   */
  update(grid: MapGrid, prev: MoverState, curr: MoverState, alpha: number, dtSec: number): void {
    poseOf(grid, prev, this.prevPose);
    poseOf(grid, curr, this.currPose);
    this.mesh.position.lerpVectors(this.prevPose, this.currPose, alpha);
    this.setWalking(curr.target !== null);
    this.rig?.mixer.update(dtSec);
    this.hammer.update(dtSec);
    if (this.marker) {
      const t = CLIENT_TUNING.selfMarker;
      this.markerTime += dtSec;
      this.marker.position.y = t.height + t.length / 2 + Math.sin(this.markerTime * t.bobHz * Math.PI * 2) * t.bobAmp;
    }
    if (this.ghost?.visible) {
      const g = CLIENT_TUNING.ghostModel;
      this.ghostTime += dtSec;
      this.ghost.position.y = g.hover + Math.sin(this.ghostTime * g.bobHz * Math.PI * 2) * g.bobAmp;
    }
  }

  /**
   * Ghost look during a chase: the ghost.glb model floats in place of the
   * character. Without the file the character is left untouched (no tinting;
   * CLAUDE.md section 13).
   */
  setGhost(on: boolean): void {
    if (on && !this.ghost) {
      this.ghost = models.instantiate("ghost");
      if (this.ghost) this.mesh.add(this.ghost);
    }
    if (!this.ghost) return;
    this.ghost.visible = on;
    this.body.visible = !on;
  }

  /**
   * Show or hide the local-player arrow: a team-coloured cone pointing down at
   * the head, unlit so it reads in the dark, bobbing slowly. Twelve characters
   * shared by up to six players are not enough to tell yourself apart otherwise.
   */
  setSelfMarker(on: boolean): void {
    if (on && !this.marker) {
      const t = CLIENT_TUNING.selfMarker;
      this.marker = new THREE.Mesh(
        new THREE.ConeGeometry(t.radius, t.length, 4),
        new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: t.opacity, depthWrite: false }),
      );
      this.marker.rotation.x = Math.PI; // apex down
      this.marker.position.y = t.height + t.length / 2;
      this.mesh.add(this.marker);
    }
    if (this.marker) this.marker.visible = on;
  }

  /** Place the character at a world x/z on the ground (used while walking into the tower). */
  setGhostPose(x: number, z: number, walking: boolean, dtSec: number): void {
    this.mesh.position.set(x, 0, z);
    this.setWalking(walking);
    this.rig?.mixer.update(dtSec);
  }

  setVisible(v: boolean): void {
    this.mesh.visible = v;
  }

  /** Swing the hammer at the tile ahead: melee clip on the body plus the prop arc. */
  swingHammer(): void {
    this.hammer.start();
    this.playOnce("attack-melee-right");
  }

  /** Bend down briefly, for keys and boxes. */
  pickUp(): void {
    this.playOnce("pick-up");
  }

  private base(): THREE.AnimationAction | null {
    if (!this.rig) return null;
    return this.walking ? this.rig.walk : this.rig.idle;
  }

  private playOnce(name: string): void {
    const action = this.rig?.clip(name);
    if (!action) return;
    this.oneShot?.stop();
    this.base()?.fadeOut(0.08);
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = false;
    action.fadeIn(0.08).play();
    this.oneShot = action;
  }

  private setWalking(walking: boolean): void {
    if (!this.rig || walking === this.walking) return;
    this.walking = walking;
    if (this.oneShot) return; // the finished handler resumes the right base clip
    const from = walking ? this.rig.idle : this.rig.walk;
    const to = walking ? this.rig.walk : this.rig.idle;
    if (to) {
      to.reset().play();
      if (from) from.crossFadeTo(to, 0.15, false);
    }
  }

  setFacing(dir: Dir): void {
    this.mesh.rotation.y = Math.atan2(dir.dx, dir.dy);
  }

  setFrozen(frozen: boolean): void {
    (this.disc.material as THREE.MeshBasicMaterial).color.setHex(frozen ? FROZEN_COLOR : this.color);
  }
}
