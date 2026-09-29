import * as THREE from "three";
import { crack, roundedBlock, speckle, wrapped } from "./canvasDraw.js";

/** Garden surfaces: clipped hedges with flowers, flagstone paths with grassy joints, and bark for the great tree. */

export type Shade = (k: number) => string;

export function paintHedge(ctx: CanvasRenderingContext2D, size: number, shade: Shade, rnd: () => number, top: boolean, growth: number): void {
  // Dense clipped leaves: dark depth first, then layers of leaf clusters, lit
  // from above. The top is flatter and lighter so it reads as a walkable surface.
  ctx.fillStyle = shade(top ? 0.8 : 0.62);
  ctx.fillRect(0, 0, size, size);
  const layers: [number, number, number][] = top
    ? [[0.85, 170, 9], [1.0, 170, 8], [1.14, 90, 6]]
    : [[0.7, 150, 11], [0.9, 170, 10], [1.08, 130, 8], [1.24, 60, 6]];
  for (const [tone, count, r] of layers) {
    for (let i = 0; i < count; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      // Side faces are lit from above: lighter leaves drift toward the top.
      const lift = top ? 1 : 1.08 - (y / size) * 0.22;
      ctx.fillStyle = shade(tone * lift * (0.94 + rnd() * 0.12));
      wrapped(size, x, y, r * 1.6, (px, py) => leaf(ctx, px, py, r * (0.7 + rnd() * 0.6), rnd() * Math.PI));
    }
  }
  speckle(ctx, size, shade(top ? 0.7 : 0.5), top ? 40 : 70, 2.2, rnd);
  if (growth) flowers(ctx, size, growth, rnd, top ? 3 : 5);
}

export function paintFlagstone(ctx: CanvasRenderingContext2D, size: number, shade: Shade, rnd: () => number): void {
  // Four irregular paving stones of uneven size, thin grassy joints between them.
  ctx.fillStyle = "#7c8d4e";
  ctx.fillRect(0, 0, size, size);
  const gap = 3;
  const sx = size * (0.4 + rnd() * 0.2);
  const syL = size * (0.38 + rnd() * 0.24);
  const syR = size * (0.38 + rnd() * 0.24);
  const stones: [number, number, number, number][] = [
    [0, 0, sx, syL],
    [0, syL, sx, size - syL],
    [sx, 0, size - sx, syR],
    [sx, syR, size - sx, size - syR],
  ];
  for (const [x, y, w, h] of stones) {
    const tone = 0.9 + rnd() * 0.16;
    roundedBlock(ctx, x + gap, y + gap, w - gap * 2, h - gap * 2, 18, shade(tone), shade(tone * 1.06), shade(tone * 0.87));
  }
  speckle(ctx, size, shade(1.1), 40, 2, rnd);
  speckle(ctx, size, shade(0.84), 30, 1.8, rnd);
  ctx.strokeStyle = shade(0.74);
  ctx.lineWidth = 1.5;
  crack(ctx, rnd, size);
  grassTufts(ctx, size, rnd, [0, sx, size], [0, syL, syR, size]);
}

export function paintBark(ctx: CanvasRenderingContext2D, size: number, shade: Shade, rnd: () => number): void {
  // Vertical furrows with a few knots; tiles vertically along the trunk.
  ctx.fillStyle = shade(0.8);
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 26; i++) {
    const x0 = rnd() * size;
    const w = 4 + rnd() * 9;
    ctx.strokeStyle = shade(0.55 + rnd() * 0.5);
    ctx.lineWidth = w;
    ctx.beginPath();
    for (let y = -10; y <= size + 10; y += 16) {
      const x = x0 + Math.sin((y / size) * Math.PI * 2 + x0) * 5;
      if (y === -10) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = shade(0.45);
    ctx.beginPath();
    ctx.ellipse(rnd() * size, rnd() * size, 7, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** One leaf: a pointed ellipse. */
function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.62, angle, 0, Math.PI * 2);
  ctx.fill();
}

/** Small five-petal flowers in clusters: the accent colour mixed with white, yellow centres. */
function flowers(ctx: CanvasRenderingContext2D, size: number, color: number, rnd: () => number, clusters: number): void {
  const c = new THREE.Color(color);
  const petal = [`#${c.getHexString()}`, `#${c.clone().lerp(new THREE.Color(0xffffff), 0.45).getHexString()}`, "#fff8ee"];
  for (let i = 0; i < clusters; i++) {
    const cx = rnd() * size;
    const cy = rnd() * size;
    for (let k = 0; k < 5; k++) {
      const x = cx + (rnd() - 0.5) * 40;
      const y = cy + (rnd() - 0.5) * 30;
      const r = 3 + rnd() * 2.5;
      const col = petal[Math.floor(rnd() * petal.length)] as string;
      wrapped(size, x, y, r * 3, (px, py) => {
        ctx.fillStyle = col;
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(px + Math.cos(a) * r, py + Math.sin(a) * r, r * 0.75, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = "#ffd23f";
        ctx.beginPath();
        ctx.arc(px, py, r * 0.55, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }
}

/** Grass blades poking out of the paving joints. */
function grassTufts(ctx: CanvasRenderingContext2D, size: number, rnd: () => number, xs: number[], ys: number[]): void {
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (let i = 0; i < 12; i++) {
    // Along one of the joints between the stones.
    const onX = rnd() < 0.5;
    const line = (onX ? xs : ys)[Math.floor(rnd() * (onX ? xs.length : ys.length))] as number;
    const along = rnd() * size;
    const x = onX ? line : along;
    const y = onX ? along : line;
    ctx.strokeStyle = rnd() < 0.5 ? "#86ad4f" : "#5d7f36";
    for (let b = 0; b < 3; b++) {
      const bx = x + (rnd() - 0.5) * 8;
      wrapped(size, bx, y, 12, (px, py) => {
        ctx.beginPath();
        ctx.moveTo(px, py + 4);
        ctx.lineTo(px + (rnd() - 0.5) * 6, py - 6 - rnd() * 5);
        ctx.stroke();
      });
    }
  }
}
