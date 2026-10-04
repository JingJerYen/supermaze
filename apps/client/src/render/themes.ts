import * as THREE from "three";

/**
 * Per-map look for walls, floors, lighting and decorations (CLAUDE.md 14).
 * A theme is colours plus patterns drawn on a canvas at startup and tiled once
 * per tile face. No image files; every surface kind is one material, and all
 * decorations are merged into the static map batches, so a theme costs the
 * same handful of draw calls whatever it looks like.
 */
export interface GroundLook {
  /** Two colours blended by soft noise. */
  base: number;
  alt: number;
  /** Size of the noise blotches in tiles; `stretch` squashes them per axis (x, z), e.g. long dunes. */
  scale: number;
  stretch?: [number, number];
  /** Optional grid lines every `lineEvery` tiles. */
  line?: number;
  lineEvery?: number;
}

export interface Theme {
  id: string;
  /** Scene background while lit: gradient colours from the top of the screen to the bottom (render/sky.ts). */
  sky: number[];
  /** The land around the maze out to the horizon (render/backdrop.ts), in on-screen colours. */
  ground: GroundLook;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  sunColor: number;
  sunIntensity: number;

  wallSide: number;
  wallTop: number;
  /**
   * A second wall-top colour, laid in runs of a few tiles (the candy walls'
   * pink and cream icing); omitted for one colour. A wall pattern that carries
   * its top's colour as a band (biscuit under icing) follows the same runs.
   */
  wallTopAlt?: number;
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
  /** Colour of the light strips built into the wall pattern, glowing while the map is lit; 0 for none. */
  glow: number;
  /** Matte (plain diffuse) or metal (adds a soft specular sheen) for walls, wall tops and floors. */
  surface: "matte" | "metal";

  /** Wall lights per eligible inner wall face, roughly 1 in N; 0 disables them. */
  torchEvery: number;
  torchFlame: number;
  /** A torch on the wall face, or a stone lantern, light beacon, striped candle, ice crystal or fire brazier on a plinth standing at the foot of the wall. */
  lightStyle: "torch" | "lantern" | "beacon" | "candle" | "crystal" | "brazier";
  /** Small props scattered at the wall feet (gumdrops on the candy map); omitted for none. */
  scatter?: "gumdrops";
  /** Stairs and bridges. */
  structure: StructurePalette;
  /** The central tower: stacked stone, a giant tree with a deck in its crown, a steel reactor with a hologram, a tall layer cake, an ice spire, or an obelisk. */
  towerStyle: "stone" | "tree" | "reactor" | "cake" | "ice" | "obelisk";
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

export type PatternKind =
  | "none"
  | "blocks"
  | "slab"
  | "hedge"
  | "hedgeTop"
  | "flagstone"
  | "bark"
  | "panel"
  | "plate"
  | "tread"
  | "biscuit"
  | "icing"
  | "chocolate"
  | "cake"
  | "iceBrick"
  | "snow"
  | "frostStone"
  | "sandstone"
  | "limestone"
  | "earth";

/** Wall patterns that carry their wall top's colour as a band along the top edge (icing, snow). */
export function bandedWalls(kind: PatternKind): boolean {
  return kind === "biscuit" || kind === "iceBrick";
}

export const THEMES: Record<string, Theme> = {
  stone: {
    id: "stone",
    sky: [0x0e1a3a, 0x2c4474, 0x6c7fa6],
    ground: { base: 0x3b4838, alt: 0x56624a, scale: 6 },
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
    glow: 0,
    surface: "matte",
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
    sky: [0x2d4f7a, 0x8a8fb0, 0xf2b884],
    ground: { base: 0x4f7f34, alt: 0x6f9c42, scale: 5 },
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
    growthShare: 0.6,
    glow: 0,
    surface: "matte",
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
  /**
   * Sci-fi factory: modular steel walls with glowing light strips and pale caps,
   * tread-plate floors, beacons at the wall feet, and a reactor holding a
   * hologram globe instead of the tower. Its patterns are true-colour, so these
   * are the colours on screen before lighting.
   */
  factory: {
    id: "factory",
    sky: [0x03061a, 0x0d1f4a, 0x1f5a8a],
    ground: { base: 0x1e2532, alt: 0x2a3344, scale: 8, line: 0x35516f, lineEvery: 4 },
    hemiSky: 0xd6e2ff,
    hemiGround: 0x1a2233,
    hemiIntensity: 1.0,
    sunColor: 0xeef4ff,
    sunIntensity: 1.25,
    wallSide: 0x4a5b7c,
    wallTop: 0xa4adba,
    outerWall: 0x3c4a66,
    floor: 0x444c5a,
    plaza: 0x535d6e,
    line: 0x0c1018,
    linesGlowInDark: false,
    wallPattern: "panel",
    topPattern: "plate",
    floorPattern: "tread",
    growth: 0xf2b41e,
    growthShare: 0.22,
    glow: 0x4fd8ff,
    surface: "metal",
    torchEvery: 8,
    torchFlame: 0x55dcff,
    lightStyle: "beacon",
    structure: { step: 0x8e98a8, stepAlt: 0x76808f, plank: 0x4d596b, plankAlt: 0x404b5c, rail: 0xf0a431 },
    towerStyle: "reactor",
    towerStone: 0xa7b0bd,
    towerRune: 0x4fd8ff,
    towerCrystal: 0xa8f2ff,
    towerBark: 0x6b4a2f,
    towerLeaf: 0x4f9a3c,
    towerDeck: 0x6fb6e6,
  },
  /**
   * Candy: biscuit walls under pink and cream icing, chocolate-bar floors,
   * striped candles and gumdrops at the wall feet, and a tall layer cake with a
   * cherry instead of the tower. True-colour patterns, like the factory's.
   */
  candy: {
    id: "candy",
    sky: [0x6a4fa0, 0xd88ac0, 0xffd0e0],
    ground: { base: 0x5a3020, alt: 0x7a462c, scale: 5 },
    hemiSky: 0xfff0e6,
    hemiGround: 0x5a3a2a,
    hemiIntensity: 1.15,
    sunColor: 0xffe6c8,
    sunIntensity: 1.3,
    wallSide: 0xf2c070,
    wallTop: 0xff9fc2,
    wallTopAlt: 0xfff4e2,
    outerWall: 0xe8b262,
    floor: 0x5a3322,
    plaza: 0x6a3d28,
    line: 0x2a140c,
    linesGlowInDark: false,
    wallPattern: "biscuit",
    topPattern: "icing",
    floorPattern: "chocolate",
    growth: 0,
    growthShare: 0,
    glow: 0,
    surface: "matte",
    torchEvery: 7,
    torchFlame: 0xffc45a,
    lightStyle: "candle",
    scatter: "gumdrops",
    structure: { step: 0xff9fc2, stepAlt: 0xfff4e2, plank: 0xfff4e2, plankAlt: 0xf4e4c8, rail: 0xe8587e },
    towerStyle: "cake",
    towerStone: 0x5a3322,
    towerRune: 0xffc45a,
    towerCrystal: 0xd81e3a,
    towerBark: 0x6b4a2f,
    towerLeaf: 0x4f9a3c,
    towerDeck: 0xf6ecd8,
  },
  /**
   * Ice palace: walls of pale-blue ice over dark stone with snow and icicles
   * along the top, thick snow on the wall tops, frosted pavers, glowing ice
   * crystals on stone plinths, and an ice spire instead of the tower, under a
   * deep indigo night. True-colour patterns with a soft sheen.
   */
  ice: {
    id: "ice",
    sky: [0x0a0f30, 0x1c2e6a, 0x2e8a96],
    ground: { base: 0xa7bbd4, alt: 0xc6d5e7, scale: 12 },
    hemiSky: 0xe4eeff,
    hemiGround: 0x46527c,
    hemiIntensity: 1.3,
    sunColor: 0xf0f5ff,
    sunIntensity: 1.35,
    wallSide: 0x9cd8fa,
    wallTop: 0xf4f8ff,
    outerWall: 0x8ccbf0,
    floor: 0x7d8aa6,
    plaza: 0x8e9bb6,
    line: 0x2a3450,
    linesGlowInDark: false,
    wallPattern: "iceBrick",
    topPattern: "snow",
    floorPattern: "frostStone",
    growth: 0,
    growthShare: 0,
    glow: 0,
    surface: "metal",
    torchEvery: 7,
    torchFlame: 0x8fe6ff,
    lightStyle: "crystal",
    structure: { step: 0xeef3fb, stepAlt: 0xd6e0ee, plank: 0xbfe6fb, plankAlt: 0xa8dcf6, rail: 0x7cc4ec },
    towerStyle: "ice",
    towerStone: 0x9fd6f6,
    towerRune: 0x7fe4ff,
    towerCrystal: 0xc8f4ff,
    towerBark: 0x6b4a2f,
    towerLeaf: 0x4f9a3c,
    towerDeck: 0xe6f2ff,
  },
  /**
   * Desert temple: sandstone walls carved with glyphs (some with a turquoise
   * inlay trimmed in gold), limestone wall tops, red earth with pebbles,
   * bronze fire braziers, rope bridges, and an obelisk instead of the tower,
   * in late-afternoon sun. True-colour patterns.
   */
  desert: {
    id: "desert",
    sky: [0xb05a2e, 0xe0904e, 0xf6d49a],
    ground: { base: 0xb47a3e, alt: 0xe6bb7a, scale: 7, stretch: [1, 3] },
    hemiSky: 0xfff0d8,
    hemiGround: 0x7a4a2e,
    hemiIntensity: 1.1,
    sunColor: 0xffd9a0,
    sunIntensity: 1.45,
    wallSide: 0xdcb47a,
    wallTop: 0xfbf0da,
    outerWall: 0xd2a970,
    floor: 0xa85e3c,
    plaza: 0xb86e4a,
    line: 0x4a2414,
    linesGlowInDark: false,
    wallPattern: "sandstone",
    topPattern: "limestone",
    floorPattern: "earth",
    growth: 0x2fb8b0,
    growthShare: 0.3,
    glow: 0,
    surface: "matte",
    torchEvery: 7,
    torchFlame: 0xffa040,
    lightStyle: "brazier",
    structure: { step: 0xe6cc9a, stepAlt: 0xd6b884, plank: 0x6b4a2e, plankAlt: 0x5a3d25, rail: 0xc9a24a },
    towerStyle: "obelisk",
    towerStone: 0xe2bf88,
    towerRune: 0x3fd8d0,
    towerCrystal: 0x3fc8c0,
    towerBark: 0x6b4a2f,
    towerLeaf: 0x4f9a3c,
    towerDeck: 0xfbf0da,
  },
};

export const DEFAULT_THEME_ID = "stone";

export function themeFor(id: string | undefined): Theme {
  return THEMES[id ?? DEFAULT_THEME_ID] ?? (THEMES[DEFAULT_THEME_ID] as Theme);
}

export { glowTexture, patternTexture, runeTexture, trueColour } from "./patterns.js";
