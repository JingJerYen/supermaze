import * as THREE from "three";
import type { MapGrid } from "@supermaze/sim";
import { CLIENT_TUNING } from "../tuning.js";
import { TowerAnimations } from "./climbSequence.js";
import { patternTexture, type Theme } from "./themes.js";
import { mergeByMaterial, TowerView, towerGeometry, type TowerBuild } from "./tower.js";

/**
 * The ice palace's tower: an ice spire. It keeps every measure of the stone
 * tower (tiers, octagonal shaft, platform, doors), so the climb, the overview
 * camera and the occlusion test are unchanged. A stone plinth under a tier of
 * snow-capped ice, a shaft of clear ice with crystal shards leaning out from
 * its foot, a flared crown of ice under a snowy platform with an icicle spike
 * at each corner, and a glowing crystal above it all.
 */
export function buildIceTower(grid: MapGrid, theme: Theme): TowerBuild {
  const tower = new THREE.Group();
  const { center, footW, footD } = towerGeometry(grid);
  const t = CLIENT_TUNING.tower;
  const ice = (base: number, snow: number, repeat: [number, number]) => {
    const map = patternTexture("iceBrick", base, snow);
    const tex = map ? map.clone() : null;
    if (tex) {
      tex.repeat.set(repeat[0], repeat[1]);
      tex.needsUpdate = true;
    }
    return new THREE.MeshPhongMaterial({ color: 0xffffff, ...(tex ? { map: tex } : {}), specular: 0x6a88aa, shininess: 60, emissive: snow ? 0x000000 : 0x0e2a44 });
  };
  const shaftBottom = t.baseHeight * 2.6;
  const shaftH = t.shaftHeight - t.baseHeight * 1.6;
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x4a566e });
  const snowMat = new THREE.MeshLambertMaterial({ color: theme.wallTop });
  const tierMat = ice(theme.wallSide, theme.wallTop, [Math.max(1, footW), 1]);
  const shaftMat = ice(theme.towerStone, 0, [8, Math.max(1, Math.round(shaftH / 1.5))]);
  const shardMat = new THREE.MeshPhongMaterial({ color: theme.towerStone, emissive: 0x1a4a70, specular: 0xffffff, shininess: 90, flatShading: true });
  const platformMat = new THREE.MeshLambertMaterial({
    color: theme.towerDeck,
    transparent: true,
    opacity: t.platformOpacityFollow,
    depthWrite: false,
  });
  const spikeMat = new THREE.MeshPhongMaterial({ color: theme.towerCrystal, emissive: 0x2a6a90, specular: 0xffffff, shininess: 90, flatShading: true });
  const view = new TowerView(platformMat, shaftMat, [spikeMat]);
  if (footW === 0) return { group: tower, view, animations: null, center };
  const cx = center.x;
  const cz = center.z;
  // Repeated decorations, merged into one mesh per material at the end.
  const parts: THREE.Mesh[] = [];

  // Plinth: a course of dark stone over the whole footprint, then a snow-capped tier of ice.
  const tier1 = new THREE.Mesh(new THREE.BoxGeometry(footW, t.baseHeight, footD), stoneMat);
  tier1.position.set(cx, t.baseHeight / 2, cz);
  const tier2 = new THREE.Mesh(new THREE.BoxGeometry(footW - 0.3, t.baseHeight * 1.6, footD - 0.3), tierMat);
  tier2.position.set(cx, t.baseHeight + (t.baseHeight * 1.6) / 2, cz);

  // Octagonal shaft of clear ice.
  const faceDist = t.shaftWidth / 2;
  const radius = faceDist / Math.cos(Math.PI / 8);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.06, shaftH, 8, 1, false, Math.PI / 8), shaftMat);
  shaft.position.set(cx, shaftBottom + shaftH / 2, cz);

  // Crystal ribs up the eight edges of the shaft, for the faceted look of an ice spire.
  const ribGeo = new THREE.CylinderGeometry(0.07, 0.1, shaftH - 0.4, 4);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    const rib = new THREE.Mesh(ribGeo, shardMat);
    rib.position.set(cx + Math.sin(a) * radius, shaftBottom + shaftH / 2, cz + Math.cos(a) * radius);
    parts.push(rib);
  }

  // Crystal shards leaning out from the foot of the shaft, on the corners between the doors.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    for (const [len, spread, lean] of [
      [2.2, 0, 0.18],
      [1.4, 0.32, 0.4],
      [1.2, -0.32, 0.45],
    ] as const) {
      const dir = a + spread;
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.2, len, 4), shardMat);
      const r = radius * 0.95;
      shard.position.set(cx + Math.sin(dir) * r, shaftBottom + len / 2 - 0.1, cz + Math.cos(dir) * r);
      shard.rotation.set(Math.cos(dir) * lean, 0, -Math.sin(dir) * lean);
      parts.push(shard);
    }
  }

  // A flared crown of ice under the platform, capped with snow.
  const crownH = 1.2;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.55, radius, crownH, 8, 1, false, Math.PI / 8), shaftMat);
  crown.position.set(cx, shaftBottom + shaftH - crownH / 2, cz);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.62, radius + 0.58, 0.14, 8, 1, false, Math.PI / 8), snowMat);
  cap.position.set(cx, shaftBottom + shaftH + 0.02, cz);
  tower.add(crown, cap);

  // The walkable platform: packed snow, with a pale blue rim.
  const deckY = t.baseHeight + t.shaftHeight;
  const slabW = footW + t.platformOverhang * 2;
  const slabD = footD + t.platformOverhang * 2;
  const slabGeo = new THREE.BoxGeometry(slabW, t.platformThickness, slabD);
  const platform = new THREE.Mesh(slabGeo, platformMat);
  platform.position.set(cx, deckY + t.platformThickness / 2, cz);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(slabGeo), new THREE.LineBasicMaterial({ color: 0xbfeaff }));
  edges.position.copy(platform.position);

  // An ice spike at each corner of the platform, clear of the seats in the middle.
  const top = deckY + t.platformThickness;
  const spikeGeo = new THREE.ConeGeometry(0.16, 1.3, 4);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      spike.position.set(cx + sx * (slabW / 2 - 0.18), top + 0.65, cz + sz * (slabD / 2 - 0.18));
      parts.push(spike);
    }
  }

  // The crystal, as on the stone tower: an elongated octahedron, stretched by the climb animation.
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.62, 0),
    new THREE.MeshLambertMaterial({ color: theme.towerCrystal, emissive: theme.towerRune, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 }),
  );
  crystal.scale.set(1, 1.6, 1);
  const crystalY = top + 1.9;
  crystal.position.set(cx, crystalY, cz);
  crystal.userData["baseY"] = crystalY;

  mergeByMaterial(tower, parts);
  tower.add(tier1, tier2, shaft, platform, edges, crystal);
  const animations = new TowerAnimations(tower, center, footW, footD, t.shaftWidth, shaftBottom, shaftH, shaftBottom, crystal, theme.towerRune, {
    leaf: 0x2a4a7a,
    frame: 0xeef3fb,
    handle: 0x8fe6ff,
  });
  view.attach(tower, [
    { min: { x: cx - footW / 2, y: 0, z: cz - footD / 2 }, max: { x: cx + footW / 2, y: shaftBottom, z: cz + footD / 2 } },
    { min: { x: cx - faceDist, y: shaftBottom, z: cz - faceDist }, max: { x: cx + faceDist, y: shaftBottom + shaftH, z: cz + faceDist } },
  ]);
  return { group: tower, view, animations, center };
}
