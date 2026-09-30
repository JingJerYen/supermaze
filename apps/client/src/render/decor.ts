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
  /** Scattered props with vertex colours (the candy map's gumdrops). */
  props: THREE.BufferGeometry[];
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
const candleBaseProto = new THREE.CylinderGeometry(0.1, 0.11, 0.05, 8);
const candleProto = new THREE.CylinderGeometry(0.055, 0.06, 0.4, 8);
const candleFlameProto = new THREE.ConeGeometry(0.05, 0.15, 6);
const plinthProto = new THREE.BoxGeometry(0.2, 0.26, 0.2);
const plinthCapProto = new THREE.BoxGeometry(0.26, 0.05, 0.26);
const iceCrystalProto = new THREE.OctahedronGeometry(0.1, 0).scale(0.8, 1.5, 0.8);
const brazierBowlProto = new THREE.CylinderGeometry(0.13, 0.08, 0.12, 8);
const brazierRimProto = new THREE.CylinderGeometry(0.14, 0.14, 0.025, 8);
const brazierFlameProto = new THREE.ConeGeometry(0.08, 0.2, 6);
const gumdropProto = new THREE.SphereGeometry(0.07, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.15, 1);
/** Gumdrop colours; no yellow, so nothing on the floor reads as the key's gold. */
const GUMDROPS = [0xe8384f, 0x4cc46a, 0x9b5ad6, 0xf28c28, 0x3fa8e8];

/**
 * Wall lights: on inner walls, on faces that look onto a road tile, roughly one
 * per `theme.torchEvery` eligible faces. Never on a tile that can host a light
 * switch, so the two never overlap. A torch hangs on the face; a lantern stands
 * on the road at its foot.
 */
export function collectTorches(grid: MapGrid, theme: Theme, switchTiles: ReadonlySet<string>): TorchParts {
  const parts: TorchParts = { brackets: [], flames: [], glows: [], props: [] };
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
        if (tileHash(x, y, i + 1) % theme.torchEvery !== 0) {
          if (theme.scatter === "gumdrops" && tileHash(x, y, i + 41) % 6 === 0) parts.props.push(...gumdrops(x, y, f, tileHash(x, y, i + 97)));
          return;
        }
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
        } else if (theme.lightStyle === "crystal") {
          // A glowing ice crystal floating over a small stone plinth at the foot of the wall.
          parts.brackets.push(place(plinthProto, 0.13, 0.16), place(plinthCapProto, 0.285, 0.16));
          parts.flames.push(place(iceCrystalProto, 0.5, 0.16));
        } else if (theme.lightStyle === "brazier") {
          // A bronze fire bowl on a small stone plinth at the foot of the wall.
          parts.brackets.push(place(plinthProto, 0.13, 0.16), place(brazierBowlProto, 0.32, 0.16), place(brazierRimProto, 0.385, 0.16));
          parts.flames.push(place(brazierFlameProto, 0.49, 0.16));
        } else if (theme.lightStyle === "candle") {
          // A striped candle standing at the foot of the wall on a little icing base.
          parts.brackets.push(place(candleBaseProto, 0.025, 0.16), place(candleProto, 0.25, 0.16));
          parts.flames.push(place(candleFlameProto, 0.53, 0.16));
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

/** Two or three gumdrops in a little heap on the road at the foot of the wall face `f` of (x, y). */
function gumdrops(x: number, y: number, f: { dx: number; dy: number }, h: number): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const n = 2 + (h % 2);
  // Along the wall: the axis across the face.
  const ax = f.dy !== 0 ? 1 : 0;
  const az = f.dx !== 0 ? 1 : 0;
  for (let k = 0; k < n; k++) {
    const along = ((h >>> (k * 3)) % 7) / 7 - 0.4 + k * 0.14;
    const g = gumdropProto.clone();
    const colour = new THREE.Color(GUMDROPS[(h >>> (k * 5 + 2)) % GUMDROPS.length] as number);
    const count = g.getAttribute("position").count;
    const colours = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) colours.set([colour.r, colour.g, colour.b], i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    g.translate(x + f.dx * 0.66 + ax * along * 0.6, 0, y + f.dy * 0.66 + az * along * 0.6);
    out.push(g);
  }
  return out;
}

/** Materials for torch parts; flames and glows are unlit so they read in the dark too. */
export function torchMaterials(theme: Theme): { bracket: THREE.Material; flame: THREE.Material; glow: THREE.Material; prop: THREE.Material } {
  const candle = theme.lightStyle === "candle";
  return {
    bracket: candle
      ? new THREE.MeshLambertMaterial({ color: 0xffffff, map: stripeTexture(theme.structure.rail) })
      : new THREE.MeshLambertMaterial({ color: theme.lightStyle === "torch" ? 0x2b2b2b : theme.lightStyle === "crystal" ? 0x3e4a60 : theme.lightStyle === "brazier" ? 0x4a3420 : theme.structure.stepAlt }),
    prop: new THREE.MeshLambertMaterial({ vertexColors: true }),
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

/** White with diagonal stripes of `color`, for the candles; wraps round a cylinder. */
function stripeTexture(color: number): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff6ee";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = `#${new THREE.Color(color).getHexString()}`;
  ctx.lineWidth = 12;
  for (let i = -size; i < size * 2; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, size);
    ctx.lineTo(i + size, 0);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
