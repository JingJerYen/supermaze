import * as THREE from "three";

/**
 * Per-map look for walls, floors, lighting and decorations (CLAUDE.md 14).
 * A theme is colours plus patterns drawn on a canvas at startup and tiled once
 * per tile face. No image files; every surface kind is one material, and all
 * decorations are merged into the static map batches, so a theme costs the
 * same handful of draw calls whatever it looks like.
 */
export interface Theme {
  id: string;
  /** Scene background while lit. */
  sky: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  sunColor: number;
  sunIntensity: number;

  wallSide: number;
  wallTop: number;
  outerWall: number;
  floor: number;
  plaza: number;
  line: number;
  linesGlowInDark: boolean;
  wallPattern: PatternKind;
  floorPattern: PatternKind;
  /** Accent colour used by the pattern's "growth" (moss, frost, flowers); 0 disables it. */
  growth: number;
  /** Share of inner walls that get the growth variant of the side texture (0..1). */
  growthShare: number;

  /** Wall torches per eligible inner wall face, roughly 1 in N; 0 disables torches. */
  torchEvery: number;
  torchFlame: number;
  /** Tower styling. */
  towerStone: number;
  towerRune: number;
  towerCrystal: number;
}

export type PatternKind = "none" | "blocks" | "slab" | "hedge" | "ice";

export const THEMES: Record<string, Theme> = {
  stone: {
    id: "stone",
    sky: 0x0b1424,
    hemiSky: 0xbcd0ff,
    hemiGround: 0x243044,
    hemiIntensity: 0.95,
    sunColor: 0xfff0dc,
    sunIntensity: 1.15,
    wallSide: 0xa8b0bc,
    wallTop: 0xc3cad4,
    outerWall: 0x9aa3b0,
    floor: 0x232f44,
    plaza: 0x2c3a52,
    line: 0x0e1626,
    linesGlowInDark: false,
    wallPattern: "blocks",
    floorPattern: "slab",
    growth: 0x74c447,
    growthShare: 0.5,
    torchEvery: 9,
    torchFlame: 0xffa63a,
    towerStone: 0x9aa4b3,
    towerRune: 0x5be6ff,
    towerCrystal: 0x8ff3ff,
  },
  garden: {
    id: "garden",
    sky: 0x9fd0ef,
    hemiSky: 0xe9f4ff,
    hemiGround: 0x4f6a3a,
    hemiIntensity: 1.05,
    sunColor: 0xfff4d6,
    sunIntensity: 1.35,
    wallSide: 0x3f7d3a,
    wallTop: 0x6fb35f,
    outerWall: 0x34682f,
    floor: 0xb59a5d,
    plaza: 0x9a9a8c,
    line: 0x6b5a33,
    linesGlowInDark: false,
    wallPattern: "hedge",
    floorPattern: "none",
    growth: 0xff7fb3,
    growthShare: 0.3,
    torchEvery: 0,
    torchFlame: 0xffa63a,
    towerStone: 0xc9c3b0,
    towerRune: 0xffe27a,
    towerCrystal: 0xfff0a0,
  },
  ice: {
    id: "ice",
    sky: 0x6f8fb0,
    hemiSky: 0xe4f3ff,
    hemiGround: 0x5a7590,
    hemiIntensity: 1.1,
    sunColor: 0xeaf6ff,
    sunIntensity: 1.2,
    wallSide: 0x9fd3f2,
    wallTop: 0xe6f6ff,
    outerWall: 0x7fb9dd,
    floor: 0xbfd3e0,
    plaza: 0xa9bfd0,
    line: 0xffffff,
    linesGlowInDark: false,
    wallPattern: "ice",
    floorPattern: "ice",
    growth: 0xffffff,
    growthShare: 0.4,
    torchEvery: 0,
    torchFlame: 0x9be7ff,
    towerStone: 0xb9dcef,
    towerRune: 0x7ff0ff,
    towerCrystal: 0xd8fbff,
  },
};

export const DEFAULT_THEME_ID = "stone";

export function themeFor(id: string | undefined): Theme {
  return THEMES[id ?? DEFAULT_THEME_ID] ?? (THEMES[DEFAULT_THEME_ID] as Theme);
}

const textureCache = new Map<string, THREE.CanvasTexture | null>();

/**
 * Tileable 256 px pattern in shades of `base`; null for "none" so the plain
 * colour is used. `growth` > 0 adds moss / frost / flowers to the pattern.
 */
export function patternTexture(kind: PatternKind, base: number, growth = 0): THREE.CanvasTexture | null {
  if (kind === "none") return null;
  const key = `${kind}:${base}:${growth}`;
  const cached = textureCache.get(key);
  if (cached !== undefined) return cached;

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const c = new THREE.Color(base);
  const shade = (k: number) => `#${c.clone().multiplyScalar(k).getHexString()}`;
  const rnd = seeded(kind.length * 977 + base);
  ctx.fillStyle = shade(1);
  ctx.fillRect(0, 0, size, size);

  switch (kind) {
    case "blocks": {
      // Two courses of big stone blocks per face, thick dark mortar, each block its own shade.
      const rows = 2;
      const cols = 2;
      const h = size / rows;
      const w = size / cols;
      const mortar = 10;
      ctx.fillStyle = shade(0.45);
      ctx.fillRect(0, 0, size, size);
      for (let r = 0; r < rows; r++) {
        const off = r % 2 ? w / 2 : 0;
        for (let k = -1; k <= cols; k++) {
          const x = off + k * w;
          const tone = 0.9 + rnd() * 0.18;
          roundedBlock(ctx, x + mortar / 2, r * h + mortar / 2, w - mortar, h - mortar, 8, shade(tone), shade(tone * 1.1), shade(tone * 0.85));
        }
      }
      speckle(ctx, size, shade(1.12), 70, 2.5, rnd);
      if (growth) mossPatches(ctx, size, growth, rnd, 6);
      break;
    }
    case "slab": {
      // One big flagstone per tile with a lighter chipped border and a few cracks.
      ctx.fillStyle = shade(0.8);
      ctx.fillRect(0, 0, size, size);
      roundedBlock(ctx, 6, 6, size - 12, size - 12, 6, shade(1), shade(1.08), shade(0.9));
      speckle(ctx, size, shade(1.15), 50, 2, rnd);
      ctx.strokeStyle = shade(0.7);
      ctx.lineWidth = 2;
      crack(ctx, rnd, size);
      if (growth) mossPatches(ctx, size, growth, rnd, 2);
      break;
    }
    case "hedge": {
      speckle(ctx, size, shade(0.75), 420, 9, rnd);
      speckle(ctx, size, shade(1.2), 260, 7, rnd);
      speckle(ctx, size, shade(1.45), 90, 4, rnd);
      if (growth) flowers(ctx, size, growth, rnd, 8);
      break;
    }
    case "ice": {
      speckle(ctx, size, shade(1.1), 60, 10, rnd);
      ctx.strokeStyle = shade(1.3);
      ctx.lineWidth = 3;
      crack(ctx, rnd, size);
      crack(ctx, rnd, size);
      if (growth) speckle(ctx, size, `#${new THREE.Color(growth).getHexString()}`, 40, 3, rnd);
      break;
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

/** Deterministic PRNG so every client draws the same pattern. */
function seeded(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function roundedBlock(
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

function crack(ctx: CanvasRenderingContext2D, rnd: () => number, size: number): void {
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

function speckle(ctx: CanvasRenderingContext2D, size: number, color: string, count: number, maxR: number, rnd: () => number): void {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const r = 1 + rnd() * (maxR - 1);
    ctx.beginPath();
    ctx.arc(rnd() * size, rnd() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Moss: green blotches, mostly along the bottom and in mortar corners; a darker underlay makes them read from a distance. */
function mossPatches(ctx: CanvasRenderingContext2D, size: number, color: number, rnd: () => number, count: number): void {
  const c = new THREE.Color(color);
  for (let i = 0; i < count; i++) {
    const cx = rnd() * size;
    const cy = size * (0.5 + rnd() * 0.5);
    ctx.fillStyle = `#${c.clone().multiplyScalar(0.55).getHexString()}`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 20 + rnd() * 12, 12 + rnd() * 8, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let k = 0; k < 18; k++) {
      ctx.fillStyle = `#${c.clone().multiplyScalar(0.8 + rnd() * 0.45).getHexString()}`;
      ctx.beginPath();
      ctx.arc(cx + (rnd() - 0.5) * 48, cy + (rnd() - 0.5) * 28, 4 + rnd() * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function flowers(ctx: CanvasRenderingContext2D, size: number, color: number, rnd: () => number, count: number): void {
  const c = `#${new THREE.Color(color).getHexString()}`;
  for (let i = 0; i < count; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    ctx.fillStyle = c;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#fff3a0";
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Glowing rune strip for the tower shaft: a few glyph-like strokes on a transparent background. */
export function runeTexture(color: number): THREE.CanvasTexture {
  const key = `rune:${color}`;
  const cached = textureCache.get(key);
  if (cached) return cached;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size * 4;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size * 4);
  ctx.strokeStyle = `#${new THREE.Color(color).getHexString()}`;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  const rnd = seeded(color);
  for (let g = 0; g < 2; g++) {
    const cy = 128 + g * 220;
    ctx.beginPath();
    ctx.moveTo(64, cy - 22);
    ctx.lineTo(44, cy);
    ctx.lineTo(64, cy + 22);
    ctx.lineTo(84, cy);
    ctx.closePath();
    ctx.stroke();
    if (rnd() > 0.5) {
      ctx.beginPath();
      ctx.moveTo(64, cy - 22);
      ctx.lineTo(64, cy + 22);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}
