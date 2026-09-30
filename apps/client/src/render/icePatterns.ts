import * as THREE from "three";
import { speckle } from "./canvasDraw.js";
import type { Shade } from "./gardenPatterns.js";

/**
 * Ice palace surfaces: walls of pale-blue ice over a course of dark stone,
 * with snow along the top edge and icicles hanging from it; thick snow on the
 * wall tops; frosted stone pavers on the floor. Painted in their true colours
 * for a white material. `snow` is the colour of the snow on a wall side (the
 * wall top's), 0 for bare ice (the tower's shaft).
 */

const css = (c: number, k = 1) => `#${new THREE.Color(c).multiplyScalar(k).getHexString()}`;

/** Height of the snow along the top of a wall side, and of the stone course at its foot, px of 256. */
const SNOW = 26;
const FOOT = 34;

export function paintIceBrick(ctx: CanvasRenderingContext2D, size: number, shade: Shade, rnd: () => number, snow: number): void {
  // Bare ice (the tower's shaft) has no stone course and no block seams: it is one long spire.
  const iceBottom = snow ? size - FOOT : size;
  // Ice: lighter toward the top, as if lit from within. Bare ice is even, so
  // stacked repeats up the spire leave no bands.
  if (snow) {
    const g = ctx.createLinearGradient(0, 0, 0, iceBottom);
    g.addColorStop(0, shade(1.18));
    g.addColorStop(1, shade(0.86));
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = shade(1.05);
  }
  ctx.fillRect(0, 0, size, iceBottom);

  // Two ice blocks per face, split by a faint seam.
  if (snow) {
    ctx.fillStyle = shade(0.8);
    ctx.fillRect(size / 2 - 1, SNOW, 2, iceBottom);
    ctx.fillRect(0, 0, 2, iceBottom);
  }

  // Refraction streaks and cracks: pale diagonal slivers and thin bright lines.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, size, iceBottom);
  ctx.clip();
  for (let i = 0; i < 7; i++) {
    const x = rnd() * size;
    const y = 30 + rnd() * (iceBottom - 60);
    const w = 20 + rnd() * 50;
    ctx.fillStyle = `rgba(255,255,255,${0.12 + rnd() * 0.14})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y - w * 0.5);
    ctx.lineTo(x + w + 8, y - w * 0.5 + 6);
    ctx.lineTo(x + 8, y + 6);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(235,250,255,0.55)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    let x = rnd() * size;
    let y = 40 + rnd() * (iceBottom - 80);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      x += (rnd() - 0.5) * 50;
      y += 8 + rnd() * 20;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();

  if (!snow) return;
  // A course of dark stone at the foot.
  ctx.fillStyle = "#3e4a60";
  ctx.fillRect(0, iceBottom, size, FOOT);
  ctx.fillStyle = "#56647c";
  ctx.fillRect(0, iceBottom, size, 4);
  ctx.fillStyle = "#2c3546";
  for (const x of [0, 86, 172]) ctx.fillRect(x + (rnd() * 20) | 0, iceBottom + 4, 3, FOOT - 4);

  // Snow over the top edge, with icicles hanging from it.
  ctx.fillStyle = css(snow, 0.82);
  ctx.fillRect(0, SNOW - 2, size, 5);
  ctx.fillStyle = css(snow);
  ctx.fillRect(0, 0, size, SNOW);
  ctx.fillStyle = "rgba(225,245,255,0.92)";
  let x = 6 + rnd() * 14;
  while (x < size - 14) {
    const w = 6 + rnd() * 10;
    const len = 12 + rnd() * 34;
    ctx.beginPath();
    ctx.moveTo(x, SNOW - 1);
    ctx.lineTo(x + w / 2, SNOW + len);
    ctx.lineTo(x + w, SNOW - 1);
    ctx.fill();
    x += w + 4 + rnd() * 18;
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 4, size, 4);
}

/** Thick snow on a wall top: a soft cushion with a blue-grey rim and a few glints. */
export function paintSnow(ctx: CanvasRenderingContext2D, size: number, shade: Shade, rnd: () => number): void {
  ctx.fillStyle = shade(0.86);
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = shade(0.95);
  ctx.beginPath();
  ctx.roundRect(5, 5, size - 10, size - 10, 34);
  ctx.fill();
  const g = ctx.createRadialGradient(size * 0.42, size * 0.4, 10, size / 2, size / 2, size * 0.62);
  g.addColorStop(0, shade(1.06));
  g.addColorStop(1, shade(0.98));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(16, 16, size - 30, size - 30, 30);
  ctx.fill();
  speckle(ctx, size, shade(0.9), 60, 2, rnd);
  speckle(ctx, size, "#ffffff", 26, 1.4, rnd);
}

/** Four frosted stone pavers per tile, with drifts of snow in the joints and a few sparkles. */
export function paintFrostStone(ctx: CanvasRenderingContext2D, size: number, shade: Shade, rnd: () => number): void {
  ctx.fillStyle = shade(0.7);
  ctx.fillRect(0, 0, size, size);
  const n = 2;
  const cell = size / n;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      ctx.fillStyle = shade(1 - rnd() * 0.08);
      ctx.fillRect(c * cell + 4, r * cell + 4, cell - 8, cell - 8);
      ctx.fillStyle = shade(1.1);
      ctx.fillRect(c * cell + 4, r * cell + 4, cell - 8, 3);
    }
  }
  // Frost: a few soft pale patches.
  for (let i = 0; i < 3; i++) {
    const x = 30 + rnd() * (size - 60);
    const y = 30 + rnd() * (size - 60);
    const r = 24 + rnd() * 30;
    const f = ctx.createRadialGradient(x, y, 0, x, y, r);
    f.addColorStop(0, "rgba(235,244,255,0.22)");
    f.addColorStop(1, "rgba(235,244,255,0)");
    ctx.fillStyle = f;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  speckle(ctx, size, shade(0.9), 30, 1.4, rnd);
  // Sparkles: small four-point stars.
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (let i = 0; i < 6; i++) {
    const x = 10 + rnd() * (size - 20);
    const y = 10 + rnd() * (size - 20);
    ctx.fillRect(x - 3, y - 0.5, 6, 1);
    ctx.fillRect(x - 0.5, y - 3, 1, 6);
  }
}
