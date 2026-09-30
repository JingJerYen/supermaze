import * as THREE from "three";
import type { MapGrid } from "@supermaze/sim";
import { CLIENT_TUNING } from "../tuning.js";
import { TowerAnimations } from "./climbSequence.js";
import { patternTexture, type Theme } from "./themes.js";
import { mergeByMaterial, TowerView, towerGeometry, type TowerBuild } from "./tower.js";

/**
 * The candy map's tower: a tall layer cake. It keeps every measure of the
 * stone tower (tiers, shaft, platform, doors), so the climb, the overview
 * camera and the occlusion test are unchanged. A biscuit plinth under pink
 * icing, a round shaft of chocolate sponge and cream, a cream-topped slab for
 * the platform with a striped candle at each corner, and a cherry floating
 * where the crystal would be.
 */
export function buildCakeTower(grid: MapGrid, theme: Theme): TowerBuild {
  const tower = new THREE.Group();
  const { center, footW, footD } = towerGeometry(grid);
  const t = CLIENT_TUNING.tower;
  const pink = theme.wallTop;
  const cream = theme.wallTopAlt ?? theme.towerDeck;
  const textured = (kind: "biscuit" | "icing" | "cake", base: number, accent: number, repeat?: [number, number]) => {
    const map = patternTexture(kind, base, accent);
    const tex = repeat && map ? map.clone() : map;
    if (repeat && tex) {
      tex.repeat.set(repeat[0], repeat[1]);
      tex.needsUpdate = true;
    }
    return new THREE.MeshLambertMaterial({ color: 0xffffff, ...(tex ? { map: tex } : {}) });
  };
  const shaftBottom = t.baseHeight * 2.6;
  const shaftH = t.shaftHeight - t.baseHeight * 1.6;
  const icingMat = new THREE.MeshLambertMaterial({ color: pink });
  const creamMat = new THREE.MeshLambertMaterial({ color: cream });
  const biscuitMat = textured("biscuit", theme.wallSide, pink, [Math.max(1, footW), 1]);
  // Two world units of cake per texture repeat, wrapped six times round the shaft.
  const shaftMat = textured("cake", theme.towerStone, cream, [6, Math.max(1, Math.round(shaftH / 2))]);
  const platformMat = new THREE.MeshLambertMaterial({
    color: theme.towerDeck,
    transparent: true,
    opacity: t.platformOpacityFollow,
    depthWrite: false,
  });
  const candleMat = new THREE.MeshLambertMaterial({ color: 0xfff6ee });
  const stripeMat = new THREE.MeshLambertMaterial({ color: theme.structure.rail });
  const flameMat = new THREE.MeshBasicMaterial({ color: theme.torchFlame });
  const view = new TowerView(platformMat, shaftMat, [candleMat, stripeMat, flameMat]);
  if (footW === 0) return { group: tower, view, animations: null, center };
  const cx = center.x;
  const cz = center.z;
  // Repeated decorations, merged into one mesh per material at the end.
  const parts: THREE.Mesh[] = [];

  // Plinth: a biscuit block under pink icing over the whole footprint, then a smaller iced step.
  const tier1 = new THREE.Mesh(new THREE.BoxGeometry(footW, t.baseHeight, footD), icingMat);
  tier1.position.set(cx, t.baseHeight / 2, cz);
  const tier2 = new THREE.Mesh(new THREE.BoxGeometry(footW - 0.3, t.baseHeight * 1.6, footD - 0.3), biscuitMat);
  tier2.position.set(cx, t.baseHeight + (t.baseHeight * 1.6) / 2, cz);

  // Round shaft of sponge and cream, with a ring of pink icing at its foot and a wide cream collar under the platform.
  const faceDist = t.shaftWidth / 2;
  const radius = faceDist * 1.02;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.03, shaftH, 28, 1), shaftMat);
  shaft.position.set(cx, shaftBottom + shaftH / 2, cz);
  const ring = (r: number, tube: number, mat: THREE.Material, y: number) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 36).rotateX(Math.PI / 2), mat);
    m.position.set(cx, y, cz);
    parts.push(m);
  };
  ring(radius + 0.04, 0.09, icingMat, shaftBottom + 0.06);
  for (let h = 4; h < shaftH - 1; h += 4) ring(radius + 0.02, 0.06, icingMat, shaftBottom + h);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.3, radius + 0.06, 0.45, 28), creamMat);
  collar.position.set(cx, shaftBottom + shaftH - 0.22, cz);
  tower.add(collar);
  ring(radius + 0.3, 0.08, icingMat, shaftBottom + shaftH);

  // The walkable platform: the cake's cream top, with a pink rim.
  const deckY = t.baseHeight + t.shaftHeight;
  const slabW = footW + t.platformOverhang * 2;
  const slabD = footD + t.platformOverhang * 2;
  const slabGeo = new THREE.BoxGeometry(slabW, t.platformThickness, slabD);
  const platform = new THREE.Mesh(slabGeo, platformMat);
  platform.position.set(cx, deckY + t.platformThickness / 2, cz);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(slabGeo), new THREE.LineBasicMaterial({ color: pink }));
  edges.position.copy(platform.position);

  // A striped candle at each corner of the platform, clear of the seats in the middle.
  const top = deckY + t.platformThickness;
  const candleGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.9, 12);
  const bandGeo = new THREE.CylinderGeometry(0.105, 0.105, 0.1, 12);
  const flameGeo = new THREE.ConeGeometry(0.09, 0.26, 8);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = cx + sx * (slabW / 2 - 0.18);
      const z = cz + sz * (slabD / 2 - 0.18);
      const body = new THREE.Mesh(candleGeo, candleMat);
      body.position.set(x, top + 0.45, z);
      parts.push(body);
      for (let b = 0; b < 4; b++) {
        const band = new THREE.Mesh(bandGeo, stripeMat);
        band.position.set(x, top + 0.15 + b * 0.22, z);
        parts.push(band);
      }
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(x, top + 1.05, z);
      parts.push(flame);
    }
  }

  // The cherry on top, floating where the crystal floats on the stone tower. The
  // climb animation scales the crystal by 1.6 in y, so it is squashed to match.
  const squash = new THREE.Matrix4().makeScale(1, 1 / 1.6, 1);
  const cherry = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 20, 14).applyMatrix4(squash),
    new THREE.MeshLambertMaterial({ color: theme.towerCrystal, emissive: 0x7a0c1e, emissiveIntensity: 0.6 }),
  );
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8).applyMatrix4(squash), new THREE.MeshBasicMaterial({ color: 0xffe4ea }));
  shine.position.set(-0.2, 0.14, 0.32);
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.04, 0.6, 6).rotateZ(0.35).applyMatrix4(squash),
    new THREE.MeshLambertMaterial({ color: 0x5b3a1a }),
  );
  stem.position.set(0.08, 0.42 / 1.6 + 0.12, 0);
  cherry.add(shine, stem);
  cherry.scale.set(1, 1.6, 1);
  const cherryY = top + 1.9;
  cherry.position.set(cx, cherryY, cz);
  cherry.userData["baseY"] = cherryY;

  mergeByMaterial(tower, parts);
  tower.add(tier1, tier2, shaft, platform, edges, cherry);
  const animations = new TowerAnimations(tower, center, footW, footD, t.shaftWidth, shaftBottom, shaftH, shaftBottom, cherry, theme.towerRune, {
    leaf: 0x4a2a1a,
    frame: theme.structure.rail,
    handle: 0xfff6ee,
  });
  view.attach(tower, [
    { min: { x: cx - footW / 2, y: 0, z: cz - footD / 2 }, max: { x: cx + footW / 2, y: shaftBottom, z: cz + footD / 2 } },
    { min: { x: cx - faceDist, y: shaftBottom, z: cz - faceDist }, max: { x: cx + faceDist, y: shaftBottom + shaftH, z: cz + faceDist } },
  ]);
  return { group: tower, view, animations, center };
}
