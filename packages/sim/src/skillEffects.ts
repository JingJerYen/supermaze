import { canDrawItem, drawItem } from "./boxes.js";
import { teamNodeCount } from "./items.js";
import type { MapGrid } from "./map/grid.js";
import type { TilePos } from "./map/types.js";
import { sameTile } from "./movement.js";
import { nodeAt, placeableAt, type PlaceableState, type TeleportNodeState } from "./placeables.js";
import type { SeededRandom } from "./random/seeded.js";
import type { PlayerState } from "./simulation.js";
import type { ItemKind, Tuning } from "./tuning/index.js";
import type { PlayerId } from "./types.js";

/** Tiles reachable from the tower, per map: where a warp may land. Computed once per grid. */
const reachableCache = new WeakMap<MapGrid, TilePos[]>();

function reachableTiles(grid: MapGrid): TilePos[] {
  let tiles = reachableCache.get(grid);
  if (!tiles) {
    const start = grid.spawnTiles()[0];
    tiles = start
      ? [...grid.reachableFrom(start)].map((key) => {
          const [x, y, layer] = key.split(",");
          return { x: Number(x), y: Number(y), layer: layer as TilePos["layer"] };
        })
      : [];
    reachableCache.set(grid, tiles);
  }
  return tiles;
}

/**
 * Where the warp skill may land `p`: any tile reachable from the tower (so
 * never a wall top the stairs do not lead to), except the one `p` stands on,
 * stairs and bridges (between levels), the ring round the tower (a free trip
 * home), and tiles holding a placeable or a teleport node. In the map's
 * search order, so a seeded pick is the same on every replay.
 */
export function warpTargets(
  grid: MapGrid,
  placeables: Record<string, PlaceableState>,
  nodes: Record<string, TeleportNodeState>,
  p: PlayerState,
): TilePos[] {
  return reachableTiles(grid).filter((t) => {
    const kind = grid.kindAt(t.x, t.y);
    if (kind === "stairs" || kind === "bridge") return false;
    if (t.layer === "road" && grid.isTowerEntry(t.x, t.y)) return false;
    if (sameTile(t, p.mover.from)) return false;
    return !placeableAt(placeables, t) && !nodeAt(nodes, t);
  });
}

/**
 * Items the supply skill hands `p`: drawn one by one like box contents until
 * the bag is full, keeping the team's two-teleport-node limit (section 9); it
 * stops early when nothing is left to draw.
 */
export function supplyItems(
  rng: SeededRandom,
  tuning: Tuning,
  players: Record<PlayerId, PlayerState>,
  nodes: Record<string, TeleportNodeState>,
  p: PlayerState,
): ItemKind[] {
  const items = [...p.items];
  while (items.length < tuning.inventory.capacity) {
    const owned = teamNodeCount({ ...players, [p.id]: { ...p, items } }, nodes, p.teamId);
    const excluded: ItemKind[] = owned >= tuning.teleport.maxNodesPerTeam ? ["teleportNode"] : [];
    if (!canDrawItem(tuning, excluded)) break;
    items.push(drawItem(rng, tuning, excluded));
  }
  return items.slice(p.items.length);
}
