import type { MapGrid, PlayerInput, SimulationState } from "@supermaze/sim";

/** What main.ts needs from a game mode; local and online implement it identically from the outside. */
export interface GameMode {
  label: string;
  grid: MapGrid;
  tickRate: number;
  localPlayerId(): string | null;
  /** Called at the fixed tick rate with the current intent. */
  tick(input: PlayerInput): void;
  /** States to render between, with a 0..1 blend. */
  sample(now: number, loopAlpha: number): { from: SimulationState; to: SimulationState; alpha: number } | null;
  hud(): Record<string, string | number>;
  /** Large centre-screen message (connection problems etc.), or null when there is nothing to say. */
  banner?(): string | null;
}
