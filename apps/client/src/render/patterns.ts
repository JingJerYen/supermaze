import * as THREE from "three";
import type { PatternKind } from "./themes.js";
import { crack, roundedBlock, seeded, speckle } from "./canvasDraw.js";
import { paintBark, paintFlagstone, paintHedge } from "./gardenPatterns.js";
import { paintPanel, paintPanelGlow, paintPlate, paintTreadPlate } from "./factoryPatterns.js";
import { paintBiscuit, paintCakeLayer, paintChocolate, paintIcing } from "./candyPatterns.js";

/**
 * Surface patterns for the themes, drawn on a canvas at startup and tiled once
 * per tile face. No image files; each texture is cached by kind and colour.
 */
const textureCache = new Map<string, THREE.CanvasTexture | null>();

/**
 * Kinds painted in their true colours, for a white material: the theme colour
 * is the colour on screen and the accents keep theirs. Other kinds are shades
 * of the base, multiplied by a material of the same colour.
 */
const TRUE_COLOUR: ReadonlySet<PatternKind> = new Set(["panel", "plate", "tread", "biscuit", "icing", "chocolate", "cake"]);

export function trueColour(kind: PatternKind): boolean {
  return TRUE_COLOUR.has(kind);
}

/**
 * Tileable 256 px pattern in shades of `base`; null for "none" so the plain
 * colour is used. `growth` > 0 adds its accent to the pattern (moss on stone,
 * flowers on hedges, hazard stripes on factory panels). `baked` multiplies
 * `base` into the texture itself, for a white material: the pattern looks the
 * same, but growth colours (flowers) keep their true colour instead of being
 * tinted by the material. True-colour kinds are always drawn for a white material.
 */
export function patternTexture(kind: PatternKind, base: number, growth = 0, baked = false): THREE.CanvasTexture | null {
  if (kind === "none") return null;
  const key = `${kind}:${base}:${growth}:${baked}`;
  const cached = textureCache.get(key);
  if (cached !== undefined) return cached;

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const c = new THREE.Color(base);
  const tint = baked && !trueColour(kind) ? c.clone().multiply(c) : c.clone();
  const shade = (k: number) => `#${tint.clone().multiplyScalar(k).getHexString()}`;
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
    case "hedge":
    case "hedgeTop":
      paintHedge(ctx, size, shade, rnd, kind === "hedgeTop", growth);
      break;
    case "flagstone":
      paintFlagstone(ctx, size, shade, rnd);
      break;
    case "bark":
      paintBark(ctx, size, shade, rnd);
      break;
    case "panel":
      paintPanel(ctx, size, shade, rnd, growth);
      break;
    case "plate":
      paintPlate(ctx, size, shade, rnd);
      break;
    case "tread":
      paintTreadPlate(ctx, size, shade, rnd);
      break;
    case "biscuit":
      paintBiscuit(ctx, size, shade, rnd, growth);
      break;
    case "icing":
      paintIcing(ctx, size, shade, rnd);
      break;
    case "chocolate":
      paintChocolate(ctx, size, shade, rnd);
      break;
    case "cake":
      paintCakeLayer(ctx, size, shade, rnd, growth);
      break;
  }

  return finish(key, canvas);
}

/**
 * Emissive map for the kinds that have lights in them (the factory wall
 * modules), in `glow`; null for every other kind or when `glow` is 0. `growth`
 * must match the diffuse texture's so the lights line up.
 */
export function glowTexture(kind: PatternKind, glow: number, growth = 0): THREE.CanvasTexture | null {
  if (kind !== "panel" || !glow) return null;
  const key = `glow:${kind}:${glow}:${growth}`;
  const cached = textureCache.get(key);
  if (cached !== undefined) return cached;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  paintPanelGlow(canvas.getContext("2d")!, size, glow, growth);
  return finish(key, canvas);
}

function finish(key: string, canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
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
