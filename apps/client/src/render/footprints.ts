import * as THREE from "three";
import type { MapGrid, TilePos } from "@supermaze/sim";
import { CLIENT_TUNING } from "../tuning.js";
import { tileElevation } from "./elevation.js";

/** One tile the player walked onto, and the way they were heading. */
export interface Step {
  tile: TilePos;
  dx: number;
  dy: number;
}

/**
 * The local player's last `max` steps, newest last. A step is recorded each
 * time the player stands on a new tile; stairs and the tower top leave no
 * prints. Pure, so it is tested without a renderer.
 */
export class FootTrail {
  private readonly steps: Step[] = [];
  private last: TilePos | null = null;

  constructor(private readonly max: number) {}

  /** Feed the tile the player stands on (or last stood on) each frame. */
  visit(tile: TilePos, grid: MapGrid): boolean {
    const prev = this.last;
    if (prev && prev.x === tile.x && prev.y === tile.y && prev.layer === tile.layer) return false;
    this.last = tile;
    if (this.max <= 0 || tile.layer === "towerTop" || grid.kindAt(tile.x, tile.y) === "stairs") return false;
    // The way in: from the previous tile, or nothing to go on for the first one.
    const dx = prev ? Math.sign(tile.x - prev.x) : 0;
    const dy = prev ? Math.sign(tile.y - prev.y) : 1;
    this.steps.push({ tile, dx, dy: dx === 0 && dy === 0 ? 1 : dy });
    if (this.steps.length > this.max) this.steps.shift();
    return true;
  }

  get list(): readonly Step[] {
    return this.steps;
  }
}

const VERT = `
attribute float aAlpha;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const FRAG = `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(uColor, vAlpha);
}`;

/**
 * The local player's footprints (CLAUDE.md section 17.1): a pair of small
 * prints on each of the last few tiles walked, oldest faintest. Unlit, so they
 * show in the dark too; only the player's own, and never on the minimap.
 * One instanced mesh, one draw call, rebuilt only when a step is added.
 */
export class FootprintView {
  private readonly trail: FootTrail;
  private readonly mesh: THREE.InstancedMesh;
  private readonly alpha: THREE.InstancedBufferAttribute;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

  constructor(scene: THREE.Scene, private readonly grid: MapGrid, steps: number) {
    const t = CLIENT_TUNING.footprints;
    this.trail = new FootTrail(steps);
    const shape = new THREE.CircleGeometry(0.5, 12);
    shape.scale(t.width, t.length, 1);
    const count = Math.max(1, steps * 2);
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
    shape.setAttribute("aAlpha", this.alpha);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uColor: { value: new THREE.Color(t.color) } },
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(shape, material, count);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
  }

  /** The tile the local player stands on, or null when there is none (no player yet, or on the tower). */
  update(tile: TilePos | null): void {
    if (!tile || !this.trail.visit(tile, this.grid)) return;
    const t = CLIENT_TUNING.footprints;
    const steps = this.trail.list;
    let n = 0;
    steps.forEach((s, i) => {
      // Newest at full strength, fading to `oldest` of it at the far end.
      const age = steps.length > 1 ? (steps.length - 1 - i) / (steps.length - 1) : 0;
      const a = t.opacity * (1 - age * (1 - t.oldest));
      const heading = Math.atan2(-s.dx, -s.dy);
      this.q.setFromAxisAngle(this.up, heading).multiply(this.flat);
      const y = tileElevation(this.grid, s.tile) + t.lift;
      for (const side of [-1, 1]) {
        // Left and right print, one a little ahead of the other.
        const across = side * t.gap;
        const along = side * t.stagger;
        const x = s.tile.x + across * -s.dy + along * s.dx;
        const z = s.tile.y + across * s.dx + along * s.dy;
        this.m.compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(1, 1, 1));
        this.mesh.setMatrixAt(n, this.m);
        this.alpha.setX(n, a);
        n++;
      }
    });
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.alpha.needsUpdate = true;
  }
}
