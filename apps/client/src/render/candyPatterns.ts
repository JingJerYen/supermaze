import * as THREE from "three";
import { speckle } from "./canvasDraw.js";
import type { Shade } from "./gardenPatterns.js";

/**
 * Candy surfaces: biscuit walls under a band of icing, soft icing slabs on the
 * wall tops, chocolate-bar squares on the floor, and sponge-and-cream layers
 * for the cake tower. Painted in their true colours for a white material, so
 * the icing band and the cream keep their own colours on the biscuit and the
 * sponge. `band` is the icing's colour on a wall side (it matches that wall's
 * top) and the cream's between two cake layers.
 */

const css = (c: number, k = 1) => `#${new THREE.Color(c).multiplyScalar(k).getHexString()}`;

/** Height of the icing band along the top of a wall side, px of 256. */
const BAND = 34;

export function paintBiscuit(ctx: CanvasRenderingContext2D, size: number, shade: Shade, rnd: () => number, band: number): void {
  // Grooves between the squares, then the squares themselves.
  ctx.fillStyle = shade(0.66);
  ctx.fillRect(0, 0, size, size);

  // A grid of raised biscuit squares, each with docking holes.
  const cols = 4;
  const rows = 3;
  const top = BAND + 10;
  const cellW = size / cols;
  const cellH = (size - top - 8) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellW + 5;
      const y = top + r * cellH + 4;
      const w = cellW - 10;
      const h = cellH - 8;
      ctx.fillStyle = shade(1.06 - rnd() * 0.05);
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 7);
      ctx.fill();
      ctx.fillStyle = shade(1.22);
      ctx.fillRect(x + 7, y + 3, w - 14, 3);
      ctx.fillStyle = shade(0.86);
      ctx.fillRect(x + 7, y + h - 5, w - 14, 3);
      ctx.fillStyle = shade(0.55);
      for (const [dx, dy] of [
        [0.3, 0.3],
        [0.7, 0.3],
        [0.5, 0.7],
      ] as const) {
        ctx.beginPath();
        ctx.arc(x + w * dx, y + h * dy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  speckle(ctx, size, shade(0.9), 50, 1.6, rnd);
  // Toasted edge along the bottom.
  ctx.fillStyle = shade(0.7);
  ctx.fillRect(0, size - 6, size, 6);

  if (!band) return;
  // Icing poured over the top edge: a band with rounded drips, a glossy line along it.
  ctx.fillStyle = css(band, 0.8);
  ctx.fillRect(0, BAND - 2, size, 5);
  ctx.fillStyle = css(band);
  ctx.fillRect(0, 0, size, BAND);
  let x = 10 + rnd() * 20;
  while (x < size - 24) {
    const w = 14 + rnd() * 16;
    const len = 8 + rnd() * 22;
    ctx.beginPath();
    ctx.moveTo(x, BAND - 1);
    ctx.lineTo(x, BAND + len - w / 2);
    ctx.arc(x + w / 2, BAND + len - w / 2, w / 2, Math.PI, 0, true);
    ctx.lineTo(x + w, BAND - 1);
    ctx.fill();
    x += w + 14 + rnd() * 30;
  }
  ctx.fillStyle = css(band, 1.12);
  ctx.fillRect(0, 5, size, 4);
}

/** A soft slab of icing: a rounded bevel round a smooth middle with a gloss streak. */
export function paintIcing(ctx: CanvasRenderingContext2D, size: number, shade: Shade, rnd: () => number): void {
  ctx.fillStyle = shade(0.84);
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = shade(1.06);
  ctx.beginPath();
  ctx.roundRect(6, 6, size - 12, size - 12, 26);
  ctx.fill();
  ctx.fillStyle = shade(1);
  ctx.beginPath();
  ctx.roundRect(16, 16, size - 28, size - 28, 22);
  ctx.fill();
  // Gloss along the upper-left, as light catching the icing.
  ctx.fillStyle = shade(1.14);
  ctx.beginPath();
  ctx.roundRect(28, 26, size * 0.55, 10, 5);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(26, 44, 10, size * 0.32, 5);
  ctx.fill();
  speckle(ctx, size, shade(0.95), 40, 1.5, rnd);
}

/** Four chocolate-bar squares per tile, bevelled, in grooves. */
export function paintChocolate(ctx: CanvasRenderingContext2D, size: number, shade: Shade, rnd: () => number): void {
  ctx.fillStyle = shade(0.55);
  ctx.fillRect(0, 0, size, size);
  const n = 2;
  const cell = size / n;
  const gap = 5;
  const bevel = 12;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const x = c * cell + gap;
      const y = r * cell + gap;
      const w = cell - gap * 2;
      // Lit top-left bevel, shaded bottom-right bevel, flat face in the middle.
      ctx.fillStyle = shade(1.32);
      ctx.fillRect(x, y, w, w);
      ctx.fillStyle = shade(0.72);
      ctx.beginPath();
      ctx.moveTo(x + w, y);
      ctx.lineTo(x + w, y + w);
      ctx.lineTo(x, y + w);
      ctx.lineTo(x + bevel, y + w - bevel);
      ctx.lineTo(x + w - bevel, y + w - bevel);
      ctx.lineTo(x + w - bevel, y + bevel);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade(1 - rnd() * 0.05);
      ctx.fillRect(x + bevel, y + bevel, w - bevel * 2, w - bevel * 2);
      ctx.fillStyle = shade(1.12);
      ctx.fillRect(x + bevel + 6, y + bevel + 6, (w - bevel * 2) * 0.4, 4);
    }
  }
  speckle(ctx, size, shade(0.9), 30, 1.4, rnd);
}

/**
 * Two world units of cake for the tower's shaft: a band of cream filling with
 * drips over the chocolate sponge below it. Drips stay clear of the edges so
 * the texture wraps round the cake without a seam.
 */
export function paintCakeLayer(ctx: CanvasRenderingContext2D, size: number, shade: Shade, rnd: () => number, cream: number): void {
  ctx.fillStyle = shade(1);
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, shade(0.78), 260, 2.4, rnd);
  speckle(ctx, size, shade(1.2), 90, 1.6, rnd);
  if (!cream) return;
  const band = 40;
  ctx.fillStyle = css(cream, 0.82);
  ctx.fillRect(0, band - 2, size, 5);
  ctx.fillStyle = css(cream);
  ctx.fillRect(0, 0, size, band);
  let x = 8 + rnd() * 12;
  while (x < size - 22) {
    const w = 12 + rnd() * 12;
    const len = 10 + rnd() * 26;
    ctx.beginPath();
    ctx.moveTo(x, band - 1);
    ctx.lineTo(x, band + len - w / 2);
    ctx.arc(x + w / 2, band + len - w / 2, w / 2, Math.PI, 0, true);
    ctx.lineTo(x + w, band - 1);
    ctx.fill();
    x += w + 10 + rnd() * 22;
  }
  ctx.fillStyle = css(cream, 1.1);
  ctx.fillRect(0, 6, size, 4);
}
