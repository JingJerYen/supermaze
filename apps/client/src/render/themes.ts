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
  /** Pattern on wall tops (the walkable upper layer). */
  topPattern: PatternKind;
  floorPattern: PatternKind;
  /** Accent colour used by the pattern's "growth" (moss on stone, flowers on hedges); 0 disables it. */
  growth: number;
  /** Share of inner walls that get the growth variant of the side texture (0..1). */
  growthShare: number;

  /** Wall lights per eligible inner wall face, roughly 1 in N; 0 disables them. */
  torchEvery: number;
  torchFlame: number;
  /** A torch on the wall face, or a stone lantern standing at the foot of the wall. */
  lightStyle: "torch" | "lantern";
  /** Stairs and bridges. */
  structure: StructurePalette;
  /** The central tower: stacked stone, or a giant tree with a deck in its crown. */
  towerStyle: "stone" | "tree";
  towerStone: number;
  towerRune: number;
  towerCrystal: number;
  /** Tree tower only: bark, leaves, and the deck the climbers stand on. */
  towerBark: number;
  towerLeaf: number;
  towerDeck: number;
}

export interface StructurePalette {
  step: number;
  stepAlt: number;
  plank: number;
  plankAlt: number;
  rail: number;
}

export type PatternKind = "none" | "blocks" | "slab" | "hedge" | "hedgeTop" | "flagstone" | "bark";

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
    topPattern: "slab",
    floorPattern: "slab",
    growth: 0x74c447,
    growthShare: 0.5,
    torchEvery: 9,
    torchFlame: 0xffa63a,
    lightStyle: "torch",
    structure: { step: 0xb98a55, stepAlt: 0xa5784a, plank: 0xb08a5a, plankAlt: 0xa07c4f, rail: 0x6d5436 },
    towerStyle: "stone",
    towerStone: 0x9aa4b3,
    towerRune: 0x5be6ff,
    towerCrystal: 0x8ff3ff,
    towerBark: 0x6b4a2f,
    towerLeaf: 0x4f9a3c,
    towerDeck: 0xb08a5a,
  },
  /** Clipped hedges, flagstone paths and stone lanterns in golden evening light; a great tree instead of the tower. */
  garden: {
    id: "garden",
    sky: 0x1d3441,
    hemiSky: 0xfff0d4,
    hemiGround: 0x4e6634,
    hemiIntensity: 1.2,
    sunColor: 0xffdcaa,
    sunIntensity: 1.4,
    wallSide: 0x62a646,
    wallTop: 0x86c95a,
    outerWall: 0x559a3c,
    floor: 0xe2cfa6,
    plaza: 0xeee2c4,
    line: 0x6a5a3c,
    linesGlowInDark: false,
    wallPattern: "hedge",
    topPattern: "hedgeTop",
    floorPattern: "flagstone",
    growth: 0xf2709f,
    growthShare: 0.45,
    torchEvery: 7,
    torchFlame: 0xffd57a,
    lightStyle: "lantern",
    structure: { step: 0xdcd0b4, stepAlt: 0xcabd9e, plank: 0xd6c8a8, plankAlt: 0xc5b694, rail: 0xb3a282 },
    towerStyle: "tree",
    towerStone: 0xd8ccae,
    towerRune: 0x5be6ff,
    towerCrystal: 0x8ff3ff,
    towerBark: 0x8c7050,
    towerLeaf: 0x4f9a3c,
    towerDeck: 0xc9a46c,
  },
};

export const DEFAULT_THEME_ID = "stone";

export function themeFor(id: string | undefined): Theme {
  return THEMES[id ?? DEFAULT_THEME_ID] ?? (THEMES[DEFAULT_THEME_ID] as Theme);
}

export { patternTexture, runeTexture } from "./patterns.js";
