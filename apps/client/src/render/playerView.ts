import * as THREE from "three";
import { moverPosition, type Dir, type MapGrid, type MoverState } from "@supermaze/sim";
import { tileElevation } from "./elevation.js";

export const PLAYER_HEIGHT = 0.9;

/** World-space feet position of a mover. */
function poseOf(grid: MapGrid, m: MoverState, out: THREE.Vector3): THREE.Vector3 {
  const { x, y } = moverPosition(m);
  const from = tileElevation(grid, m.from);
  const to = m.target ? tileElevation(grid, m.target) : from;
  return out.set(x, from + (to - from) * m.progress, y);
}

export class PlayerView {
  readonly mesh: THREE.Mesh;
  private readonly nose: THREE.Mesh;
  private readonly color: number;
  private readonly prevPose = new THREE.Vector3();
  private readonly currPose = new THREE.Vector3();

  constructor(color: number) {
    this.color = color;
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, PLAYER_HEIGHT, 0.6),
      new THREE.MeshLambertMaterial({ color }),
    );
    // Small "nose" showing which way the player faces, i.e. where an item would be placed.
    this.nose = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.16), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    this.nose.position.set(0, 0.2, 0.38);
    this.mesh.add(this.nose);
  }

  setFacing(dir: Dir): void {
    this.mesh.rotation.y = Math.atan2(dir.dx, dir.dy);
  }

  setFrozen(frozen: boolean): void {
    (this.mesh.material as THREE.MeshLambertMaterial).color.setHex(frozen ? 0x9fd3ff : this.color);
  }

  /**
   * Render between the previous and current simulation states. The simulation
   * runs at a fixed tick rate below the frame rate; without this the player
   * would visibly step once per tick.
   */
  update(grid: MapGrid, prev: MoverState, curr: MoverState, alpha: number): void {
    poseOf(grid, prev, this.prevPose);
    poseOf(grid, curr, this.currPose);
    this.mesh.position.lerpVectors(this.prevPose, this.currPose, alpha);
    this.mesh.position.y += PLAYER_HEIGHT / 2;
  }

  /** Park the player on the tower platform; `slot` spreads arrivals so they do not overlap. */
  placeOnTower(center: THREE.Vector3, platformTopY: number, slot: number): void {
    const ring = 0.9;
    const angle = (slot / 6) * Math.PI * 2;
    this.mesh.position.set(
      center.x + Math.cos(angle) * ring,
      platformTopY + PLAYER_HEIGHT / 2,
      center.z + Math.sin(angle) * ring,
    );
  }
}
