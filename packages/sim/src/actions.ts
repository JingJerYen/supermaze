import { usableSwitchAt, type LightSwitchState } from "./lighting.js";
import type { MapGrid } from "./map/grid.js";
import type { PlayerState } from "./simulation.js";

/** What the single context action (E / on-screen button) would do right now. */
export type PlayerAction = "climb" | "switch";

/**
 * Shared by the authoritative step and the client HUD, so what the button says
 * it will do is exactly what the server will do. A player must be standing
 * still in the maze; switch tiles and tower entries never coincide (validator).
 */
export function availableAction(
  grid: MapGrid,
  switches: Record<string, LightSwitchState>,
  p: PlayerState,
): PlayerAction | null {
  if (p.phase !== "maze" || p.mover.target !== null) return null;
  const at = p.mover.from;
  if (at.layer === "road" && p.keyId !== null && grid.isTowerEntry(at.x, at.y)) return "climb";
  if (usableSwitchAt(switches, at)) return "switch";
  return null;
}
