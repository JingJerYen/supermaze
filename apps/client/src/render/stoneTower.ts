import * as THREE from "three";
import type { MapGrid } from "@supermaze/sim";
import { CLIENT_TUNING } from "../tuning.js";
import { TowerAnimations } from "./climbSequence.js";
import { patternTexture, runeTexture, type Theme } from "./themes.js";
import { TowerView, towerGeometry, type TowerBuild } from "./tower.js";

const PLATFORM_COLOR = 0xf0a19b;

/**
 * Stone tower: two stepped tiers, a textured shaft with glowing rune strips on
 * each face, the see-through walkable platform, and a floating crystal above
 * it as a landmark visible from anywhere in the maze.
 */
export function buildStoneTower(grid: MapGrid, theme: Theme): TowerBuild {
  const tower = new THREE.Group();
  const { center, footW, footD } = towerGeometry(grid);
  const t = CLIENT_TUNING.tower;
  const stoneTex = patternTexture("blocks", theme.towerStone);
  const baseMat = new THREE.MeshLambertMaterial({ color: theme.towerStone, map: patternTexture("slab", theme.towerStone) });
  const shaftMat = new THREE.MeshLambertMaterial(stoneTex ? { color: theme.towerStone, map: stoneTex } : { color: theme.towerStone });
  const platformMat = new THREE.MeshLambertMaterial({
    color: PLATFORM_COLOR,
    transparent: true,
    opacity: t.platformOpacityFollow,
    depthWrite: false,
  });
  const view = new TowerView(platformMat, shaftMat);
  if (footW === 0) return { group: tower, view, animations: null, center };
  const cx = center.x;
  const cy = center.z;

  // Two stepped tiers that stay inside the footprint, so the entry tiles around it are clear.
  const tier1 = new THREE.Mesh(new THREE.BoxGeometry(footW, t.baseHeight, footD), baseMat);
  tier1.position.set(cx, t.baseHeight / 2, cy);
  const tier2 = new THREE.Mesh(new THREE.BoxGeometry(footW - 0.3, t.baseHeight * 1.6, footD - 0.3), baseMat);
  tier2.position.set(cx, t.baseHeight + (t.baseHeight * 1.6) / 2, cy);

  const shaftBottom = t.baseHeight * 2.6;
  const shaftH = t.shaftHeight - t.baseHeight * 1.6;

  // Octagonal stacked-stone shaft. Flat faces point N/E/S/W at exactly shaftWidth/2
  // from the centre (thetaStart offsets the corners), so doors, runes and the
  // ascent strips sit flush on a face. The block texture repeats so each course of
  // stone is about half a tile tall instead of being stretched over the whole height.
  const faceDist = t.shaftWidth / 2;
  const radius = faceDist / Math.cos(Math.PI / 8);
  const shaftGeo = new THREE.CylinderGeometry(radius, radius * 1.04, shaftH, 8, 1, false, Math.PI / 8);
  const shaftTex = stoneTex ? stoneTex.clone() : null;
  if (shaftTex) {
    shaftTex.repeat.set(4, Math.round(shaftH));
    shaftTex.needsUpdate = true;
    shaftMat.map = shaftTex;
    shaftMat.needsUpdate = true;
  }
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.position.set(cx, shaftBottom + shaftH / 2, cy);

  // Stone string courses every three tiles, and a heavier ring under the platform.
  const bandMat = new THREE.MeshLambertMaterial({ color: theme.towerStone, map: patternTexture("slab", theme.towerStone) });
  for (let h = 3; h < shaftH - 0.5; h += 3) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.09, radius + 0.09, 0.18, 8, 1, false, Math.PI / 8), bandMat);
    band.position.set(cx, shaftBottom + h, cy);
    tower.add(band);
  }
  const corbel = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.22, radius + 0.04, 0.4, 8, 1, false, Math.PI / 8), bandMat);
  corbel.position.set(cx, shaftBottom + shaftH - 0.2, cy);
  tower.add(corbel);

  // Narrow slit windows on the four faces at two heights, and one small rune plaque near the top.
  const slitMat = new THREE.MeshBasicMaterial({ color: 0x0b0f18 });
  const slitGeo = new THREE.PlaneGeometry(0.12, 0.7);
  const runeMat = new THREE.MeshBasicMaterial({ map: runeTexture(theme.towerRune), transparent: true, depthWrite: false });
  const runeGeo = new THREE.PlaneGeometry(0.34, 1.1);
  for (const [dx, dz, yaw] of [
    [0, 1, 0],
    [0, -1, Math.PI],
    [1, 0, Math.PI / 2],
    [-1, 0, -Math.PI / 2],
  ] as const) {
    const fx = cx + dx * (faceDist + 0.01);
    const fz = cy + dz * (faceDist + 0.01);
    for (const h of [shaftH * 0.3, shaftH * 0.62]) {
      const slit = new THREE.Mesh(slitGeo, slitMat);
      slit.position.set(fx, shaftBottom + h, fz);
      slit.rotation.y = yaw;
      tower.add(slit);
    }
    const r = new THREE.Mesh(runeGeo, runeMat);
    r.position.set(fx, shaftBottom + shaftH - 1.2, fz);
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
  const animations = new TowerAnimations(
    tower,
    center,
    footW,
    footD,
    t.shaftWidth,
    shaftBottom,
    shaftH,
    t.baseHeight * 2.6,
    crystal,
    theme.towerRune,
  );
  const baseTop = t.baseHeight * 2.6;
  view.attach(tower, [
    { min: { x: cx - footW / 2, y: 0, z: cy - footD / 2 }, max: { x: cx + footW / 2, y: baseTop, z: cy + footD / 2 } },
    { min: { x: cx - faceDist, y: baseTop, z: cy - faceDist }, max: { x: cx + faceDist, y: shaftBottom + shaftH, z: cy + faceDist } },
  ]);
  return { group: tower, view, animations, center };
}
