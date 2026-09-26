import { usableSwitchAt, type LightSwitchState } from "./lighting.js";
import type { MapGrid } from "./map/grid.js";
import { nodeAt, type TeleportNodeState } from "./placeables.js";
import type { PlayerState } from "./simulation.js";

/** What the single context action (E / on-screen button) would do right now. */
export type PlayerAction = "climb" | "switch" | "pickUpNode" | "useItem";

/**
 * Shared by the authoritative step and the client HUD, so what the button says
 * it will do is exactly what the server will do. The player must be standing
 * still in the maze. Priority: climb, light switch underfoot, pick up the
 * team's teleport node underfoot, then use the oldest carried item.
 */
export function availableAction(
  grid: MapGrid,
  switches: Record<string, LightSwitchState>,
  nodes: Record<string, TeleportNodeState>,
  p: PlayerState,
  inventoryCapacity: number,
): PlayerAction | null {
  if (p.phase !== "maze" || p.mover.target !== null) return null;
  const at = p.mover.from;
  if (at.layer === "road" && p.keyId !== null && grid.isTowerEntry(at.x, at.y)) return "climb";
  if (usableSwitchAt(switches, at)) return "switch";
  const node = nodeAt(nodes, at);
  if (node && node.teamId === p.teamId && p.items.length < inventoryCapacity) return "pickUpNode";
  if (p.items.length > 0) return "useItem";
  return null;
}
