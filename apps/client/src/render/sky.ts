import * as THREE from "three";

const cache = new Map<string, THREE.CanvasTexture>();

/**
 * The lit background behind the maze: a gradient from the top of the screen to
 * the bottom through the theme's colours (CLAUDE.md 14). A screen-filling
 * texture rather than a sky dome, so it reads the same from the follow camera,
 * the opening shot and the bird's-eye view. One small texture per theme, kept.
 */
export function skyTexture(stops: readonly number[]): THREE.CanvasTexture {
  const key = stops.join(",");
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  stops.forEach((c, i) => grad.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), `#${c.toString(16).padStart(6, "0")}`));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}
