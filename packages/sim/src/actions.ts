import { isGhost, type GhostState } from "./ghost.js";
import { canUseOldestItem, placementContextOf } from "./items.js";
import { usableSwitchAt, type LightSwitchState } from "./lighting.js";
import type { MapGrid } from "./map/grid.js";
import { nodeAt, type PlaceableState, type TeleportNodeState } from "./placeables.js";
import type { PlayerState } from "./simulation.js";
import type { TilePos } from "./map/types.js";
import type { PlayerId, Tick } from "./types.js";

/** What the single context action (E / on-screen button) would do right now. */
export type PlayerAction = "climb" | "switch" | "pickUpNode" | "useItem";

/** The slice of state the action decision reads. */
export interface ActionContext {
  tick: Tick;
  /** Start freeze: no action is available before this tick (section 4). */
  freezeUntilTick: Tick;
  switches: Record<string, LightSwitchState>;
  nodes: Record<string, TeleportNodeState>;
  placeables: Record<string, PlaceableState>;
  players: Record<PlayerId, PlayerState>;
  boxes: Record<string, { pos: TilePos }>;
  keys: Record<string, { pos: TilePos; ownerId: PlayerId | null }>;
  ghost: GhostState;
}

/**
 * Shared by the authoritative step and the client HUD, so what the button says
 * it will do is exactly what the server will do. The player must be standing
 * still in the maze and the start freeze must be over. Priority: climb, light switch underfoot, pick up the
 * team's teleport node underfoot, then use the oldest carried item; the last
 * only when the item could really be used (a refused placement offers nothing).
 */
export function availableAction(grid: MapGrid, ctx: ActionContext, p: PlayerState, inventoryCapacity: number): PlayerAction | null {
  if (ctx.tick < ctx.freezeUntilTick) return null;
  if (p.phase !== "maze" || p.mover.target !== null) return null;
  const at = p.mover.from;
  // A ghost's key and bag are locked for the chase; light switches stay usable (section 13).
  if (isGhost(ctx.ghost, p)) return usableSwitchAt(ctx.switches, at) ? "switch" : null;
  if (at.layer === "road" && p.keyId !== null && grid.isTowerEntry(at.x, at.y)) return "climb";
  if (usableSwitchAt(ctx.switches, at)) return "switch";
  const node = nodeAt(ctx.nodes, at);
  if (node && node.teamId === p.teamId && p.items.length < inventoryCapacity) return "pickUpNode";
  if (p.items.length > 0 && canUseOldestItem(grid, placementContextOf(ctx), p)) return "useItem";
  return null;
}
