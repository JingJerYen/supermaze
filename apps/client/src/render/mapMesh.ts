import * as THREE from "three";
import type { MapGrid } from "@supermaze/sim";
import { CLIENT_TUNING } from "../tuning.js";
import { platformTopY as platformTopYWorld } from "./elevation.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { collectTorches, tileHash, torchMaterials } from "./decor.js";
import { createBridge, createStairs } from "./structures.js";
import { patternTexture, runeTexture, themeFor, type Theme } from "./themes.js";

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
  /** Per-frame animation of the few moving decorations (the tower crystal). */
  update(timeSec: number): void;
}

/**
 * World x = tile x, world z = tile y. One tile is one world unit; walls are one
 * unit high. `plazaRadius` marks the tiles around the tower drawn as plaza.
 */
export function buildMapMesh(
  grid: MapGrid,
  theme: Theme = themeFor(undefined),
  plazaRadius = 0,
  switchTiles: ReadonlySet<string> = new Set(),
): MapView {
  const group = new THREE.Group();
  const lambert = (color: number, map: THREE.Texture | null) =>
    new THREE.MeshLambertMaterial(map ? { color, map } : { color });

  const floorMat = lambert(theme.floor, patternTexture(theme.floorPattern, theme.floor));
  const plazaMat = lambert(theme.plaza, patternTexture(theme.floorPattern, theme.plaza));
  const sideMat = lambert(theme.wallSide, patternTexture(theme.wallPattern, theme.wallSide));
  // A second side material with moss / frost / flowers, used on a share of inner walls to break repetition.
  const sideGrowthMat = theme.growth
    ? lambert(theme.wallSide, patternTexture(theme.wallPattern, theme.wallSide, theme.growth))
    : sideMat;
  const outerSideMat = lambert(theme.outerWall, patternTexture(theme.wallPattern, theme.outerWall));
  const topMat = lambert(theme.wallTop, patternTexture(theme.wallPattern === "blocks" ? "slab" : theme.wallPattern, theme.wallTop));
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });

  const tower = grid.findCells("tower");
  const inPlaza = (x: number, y: number) =>
    plazaRadius > 0 && tower.some((t) => Math.max(Math.abs(t.x - x), Math.abs(t.y - y)) <= plazaRadius);
  const isOuter = (x: number, y: number) => x === 0 || y === 0 || x === grid.width - 1 || y === grid.height - 1;

  // Every tile face of one surface kind is merged into a single geometry, so the
  // whole maze costs a handful of draw calls regardless of its size.
  const batches = {
    floor: [] as THREE.BufferGeometry[],
    plaza: [] as THREE.BufferGeometry[],
    side: [] as THREE.BufferGeometry[],
    sideGrowth: [] as THREE.BufferGeometry[],
    outerSide: [] as THREE.BufferGeometry[],
    top: [] as THREE.BufferGeometry[],
    shadow: [] as THREE.BufferGeometry[],
  };
  const floorProto = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const shadowProto = new THREE.PlaneGeometry(1.16, 1.16).rotateX(-Math.PI / 2);
  const topProto = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 1, 0);
  // Four vertical faces of a unit wall, each a plane facing outward, at their offsets.
  const sideProtos = [
    new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0.5), // south face (+z)
    new THREE.PlaneGeometry(1, 1).rotateY(Math.PI).translate(0, 0.5, -0.5), // north face
    new THREE.PlaneGeometry(1, 1).rotateY(Math.PI / 2).translate(0.5, 0.5, 0), // east face
    new THREE.PlaneGeometry(1, 1).rotateY(-Math.PI / 2).translate(-0.5, 0.5, 0), // west face
  ];
  const at = (proto: THREE.BufferGeometry, x: number, y: number, dy = 0) => proto.clone().translate(x, dy, y);

  const addFloor = (x: number, y: number) => {
    (inPlaza(x, y) ? batches.plaza : batches.floor).push(at(floorProto, x, y));
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
          const outer = isOuter(x, y);
          const grown = !outer && theme.growth !== 0 && tileHash(x, y, 7) % 100 < theme.growthShare * 100;
          const sides = outer ? batches.outerSide : grown ? batches.sideGrowth : batches.side;
          // Only faces that can be seen: skip a face when the neighbour is also a wall.
          const neighbourWall = (dx: number, dy: number) => grid.kindAt(x + dx, y + dy) === "wall";
          if (!neighbourWall(0, 1)) sides.push(at(sideProtos[0] as THREE.BufferGeometry, x, y));
          if (!neighbourWall(0, -1)) sides.push(at(sideProtos[1] as THREE.BufferGeometry, x, y));
          if (!neighbourWall(1, 0)) sides.push(at(sideProtos[2] as THREE.BufferGeometry, x, y));
          if (!neighbourWall(-1, 0)) sides.push(at(sideProtos[3] as THREE.BufferGeometry, x, y));
          batches.top.push(at(topProto, x, y));
          pushRect(topEdges, x, y, 1.003);
          if (!outer) batches.shadow.push(at(shadowProto, x, y, 0.006));
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

  // Stairs and bridges never move: fold their parts into per-material batches as well.
  const structureBatches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const child of [...group.children]) {
    if (!(child as THREE.Group).isGroup) continue;
    child.updateMatrixWorld(true);
    child.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      const list = structureBatches.get(mesh.material) ?? [];
      list.push(g);
      structureBatches.set(mesh.material, list);
    });
    group.remove(child);
  }

  const addMerged = (list: THREE.BufferGeometry[], material: THREE.Material) => {
    if (list.length === 0) return;
    const merged = mergeGeometries(list, false);
    if (!merged) return;
    for (const g of list) g.dispose();
    group.add(new THREE.Mesh(merged, material));
  };
  addMerged(batches.floor, floorMat);
  addMerged(batches.plaza, plazaMat);
  addMerged(batches.side, sideMat);
  addMerged(batches.sideGrowth, sideGrowthMat);
  addMerged(batches.outerSide, outerSideMat);
  addMerged(batches.top, topMat);
  addMerged(batches.shadow, shadowMat);
  for (const [material, list] of structureBatches) addMerged(list, material);

  // Torches: three batches (brackets, flames, floor glows). Flames and glows are unlit.
  const torches = collectTorches(grid, theme, switchTiles);
  const torchMats = torchMaterials(theme);
  addMerged(torches.brackets, torchMats.bracket);
  addMerged(torches.flames, torchMats.flame);
  addMerged(torches.glows, torchMats.glow);

  const lineMat = (opacity: number) => new THREE.LineBasicMaterial({ color: theme.line, transparent: true, opacity });
  const topLines = new THREE.LineSegments(lineGeometry(topEdges), lineMat(0.55));
  const floorLines = new THREE.LineSegments(lineGeometry(floorEdges), lineMat(0.12));
  group.add(topLines, floorLines);

  const { group: towerGroup, view, crystal } = buildTower(grid, theme);
  group.add(towerGroup);
  return {
    group,
    tower: view,
    setDark(dark: boolean) {
      const show = !dark || theme.linesGlowInDark;
      topLines.visible = show;
      floorLines.visible = show;
      // Torches keep a faint presence in the dark; they are ambience, not a light source.
      (torchMats.flame as THREE.MeshBasicMaterial).opacity = dark ? 0.45 : 1;
      (torchMats.flame as THREE.MeshBasicMaterial).transparent = true;
      (torchMats.glow as THREE.MeshBasicMaterial).opacity = dark ? 0.18 : 0.55;
    },
    update(timeSec: number) {
      if (crystal) {
        crystal.rotation.y = timeSec * 0.6;
        crystal.position.y = crystal.userData["baseY"] + Math.sin(timeSec * 1.5) * 0.08;
      }
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

/**
 * Stone tower: two stepped tiers, a textured shaft with glowing rune strips on
 * each face, the see-through walkable platform, and a floating crystal above
 * it as a landmark visible from anywhere in the maze.
 */
function buildTower(grid: MapGrid, theme: Theme): { group: THREE.Group; view: TowerView; crystal: THREE.Mesh | null } {
  const tower = new THREE.Group();
  const { center, footW, footD } = towerGeometry(grid);
  const t = CLIENT_TUNING.tower;
  const stoneTex = patternTexture("blocks", theme.towerStone);
  const baseMat = new THREE.MeshLambertMaterial({ color: theme.towerStone, map: patternTexture("slab", theme.towerStone) });
  const shaftMat = new THREE.MeshLambertMaterial(stoneTex ? { color: theme.towerStone, map: stoneTex } : { color: theme.towerStone });
  const platformMat = new THREE.MeshLambertMaterial({
    color: COLORS.towerPlatform,
    transparent: true,
    opacity: t.platformOpacityFollow,
    depthWrite: false,
  });
  const view = new TowerView(platformMat, shaftMat);
  if (footW === 0) return { group: tower, view, crystal: null };
  const cx = center.x;
  const cy = center.z;

  // Two stepped tiers instead of a flat base.
  const tier1 = new THREE.Mesh(new THREE.BoxGeometry(footW + 0.6, t.baseHeight, footD + 0.6), baseMat);
  tier1.position.set(cx, t.baseHeight / 2, cy);
  const tier2 = new THREE.Mesh(new THREE.BoxGeometry(footW, t.baseHeight * 1.6, footD), baseMat);
  tier2.position.set(cx, t.baseHeight + (t.baseHeight * 1.6) / 2, cy);

  const shaftBottom = t.baseHeight * 2.6;
  const shaftH = t.shaftHeight - t.baseHeight * 1.6;
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(t.shaftWidth, shaftH, t.shaftWidth), shaftMat);
  shaft.position.set(cx, shaftBottom + shaftH / 2, cy);

  // Rune strips: one unlit glowing plane per shaft face.
  const runeMat = new THREE.MeshBasicMaterial({ map: runeTexture(theme.towerRune), transparent: true, depthWrite: false });
  const runeGeo = new THREE.PlaneGeometry(t.shaftWidth * 0.6, shaftH * 0.7);
  for (const [dx, dz, yaw] of [
    [0, 1, 0],
    [0, -1, Math.PI],
    [1, 0, Math.PI / 2],
    [-1, 0, -Math.PI / 2],
  ] as const) {
    const r = new THREE.Mesh(runeGeo, runeMat);
    r.position.set(cx + dx * (t.shaftWidth / 2 + 0.01), shaftBottom + shaftH / 2, cy + dz * (t.shaftWidth / 2 + 0.01));
    r.rotation.y = yaw;
    tower.add(r);
  }

  const slabGeo = new THREE.BoxGeometry(footW + t.platformOverhang * 2, t.platformThickness, footD + t.platformOverhang * 2);
  const platform = new THREE.Mesh(slabGeo, platformMat);
  platform.position.set(cx, t.baseHeight + t.shaftHeight + t.platformThickness / 2, cy);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(slabGeo), new THREE.LineBasicMaterial({ color: 0xfff1ec }));
  edges.position.copy(platform.position);

  // Landmark crystal floating above the platform centre; players walk beneath it.
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.42),
    new THREE.MeshLambertMaterial({ color: theme.towerCrystal, emissive: theme.towerRune, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 }),
  );
  crystal.scale.set(1, 1.6, 1);
  const baseY = t.baseHeight + t.shaftHeight + t.platformThickness + 1.9;
  crystal.position.set(cx, baseY, cy);
  crystal.userData["baseY"] = baseY;

  tower.add(tier1, tier2, shaft, platform, edges, crystal);
  return { group: tower, view, crystal };
}
