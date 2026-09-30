import * as THREE from "three";
import type { MapGrid } from "@supermaze/sim";
import { CLIENT_TUNING } from "../tuning.js";
import { TowerAnimations } from "./climbSequence.js";
import { patternTexture, type Theme } from "./themes.js";
import { mergeByMaterial, TowerView, towerGeometry, type TowerBuild } from "./tower.js";

/**
 * The desert temple's tower: an obelisk. It keeps every measure of the stone
 * tower (tiers, shaft, platform, doors), so the climb, the overview camera and
 * the occlusion test are unchanged; the shaft is a square, slightly tapering
 * pillar of carved sandstone with gold bands, under a flared capital, and a
 * turquoise pyramidion floats where the crystal would be. Four small pillars
 * with gold and turquoise caps stand at the platform corners.
 */
export function buildObeliskTower(grid: MapGrid, theme: Theme): TowerBuild {
  const tower = new THREE.Group();
  const { center, footW, footD } = towerGeometry(grid);
  const t = CLIENT_TUNING.tower;
  const carved = (kind: "sandstone" | "limestone", base: number, inlay: number, repeat: [number, number]) => {
    const map = patternTexture(kind, base, inlay);
    const tex = map ? map.clone() : null;
    if (tex) {
      tex.repeat.set(repeat[0], repeat[1]);
      tex.needsUpdate = true;
    }
    return new THREE.MeshLambertMaterial({ color: 0xffffff, ...(tex ? { map: tex } : {}) });
  };
  const shaftBottom = t.baseHeight * 2.6;
  const shaftH = t.shaftHeight - t.baseHeight * 1.6;
  const slabMat = carved("limestone", theme.wallTop, 0, [Math.max(1, footW), 1]);
  const tierMat = carved("sandstone", theme.towerStone, theme.growth, [Math.max(1, footW), 1]);
  // One carved module per face of the square shaft and per 1.5 units of height.
  const shaftMat = carved("sandstone", theme.towerStone, 0, [4, Math.max(1, Math.round(shaftH / 1.5))]);
  const goldMat = new THREE.MeshLambertMaterial({ color: 0xd9a93a, emissive: 0x2a1a00 });
  const gemMat = new THREE.MeshLambertMaterial({ color: theme.towerCrystal });
  const platformMat = new THREE.MeshLambertMaterial({
    color: theme.towerDeck,
    transparent: true,
    opacity: t.platformOpacityFollow,
    depthWrite: false,
  });
  const pillarMat = new THREE.MeshLambertMaterial({ color: theme.towerStone });
  const view = new TowerView(platformMat, shaftMat, [pillarMat, gemMat]);
  if (footW === 0) return { group: tower, view, animations: null, center };
  const cx = center.x;
  const cz = center.z;
  // Repeated decorations, merged into one mesh per material at the end.
  const parts: THREE.Mesh[] = [];

  // Stepped plinth: a limestone course over the whole footprint, then a carved sandstone tier.
  const tier1 = new THREE.Mesh(new THREE.BoxGeometry(footW, t.baseHeight, footD), slabMat);
  tier1.position.set(cx, t.baseHeight / 2, cz);
  const tier2 = new THREE.Mesh(new THREE.BoxGeometry(footW - 0.3, t.baseHeight * 1.6, footD - 0.3), tierMat);
  tier2.position.set(cx, t.baseHeight + (t.baseHeight * 1.6) / 2, cz);

  // Square shaft: a four-sided prism turned so its faces look north, south, east and west, narrowing a little toward the top.
  const faceDist = t.shaftWidth / 2;
  const half = faceDist * Math.SQRT2;
  const taper = 0.84;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(half * taper, half, shaftH, 4, 1, false, Math.PI / 4), shaftMat);
  shaft.position.set(cx, shaftBottom + shaftH / 2, cz);

  // Gold bands round the shaft every three units, sized to its taper at that height.
  const band = (y: number, thick: number, extra: number) => {
    const k = 1 - (1 - taper) * ((y - shaftBottom) / shaftH);
    const w = faceDist * 2 * k + extra;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, thick, w), goldMat);
    m.position.set(cx, y, cz);
    parts.push(m);
  };
  band(shaftBottom + 0.08, 0.16, 0.12);
  for (let h = 3; h < shaftH - 1; h += 3) band(shaftBottom + h, 0.1, 0.06);

  // A flared capital under the platform, rimmed in gold.
  const capH = 0.9;
  const topHalf = half * taper;
  const capital = new THREE.Mesh(new THREE.CylinderGeometry(topHalf + 0.55, topHalf, capH, 4, 1, false, Math.PI / 4), pillarMat);
  capital.position.set(cx, shaftBottom + shaftH - capH / 2, cz);
  tower.add(capital);
  band(shaftBottom + shaftH - 0.04, 0.1, 0.78);

  // The walkable platform: pale limestone, with a gold rim.
  const deckY = t.baseHeight + t.shaftHeight;
  const slabW = footW + t.platformOverhang * 2;
  const slabD = footD + t.platformOverhang * 2;
  const slabGeo = new THREE.BoxGeometry(slabW, t.platformThickness, slabD);
  const platform = new THREE.Mesh(slabGeo, platformMat);
  platform.position.set(cx, deckY + t.platformThickness / 2, cz);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(slabGeo), new THREE.LineBasicMaterial({ color: 0xe8c060 }));
  edges.position.copy(platform.position);

  // Small pillars at the platform corners, capped with a gold band and a turquoise pyramid.
  const top = deckY + t.platformThickness;
  const pillarGeo = new THREE.BoxGeometry(0.3, 0.8, 0.3);
  const capGeo = new THREE.BoxGeometry(0.36, 0.08, 0.36);
  const pyramidGeo = new THREE.ConeGeometry(0.22, 0.3, 4).rotateY(Math.PI / 4);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = cx + sx * (slabW / 2 - 0.2);
      const z = cz + sz * (slabD / 2 - 0.2);
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(x, top + 0.4, z);
      const cap = new THREE.Mesh(capGeo, goldMat);
      cap.position.set(x, top + 0.84, z);
      const pyramid = new THREE.Mesh(pyramidGeo, gemMat);
      pyramid.position.set(x, top + 1.03, z);
      parts.push(pillar, cap, pyramid);
    }
  }

  // The pyramidion, floating where the crystal floats on the stone tower. The
  // climb animation stretches the crystal by 1.6 in y, so it is squashed to match.
  const squash = new THREE.Matrix4().makeScale(1, 1 / 1.6, 1);
  const gem = new THREE.Mesh(
    new THREE.ConeGeometry(0.6, 1.1, 4).rotateY(Math.PI / 4).applyMatrix4(squash),
    new THREE.MeshLambertMaterial({ color: theme.towerCrystal, emissive: theme.towerRune, emissiveIntensity: 0.6 }),
  );
  const gemBase = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.1, 0.86).applyMatrix4(squash), goldMat);
  gemBase.position.y = -0.6 / 1.6;
  gem.add(gemBase);
  gem.scale.set(1, 1.6, 1);
  const gemY = top + 1.9;
  gem.position.set(cx, gemY, cz);
  gem.userData["baseY"] = gemY;

  mergeByMaterial(tower, parts);
  tower.add(tier1, tier2, shaft, platform, edges, gem);
  const animations = new TowerAnimations(tower, center, footW, footD, t.shaftWidth, shaftBottom, shaftH, shaftBottom, gem, theme.towerRune, {
    leaf: 0x3a2616,
    frame: 0xd9a93a,
    handle: 0x3fc8c0,
  });
  view.attach(tower, [
    { min: { x: cx - footW / 2, y: 0, z: cz - footD / 2 }, max: { x: cx + footW / 2, y: shaftBottom, z: cz + footD / 2 } },
    { min: { x: cx - faceDist, y: shaftBottom, z: cz - faceDist }, max: { x: cx + faceDist, y: shaftBottom + shaftH, z: cz + faceDist } },
  ]);
  return { group: tower, view, animations, center };
}
