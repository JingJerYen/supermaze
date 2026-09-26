import * as THREE from "three";
import { columnLabel, rowLabel, type MapGrid } from "@supermaze/sim";

/**
 * Board coordinates painted on top of the outer wall ring: column letters along
 * the north and south edges, row numbers along the west and east edges. Laid
 * flat with "up" pointing north, so they read correctly from the follow camera
 * (which always looks north) and from the tower overview (north up).
 */
export function buildCoordLabels(grid: MapGrid): THREE.Group {
  const group = new THREE.Group();
  const y = 1.02; // just above a wall top
  for (let x = 1; x < grid.width - 1; x++) {
    if (grid.kindAt(x, 0) === "wall") group.add(label(columnLabel(x), x, 0, y));
    if (grid.kindAt(x, grid.height - 1) === "wall") group.add(label(columnLabel(x), x, grid.height - 1, y));
  }
  for (let ty = 1; ty < grid.height - 1; ty++) {
    if (grid.kindAt(0, ty) === "wall") group.add(label(rowLabel(ty), 0, ty, y));
    if (grid.kindAt(grid.width - 1, ty) === "wall") group.add(label(rowLabel(ty), grid.width - 1, ty, y));
  }
  return group;
}

const textureCache = new Map<string, THREE.CanvasTexture>();

function label(text: string, x: number, z: number, y: number): THREE.Mesh {
  let tex = textureCache.get(text);
  if (!tex) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 128, 128);
    ctx.font = "bold 84px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.strokeText(text, 64, 68);
    ctx.fillStyle = "#f3f6ff";
    ctx.fillText(text, 64, 68);
    tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    textureCache.set(text, tex);
  }
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.9),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2; // lie flat; plane +Y (text up) now points to -Z = north
  mesh.position.set(x, y, z);
  return mesh;
}
