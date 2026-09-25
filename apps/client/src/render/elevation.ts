import type { MapGrid, TilePos } from "@supermaze/sim";

/** Ground height under a tile for a given layer. Stairs sit halfway so the walk up is linear. */
export function tileElevation(grid: MapGrid, tile: TilePos): number {
  switch (grid.kindAt(tile.x, tile.y)) {
    case "stairs":
      return 0.5;
    case "wall":
      return 1;
    case "bridge":
      return tile.layer === "wallTop" ? 1 : 0;
    default:
      return 0;
  }
}
