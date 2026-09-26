import type { Dir } from "./map/grid.js";
import type { TilePos } from "./map/types.js";
import { sameTile } from "./movement.js";
import type { PlaceableKind } from "./tuning/index.js";
import type { PlayerId, TeamId, Tick } from "./types.js";

/** A one-way door, obstacle or trap sitting on a tile for a limited time (CLAUDE.md section 10). */
export interface PlaceableState {
  id: string;
  kind: PlaceableKind;
  pos: TilePos;
  /** Passage direction for doors; irrelevant for the others (kept for rendering). */
  dir: Dir;
  ownerId: PlayerId;
  expiresAtTick: Tick;
}

/** A quantum teleport endpoint lying on the floor. Persistent; never blocks passage. */
export interface TeleportNodeState {
  id: string;
  pos: TilePos;
  teamId: TeamId;
  pairedWith: string | null;
  /** Placement order, used to pair with the earliest waiting node. */
  order: number;
}

export function placeableAt(placeables: Record<string, PlaceableState>, tile: TilePos): PlaceableState | undefined {
  return Object.values(placeables).find((p) => sameTile(p.pos, tile));
}

export function nodeAt(nodes: Record<string, TeleportNodeState>, tile: TilePos): TeleportNodeState | undefined {
  return Object.values(nodes).find((n) => sameTile(n.pos, tile));
}

/**
 * Movement veto from placeables: obstacles block their tile entirely; a one-way
 * door may only be entered and left while moving in its direction.
 */
export function placeableMoveFilter(placeables: Record<string, PlaceableState>) {
  return (from: TilePos, to: TilePos, dir: Dir): boolean => {
    const ahead = placeableAt(placeables, to);
    if (ahead?.kind === "obstacle") return false;
    if (ahead?.kind === "oneWayDoor" && !sameDir(ahead.dir, dir)) return false;
    const here = placeableAt(placeables, from);
    if (here?.kind === "oneWayDoor" && !sameDir(here.dir, dir)) return false;
    return true;
  };
}

export function sameDir(a: Dir, b: Dir): boolean {
  return a.dx === b.dx && a.dy === b.dy;
}
