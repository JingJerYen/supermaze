/**
 * Hand-made map data (CLAUDE.md section 6).
 *
 * Phase-0 draft format: one character per cell, row-major.
 *   `X` or ` `  void      nothing here, never walkable
 *   `.`         road      walkable on the road layer
 *   `#`         wall      one level high; its top is walkable on the wallTop layer
 *   `S`         stairs    walkable on both layers and the only place a player changes layer
 *   `=`         bridge    wallTop walkway over a road cell; the road beneath stays walkable
 *   `T`         tower     central tower footprint; blocked in phase 0
 *
 * The format is finalised in phase 1 together with the validator.
 */
export type Layer = "road" | "wallTop";

export interface TilePos {
  x: number;
  y: number;
  layer: Layer;
}

export interface MapData {
  id: string;
  name: string;
  /** Player counts this map is validated for. */
  supportedParticipants: number[];
  /**
   * Row-major cell codes. All rows must have the same length. Besides the six
   * cell codes, rows may carry spawn markers (K/k keys, B/b item boxes,
   * L/l light switches; upper case on road, lower case on a wall top) which
   * `normalizeMap` converts into `spawns` entries.
   */
  rows: string[];
  /**
   * Chebyshev distance from the tower footprint within which the one-tile-wide
   * corridor rule is waived (the plaza around the tower). Default 0.
   */
  plazaRadius?: number;
  /** Quarter turns clockwise applied to the authored map; set by rotateMap. */
  rotation?: 0 | 1 | 2 | 3;
  /**
   * Author-verified candidate tiles for dynamic objects. Each round draws from
   * these with the round seed:
   *   keys          -> participants x tuning.keys.perParticipant
   *   itemBoxes     -> participants x tuning.itemBoxes.perParticipant, and every
   *                    replacement box is drawn from the still-free candidates
   *   lightSwitches -> exactly `lightSwitchCount`
   * The three lists must not share tiles with each other or with tower entries.
   */
  spawns?: {
    keys?: TilePos[];
    itemBoxes?: TilePos[];
    lightSwitches?: TilePos[];
  };
  /** Light switches placed per round. Even and at least tuning.lighting.switchCountMin. */
  lightSwitchCount: number;
}

/** A map after `normalizeMap`: plain cell codes and every spawn list present. */
export interface NormalizedMapData extends MapData {
  rows: string[];
  spawns: {
    keys: TilePos[];
    itemBoxes: TilePos[];
    lightSwitches: TilePos[];
  };
}
