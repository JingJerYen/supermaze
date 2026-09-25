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
  /** Row-major cell codes. All rows must have the same length. */
  rows: string[];
  /** Legal, author-verified spawn points for dynamic objects. Unused in phase 0. */
  spawns: {
    keys: TilePos[];
    itemBoxes: TilePos[];
    lightSwitches: TilePos[];
  };
}
