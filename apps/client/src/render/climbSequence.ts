import * as THREE from "three";
import type { Dir } from "@supermaze/sim";
import { CLIENT_TUNING } from "../tuning.js";

/**
 * Presentation of climbing the tower (CLAUDE.md 5). The simulation moves a
 * player to the platform instantly; the client delays the picture: the door on
 * the face the player came from slides open, the character walks in and
 * vanishes, a light runs up that face's rune strip, the crystal pulses, and
 * only then is the character drawn on the platform. Warm light pours out of
 * the doorway while the door stands open. Progress is timed from the frame the
 * client first sees the player on the tower.
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

/**
 * The doorway glow and a beam of light fanning out of it onto the ground, both
 * additive and fading toward the far end. Returns [glow, beam] materials.
 */
function addSpill(group: THREE.Group, px: number, pz: number, yaw: number, doorW: number, doorH: number): THREE.MeshBasicMaterial[] {
  const c = CLIENT_TUNING.climb;
  const additive = { color: c.spillColor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false };
  const glowMat = new THREE.MeshBasicMaterial(additive);
  const beamMat = new THREE.MeshBasicMaterial({ ...additive, vertexColors: true, side: THREE.DoubleSide });
  const holder = new THREE.Group();
  holder.position.set(px, 0, pz);
  holder.rotation.y = yaw;
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(doorW, doorH), glowMat);
  glow.position.set(0, doorH / 2, 0);
  holder.add(glow);

  // A widening box open at both ends: floor, roof and sides, bright at the door, black (invisible) at the far end.
  const n = { w: doorW * 0.95, h: doorH * 0.95, z: 0.04 };
  const f = { w: doorW * 2.6, h: doorH * 1.25, z: c.spillReach };
  const quad = (a: number[], b: number[], cc: number[], d: number[]) => [a, b, cc, a, cc, d];
  const nl = [-n.w / 2, 0.02, n.z], nr = [n.w / 2, 0.02, n.z], ntl = [-n.w / 2, n.h, n.z], ntr = [n.w / 2, n.h, n.z];
  const fl = [-f.w / 2, 0.02, f.z], fr = [f.w / 2, 0.02, f.z], ftl = [-f.w / 2, f.h, f.z], ftr = [f.w / 2, f.h, f.z];
  const tris = [...quad(nl, nr, fr, fl), ...quad(ntl, ntr, ftr, ftl), ...quad(nl, ntl, ftl, fl), ...quad(nr, ntr, ftr, fr)];
  const positions = tris.flat();
  const colors = tris.flatMap((v) => {
    const k = v[2] === n.z ? 1 : 0;
    return [k, k, k];
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const beam = new THREE.Mesh(geo, beamMat);
  beam.renderOrder = 2;
  holder.add(beam);
  group.add(holder);
  return [glowMat, beamMat];
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export interface DoorColors {
  leaf: number;
  frame: number;
  handle: number;
}

const STONE_DOORS: DoorColors = { leaf: 0x20242e, frame: 0x5c6472, handle: 0x8a8f9c };

/** The tower's animated parts: one door and one ascent light per face, plus the crystal. */
export class TowerAnimations {
  private readonly doors = new Map<Face, { left: THREE.Mesh; right: THREE.Mesh; travel: number }>();
  private readonly ascents = new Map<Face, THREE.Mesh>();
  /** Light pouring out of each doorway: the glowing opening and a beam fanning out over the ground. */
  private readonly spills = new Map<Face, { mats: THREE.MeshBasicMaterial[]; at: THREE.Vector3 }>();
  /** One lamp shared by all doors, parked at the most open one. */
  private readonly spillLight: THREE.PointLight;
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
    /** Door leaves, frame and handles; the default is the stone tower's iron and granite. */
    doorColors: DoorColors = STONE_DOORS,
  ) {
    const doorMat = new THREE.MeshLambertMaterial({ color: doorColors.leaf });
    const frameMat = new THREE.MeshLambertMaterial({ color: doorColors.frame });
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

      // Double door: two leaves that slide apart sideways into the jambs.
      const leafGeo = new THREE.BoxGeometry(doorW / 2 - 0.01, doorH, 0.06);
      const holder = new THREE.Group();
      holder.position.set(px, doorH / 2, pz);
      holder.rotation.y = yaw;
      const left = new THREE.Mesh(leafGeo, doorMat);
      const right = new THREE.Mesh(leafGeo, doorMat);
      left.position.x = -doorW / 4;
      right.position.x = doorW / 4;
      // A thin handle strip on each leaf so the split reads even when closed.
      const handleMat = new THREE.MeshLambertMaterial({ color: doorColors.handle });
      for (const [leaf, side] of [[left, 1], [right, -1]] as const) {
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.02), handleMat);
        handle.position.set(side * (doorW / 4 - 0.06), 0, 0.04);
        leaf.add(handle);
      }
      holder.add(left, right);
      group.add(holder);
      this.doors.set(face, { left, right, travel: doorW / 2 });
      this.spills.set(face, {
        mats: addSpill(group, px, pz, yaw, doorW, doorH),
        at: new THREE.Vector3(px + d.dx * 0.6, doorH * 0.6, pz + d.dy * 0.6),
      });

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
    const c = CLIENT_TUNING.climb;
    // Always in the scene (at zero) so the light count, and with it the shaders, never changes.
    this.spillLight = new THREE.PointLight(c.spillColor, 0, 4.5, 1.2);
    group.add(this.spillLight);
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
    const c = CLIENT_TUNING.climb;
    let brightest = 0;
    for (const [face, door] of this.doors) {
      const o = open.get(face) ?? 0;
      door.left.position.x = -door.travel / 2 - o * door.travel;
      door.right.position.x = door.travel / 2 + o * door.travel;
      // Only a climb lights the doorway; the opening ceremony just opens the doors.
      const lit = active.some((a) => a.face === face) ? o : 0;
      const spill = this.spills.get(face)!;
      const flicker = 0.92 + 0.08 * Math.sin(timeSec * 9 + face.length);
      spill.mats[0]!.opacity = lit;
      spill.mats[1]!.opacity = lit * c.spillOpacity * flicker;
      if (lit > brightest) {
        brightest = lit;
        this.spillLight.position.copy(spill.at);
      }
    }
    this.spillLight.intensity = brightest * c.spillLightIntensity;
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
