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
const glowProto = new THREE.CircleGeometry(0.75, 20).rotateX(-Math.PI / 2);

/**
 * Wall torches: on inner walls, on faces that look onto a road tile, roughly one
 * per `theme.torchEvery` eligible faces. Never on a tile that can host a light
 * switch, so the two never overlap.
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
        parts.brackets.push(place(bracketProto, 0.62, 0.04), place(cupProto, 0.8, 0.06));
        parts.flames.push(place(flameProto, 0.96, 0.06));
        const glow = glowProto.clone().translate(rx, 0.012, ry);
        parts.glows.push(glow);
      });
    }
  }
  return parts;
}

/** Materials for torch parts; flames and glows are unlit so they read in the dark too. */
export function torchMaterials(theme: Theme): { bracket: THREE.Material; flame: THREE.Material; glow: THREE.Material } {
  return {
    bracket: new THREE.MeshLambertMaterial({ color: 0x2b2b2b }),
    flame: new THREE.MeshBasicMaterial({ color: theme.torchFlame }),
    glow: new THREE.MeshBasicMaterial({
      color: theme.torchFlame,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  };
}
