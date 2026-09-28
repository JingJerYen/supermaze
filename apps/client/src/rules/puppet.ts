import {
  NO_INPUT,
  placeableMoveFilter,
  sameTile,
  shortestPath,
  type Layer,
  type MapGrid,
  type PlayerInput,
  type SimulationState,
  type TilePos,
} from "@supermaze/sim";

/**
 * One step of a scripted actor in a rules demo. Scripts say where to go and
 * what to press, not which keys to hold for how many ticks, so they survive
 * changes to speed, turn delay or tick rate.
 */
export type Cmd =
  | { do: "goto"; x: number; y: number; layer?: Layer }
  /** Turn on the spot to face a direction (a one-tick tap). */
  | { do: "face"; dx: number; dy: number }
  /** Hold a direction for a while, for walking into something that blocks. */
  | { do: "push"; dx: number; dy: number; sec: number }
  | { do: "act" }
  | { do: "discard" }
  | { do: "wait"; sec: number }
  /** Walk toward another player for up to `sec` seconds. */
  | { do: "chase"; id: string; sec: number };

/** Plays a command list for one player, one input per tick. No DOM, no rendering. */
export class Puppet {
  private index = 0;
  /** Ticks spent on the current command. */
  private spent = 0;

  constructor(
    private readonly id: string,
    private readonly script: readonly Cmd[],
  ) {}

  get done(): boolean {
    return this.index >= this.script.length;
  }

  input(state: SimulationState, grid: MapGrid, tickRate: number): PlayerInput {
    const p = state.players[this.id];
    if (!p || p.phase !== "maze") {
      this.index = this.script.length;
      return NO_INPUT;
    }
    // Several commands can complete on the same tick (arrived, already facing...).
    for (let guard = 0; guard < 8 && !this.done; guard++) {
      const cmd = this.script[this.index] as Cmd;
      const ticks = "sec" in cmd ? Math.round(cmd.sec * tickRate) : 0;
      const anchor = p.mover.target ?? p.mover.from;
      switch (cmd.do) {
        case "goto": {
          const goal: TilePos = { x: cmd.x, y: cmd.y, layer: cmd.layer ?? "road" };
          if (sameTile(anchor, goal)) {
            if (p.mover.target !== null) return NO_INPUT; // finishing the last tile
            break;
          }
          return this.toward(state, grid, anchor, (t) => sameTile(t, goal));
        }
        case "chase": {
          const other = state.players[cmd.id];
          if (!other || this.spent >= ticks) break;
          this.spent++;
          const goal = other.mover.target ?? other.mover.from;
          return this.toward(state, grid, anchor, (t) => sameTile(t, goal));
        }
        case "face":
          if (p.mover.facing.dx === cmd.dx && p.mover.facing.dy === cmd.dy) break;
          if (p.mover.target !== null) return NO_INPUT;
          return { moveX: cmd.dx, moveY: cmd.dy };
        case "push":
          if (this.spent >= ticks) break;
          this.spent++;
          return { moveX: cmd.dx, moveY: cmd.dy };
        case "wait":
          if (this.spent >= ticks) break;
          this.spent++;
          return NO_INPUT;
        case "act":
        case "discard":
          if (p.mover.target !== null) return NO_INPUT; // press once standing still
          this.next();
          return cmd.do === "act" ? { moveX: 0, moveY: 0, action: true } : { moveX: 0, moveY: 0, discard: true };
      }
      this.next();
    }
    return NO_INPUT;
  }

  private next(): void {
    this.index++;
    this.spent = 0;
  }

  private toward(state: SimulationState, grid: MapGrid, anchor: TilePos, isGoal: (t: TilePos) => boolean): PlayerInput {
    const path = shortestPath(grid, anchor, isGoal, placeableMoveFilter(state.placeables));
    const step = path?.[0];
    if (!step) return NO_INPUT;
    return { moveX: Math.sign(step.x - anchor.x), moveY: Math.sign(step.y - anchor.y) };
  }
}
