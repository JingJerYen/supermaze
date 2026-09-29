import type { SimulationState } from "@supermaze/sim";
import { TEAM_COLORS, teamColorIndex } from "../render/teamColors.js";
import { CLIENT_TUNING } from "../tuning.js";

export interface MinimapDot {
  id: string;
  /** Tile the player stands on (or is leaving). */
  x: number;
  y: number;
  /** CSS colour. */
  color: string;
  self: boolean;
  /** On the tower top: drawn smaller, over the tower icon. */
  onTower: boolean;
}

const css = (hex: number) => `#${hex.toString(16).padStart(6, "0")}`;

/**
 * Who appears on the minimap and in which colour (CLAUDE.md section 7). The
 * same for everyone, in the maze or on the tower: every player is a dot.
 * Two teams: each team in its team colour. Everyone for themselves: you in one
 * colour, all the others in another. Others first, you last, so your own dot
 * is drawn on top. No terrain, keys, boxes or switches are ever part of it.
 */
export function minimapDots(state: SimulationState, meId: string | null): MinimapDot[] {
  const t = CLIENT_TUNING.minimap;
  const dots = Object.values(state.players).map((p): MinimapDot => {
    const self = p.id === meId;
    const color =
      state.teamMode === "solo" ? css(self ? t.soloSelfColor : t.soloOtherColor) : css(TEAM_COLORS[teamColorIndex(p.teamId) % TEAM_COLORS.length] as number);
    return { id: p.id, x: p.mover.from.x, y: p.mover.from.y, color, self, onTower: p.phase === "tower" };
  });
  return dots.sort((a, b) => Number(a.self) - Number(b.self) || a.id.localeCompare(b.id));
}
