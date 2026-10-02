import { normalizeMap, type MapData, type MapGrid, type PlayerInput, type SimulationState } from "@supermaze/sim";
import type { ResultsActions } from "../hud/results.js";

/** The two states to draw between. */
export interface Sample {
  from: SimulationState;
  to: SimulationState;
  alpha: number;
  /**
   * Offset in tiles added to where the local player is drawn. Online play uses
   * it to ease a corrected prediction into place instead of jumping there.
   */
  nudge?: { x: number; y: number };
}

/** What main.ts needs from a game mode; local and online implement it identically from the outside. */
export interface GameMode {
  label: string;
  grid: MapGrid;
  /** Visual theme id from the map file; undefined means the default. */
  theme: string | undefined;
  /** The map's difficulty, for the footprint trail's length; undefined for maps without one. */
  difficulty?: string | undefined;
  plazaRadius: number;
  /** "x,y" of every light-switch candidate tile; decorations stay off them. */
  switchTiles: ReadonlySet<string>;
  tickRate: number;
  localPlayerId(): string | null;
  /** Called at the fixed tick rate with the current intent. */
  tick(input: PlayerInput): void;
  /** States to render between, with a 0..1 blend. */
  sample(now: number, loopAlpha: number): Sample | null;
  hud(): Record<string, string | number>;
  /** Small line under the clock, e.g. the tower run's floor and total; null for none. */
  caption?(): string | null;
  /** Big toasts the mode wants shown now (the tower run's achievements); each is returned once. */
  notices?(): string[];
  /** Large centre-screen message (connection problems etc.), or null when there is nothing to say. */
  banner?(): string | null;
  /** What the results screen offers once the round is finished. */
  results(): ResultsActions;
  /** Leave the match from the on-screen exit button; absent when there is nowhere to go. */
  exit?(): void;
  /** Developer command (F4 forces a ghost event). Optional. */
  debug?(cmd: "ghost"): void;
}

/** Tiles that may host a light switch this round, as "x,y". */
export function switchTileSet(map: MapData): ReadonlySet<string> {
  return new Set(normalizeMap(map).spawns.lightSwitches.map((t) => `${t.x},${t.y}`));
}
