import type { SimEvent } from "./events.js";
import type { MapGrid } from "./map/grid.js";
import type { TilePos } from "./map/types.js";
import { frontTile, sameTile } from "./movement.js";
import { tileId } from "./boxes.js";
import { nodeAt, placeableAt, type PlaceableState, type TeleportNodeState } from "./placeables.js";
import type { PlayerState } from "./simulation.js";
import type { ItemKind, Tuning } from "./tuning/index.js";
import type { PlayerId, Tick } from "./types.js";

/** What placement rules look at. Both the authoritative step and the HUD build one of these. */
export interface PlacementContext {
  placeables: Record<string, PlaceableState>;
  nodes: Record<string, TeleportNodeState>;
  players: Record<PlayerId, PlayerState>;
  /** Tiles holding a box or an unowned key. */
  boxTiles: ReadonlySet<string>;
  keyTiles: ReadonlySet<string>;
}

/** Mutable working copy of the parts of the state that item use touches. */
export interface ItemWork extends PlacementContext {
  tick: Tick;
  nextPlaceableId(): string;
  nextNodeOrder(): number;
  events: SimEvent[];
}

/**
 * Why the tile in front of the player cannot take a placeable, or null if it can.
 * Kept as text so the HUD can show it.
 */
export function placementProblem(grid: MapGrid, work: PlacementContext, tile: TilePos): string | null {
  if (!grid.isWalkable(tile.x, tile.y, tile.layer)) return "前方不可通行";
  if (grid.kindAt(tile.x, tile.y) === "stairs") return "不能放在樓梯上";
  if (tile.layer === "road" && grid.isTowerEntry(tile.x, tile.y)) return "不能放在塔入口";
  const id = tileId(tile);
  if (grid.isCandidateTile(tile.x, tile.y, tile.layer)) return "不能放在候選格";
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
 * Use the oldest item of `p`. Returns the updated player. Placeables are kept
 * when the tile ahead refuses them; a hammer is spent whether or not it hits,
 * so a hammer at the front of the FIFO bag never jams it (CLAUDE.md 10.3).
 */
export function useOldestItem(grid: MapGrid, tuning: Tuning, work: ItemWork, p: PlayerState): PlayerState {
  const item = p.items[0];
  if (!item) return p;
  const front = frontTile(p.mover);
  const consume = (): PlayerState => {
    work.events.push({ type: "itemUsed", tick: work.tick, playerId: p.id, item });
    return { ...p, items: p.items.slice(1) };
  };

  switch (item) {
    case "hammer": {
      // Breaks whatever players put on the tile ahead: any placeable and any team's
      // teleport node. Never map geometry, boxes, keys or switches (10.3).
      const target = placeableAt(work.placeables, front);
      if (target) {
        const rest = { ...work.placeables };
        delete rest[target.id];
        work.placeables = rest;
        work.events.push({ type: "placeableDestroyed", tick: work.tick, playerId: p.id, placeableId: target.id, kind: target.kind });
      }
      const node = nodeAt(work.nodes, front);
      if (node) {
        const nodes = { ...work.nodes };
        delete nodes[node.id];
        if (node.pairedWith && nodes[node.pairedWith]) {
          nodes[node.pairedWith] = { ...(nodes[node.pairedWith] as TeleportNodeState), pairedWith: null };
        }
        work.nodes = nodes;
        work.events.push({ type: "nodeDestroyed", tick: work.tick, playerId: p.id, nodeId: node.id, teamId: node.teamId });
      }
      return consume(); // a swing at nothing still uses the hammer up
    }
    case "oneWayDoor":
    case "obstacle":
    case "trap": {
      if (placementProblem(grid, work, front)) return p;
      const id = work.nextPlaceableId();
      const lifetime = Math.round(tuning.placeables.lifetimeSec[item] * tuning.tickRate);
      work.placeables = {
        ...work.placeables,
        [id]: { id, kind: item, pos: front, dir: p.mover.facing, ownerId: p.id, expiresAtTick: work.tick + lifetime },
      };
      work.events.push({ type: "placeablePlaced", tick: work.tick, playerId: p.id, placeableId: id, kind: item });
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

/**
 * Whether pressing the action would actually use the oldest item right now.
 * Hammers always swing; everything else needs a legal tile ahead. The HUD hides
 * the button when this is false, so the player is never offered a dead press.
 */
export function canUseOldestItem(grid: MapGrid, ctx: PlacementContext, p: PlayerState): boolean {
  const item = p.items[0];
  if (!item) return false;
  if (item === "hammer") return true;
  return placementProblem(grid, ctx, frontTile(p.mover)) === null;
}

/** Build a placement context from a full state (client side and tests). */
export function placementContextOf(state: {
  placeables: Record<string, PlaceableState>;
  nodes: Record<string, TeleportNodeState>;
  players: Record<PlayerId, PlayerState>;
  boxes: Record<string, { pos: TilePos }>;
  keys: Record<string, { pos: TilePos; ownerId: PlayerId | null }>;
}): PlacementContext {
  return {
    placeables: state.placeables,
    nodes: state.nodes,
    players: state.players,
    boxTiles: new Set(Object.values(state.boxes).map((b) => tileId(b.pos))),
    keyTiles: new Set(
      Object.values(state.keys)
        .filter((k) => k.ownerId === null)
        .map((k) => tileId(k.pos)),
    ),
  };
}
