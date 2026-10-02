import * as THREE from "three";

const COLORS = [0xffd23f, 0xff4d5e, 0x4dd2ff, 0x7dff8a, 0xc58bff, 0xffffff];
const MAX = 120;
const LIFE_SEC = 3.5;
const GRAVITY = 3.2;

/**
 * A burst of paper confetti for a celebration: small coloured squares thrown
 * up around a point, fluttering down and spinning. One instanced mesh, so a
 * whole burst is a single draw.
 */
export class Confetti {
  private readonly mesh: THREE.InstancedMesh;
  private readonly pos: THREE.Vector3[] = [];
  private readonly vel: THREE.Vector3[] = [];
  private readonly rot: THREE.Euler[] = [];
  private readonly spin: THREE.Vector3[] = [];
  private age = LIFE_SEC;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly one = new THREE.Vector3(1, 1, 1);

  constructor(private readonly scene: THREE.Scene) {
    const geo = new THREE.PlaneGeometry(0.07, 0.1);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), MAX);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    const color = new THREE.Color();
    for (let i = 0; i < MAX; i++) {
      this.pos.push(new THREE.Vector3());
      this.vel.push(new THREE.Vector3());
      this.rot.push(new THREE.Euler());
      this.spin.push(new THREE.Vector3());
      this.mesh.setColorAt(i, color.setHex(COLORS[i % COLORS.length] as number));
    }
    scene.add(this.mesh);
  }

  /** Throw a burst from around `at`. */
  burst(at: THREE.Vector3): void {
    for (let i = 0; i < MAX; i++) {
      const a = Math.random() * Math.PI * 2;
      const out = 0.6 + Math.random() * 1.4;
      this.pos[i]!.set(at.x + (Math.random() - 0.5) * 0.4, at.y + Math.random() * 0.3, at.z + (Math.random() - 0.5) * 0.4);
      this.vel[i]!.set(Math.cos(a) * out, 2.6 + Math.random() * 2, Math.sin(a) * out);
      this.rot[i]!.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      this.spin[i]!.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
    }
    this.age = 0;
    this.mesh.count = MAX;
  }

  update(dt: number): void {
    if (this.age >= LIFE_SEC) return;
    this.age += dt;
    if (this.age >= LIFE_SEC) {
      this.mesh.count = 0;
      return;
    }
    // Paper falls slowly: heavy drag once it is coming down.
    for (let i = 0; i < MAX; i++) {
      const v = this.vel[i]!;
      v.y -= GRAVITY * dt;
      if (v.y < -0.7) v.y = -0.7;
      v.x *= 1 - 1.2 * dt;
      v.z *= 1 - 1.2 * dt;
      this.pos[i]!.addScaledVector(v, dt);
      const r = this.rot[i]!;
      const s = this.spin[i]!;
      r.set(r.x + s.x * dt, r.y + s.y * dt, r.z + s.z * dt);
      this.m.compose(this.pos[i]!, this.q.setFromEuler(r), this.one);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
