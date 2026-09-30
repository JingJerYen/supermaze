import * as THREE from "three";
import type { MapGrid } from "@supermaze/sim";
import type { Theme } from "./themes.js";

/**
 * Static decorations chosen deterministically from tile coordinates, so every
 * client sees the same ones without any network data. Each part is pushed into
 * a per-material batch by the map builder, so decorations add a fixed handful
 * of draw calls regardless of how many there are.
 */

/** Small integer hash of a tile, stable across clients and sessions. */
export function tileHash(x: number, y: number, salt = 0): number {
  let h = (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

export interface TorchParts {
  brackets: THREE.BufferGeometry[];
  flames: THREE.BufferGeometry[];
  glows: THREE.BufferGeometry[];
}

const bracketProto = new THREE.BoxGeometry(0.08, 0.3, 0.08);
const cupProto = new THREE.CylinderGeometry(0.07, 0.05, 0.1, 8);
const flameProto = new THREE.ConeGeometry(0.075, 0.24, 6);
const glowProto = new THREE.PlaneGeometry(1.7, 1.7).rotateX(-Math.PI / 2);
const lanternBaseProto = new THREE.BoxGeometry(0.22, 0.06, 0.22);
const lanternPostProto = new THREE.BoxGeometry(0.1, 0.4, 0.1);
const lanternLampProto = new THREE.BoxGeometry(0.15, 0.17, 0.15);
const lanternRoofProto = new THREE.ConeGeometry(0.17, 0.12, 4).rotateY(Math.PI / 4);
const lanternCapProto = new THREE.SphereGeometry(0.035, 6, 4);
const beaconBaseProto = new THREE.BoxGeometry(0.2, 0.1, 0.2);
const beaconPostProto = new THREE.BoxGeometry(0.07, 0.42, 0.07);
const beaconTubeProto = new THREE.CylinderGeometry(0.045, 0.045, 0.26, 8);
const beaconCapProto = new THREE.BoxGeometry(0.12, 0.05, 0.12);

/**
 * Wall lights: on inner walls, on faces that look onto a road tile, roughly one
 * per `theme.torchEvery` eligible faces. Never on a tile that can host a light
 * switch, so the two never overlap. A torch hangs on the face; a lantern stands
 * on the road at its foot.
 */
export function collectTorches(grid: MapGrid, theme: Theme, switchTiles: ReadonlySet<string>): TorchParts {
  const parts: TorchParts = { brackets: [], flames: [], glows: [] };
  if (theme.torchEvery <= 0) return parts;
  const faces: { dx: number; dy: number }[] = [
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
  ];
  for (let y = 1; y < grid.height - 1; y++) {
    for (let x = 1; x < grid.width - 1; x++) {
      if (grid.kindAt(x, y) !== "wall") continue;
      faces.forEach((f, i) => {
        const rx = x + f.dx;
        const ry = y + f.dy;
        if (grid.kindAt(rx, ry) !== "road") return;
        if (switchTiles.has(`${rx},${ry}`)) return;
        if (tileHash(x, y, i + 1) % theme.torchEvery !== 0) return;
        // Bracket hangs on the wall face, flame above it, glow on the road tile below.
        const px = x + f.dx * 0.53;
        const pz = y + f.dy * 0.53;
        const yaw = Math.atan2(f.dx, f.dy);
        const place = (proto: THREE.BufferGeometry, dy: number, out: number) => {
          const g = proto.clone();
          g.rotateY(yaw);
          g.translate(px + f.dx * out, dy, pz + f.dy * out);
          return g;
        };
        if (theme.lightStyle === "lantern") {
          // Stone lantern standing on the road at the foot of the wall: plinth, post, glowing lamp, roof.
          parts.brackets.push(
            place(lanternBaseProto, 0.03, 0.14),
            place(lanternPostProto, 0.25, 0.14),
            place(lanternRoofProto, 0.64, 0.14),
            place(lanternCapProto, 0.73, 0.14),
          );
          parts.flames.push(place(lanternLampProto, 0.5, 0.14));
        } else if (theme.lightStyle === "beacon") {
          // Steel beacon standing at the foot of the wall: footing, post, glowing tube, cap.
          parts.brackets.push(
            place(beaconBaseProto, 0.05, 0.14),
            place(beaconPostProto, 0.31, 0.14),
            place(beaconCapProto, 0.8, 0.14),
          );
          parts.flames.push(place(beaconTubeProto, 0.65, 0.14));
        } else {
          parts.brackets.push(place(bracketProto, 0.62, 0.04), place(cupProto, 0.8, 0.06));
          parts.flames.push(place(flameProto, 0.96, 0.06));
        }
        // Soft pool of light on the road tile, pulled a little toward the wall the torch hangs on.
        const glow = glowProto.clone().translate(rx - f.dx * 0.18, 0.012, ry - f.dy * 0.18);
        parts.glows.push(glow);
      });
    }
  }
  return parts;
}

/** Materials for torch parts; flames and glows are unlit so they read in the dark too. */
export function torchMaterials(theme: Theme): { bracket: THREE.Material; flame: THREE.Material; glow: THREE.Material } {
  return {
    bracket: new THREE.MeshLambertMaterial({ color: theme.lightStyle === "torch" ? 0x2b2b2b : theme.structure.stepAlt }),
    flame: new THREE.MeshBasicMaterial({ color: theme.torchFlame }),
    glow: new THREE.MeshBasicMaterial({
      color: theme.torchFlame,
      map: radialGlowTexture(),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  };
}

let glowTex: THREE.CanvasTexture | null = null;
/** Radial falloff (bright centre, transparent rim) so the pool reads as light, not a painted disc. */
function radialGlowTexture(): THREE.CanvasTexture {
  if (glowTex) return glowTex;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.45)");
  g.addColorStop(0.7, "rgba(255,255,255,0.12)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  glowTex = new THREE.CanvasTexture(canvas);
  return glowTex;
}
