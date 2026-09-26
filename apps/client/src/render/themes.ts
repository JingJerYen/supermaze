import * as THREE from "three";

/**
 * Per-map look for walls and floors (CLAUDE.md section 14). A theme is a
 * handful of colours plus a pattern drawn on a small canvas at startup and
 * tiled once per tile face. No image files, one material per surface kind.
 */
export interface Theme {
  id: string;
  wallSide: number;
  wallTop: number;
  outerWall: number;
  floor: number;
  plaza: number;
  /** Colour of the thin lines on wall-top edges and floor tile borders. */
  line: number;
  /** Whether the lines stay visible while the map is dark. */
  linesGlowInDark: boolean;
  /** Pattern painted on wall sides. */
  wallPattern: PatternKind;
  /** Pattern painted on floors. */
  floorPattern: PatternKind;
}

export type PatternKind = "none" | "brick" | "slab" | "hedge" | "ice";

export const THEMES: Record<string, Theme> = {
  stone: {
    id: "stone",
    wallSide: 0x8e9bb3,
    wallTop: 0xb3bfd3,
    outerWall: 0x7a879f,
    floor: 0x4d5a6d,
    plaza: 0x5c6b80,
    line: 0xdfe6f2,
    linesGlowInDark: false,
    wallPattern: "brick",
    floorPattern: "slab",
  },
  garden: {
    id: "garden",
    wallSide: 0x3f7d3a,
    wallTop: 0x6fb35f,
    outerWall: 0x34682f,
    floor: 0xb59a5d,
    plaza: 0x9a9a8c,
    line: 0xe8e2c8,
    linesGlowInDark: false,
    wallPattern: "hedge",
    floorPattern: "none",
  },
  ice: {
    id: "ice",
    wallSide: 0x9fd3f2,
    wallTop: 0xe6f6ff,
    outerWall: 0x7fb9dd,
    floor: 0xc9d9e3,
    plaza: 0xb4c8d6,
    line: 0xffffff,
    linesGlowInDark: false,
    wallPattern: "ice",
    floorPattern: "ice",
  },
};

export const DEFAULT_THEME_ID = "stone";

export function themeFor(id: string | undefined): Theme {
  return THEMES[id ?? DEFAULT_THEME_ID] ?? (THEMES[DEFAULT_THEME_ID] as Theme);
}

const textureCache = new Map<string, THREE.CanvasTexture | null>();

/** Tileable 128 px pattern in shades of `base`; null for "none" so the plain colour is used. */
export function patternTexture(kind: PatternKind, base: number): THREE.CanvasTexture | null {
  if (kind === "none") return null;
  const key = `${kind}:${base}`;
  const cached = textureCache.get(key);
  if (cached !== undefined) return cached;

  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const c = new THREE.Color(base);
  const shade = (k: number) => `#${c.clone().multiplyScalar(k).getHexString()}`;
  ctx.fillStyle = shade(1);
  ctx.fillRect(0, 0, size, size);

  switch (kind) {
    case "brick": {
      // Three courses of bricks, mortar lines darker, alternate offset.
      const rows = 3;
      const h = size / rows;
      ctx.strokeStyle = shade(0.72);
      ctx.lineWidth = 4;
      for (let r = 0; r <= rows; r++) line(ctx, 0, r * h, size, r * h);
      const cols = 2;
      const w = size / cols;
      for (let r = 0; r < rows; r++) {
        const off = r % 2 ? w / 2 : 0;
        for (let k = -1; k <= cols; k++) line(ctx, off + k * w, r * h, off + k * w, (r + 1) * h);
      }
      speckle(ctx, size, shade(1.08), 40);
      break;
    }
    case "slab": {
      ctx.strokeStyle = shade(0.8);
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, size - 3, size - 3);
      speckle(ctx, size, shade(1.06), 60);
      break;
    }
    case "hedge": {
      speckle(ctx, size, shade(0.8), 140, 5);
      speckle(ctx, size, shade(1.18), 90, 4);
      break;
    }
    case "ice": {
      speckle(ctx, size, shade(1.12), 30, 6);
      ctx.strokeStyle = shade(1.25);
      ctx.lineWidth = 2;
      line(ctx, 10, 100, 60, 40);
      line(ctx, 60, 40, 118, 26);
      line(ctx, 60, 40, 70, 90);
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

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/** Deterministic dots so every client draws the same pattern. */
function speckle(ctx: CanvasRenderingContext2D, size: number, color: string, count: number, maxR = 2): void {
  ctx.fillStyle = color;
  let seed = 12345 + count;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < count; i++) {
    const r = 1 + rnd() * (maxR - 1);
    ctx.beginPath();
    ctx.arc(rnd() * size, rnd() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
