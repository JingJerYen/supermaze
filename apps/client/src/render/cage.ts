import * as THREE from "three";
import { CLIENT_TUNING } from "../tuning.js";

/**
 * Iron cage dropped over a trapped player: a ring of vertical bars between a
 * base hoop and a top hoop, closed by a low dome of curved ribs with a knob.
 * Origin at the ground, centred on the player. Built once per player and
 * reused; one shared material so the whole cage costs a handful of draws only
 * while somebody is actually trapped.
 */
export function createCage(): THREE.Group {
  const t = CLIENT_TUNING.cage;
  const g = new THREE.Group();
  const iron = new THREE.MeshLambertMaterial({ color: t.color });
  const dark = new THREE.MeshLambertMaterial({ color: t.hoopColor });

  const bar = new THREE.CylinderGeometry(t.barRadius, t.barRadius, t.height, 6);
  for (let i = 0; i < t.bars; i++) {
    const a = (i / t.bars) * Math.PI * 2;
    const m = new THREE.Mesh(bar, iron);
    m.position.set(Math.cos(a) * t.radius, t.height / 2, Math.sin(a) * t.radius);
    g.add(m);
  }

  const hoop = new THREE.TorusGeometry(t.radius, t.barRadius * 1.5, 6, 28);
  for (const y of [t.barRadius * 1.5, t.height * 0.5, t.height]) {
    const h = new THREE.Mesh(hoop, dark);
    h.rotation.x = Math.PI / 2;
    h.position.y = y;
    g.add(h);
  }

  // Dome: quarter-circle ribs from the top hoop to the centre.
  const rib = new THREE.TorusGeometry(t.radius, t.barRadius, 6, 12, Math.PI / 2);
  const ribs = Math.max(4, Math.floor(t.bars / 2));
  for (let i = 0; i < ribs; i++) {
    const m = new THREE.Mesh(rib, iron);
    m.scale.y = t.domeHeight / t.radius; // flatten the quarter circle into a low dome
    m.position.y = t.height;
    m.rotation.y = (i / ribs) * Math.PI * 2;
    g.add(m);
  }
  const knob = new THREE.Mesh(new THREE.SphereGeometry(t.barRadius * 3, 10, 8), dark);
  knob.position.y = t.height + t.domeHeight;
  g.add(knob);

  g.visible = false;
  return g;
}

/**
 * Drop / lift animation state for one cage: `t` runs 0 (gone, high above) to
 * 1 (on the ground). Falls with a small bounce, lifts straight up.
 */
export class CageDrop {
  private t = 0;

  update(cage: THREE.Object3D, down: boolean, dtSec: number): void {
    const c = CLIENT_TUNING.cage;
    const step = dtSec / (down ? c.dropSec : c.liftSec);
    this.t = Math.max(0, Math.min(1, this.t + (down ? step : -step)));
    cage.visible = this.t > 0.001;
    if (!cage.visible) return;
    // Ease-in fall; a short overshoot near the end reads as the cage hitting the floor.
    const fall = this.t * this.t;
    const bounce = down && this.t > 0.85 ? Math.sin(((this.t - 0.85) / 0.15) * Math.PI) * c.bounce : 0;
    cage.position.y = (1 - fall) * c.dropHeight + bounce;
  }
}
