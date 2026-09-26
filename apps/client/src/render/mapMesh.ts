import * as THREE from "three";
import type { MapGrid } from "@supermaze/sim";
import { CLIENT_TUNING } from "../tuning.js";
import { platformTopY as platformTopYWorld } from "./elevation.js";
import { createBridge, createStairs } from "./structures.js";
import { patternTexture, themeFor, type Theme } from "./themes.js";

const COLORS = {
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

/** Handles the view needs after building: the tower and the lines that must hide in the dark. */
export interface MapView {
  group: THREE.Group;
  tower: TowerView;
  setDark(dark: boolean): void;
}

/**
 * World x = tile x, world z = tile y. One tile is one world unit; walls are one
 * unit high. `plazaRadius` marks the tiles around the tower drawn as plaza.
 */
export function buildMapMesh(grid: MapGrid, theme: Theme = themeFor(undefined), plazaRadius = 0): MapView {
  const group = new THREE.Group();
  const floorGeo = new THREE.PlaneGeometry(1, 1);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const shadowGeo = new THREE.PlaneGeometry(1.16, 1.16);
  const lambert = (color: number, map: THREE.Texture | null) =>
    new THREE.MeshLambertMaterial(map ? { color, map } : { color });

  const floorMat = lambert(theme.floor, patternTexture(theme.floorPattern, theme.floor));
  const plazaMat = lambert(theme.plaza, patternTexture(theme.floorPattern, theme.plaza));
  const sideMat = lambert(theme.wallSide, patternTexture(theme.wallPattern, theme.wallSide));
  const outerSideMat = lambert(theme.outerWall, patternTexture(theme.wallPattern, theme.outerWall));
  const topMat = lambert(theme.wallTop, null);
  // BoxGeometry material order: +x, -x, +y (top), -y, +z, -z.
  const wallMats = [sideMat, sideMat, topMat, topMat, sideMat, sideMat];
  const outerWallMats = [outerSideMat, outerSideMat, topMat, topMat, outerSideMat, outerSideMat];
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });

  const tower = grid.findCells("tower");
  const inPlaza = (x: number, y: number) =>
    plazaRadius > 0 && tower.some((t) => Math.max(Math.abs(t.x - x), Math.abs(t.y - y)) <= plazaRadius);
  const isOuter = (x: number, y: number) => x === 0 || y === 0 || x === grid.width - 1 || y === grid.height - 1;

  const addFloor = (x: number, y: number) => {
    const m = new THREE.Mesh(floorGeo, inPlaza(x, y) ? plazaMat : floorMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0, y);
    group.add(m);
  };

  const topEdges: number[] = [];
  const floorEdges: number[] = [];
  const pushRect = (out: number[], x: number, y: number, h: number) => {
    const x0 = x - 0.5, x1 = x + 0.5, z0 = y - 0.5, z1 = y + 0.5;
    out.push(x0, h, z0, x1, h, z0, x1, h, z0, x1, h, z1, x1, h, z1, x0, h, z1, x0, h, z1, x0, h, z0);
  };

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      switch (grid.kindAt(x, y)) {
        case "road":
          addFloor(x, y);
          pushRect(floorEdges, x, y, 0.004);
          break;
        case "wall": {
          const m = new THREE.Mesh(boxGeo, isOuter(x, y) ? outerWallMats : wallMats);
          m.position.set(x, 0.5, y);
          group.add(m);
          pushRect(topEdges, x, y, 1.003);
          if (!isOuter(x, y)) {
            // Contact shadow: a dark square slightly larger than the wall, just above the floor.
            const sh = new THREE.Mesh(shadowGeo, shadowMat);
            sh.rotation.x = -Math.PI / 2;
            sh.position.set(x, 0.006, y);
            group.add(sh);
          }
          break;
        }
        case "stairs": {
          addFloor(x, y);
          const rise = grid.stairsRiseDir(x, y) ?? { dx: 0, dy: 1 };
          const st = createStairs(rise);
          st.position.set(x, 0, y);
          group.add(st);
          break;
        }
        case "bridge": {
          addFloor(x, y);
          pushRect(floorEdges, x, y, 0.004);
          // The deck runs between the two walls: north-south when the walls are north and south.
          const ns = grid.kindAt(x, y - 1) === "wall" && grid.kindAt(x, y + 1) === "wall";
          const b = createBridge(ns ? { dx: 0, dy: 1 } : { dx: 1, dy: 0 });
          b.position.set(x, 0, y);
          group.add(b);
          break;
        }
        case "tower":
          break; // rendered once as a whole below
        default:
          break;
      }
    }
  }

  const lineMat = (opacity: number) => new THREE.LineBasicMaterial({ color: theme.line, transparent: true, opacity });
  const topLines = new THREE.LineSegments(lineGeometry(topEdges), lineMat(0.55));
  const floorLines = new THREE.LineSegments(lineGeometry(floorEdges), lineMat(0.12));
  group.add(topLines, floorLines);

  const { group: towerGroup, view } = buildTower(grid);
  group.add(towerGroup);
  return {
    group,
    tower: view,
    setDark(dark: boolean) {
      const show = !dark || theme.linesGlowInDark;
      topLines.visible = show;
      floorLines.visible = show;
    },
  };
}

function lineGeometry(points: number[]): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return geo;
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
