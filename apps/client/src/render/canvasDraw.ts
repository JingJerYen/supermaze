/** Small canvas helpers shared by the surface patterns. */

/** Deterministic PRNG so every client draws the same pattern. */
export function seeded(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export function roundedBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  hi: string,
  lo: string,
): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  // Bevel: light top-left, dark bottom-right.
  ctx.strokeStyle = hi;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + r, y + 1.5);
  ctx.lineTo(x + w - r, y + 1.5);
  ctx.moveTo(x + 1.5, y + r);
  ctx.lineTo(x + 1.5, y + h - r);
  ctx.stroke();
  ctx.strokeStyle = lo;
  ctx.beginPath();
  ctx.moveTo(x + r, y + h - 1.5);
  ctx.lineTo(x + w - r, y + h - 1.5);
  ctx.moveTo(x + w - 1.5, y + r);
  ctx.lineTo(x + w - 1.5, y + h - r);
  ctx.stroke();
}

export function crack(ctx: CanvasRenderingContext2D, rnd: () => number, size: number): void {
  ctx.beginPath();
  let x = rnd() * size;
  let y = rnd() * size;
  ctx.moveTo(x, y);
  for (let i = 0; i < 4; i++) {
    x += (rnd() - 0.5) * size * 0.4;
    y += (rnd() - 0.5) * size * 0.4;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
}

export function speckle(ctx: CanvasRenderingContext2D, size: number, color: string, count: number, maxR: number, rnd: () => number): void {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const r = 1 + rnd() * (maxR - 1);
    ctx.beginPath();
    ctx.arc(rnd() * size, rnd() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Calls draw at (x, y) and at its copies across the edges it comes within `reach` of, so the pattern tiles. */
export function wrapped(size: number, x: number, y: number, reach: number, draw: (x: number, y: number) => void): void {
  for (const dx of [-size, 0, size]) {
    for (const dy of [-size, 0, size]) {
      if (x + dx < -reach || x + dx > size + reach || y + dy < -reach || y + dy > size + reach) continue;
      draw(x + dx, y + dy);
    }
  }
}
