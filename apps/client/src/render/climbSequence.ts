import * as THREE from "three";
import type { Dir } from "@supermaze/sim";
import { CLIENT_TUNING } from "../tuning.js";

/**
 * Presentation of climbing the tower (CLAUDE.md 5). The simulation moves a
 * player to the platform instantly; the client delays the picture: the door on
 * the face the player came from slides open, the character walks in and
 * vanishes, a light runs up that face's rune strip, the crystal pulses, and
 * only then is the character drawn on the platform. Progress is derived from
 * the tick the player's phase changed, so every client shows the same moment.
 */

export type Face = "north" | "south" | "east" | "west";

const FACES: Record<Face, Dir> = {
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  east: { dx: 1, dy: 0 },
  west: { dx: -1, dy: 0 },
};

/** Which face of the tower a tile is on, by its dominant offset from the centre. */
export function faceOf(tile: { x: number; y: number }, center: { x: number; z: number }): Face {
  const dx = tile.x - center.x;
  const dz = tile.y - center.z;
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? "east" : "west";
  return dz > 0 ? "south" : "north";
}

/** Phase of the sequence at `t` seconds after the climb began. */
export function climbPhase(t: number): { walkIn: number; doorOpen: number; ascent: number; done: boolean } {
  const c = CLIENT_TUNING.climb;
  const doorOpen = clamp01(t / c.doorOpenSec) * (1 - clamp01((t - c.walkInSec - c.doorOpenSec) / c.doorCloseSec));
  const walkIn = clamp01((t - c.doorOpenSec * 0.5) / c.walkInSec);
  const ascentStart = c.doorOpenSec + c.walkInSec;
  const ascent = clamp01((t - ascentStart) / c.ascentSec);
  return { walkIn, doorOpen, ascent, done: t >= ascentStart + c.ascentSec };
}

export function climbTotalSec(): number {
  const c = CLIENT_TUNING.climb;
  return c.doorOpenSec + c.walkInSec + c.ascentSec;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** The tower's animated parts: one door and one ascent light per face, plus the crystal. */
export class TowerAnimations {
  private readonly doors = new Map<Face, { mesh: THREE.Mesh; closedY: number; height: number }>();
  private readonly ascents = new Map<Face, THREE.Mesh>();
  private readonly ascentMats: THREE.MeshBasicMaterial[] = [];
  private crystalPulse = 0;

  constructor(
    private readonly group: THREE.Group,
    private readonly center: THREE.Vector3,
    footW: number,
    footD: number,
    private readonly shaftWidth: number,
    private readonly shaftBottomY: number,
    private readonly shaftHeight: number,
    private readonly tierHeight: number,
    private readonly crystal: THREE.Mesh | null,
    runeColor: number,
  ) {
    const doorMat = new THREE.MeshLambertMaterial({ color: 0x20242e });
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x5c6472 });
    const doorH = tierHeight * 0.95;
    const doorW = 0.7;
    for (const [face, d] of Object.entries(FACES) as [Face, Dir][]) {
      const half = d.dx !== 0 ? footW / 2 : footD / 2;
      const px = center.x + d.dx * (half + 0.02);
      const pz = center.z + d.dy * (half + 0.02);
      const yaw = Math.atan2(d.dx, d.dy);
      // Frame: two jambs and a lintel standing proud of the tier face.
      const frame = new THREE.Group();
      for (const side of [-1, 1]) {
        const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.1, doorH + 0.1, 0.08), frameMat);
        jamb.position.set(side * (doorW / 2 + 0.05), (doorH + 0.1) / 2, 0);
        frame.add(jamb);
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.3, 0.12, 0.1), frameMat);
      lintel.position.set(0, doorH + 0.12, 0);
      frame.add(lintel);
      frame.position.set(px, 0, pz);
      frame.rotation.y = yaw;
      group.add(frame);

      const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.06), doorMat);
      door.position.set(px, doorH / 2, pz);
      door.rotation.y = yaw;
      group.add(door);
      this.doors.set(face, { mesh: door, closedY: doorH / 2, height: doorH });

      // Ascent light: an additive strip on the shaft face that grows from the bottom.
      const mat = new THREE.MeshBasicMaterial({
        color: runeColor,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.ascentMats.push(mat);
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(shaftWidth * 0.7, 1), mat);
      // Origin at the strip's bottom so scaling in y grows upward.
      strip.geometry.translate(0, 0.5, 0);
      strip.position.set(center.x + d.dx * (shaftWidth / 2 + 0.02), shaftBottomY, center.z + d.dy * (shaftWidth / 2 + 0.02));
      strip.rotation.y = yaw;
      strip.scale.y = 0.001;
      group.add(strip);
      this.ascents.set(face, strip);
    }
  }

  private freezeWasOn = false;

  /**
   * Called every frame with every climb in progress and the start-freeze
   * progress (0 = just started, 1 = players released, null = no freeze).
   */
  update(active: { face: Face; t: number }[], timeSec: number, freeze: number | null = null): void {
    const open = new Map<Face, number>();
    const rise = new Map<Face, number>();
    if (freeze !== null && freeze < 1) {
      // Opening ceremony: every door slides open over the first half of the freeze.
      const o = Math.min(1, freeze * 2);
      for (const face of this.doors.keys()) open.set(face, o);
      this.freezeWasOn = true;
      this.crystalPulse = Math.max(this.crystalPulse, 0.35);
    } else if (this.freezeWasOn) {
      this.freezeWasOn = false;
      this.crystalPulse = 1; // "go": doors shut behind the players, crystal flares
    }
    for (const a of active) {
      const ph = climbPhase(a.t);
      open.set(a.face, Math.max(open.get(a.face) ?? 0, ph.doorOpen));
      rise.set(a.face, Math.max(rise.get(a.face) ?? 0, ph.ascent));
      if (ph.done) this.crystalPulse = Math.max(this.crystalPulse, 1);
    }
    for (const [face, door] of this.doors) {
      const o = open.get(face) ?? 0;
      door.mesh.position.y = door.closedY + o * door.height * 0.92;
    }
    for (const [face, strip] of this.ascents) {
      const r = rise.get(face) ?? 0;
      strip.scale.y = Math.max(0.001, r * this.shaftHeight);
      (strip.material as THREE.MeshBasicMaterial).opacity = r > 0 && r < 1 ? 0.55 : r >= 1 ? 0.55 * Math.max(0, 1 - (r - 1) * 4) : 0;
    }
    if (this.crystal) {
      this.crystalPulse = Math.max(0, this.crystalPulse - 0.02);
      const s = 1 + this.crystalPulse * 0.6;
      this.crystal.scale.set(s, 1.6 * s, s);
      (this.crystal.material as THREE.MeshLambertMaterial).emissiveIntensity = 0.6 + this.crystalPulse * 1.5;
      this.crystal.rotation.y = timeSec * 0.6;
    }
  }
}
