import * as THREE from "three";
import type { MapGrid } from "@supermaze/sim";
import { CLIENT_TUNING } from "../tuning.js";
import { platformTopY as platformTopYWorld } from "./elevation.js";
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

/** Handle to the tower's materials so the view can see through it from above. */
export class TowerView {
  constructor(
    private readonly platform: THREE.MeshLambertMaterial,
    private readonly shaft: THREE.MeshLambertMaterial,
  ) {}

  /** Overview: the commander stands on the slab and must see the plaza beneath it. */
  setOverview(overview: boolean): void {
    const t = CLIENT_TUNING.tower;
    this.platform.opacity = overview ? t.platformOpacityOverview : t.platformOpacityFollow;
    this.shaft.transparent = overview;
    this.shaft.opacity = overview ? t.shaftOpacityOverview : 1;
    this.shaft.needsUpdate = true;
  }
}

/** World x = tile x, world z = tile y. One tile is one world unit; walls are one unit high. */
export function buildMapMesh(grid: MapGrid): { group: THREE.Group; tower: TowerView } {
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
  const { group: towerGroup, view } = buildTower(grid);
  group.add(towerGroup);
  return { group, tower: view };
}

/** Footprint centre and size of the tower, and the world height of its platform top. */
export function towerGeometry(grid: MapGrid): { center: THREE.Vector3; footW: number; footD: number; platformTopY: number } {
  const cells = grid.findCells("tower");
  const platformTopY = platformTopYWorld();
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

/** One slender shaft rising from a low base, topped by a see-through platform with an outlined edge. */
function buildTower(grid: MapGrid): { group: THREE.Group; view: TowerView } {
  const tower = new THREE.Group();
  const { center, footW, footD } = towerGeometry(grid);
  const t = CLIENT_TUNING.tower;
  const baseMat = new THREE.MeshLambertMaterial({ color: COLORS.tower });
  const shaftMat = new THREE.MeshLambertMaterial({ color: COLORS.towerShaft });
  const platformMat = new THREE.MeshLambertMaterial({
    color: COLORS.towerPlatform,
    transparent: true,
    opacity: t.platformOpacityFollow,
    depthWrite: false,
  });
  const view = new TowerView(platformMat, shaftMat);
  if (footW === 0) return { group: tower, view };
  const cx = center.x;
  const cy = center.z;

  const base = new THREE.Mesh(new THREE.BoxGeometry(footW, t.baseHeight, footD), baseMat);
  base.position.set(cx, t.baseHeight / 2, cy);

  const shaft = new THREE.Mesh(new THREE.BoxGeometry(t.shaftWidth, t.shaftHeight, t.shaftWidth), shaftMat);
  shaft.position.set(cx, t.baseHeight + t.shaftHeight / 2, cy);

  const slabGeo = new THREE.BoxGeometry(footW + t.platformOverhang * 2, t.platformThickness, footD + t.platformOverhang * 2);
  const platform = new THREE.Mesh(slabGeo, platformMat);
  platform.position.set(cx, t.baseHeight + t.shaftHeight + t.platformThickness / 2, cy);
  // Crisp outline so the walkable extent stays readable even when the slab is nearly invisible.
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(slabGeo), new THREE.LineBasicMaterial({ color: 0xfff1ec }));
  edges.position.copy(platform.position);

  tower.add(base, shaft, platform, edges);
  return { group: tower, view };
}
