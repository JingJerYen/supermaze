import * as THREE from "three";
import type { MapGrid } from "@supermaze/sim";
import { CLIENT_TUNING } from "../tuning.js";
import { TowerAnimations } from "./climbSequence.js";
import { glowTexture, patternTexture, runeTexture, type Theme } from "./themes.js";
import { TowerView, towerGeometry, type TowerBuild } from "./tower.js";

/**
 * The factory's tower: a steel reactor. It keeps every measure of the stone
 * tower (tiers, octagonal shaft, platform, doors), so the climb, the overview
 * camera and the occlusion test are unchanged. Glowing rings band the shaft,
 * four pylons stand at the platform corners, and a hologram globe with two
 * orbiting rings takes the crystal's place.
 */
export function buildReactorTower(grid: MapGrid, theme: Theme): TowerBuild {
  const tower = new THREE.Group();
  const { center, footW, footD } = towerGeometry(grid);
  const t = CLIENT_TUNING.tower;
  const steel = (kind: "plate" | "panel", repeat?: [number, number]) => {
    const map = patternTexture(kind, theme.towerStone);
    const glow = glowTexture(kind, theme.towerRune);
    const tex = repeat && map ? map.clone() : map;
    const glowTex = repeat && glow ? glow.clone() : glow;
    for (const x of repeat ? [tex, glowTex] : []) {
      if (!x) continue;
      x.repeat.set(repeat![0], repeat![1]);
      x.needsUpdate = true;
    }
    return new THREE.MeshLambertMaterial({
      color: 0xffffff,
      ...(tex ? { map: tex } : {}),
      ...(glowTex ? { emissive: 0xffffff, emissiveMap: glowTex } : {}),
    });
  };
  const shaftBottom = t.baseHeight * 2.6;
  const shaftH = t.shaftHeight - t.baseHeight * 1.6;
  const baseMat = steel("plate");
  const shaftMat = steel("panel", [8, Math.round(shaftH)]);
  const darkSteel = new THREE.MeshLambertMaterial({ color: new THREE.Color(theme.towerStone).multiplyScalar(0.55) });
  const glowMat = new THREE.MeshBasicMaterial({ color: theme.towerRune });
  const platformMat = new THREE.MeshLambertMaterial({
    color: theme.towerDeck,
    transparent: true,
    opacity: t.platformOpacityFollow,
    depthWrite: false,
  });
  const pylonMat = new THREE.MeshLambertMaterial({ color: theme.towerStone });
  const tipMat = new THREE.MeshBasicMaterial({ color: theme.structure.rail });
  const view = new TowerView(platformMat, shaftMat, [pylonMat, tipMat]);
  if (footW === 0) return { group: tower, view, animations: null, center };
  const cx = center.x;
  const cz = center.z;

  // Two stepped tiers inside the footprint, as on the stone tower, with glowing corner strips.
  const tier1 = new THREE.Mesh(new THREE.BoxGeometry(footW, t.baseHeight, footD), baseMat);
  tier1.position.set(cx, t.baseHeight / 2, cz);
  const tier2 = new THREE.Mesh(new THREE.BoxGeometry(footW - 0.3, t.baseHeight * 1.6, footD - 0.3), baseMat);
  tier2.position.set(cx, t.baseHeight + (t.baseHeight * 1.6) / 2, cz);
  const cornerGeo = new THREE.BoxGeometry(0.08, shaftBottom, 0.08);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const strip = new THREE.Mesh(cornerGeo, glowMat);
      strip.position.set(cx + sx * (footW / 2 - 0.02), shaftBottom / 2, cz + sz * (footD / 2 - 0.02));
      tower.add(strip);
    }
  }

  // Octagonal shaft of wall modules, one module per face and per tile of height.
  const faceDist = t.shaftWidth / 2;
  const radius = faceDist / Math.cos(Math.PI / 8);
  const ring = (r: number, h: number, mat: THREE.Material, y: number) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 8, 1, false, Math.PI / 8), mat);
    m.position.set(cx, y, cz);
    tower.add(m);
  };
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.04, shaftH, 8, 1, false, Math.PI / 8), shaftMat);
  shaft.position.set(cx, shaftBottom + shaftH / 2, cz);

  // A steel collar every three tiles with a glowing ring through it, a glowing ring at the foot, a heavy collar under the platform.
  ring(radius + 0.12, 0.12, glowMat, shaftBottom + 0.06);
  for (let h = 3; h < shaftH - 0.5; h += 3) {
    ring(radius + 0.08, 0.24, darkSteel, shaftBottom + h);
    ring(radius + 0.1, 0.06, glowMat, shaftBottom + h);
  }
  const corbel = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.24, radius + 0.04, 0.4, 8, 1, false, Math.PI / 8), baseMat);
  corbel.position.set(cx, shaftBottom + shaftH - 0.2, cz);
  tower.add(corbel);
  ring(radius + 0.26, 0.05, glowMat, shaftBottom + shaftH - 0.02);

  // A glyph plaque near the top of each face.
  const runeMat = new THREE.MeshBasicMaterial({ map: runeTexture(theme.towerRune), transparent: true, depthWrite: false });
  const runeGeo = new THREE.PlaneGeometry(0.34, 1.1);
  for (const [dx, dz, yaw] of [
    [0, 1, 0],
    [0, -1, Math.PI],
    [1, 0, Math.PI / 2],
    [-1, 0, -Math.PI / 2],
  ] as const) {
    const r = new THREE.Mesh(runeGeo, runeMat);
    r.position.set(cx + dx * (faceDist + 0.02), shaftBottom + shaftH - 1.2, cz + dz * (faceDist + 0.02));
    r.rotation.y = yaw;
    tower.add(r);
  }

  // The walkable platform: tinted glass with a glowing rim.
  const deckY = t.baseHeight + t.shaftHeight;
  const slabW = footW + t.platformOverhang * 2;
  const slabD = footD + t.platformOverhang * 2;
  const slabGeo = new THREE.BoxGeometry(slabW, t.platformThickness, slabD);
  const platform = new THREE.Mesh(slabGeo, platformMat);
  platform.position.set(cx, deckY + t.platformThickness / 2, cz);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(slabGeo), new THREE.LineBasicMaterial({ color: 0xbff4ff }));
  edges.position.copy(platform.position);

  // Pylons on the platform corners, leaning in toward the globe, amber lights at their tips.
  const top = deckY + t.platformThickness;
  const postGeo = new THREE.BoxGeometry(0.2, 1.3, 0.2);
  const armGeo = new THREE.BoxGeometry(0.16, 0.9, 0.16);
  const tipGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const holder = new THREE.Group();
      holder.position.set(cx + sx * (slabW / 2 - 0.14), top, cz + sz * (slabD / 2 - 0.14));
      holder.rotation.y = Math.atan2(-sx, -sz); // local +z points at the centre
      const post = new THREE.Mesh(postGeo, pylonMat);
      post.position.y = 0.65;
      const arm = new THREE.Mesh(armGeo, pylonMat);
      arm.position.set(0, 1.62, 0.2);
      arm.rotation.x = 0.5;
      const tip = new THREE.Mesh(tipGeo, tipMat);
      tip.position.set(0, 2.02, 0.42);
      holder.add(post, arm, tip);
      tower.add(holder);
    }
  }

  // Hologram globe floating above the platform, in the crystal's place. The climb
  // animation scales the crystal by 1.6 in y, so its parts are squashed to match.
  const squash = new THREE.Matrix4().makeScale(1, 1 / 1.6, 1);
  const globeGeo = new THREE.IcosahedronGeometry(0.62, 2).applyMatrix4(squash);
  const globe = new THREE.Mesh(
    globeGeo,
    new THREE.MeshLambertMaterial({ color: theme.towerCrystal, emissive: theme.towerRune, emissiveIntensity: 0.6, transparent: true, opacity: 0.55 }),
  );
  const wire = new THREE.Mesh(
    globeGeo,
    new THREE.MeshBasicMaterial({ color: theme.towerCrystal, wireframe: true, transparent: true, opacity: 0.5, depthWrite: false }),
  );
  wire.scale.setScalar(1.02);
  globe.add(wire);
  const orbitMat = new THREE.MeshBasicMaterial({
    color: theme.towerRune,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  for (const [tiltX, tiltZ] of [
    [1.25, 0.3],
    [1.9, -0.45],
  ] as const) {
    const orbitGeo = new THREE.TorusGeometry(0.9, 0.025, 6, 48).rotateX(tiltX).rotateZ(tiltZ).applyMatrix4(squash);
    globe.add(new THREE.Mesh(orbitGeo, orbitMat));
  }
  globe.scale.set(1, 1.6, 1);
  const globeY = top + 1.9;
  globe.position.set(cx, globeY, cz);
  globe.userData["baseY"] = globeY;

  tower.add(tier1, tier2, shaft, platform, edges, globe);
  const animations = new TowerAnimations(tower, center, footW, footD, t.shaftWidth, shaftBottom, shaftH, shaftBottom, globe, theme.towerRune, {
    leaf: 0x39455a,
    frame: 0x9aa4b4,
    handle: 0xffa640,
  });
  view.attach(tower, [
    { min: { x: cx - footW / 2, y: 0, z: cz - footD / 2 }, max: { x: cx + footW / 2, y: shaftBottom, z: cz + footD / 2 } },
    { min: { x: cx - faceDist, y: shaftBottom, z: cz - faceDist }, max: { x: cx + faceDist, y: shaftBottom + shaftH, z: cz + faceDist } },
  ]);
  return { group: tower, view, animations, center };
}
