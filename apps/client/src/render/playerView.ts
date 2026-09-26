import * as THREE from "three";
import { moverPosition, type Dir, type MapGrid, type MoverState } from "@supermaze/sim";
import { characters, type CharacterRig } from "./characters.js";
import { tileElevation } from "./elevation.js";

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
  private walking = false;

  constructor(playerId: string, color: number) {
    this.color = color;
    this.mesh = new THREE.Group();

    this.disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.04, 20),
      new THREE.MeshLambertMaterial({ color }),
    );
    this.disc.position.y = 0.02;
    this.mesh.add(this.disc);

    this.rig = characters.createRig(playerId, PLAYER_HEIGHT);
    if (this.rig) {
      this.mesh.add(this.rig.root);
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, PLAYER_HEIGHT, 0.6), new THREE.MeshLambertMaterial({ color }));
      body.position.y = PLAYER_HEIGHT / 2;
      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.16), new THREE.MeshLambertMaterial({ color: 0xffffff }));
      nose.position.set(0, PLAYER_HEIGHT / 2 + 0.2, 0.38);
      this.mesh.add(body, nose);
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
  }

  private setWalking(walking: boolean): void {
    if (!this.rig || walking === this.walking) return;
    this.walking = walking;
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
    (this.disc.material as THREE.MeshLambertMaterial).color.setHex(frozen ? FROZEN_COLOR : this.color);
  }
}
