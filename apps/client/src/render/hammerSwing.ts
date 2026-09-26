import * as THREE from "three";

/**
 * A code-drawn hammer that swings from raised-behind to down-in-front of the
 * player over a short arc, with an impact ring on the tile ahead. Attached to
 * the player's root group, so local +Z is the player's front.
 */
export class HammerSwing {
  readonly root = new THREE.Group();
  private readonly pivot = new THREE.Group();
  private readonly ring: THREE.Mesh;
  private t = -1; // seconds since the swing started; <0 when idle

  constructor(private readonly durationSec = 0.35) {
    // Pivot at the right shoulder, slightly forward.
    this.pivot.position.set(0.22, 0.72, 0.12);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8), new THREE.MeshLambertMaterial({ color: 0x8a5a2b }));
    handle.position.set(0, 0.275, 0);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.13), new THREE.MeshLambertMaterial({ color: 0x9aa3b2 }));
    head.position.set(0, 0.55, 0);
    this.pivot.add(handle, head);
    this.pivot.visible = false;

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.3, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.set(0, 0.03, 1); // the tile ahead
    this.ring.visible = false;

    this.root.add(this.pivot, this.ring);
  }

  start(): void {
    this.t = 0;
    this.pivot.visible = true;
  }

  get active(): boolean {
    return this.t >= 0;
  }

  update(dtSec: number): void {
    if (this.t < 0) return;
    this.t += dtSec;
    const u = Math.min(this.t / this.durationSec, 1);
    // Wind up briefly, then slam: ease-in on the way down.
    const angle = u < 0.2 ? -1.4 - u * 1.0 : -1.6 + Math.pow((u - 0.2) / 0.8, 1.6) * 2.9;
    this.pivot.rotation.x = angle;

    const impactStart = 0.7;
    if (u >= impactStart) {
      const v = (u - impactStart) / (1 - impactStart);
      this.ring.visible = true;
      this.ring.scale.setScalar(0.6 + v * 1.4);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - v);
    }
    if (u >= 1) {
      this.t = -1;
      this.pivot.visible = false;
      this.ring.visible = false;
    }
  }
}
