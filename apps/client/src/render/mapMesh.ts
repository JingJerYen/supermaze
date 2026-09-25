import * as THREE from "three";
import type { MapGrid } from "@supermaze/sim";
import { CLIENT_TUNING } from "../tuning.js";
import { createRampGeometry } from "./geometry.js";

const COLORS = {
  road: 0x4d5a6d,
  wall: 0x8e9bb3,
  wallTop: 0xa9b6cc,
  stairs: 0xc2a96a,
  bridge: 0xb08a5a,
  tower: 0x9a3f3c,
  towerShaft: 0xd9534f,
  towerPlatform: 0xf0a19b,
} as const;

/** World x = tile x, world z = tile y. One tile is one world unit; walls are one unit high. */
export function buildMapMesh(grid: MapGrid): THREE.Group {
  const group = new THREE.Group();
  const floorGeo = new THREE.PlaneGeometry(1, 1);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const slabGeo = new THREE.BoxGeometry(1, 0.12, 1);
  const rampGeo = createRampGeometry();
  const mat = (color: number) => new THREE.MeshLambertMaterial({ color });
  const floorMat = mat(COLORS.road);
  const wallMat = mat(COLORS.wall);
  const stairsMat = mat(COLORS.stairs);
  const bridgeMat = mat(COLORS.bridge);

  const addFloor = (x: number, y: number) => {
    const m = new THREE.Mesh(floorGeo, floorMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0, y);
    group.add(m);
  };

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      switch (grid.kindAt(x, y)) {
        case "road":
          addFloor(x, y);
          break;
        case "wall": {
          const m = new THREE.Mesh(boxGeo, wallMat);
          m.position.set(x, 0.5, y);
          group.add(m);
          break;
        }
        case "stairs": {
          addFloor(x, y);
          const rise = grid.stairsRiseDir(x, y) ?? { dx: 0, dy: 1 };
          const m = new THREE.Mesh(rampGeo, stairsMat);
          m.position.set(x, 0, y);
          m.rotation.y = Math.atan2(rise.dx, rise.dy);
          group.add(m);
          break;
        }
        case "bridge": {
          addFloor(x, y);
          const m = new THREE.Mesh(slabGeo, bridgeMat);
          m.position.set(x, 1 - 0.06, y);
          group.add(m);
          break;
        }
        case "tower":
          break; // rendered once as a whole below
        default:
          break;
      }
    }
  }
  group.add(buildTower(grid));
  return group;
}

/** Footprint centre and size of the tower, and the world height of its platform top. */
export function towerGeometry(grid: MapGrid): { center: THREE.Vector3; footW: number; footD: number; platformTopY: number } {
  const t = CLIENT_TUNING.tower;
  const cells = grid.findCells("tower");
  const platformTopY = t.baseHeight + t.shaftHeight + t.platformThickness;
  if (cells.length === 0) return { center: new THREE.Vector3(), footW: 0, footD: 0, platformTopY };
  const minX = Math.min(...cells.map((c) => c.x));
  const maxX = Math.max(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  const maxY = Math.max(...cells.map((c) => c.y));
  return {
    center: new THREE.Vector3((minX + maxX) / 2, 0, (minY + maxY) / 2),
    footW: maxX - minX + 1,
    footD: maxY - minY + 1,
    platformTopY,
  };
}

/** One slender shaft rising from a low base, topped by a platform wider than the footprint. */
function buildTower(grid: MapGrid): THREE.Group {
  const tower = new THREE.Group();
  const { center, footW, footD } = towerGeometry(grid);
  if (footW === 0) return tower;
  const cx = center.x;
  const cy = center.z;

  const t = CLIENT_TUNING.tower;
  const baseMat = new THREE.MeshLambertMaterial({ color: COLORS.tower });
  const shaftMat = new THREE.MeshLambertMaterial({ color: COLORS.towerShaft });
  const platformMat = new THREE.MeshLambertMaterial({ color: COLORS.towerPlatform });

  const base = new THREE.Mesh(new THREE.BoxGeometry(footW, t.baseHeight, footD), baseMat);
  base.position.set(cx, t.baseHeight / 2, cy);

  const shaft = new THREE.Mesh(new THREE.BoxGeometry(t.shaftWidth, t.shaftHeight, t.shaftWidth), shaftMat);
  shaft.position.set(cx, t.baseHeight + t.shaftHeight / 2, cy);

  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(footW + t.platformOverhang * 2, t.platformThickness, footD + t.platformOverhang * 2),
    platformMat,
  );
  platform.position.set(cx, t.baseHeight + t.shaftHeight + t.platformThickness / 2, cy);

  tower.add(base, shaft, platform);
  return tower;
}
