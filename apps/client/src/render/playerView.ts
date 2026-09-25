import * as THREE from "three";
import { moverPosition, type MapGrid, type MoverState, type TilePos } from "@supermaze/sim";

const PLAYER_HEIGHT = 0.9;

/** Ground height under a tile for a given layer. Stairs sit halfway so the walk up is linear. */
function elevation(grid: MapGrid, tile: TilePos): number {
  switch (grid.kindAt(tile.x, tile.y)) {
    case "stairs":
      return 0.5;
    case "wall":
      return 1;
    case "bridge":
      return tile.layer === "wallTop" ? 1 : 0;
    default:
      return 0;
  }
}

/** World-space feet position of a mover. */
function poseOf(grid: MapGrid, m: MoverState, out: THREE.Vector3): THREE.Vector3 {
  const { x, y } = moverPosition(m);
  const from = elevation(grid, m.from);
  const to = m.target ? elevation(grid, m.target) : from;
  return out.set(x, from + (to - from) * m.progress, y);
}

export class PlayerView {
  readonly mesh: THREE.Mesh;
  private readonly prevPose = new THREE.Vector3();
  private readonly currPose = new THREE.Vector3();

  constructor(color: number) {
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, PLAYER_HEIGHT, 0.6),
      new THREE.MeshLambertMaterial({ color }),
    );
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
}
