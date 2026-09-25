/**
 * Hand-made map data (CLAUDE.md section 6).
 * Two walkable layers: road (ground) and wallTop. Stairs connect the two layers;
 * bridges connect wallTop regions. No free jumping or falling exists.
 *
 * This is a phase-0 sketch of the shape. It will be finalised in phase 1
 * together with the validator.
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
  width: number;
  height: number;
  /** Player counts this map is validated for. */
  supportedParticipants: number[];
  /** Row-major cell codes per layer. Encoding is decided in phase 1. */
  layers: Record<Layer, string[]>;
  /** Tiles where the central tower occupies the road layer. */
  tower: { center: TilePos; footprint: TilePos[] };
  /** Legal, author-verified spawn points for dynamic objects. */
  spawns: {
    keys: TilePos[];
    itemBoxes: TilePos[];
    lightSwitches: TilePos[];
  };
}
