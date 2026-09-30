import * as THREE from "three";
import { speckle } from "./canvasDraw.js";
import type { Shade } from "./gardenPatterns.js";

/**
 * Desert temple surfaces: sandstone blocks with carved glyphs (some walls
 * with a turquoise inlay trimmed in gold), smooth limestone slabs on the wall
 * tops, and red packed earth with pebbles on the floor. Painted in their true
 * colours for a white material. `inlay` is the turquoise of the inlaid
 * variant, 0 for plain carved blocks.
 */

const css = (c: number, k = 1) => `#${new THREE.Color(c).multiplyScalar(k).getHexString()}`;
const GOLD = "#d9a93a";

type Glyph = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => void;

/** A handful of simple carved symbols, drawn as strokes centred on (x, y) within a box of size s. */
const GLYPHS: Glyph[] = [
  // Triangle (pyramid).
  (ctx, x, y, s) => {
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.4);
    ctx.lineTo(x + s * 0.4, y + s * 0.35);
    ctx.lineTo(x - s * 0.4, y + s * 0.35);
    ctx.closePath();
    ctx.stroke();
  },
  // Sun: a circle with rays.
  (ctx, x, y, s) => {
    ctx.beginPath();
    ctx.arc(x, y, s * 0.18, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * s * 0.27, y + Math.sin(a) * s * 0.27);
      ctx.lineTo(x + Math.cos(a) * s * 0.4, y + Math.sin(a) * s * 0.4);
      ctx.stroke();
    }
  },
  // Ankh.
  (ctx, x, y, s) => {
    ctx.beginPath();
    ctx.ellipse(x, y - s * 0.22, s * 0.13, s * 0.18, 0, 0, Math.PI * 2);
    ctx.moveTo(x, y - s * 0.04);
    ctx.lineTo(x, y + s * 0.42);
    ctx.moveTo(x - s * 0.24, y + s * 0.06);
    ctx.lineTo(x + s * 0.24, y + s * 0.06);
    ctx.stroke();
  },
  // Eye.
  (ctx, x, y, s) => {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.4, y);
    ctx.quadraticCurveTo(x, y - s * 0.32, x + s * 0.4, y);
    ctx.quadraticCurveTo(x, y + s * 0.32, x - s * 0.4, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, s * 0.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - s * 0.1, y + s * 0.14);
    ctx.lineTo(x - s * 0.2, y + s * 0.38);
    ctx.stroke();
  },
  // Water: three zigzags.
  (ctx, x, y, s) => {
    for (let r = -1; r <= 1; r++) {
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const px = x - s * 0.36 + (i * s * 0.72) / 6;
        const py = y + r * s * 0.2 + (i % 2 ? -s * 0.06 : s * 0.06);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  },
  // Bird: a body, a head and legs.
  (ctx, x, y, s) => {
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.24, s * 0.13, -0.3, 0, Math.PI * 2);
    ctx.moveTo(x + s * 0.2, y - s * 0.12);
    ctx.arc(x + s * 0.24, y - s * 0.22, s * 0.08, Math.PI * 0.7, Math.PI * 2.7);
    ctx.moveTo(x - s * 0.04, y + s * 0.12);
    ctx.lineTo(x - s * 0.08, y + s * 0.4);
    ctx.moveTo(x + s * 0.08, y + s * 0.1);
    ctx.lineTo(x + s * 0.06, y + s * 0.4);
    ctx.stroke();
  },
];

/** Carve `glyph` at (x, y): a dark groove with a light lip below it, as sunlight on a recess. */
function carve(ctx: CanvasRenderingContext2D, shade: Shade, glyph: Glyph, x: number, y: number, s: number): void {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 5;
  ctx.strokeStyle = shade(1.14);
  glyph(ctx, x + 1.5, y + 2, s);
  ctx.lineWidth = 4;
  ctx.strokeStyle = shade(0.66);
  glyph(ctx, x, y, s);
}

export function paintSandstone(ctx: CanvasRenderingContext2D, size: number, shade: Shade, rnd: () => number, inlay: number): void {
  // Mortar, then two blocks per face side by side, each a little different.
  ctx.fillStyle = shade(0.8);
  ctx.fillRect(0, 0, size, size);
  const half = size / 2;
  for (let i = 0; i < 2; i++) {
    ctx.fillStyle = shade(1 - rnd() * 0.06);
    ctx.fillRect(i * half + 3, 3, half - 6, size - 6);
    ctx.fillStyle = shade(1.08);
    ctx.fillRect(i * half + 3, 3, half - 6, 4);
  }
  speckle(ctx, size, shade(0.9), 90, 1.8, rnd);
  speckle(ctx, size, shade(1.08), 50, 1.4, rnd);

  // A recessed panel along the middle with a glyph in each block.
  for (let i = 0; i < 2; i++) {
    const cx = i * half + half / 2;
    ctx.fillStyle = shade(0.9);
    ctx.fillRect(cx - 44, 70, 88, 110);
    ctx.fillStyle = shade(0.8);
    ctx.fillRect(cx - 44, 70, 88, 3);
    ctx.fillRect(cx - 44, 70, 3, 110);
    const glyph = GLYPHS[Math.floor(rnd() * GLYPHS.length)] as Glyph;
    carve(ctx, shade, glyph, cx, 125, 76);
  }

  if (!inlay) return;
  // A turquoise inlay trimmed in gold down the seam between the blocks.
  ctx.fillStyle = GOLD;
  ctx.fillRect(half - 11, 58, 22, 136);
  ctx.fillStyle = css(inlay);
  ctx.fillRect(half - 7, 62, 14, 128);
  ctx.fillStyle = css(inlay, 1.25);
  ctx.fillRect(half - 5, 64, 4, 124);
}

/** A smooth limestone slab: a bevelled rim, faint veins. */
export function paintLimestone(ctx: CanvasRenderingContext2D, size: number, shade: Shade, rnd: () => number): void {
  ctx.fillStyle = shade(0.84);
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = shade(1.08);
  ctx.fillRect(6, 6, size - 12, size - 12);
  ctx.fillStyle = shade(0.93);
  ctx.fillRect(14, size - 20, size - 20, 14);
  ctx.fillRect(size - 20, 14, 14, size - 20);
  ctx.fillStyle = shade(1);
  ctx.fillRect(14, 14, size - 34, size - 34);
  ctx.strokeStyle = shade(0.9);
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    let x = 20 + rnd() * (size - 40);
    let y = 20 + rnd() * (size - 40);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (rnd() - 0.4) * 40;
      y += (rnd() - 0.5) * 30;
      ctx.lineTo(Math.min(size - 20, Math.max(20, x)), Math.min(size - 20, Math.max(20, y)));
    }
    ctx.stroke();
  }
  speckle(ctx, size, shade(0.94), 40, 1.5, rnd);
}

/** Red packed earth scattered with pebbles and a few fine cracks. */
export function paintEarth(ctx: CanvasRenderingContext2D, size: number, shade: Shade, rnd: () => number): void {
  ctx.fillStyle = shade(1);
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, shade(0.88), 220, 2.6, rnd);
  speckle(ctx, size, shade(1.1), 120, 2, rnd);
  ctx.strokeStyle = shade(0.8);
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 2; i++) {
    let x = rnd() * size;
    let y = rnd() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (rnd() - 0.5) * 50;
      y += (rnd() - 0.5) * 50;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Pebbles: small rounded stones, lit from the top-left.
  for (let i = 0; i < 14; i++) {
    const x = 8 + rnd() * (size - 16);
    const y = 8 + rnd() * (size - 16);
    const r = 3 + rnd() * 6;
    ctx.fillStyle = "rgba(60,30,20,0.35)";
    ctx.beginPath();
    ctx.ellipse(x + 1.5, y + 2, r, r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rnd() < 0.5 ? shade(1.3) : "#d8b890";
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
