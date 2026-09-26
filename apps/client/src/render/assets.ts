import * as THREE from "three";
import { CLIENT_TUNING } from "../tuning.js";
import { createBeam } from "./itemModels.js";
import { models } from "./models.js";

/**
 * Model factories. Each returns an Object3D whose origin sits on the ground at
 * the tile centre. A real .glb from public/models/ (see models.ts) is used when
 * present; otherwise the hand-built placeholder below.
 */

export function createKeyModel(): THREE.Object3D {
  const real = models.instantiate("key");
  if (real) return real;
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffd23f });
  const head = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.04, 8, 16), mat);
  head.position.y = 0.55;
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.06), mat);
  shaft.position.y = 0.3;
  const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.06), mat);
  tooth.position.set(0.06, 0.2, 0);
  group.add(head, shaft, tooth);
  return group;
}

/** Tall, unlit beam so a key is visible from afar even when the map is dark. */
export function createKeyBeam(): THREE.Object3D {
  const { height, radius, opacity, color } = CLIENT_TUNING.keyBeam;
  return createBeam(color, height, opacity, radius);
}

export function createBoxModel(): THREE.Object3D {
  const real = models.instantiate("box");
  if (real) return real;
  const { size, hover, opacity } = CLIENT_TUNING.itemBox;
  const group = new THREE.Group();

  const cube = new THREE.Group();
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshLambertMaterial({ color: 0x7fd8ff, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }),
  );
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(glass.geometry), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
  cube.add(glass, edges);
  // Stand the cube on a corner: tilt so a vertex points straight down.
  cube.rotation.set(Math.atan(Math.SQRT2), Math.PI / 4, 0, "ZYX");
  cube.name = "spin";

  const mark = new THREE.Mesh(
    new THREE.PlaneGeometry(size * 0.55, size * 0.55),
    new THREE.MeshBasicMaterial({ map: questionMarkTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  );
  mark.name = "mark";

  // Cube on a corner spans size*sqrt(3) tip to tip; hover so the tip floats above the floor.
  const lift = hover + (size * Math.SQRT2) / 2 + 0.1;
  cube.position.y = lift;
  mark.position.y = lift;
  group.add(cube, mark);
  return group;
}

let questionTex: THREE.CanvasTexture | null = null;
function questionMarkTexture(): THREE.CanvasTexture {
  if (questionTex) return questionTex;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "bold 104px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 12;
  ctx.strokeStyle = "rgba(60,30,0,0.9)";
  ctx.strokeText("?", 64, 70);
  ctx.fillStyle = "#ffd23f";
  ctx.fillText("?", 64, 70);
  questionTex = new THREE.CanvasTexture(canvas);
  return questionTex;
}
