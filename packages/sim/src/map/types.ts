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
/**
 * Walkable layers. `towerTop` is the platform on the central tower: the tower
 * footprint plus a one-tile ring, reachable only by climbing (irreversible).
 */
export type Layer = "road" | "wallTop" | "towerTop";

export type MapDifficulty = "easy" | "medium" | "hard";

export const MAP_DIFFICULTIES: readonly MapDifficulty[] = ["easy", "medium", "hard"];

/** Which kind of round a map is drawn for: the race to the tower (tower run and online), or the night parade (section 4.4). */
export type MapMode = "race" | "night";
export const MAP_MODES: readonly MapMode[] = ["race", "night"];

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
   * `normalizeMap` converts into `spawns` entries, and fixture markers
   * (O/o, A/a, ^ v < >) which it converts into `fixtures` entries.
   */
  rows: string[];
  /**
   * Chebyshev distance from the tower footprint within which the one-tile-wide
   * corridor rule is waived (the plaza around the tower). Default 0.
   */
  plazaRadius?: number;
  /** Quarter turns clockwise applied to the authored map; set by rotateMap. */
  rotation?: 0 | 1 | 2 | 3;
  /** Visual theme id for walls and floors (client-side table); default "stone". */
  theme?: string;
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
  /**
   * Item boxes on the field at any time, whatever the number of players; a
   * box that is opened is replaced at once, so the count holds all round.
   * Optional: without it the count is participants x tuning.itemBoxes.perParticipant.
   */
  itemBoxCount?: number;
  /**
   * Round length in seconds for two participants, chosen by the map's author.
   * Every participant beyond the second adds tuning.round.extraSecPerParticipant.
   */
  timeLimitSec: number;
  /**
   * How hard the map is on its own (size, how far the keys are, fixtures),
   * chosen by its author. The tower run (single player) draws each floor's map
   * from one difficulty; a map without it never appears there.
   */
  difficulty?: MapDifficulty;
  /** The kinds of round the map is drawn for; a map without it is a race map only. */
  modes?: MapMode[];
  /**
   * Doors, obstacles and traps present from the start of every round and never
   * timing out; only a hammer removes them (a trap also goes when it fires).
   * Usually drawn as markers in `rows` (O/o obstacle, A/a trap, ^ v < > door);
   * this list is for what the markers cannot express, such as a wall-top door.
   */
  fixtures?: FixtureSpec[];
}

export interface FixtureSpec extends TilePos {
  kind: "obstacle" | "trap" | "oneWayDoor";
  /** Passage direction of a door in map coordinates; required for doors, ignored otherwise. */
  dir?: { dx: number; dy: number };
}

/** A map after `normalizeMap`: plain cell codes and every spawn list present. */
export interface NormalizedMapData extends MapData {
  rows: string[];
  spawns: {
    keys: TilePos[];
    itemBoxes: TilePos[];
    lightSwitches: TilePos[];
  };
  fixtures: FixtureSpec[];
}
