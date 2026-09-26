import type { SimEvent } from "./events.js";
import type { MapGrid } from "./map/grid.js";
import type { TilePos } from "./map/types.js";
import { frontTile, sameTile } from "./movement.js";
import { tileId } from "./boxes.js";
import { nodeAt, placeableAt, type PlaceableState, type TeleportNodeState } from "./placeables.js";
import type { PlayerState } from "./simulation.js";
import type { ItemKind, Tuning } from "./tuning/index.js";
import type { PlayerId, Tick } from "./types.js";

/** Mutable working copy of the parts of the state that item use touches. */
export interface ItemWork {
  tick: Tick;
  placeables: Record<string, PlaceableState>;
  nodes: Record<string, TeleportNodeState>;
  players: Record<PlayerId, PlayerState>;
  /** Every spawn-candidate tile; items may not be placed on them (CLAUDE.md section 9). */
  candidateTiles: ReadonlySet<string>;
  boxTiles: ReadonlySet<string>;
  keyTiles: ReadonlySet<string>;
  nextPlaceableId(): string;
  nextNodeOrder(): number;
  events: SimEvent[];
}

/**
 * Why the tile in front of the player cannot take a placeable, or null if it can.
 * Kept as text so the HUD can show it.
 */
export function placementProblem(grid: MapGrid, work: ItemWork, tile: TilePos): string | null {
  if (!grid.isWalkable(tile.x, tile.y, tile.layer)) return "前方不可通行";
  if (grid.kindAt(tile.x, tile.y) === "stairs") return "不能放在樓梯上";
  if (tile.layer === "road" && grid.isTowerEntry(tile.x, tile.y)) return "不能放在塔入口";
  const id = tileId(tile);
  if (work.candidateTiles.has(id)) return "不能放在候選格";
  if (work.boxTiles.has(id) || work.keyTiles.has(id)) return "該格有物件";
  if (placeableAt(work.placeables, tile) || nodeAt(work.nodes, tile)) return "該格已有放置物";
  for (const other of Object.values(work.players)) {
    if (other.phase !== "maze") continue;
    if (sameTile(other.mover.from, tile) || (other.mover.target && sameTile(other.mover.target, tile))) return "有玩家在該格";
  }
  return null;
}

/** Nodes a team owns: on the map plus in every member's bag. */
export function teamNodeCount(players: Record<PlayerId, PlayerState>, nodes: Record<string, TeleportNodeState>, teamId: string): number {
  let n = Object.values(nodes).filter((x) => x.teamId === teamId).length;
  for (const p of Object.values(players)) if (p.teamId === teamId) n += p.items.filter((i) => i === "teleportNode").length;
  return n;
}

/**
 * Use the oldest item of `p`. Returns the updated player. Consumes the item only
 * when its effect actually happened (a hammer that hits nothing stays in the bag).
 */
export function useOldestItem(grid: MapGrid, tuning: Tuning, work: ItemWork, p: PlayerState): PlayerState {
  const item = p.items[0];
  if (!item) return p;
  const front = frontTile(p.mover);
  const consume = (): PlayerState => {
    work.events.push({ type: "itemUsed", tick: work.tick, playerId: p.id, item });
    return { ...p, items: p.items.slice(1) };
  };

  // Development mode: everything but teleport nodes becomes a passable placeholder block.
  if (!tuning.placeables.effectsEnabled && item !== "teleportNode") {
    if (placementProblem(grid, work, front)) return p;
    const id = work.nextPlaceableId();
    const lifetime = Math.round(tuning.placeables.placeholderLifetimeSec * tuning.tickRate);
    work.placeables = {
      ...work.placeables,
      [id]: { id, kind: item, pos: front, dir: p.mover.facing, ownerId: p.id, expiresAtTick: work.tick + lifetime, placeholder: true },
    };
    work.events.push({ type: "placeablePlaced", tick: work.tick, playerId: p.id, placeableId: id, kind: item, placeholder: true });
    return consume();
  }

  switch (item) {
    case "hammer": {
      const target = placeableAt(work.placeables, front);
      if (!target || target.kind !== "obstacle" || target.placeholder) return p;
      const rest = { ...work.placeables };
      delete rest[target.id];
      work.placeables = rest;
      work.events.push({ type: "obstacleDestroyed", tick: work.tick, playerId: p.id, placeableId: target.id });
      return consume();
    }
    case "oneWayDoor":
    case "obstacle":
    case "trap": {
      if (placementProblem(grid, work, front)) return p;
      const id = work.nextPlaceableId();
      const lifetime = Math.round(tuning.placeables.lifetimeSec[item] * tuning.tickRate);
      work.placeables = {
        ...work.placeables,
        [id]: { id, kind: item, pos: front, dir: p.mover.facing, ownerId: p.id, expiresAtTick: work.tick + lifetime, placeholder: false },
      };
      work.events.push({ type: "placeablePlaced", tick: work.tick, playerId: p.id, placeableId: id, kind: item, placeholder: false });
      return consume();
    }
    case "teleportNode": {
      if (placementProblem(grid, work, front)) return p;
      const waiting = Object.values(work.nodes)
        .filter((n) => n.teamId === p.teamId && n.pairedWith === null)
        .sort((a, b) => a.order - b.order)[0];
      const id = `n${work.nextNodeOrder()}`;
      const node: TeleportNodeState = { id, pos: front, teamId: p.teamId, pairedWith: waiting?.id ?? null, order: Number(id.slice(1)) };
      const nodes = { ...work.nodes, [id]: node };
      if (waiting) nodes[waiting.id] = { ...waiting, pairedWith: id };
      work.nodes = nodes;
      work.events.push({ type: "nodePlaced", tick: work.tick, playerId: p.id, nodeId: id, pairedWith: waiting?.id ?? null });
      return consume();
    }
  }
}

/** Pick the team's node underfoot back into the bag; its partner goes back to waiting. */
export function pickUpNode(work: ItemWork, p: PlayerState): PlayerState {
  const node = nodeAt(work.nodes, p.mover.from);
  if (!node || node.teamId !== p.teamId) return p;
  const nodes = { ...work.nodes };
  delete nodes[node.id];
  if (node.pairedWith && nodes[node.pairedWith]) nodes[node.pairedWith] = { ...(nodes[node.pairedWith] as TeleportNodeState), pairedWith: null };
  work.nodes = nodes;
  work.events.push({ type: "nodePickedUp", tick: work.tick, playerId: p.id, nodeId: node.id });
  return { ...p, items: [...p.items, "teleportNode" as ItemKind], teleportImmunity: null };
}
