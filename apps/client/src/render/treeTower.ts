import * as THREE from "three";
import type { MapGrid } from "@supermaze/sim";
import { CLIENT_TUNING } from "../tuning.js";
import { seeded } from "./canvasDraw.js";
import { TowerAnimations } from "./climbSequence.js";
import { patternTexture, type Theme } from "./themes.js";
import { TowerView, towerGeometry, type TowerBuild } from "./tower.js";

/**
 * The garden's tower: a great tree. It keeps every measure the climb relies on,
 * so nothing else changes: a door in the root flare on each face, a trunk as wide
 * as the stone shaft (the ascent light runs up its faces), the walkable deck at the
 * platform height, and the crystal floating above. The crown gathers round and
 * under the deck but never over it, so climbers on the deck stay in view.
 */
export function buildTreeTower(grid: MapGrid, theme: Theme): TowerBuild {
  const tree = new THREE.Group();
  const { center, footW, footD } = towerGeometry(grid);
  const t = CLIENT_TUNING.tower;
  const barkTex = patternTexture("bark", theme.towerBark);
  const barkMat = new THREE.MeshLambertMaterial(barkTex ? { color: theme.towerBark, map: barkTex } : { color: theme.towerBark });
  const deckMat = new THREE.MeshLambertMaterial({
    color: theme.towerDeck,
    transparent: true,
    opacity: t.platformOpacityFollow,
    depthWrite: false,
  });
  const leafMat = new THREE.MeshLambertMaterial({ color: theme.towerLeaf, flatShading: true });
  const leafDarkMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(theme.towerLeaf).multiplyScalar(0.72), flatShading: true });
  const branchMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(theme.towerBark).multiplyScalar(0.9) });
  const view = new TowerView(deckMat, barkMat, [leafMat, leafDarkMat, branchMat]);
  if (footW === 0) return { group: tree, view, animations: null, center };
  const cx = center.x;
  const cz = center.z;
  const oct = (faceDist: number) => faceDist / Math.cos(Math.PI / 8);

  // Mossy mound over the footprint.
  const moundTex = patternTexture("hedgeTop", theme.towerLeaf);
  const moundColor = new THREE.Color(theme.towerLeaf).multiplyScalar(0.8).getHex();
  const mound = new THREE.Mesh(
    new THREE.BoxGeometry(footW, t.baseHeight, footD),
    new THREE.MeshLambertMaterial(moundTex ? { color: moundColor, map: moundTex } : { color: moundColor }),
  );
  mound.position.set(cx, t.baseHeight / 2, cz);

  // Root flare: a wide octagonal foot narrowing into the trunk; the doors sit on its faces.
  const flareMat = new THREE.MeshLambertMaterial(barkTex ? { color: theme.towerBark, map: barkTex } : { color: theme.towerBark });
  const flareTop = 2.2;
  const flareH = flareTop - t.baseHeight;
  const flare = new THREE.Mesh(
    new THREE.CylinderGeometry(oct(t.shaftWidth / 2), oct(Math.min(footW, footD) / 2 - 0.08), flareH, 8, 1, false, Math.PI / 8),
    flareMat,
  );
  flare.position.set(cx, t.baseHeight + flareH / 2, cz);

  // Four roots toward the footprint corners, away from the doors.
  const rootGeo = new THREE.BoxGeometry(0.34, 0.3, 1.1);
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const root = new THREE.Mesh(rootGeo, flareMat);
    root.position.set(cx + Math.sin(a) * 1.05, t.baseHeight + 0.1, cz + Math.cos(a) * 1.05);
    root.rotation.set(0.28, a, 0, "YXZ");
    tree.add(root);
  }

  // Trunk: same octagon as the stone shaft, so the ascent strips lie on its faces.
  const shaftBottom = t.baseHeight * 2.6;
  const shaftH = t.shaftHeight - t.baseHeight * 1.6;
  const deckY = t.baseHeight + t.shaftHeight;
  const trunkH = deckY - flareTop;
  const trunkTex = barkTex ? barkTex.clone() : null;
  if (trunkTex) {
    trunkTex.repeat.set(3, Math.round(trunkH / 2));
    trunkTex.needsUpdate = true;
  }
  if (trunkTex) barkMat.map = trunkTex;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(oct(t.shaftWidth / 2), oct(t.shaftWidth / 2), trunkH, 8, 1, false, Math.PI / 8), barkMat);
  trunk.position.set(cx, flareTop + trunkH / 2, cz);

  // Branches reaching diagonally up and out to the crown.
  const branchGeo = new THREE.CylinderGeometry(0.16, 0.26, 2.6, 6);
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const b = new THREE.Mesh(branchGeo, branchMat);
    b.position.set(cx + Math.sin(a) * 1.4, deckY - 2.4, cz + Math.cos(a) * 1.4);
    b.rotation.set(0.95, a, 0, "YXZ");
    tree.add(b);
  }

  // A few side boughs part-way up, on the diagonals so the faces (and their ascent light) stay clear.
  const boughGeo = new THREE.CylinderGeometry(0.09, 0.16, 1.5, 6);
  const tuftGeo = new THREE.IcosahedronGeometry(0.62, 1);
  for (const [a, y] of [
    [Math.PI / 4, deckY * 0.42],
    [(5 * Math.PI) / 4, deckY * 0.5],
    [(3 * Math.PI) / 4, deckY * 0.63],
    [(7 * Math.PI) / 4, deckY * 0.7],
  ] as const) {
    const bough = new THREE.Mesh(boughGeo, branchMat);
    bough.position.set(cx + Math.sin(a) * 1.15, y, cz + Math.cos(a) * 1.15);
    bough.rotation.set(1.05, a, 0, "YXZ");
    const tuft = new THREE.Mesh(tuftGeo, leafMat);
    tuft.scale.set(1, 0.8, 1);
    tuft.position.set(cx + Math.sin(a) * 1.85, y + 0.55, cz + Math.cos(a) * 1.85);
    tree.add(bough, tuft);
  }

  // Crown: low-poly leaf clusters in two rings, one round the deck edge (kept below
  // its top) and one under the deck, so the deck sits in the crown like a tree house.
  const rnd = seeded(footW * 131 + footD);
  const blob = new THREE.IcosahedronGeometry(1, 1);
  const deckHalf = Math.max(footW, footD) / 2 + t.platformOverhang;
  const rings: { n: number; r: number; y: number; s: number }[] = [
    { n: 14, r: deckHalf + 0.75, y: deckY - 0.55, s: 0.95 },
    { n: 10, r: deckHalf - 0.2, y: deckY - 1.55, s: 1.15 },
    { n: 6, r: 1.3, y: deckY - 2.6, s: 1.0 },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * Math.PI * 2 + rnd() * 0.3;
      const s = ring.s * (0.8 + rnd() * 0.4);
      const leaf = new THREE.Mesh(blob, rnd() < 0.4 ? leafDarkMat : leafMat);
      leaf.scale.set(s, s * 0.78, s);
      leaf.position.set(cx + Math.sin(a) * ring.r, ring.y + (rnd() - 0.5) * 0.35, cz + Math.cos(a) * ring.r);
      leaf.rotation.set(rnd(), rnd() * Math.PI, rnd());
      tree.add(leaf);
    }
  }

  // The deck: same slab and outline as the stone platform, in timber.
  const slabGeo = new THREE.BoxGeometry(footW + t.platformOverhang * 2, t.platformThickness, footD + t.platformOverhang * 2);
  const deck = new THREE.Mesh(slabGeo, deckMat);
  deck.position.set(cx, deckY + t.platformThickness / 2, cz);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(slabGeo), new THREE.LineBasicMaterial({ color: 0xfff1d6 }));
  edges.position.copy(deck.position);

  // The crystal floats above the deck, as on the stone tower.
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.42),
    new THREE.MeshLambertMaterial({ color: theme.towerCrystal, emissive: theme.towerRune, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 }),
  );
  crystal.scale.set(1, 1.6, 1);
  const crystalY = deckY + t.platformThickness + 1.9;
  crystal.position.set(cx, crystalY, cz);
  crystal.userData["baseY"] = crystalY;

  tree.add(mound, flare, trunk, deck, edges, crystal);
  const animations = new TowerAnimations(tree, center, footW, footD, t.shaftWidth, shaftBottom, shaftH, t.baseHeight * 2.6, crystal, theme.towerRune, {
    leaf: 0x7a5530,
    frame: 0x4a3220,
    handle: 0xd9b25a,
  });
  const faceDist = t.shaftWidth / 2;
  const crownR = deckHalf + 0.75 + 1.1;
  view.attach(tree, [
    { min: { x: cx - footW / 2, y: 0, z: cz - footD / 2 }, max: { x: cx + footW / 2, y: flareTop, z: cz + footD / 2 } },
    { min: { x: cx - faceDist, y: flareTop, z: cz - faceDist }, max: { x: cx + faceDist, y: deckY, z: cz + faceDist } },
    { min: { x: cx - crownR, y: deckY - 3.6, z: cz - crownR }, max: { x: cx + crownR, y: deckY, z: cz + crownR } },
  ]);
  return { group: tree, view, animations, center };
}
