import * as THREE from "three";
import { speckle } from "./canvasDraw.js";
import type { Shade } from "./gardenPatterns.js";

/**
 * Sci-fi factory surfaces: wall modules of painted steel with a light strip and
 * a pale cap, walkable steel plates on the wall tops, and diamond tread plate on
 * the floor. These are painted in their true colours for a white material, so
 * the accents (light strips, hazard stripes, the cap) keep theirs. The light
 * strips also get an emissive map (`paintPanelGlow`) drawn from the same layout,
 * so they glow while the map is lit.
 */

/** Pale steel of the wall cap, matching the wall top plates. */
const CAP = "#aeb6c2";
/** The slot the light strip sits in, and the strip's colour when not glowing. */
const SLOT = "#0a1220";
const STRIP_LIT = "#8feaff";
/** Status light on the hazard variant. */
const INDICATOR = "#ff9a2e";

// Layout shared by the diffuse texture and the glow map.
const STRIP = { x: 58, y: 80, w: 140, h: 12 };
const IND = { x: 214, y: 112, r: 7 };

export function paintPanel(ctx: CanvasRenderingContext2D, size: number, shade: Shade, rnd: () => number, hazard: number): void {
  ctx.fillStyle = shade(1);
  ctx.fillRect(0, 0, size, size);
  brushed(ctx, size, shade, rnd, 0, size);

  // Recessed panel in the middle of the module: dark top-left edge, light bottom-right.
  inset(ctx, 16, 44, size - 32, 152, shade(0.84), shade(0.6), shade(1.2));
  brushed(ctx, size, shade, rnd, 48, 192, 0.84);

  // Light strip in its slot.
  ctx.fillStyle = SLOT;
  ctx.beginPath();
  ctx.roundRect(STRIP.x - 6, STRIP.y - 5, STRIP.w + 12, STRIP.h + 10, 7);
  ctx.fill();
  ctx.fillStyle = STRIP_LIT;
  ctx.beginPath();
  ctx.roundRect(STRIP.x, STRIP.y, STRIP.w, STRIP.h, 5);
  ctx.fill();

  // Pale cap along the top, its lip casting a dark line on the module.
  ctx.fillStyle = CAP;
  ctx.fillRect(0, 0, size, 30);
  ctx.fillStyle = "#d4dae2";
  ctx.fillRect(0, 2, size, 3);
  ctx.fillStyle = shade(0.35);
  ctx.fillRect(0, 30, size, 4);

  // Kick plate along the bottom: vent slots, or hazard stripes on some modules.
  ctx.fillStyle = shade(0.72);
  ctx.fillRect(0, 204, size, size - 204);
  ctx.fillStyle = shade(1.15);
  ctx.fillRect(0, 204, size, 2);
  if (hazard) {
    hazardStripes(ctx, 22, 214, size - 44, 30, hazard);
    ctx.fillStyle = SLOT;
    ctx.beginPath();
    ctx.arc(IND.x, IND.y, IND.r + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INDICATOR;
    ctx.beginPath();
    ctx.arc(IND.x, IND.y, IND.r, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = shade(0.4);
    for (let y = 216; y < 246; y += 7) ctx.fillRect(92, y, 72, 3);
  }

  // Seams between modules: each tile face is one module.
  ctx.fillStyle = shade(0.32);
  ctx.fillRect(0, 0, 2, size);
  ctx.fillRect(size - 2, 0, 2, size);
  for (const [x, y] of [[10, 52], [size - 10, 52], [10, 188], [size - 10, 188]] as const) bolt(ctx, x, y, shade);
  speckle(ctx, size, shade(1.18), 30, 1.8, rnd);
}

/** Emissive map for `paintPanel`: the light strip with a soft halo, and the status light on hazard modules. */
export function paintPanelGlow(ctx: CanvasRenderingContext2D, size: number, glow: number, hazard: number): void {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  const c = `#${new THREE.Color(glow).getHexString()}`;
  ctx.shadowColor = c;
  ctx.shadowBlur = 10;
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.roundRect(STRIP.x, STRIP.y, STRIP.w, STRIP.h, 5);
  ctx.fill();
  if (hazard) {
    ctx.shadowColor = INDICATOR;
    ctx.fillStyle = INDICATOR;
    ctx.beginPath();
    ctx.arc(IND.x, IND.y, IND.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

export function paintPlate(ctx: CanvasRenderingContext2D, size: number, shade: Shade, rnd: () => number): void {
  // One raised steel plate per tile with a darker inset in the middle, bolted at the corners.
  ctx.fillStyle = shade(0.55);
  ctx.fillRect(0, 0, size, size);
  raised(ctx, 4, 4, size - 8, size - 8, shade(1), shade(1.14), shade(0.74));
  brushed(ctx, size, shade, rnd, 10, size - 10);
  inset(ctx, 44, 44, size - 88, size - 88, shade(0.86), shade(0.62), shade(1.1));
  brushed(ctx, size, shade, rnd, 50, size - 50, 0.86);
  for (const [x, y] of [[22, 22], [size - 22, 22], [22, size - 22], [size - 22, size - 22]] as const) bolt(ctx, x, y, shade);
  speckle(ctx, size, shade(0.7), 24, 1.8, rnd);
}

export function paintTreadPlate(ctx: CanvasRenderingContext2D, size: number, shade: Shade, rnd: () => number): void {
  // Diamond tread plate: one plate per tile, rows of short raised ridges in alternating directions.
  ctx.fillStyle = shade(0.5);
  ctx.fillRect(0, 0, size, size);
  raised(ctx, 3, 3, size - 6, size - 6, shade(1), shade(1.16), shade(0.74));
  ctx.lineCap = "round";
  ctx.lineWidth = 3;
  const step = 21;
  for (let row = 0; row * step < size - 30; row++) {
    for (let col = 0; col * step < size - 30; col++) {
      const x = 24 + col * step + (row % 2 ? step / 2 : 0);
      const y = 24 + row * step;
      if (x > size - 22) continue;
      const d = (row + col) % 2 ? 1 : -1;
      ctx.strokeStyle = shade(0.8);
      ridge(ctx, x + 1, y + 1.5, d);
      ctx.strokeStyle = shade(1.1);
      ridge(ctx, x, y, d);
    }
  }
  speckle(ctx, size, shade(0.72), 40, 2.2, rnd);
  for (const [x, y] of [[14, 14], [size - 14, 14], [14, size - 14], [size - 14, size - 14]] as const) bolt(ctx, x, y, shade);
}

function ridge(ctx: CanvasRenderingContext2D, x: number, y: number, d: number): void {
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 5 * d);
  ctx.lineTo(x + 5, y + 5 * d);
  ctx.stroke();
}

/** Fine horizontal brush marks between rows y0 and y1. */
function brushed(ctx: CanvasRenderingContext2D, size: number, shade: Shade, rnd: () => number, y0: number, y1: number, tone = 1): void {
  for (let i = 0; i < 70; i++) {
    const y = y0 + rnd() * (y1 - y0);
    const x = rnd() * size;
    ctx.fillStyle = shade(tone * (0.93 + rnd() * 0.14));
    ctx.fillRect(x, y, 30 + rnd() * 90, 1);
  }
}

/** A plate standing proud: light top-left bevel, dark bottom-right. */
function raised(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, hi: string, lo: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  bevel(ctx, x, y, w, h, hi, lo);
}

/** A recessed area: the bevel is reversed. */
function inset(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, dark: string, light: string): void {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  bevel(ctx, x, y, w, h, dark, light);
}

function bevel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, topLeft: string, bottomRight: string): void {
  ctx.lineWidth = 3;
  ctx.strokeStyle = topLeft;
  ctx.beginPath();
  ctx.moveTo(x + 2, y + h - 2);
  ctx.lineTo(x + 2, y + 2);
  ctx.lineTo(x + w - 2, y + 2);
  ctx.stroke();
  ctx.strokeStyle = bottomRight;
  ctx.beginPath();
  ctx.moveTo(x + w - 2, y + 2);
  ctx.lineTo(x + w - 2, y + h - 2);
  ctx.lineTo(x + 2, y + h - 2);
  ctx.stroke();
}

function bolt(ctx: CanvasRenderingContext2D, x: number, y: number, shade: Shade): void {
  ctx.fillStyle = shade(0.45);
  ctx.beginPath();
  ctx.arc(x + 1, y + 1, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(1.35);
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

/** Yellow and black diagonal stripes in a rectangle. */
function hazardStripes(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = `#${new THREE.Color(color).getHexString()}`;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#15171c";
  for (let sx = x - h; sx < x + w; sx += 28) {
    ctx.beginPath();
    ctx.moveTo(sx, y + h);
    ctx.lineTo(sx + 14, y + h);
    ctx.lineTo(sx + 14 + h, y);
    ctx.lineTo(sx + h, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = "#15171c";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}
