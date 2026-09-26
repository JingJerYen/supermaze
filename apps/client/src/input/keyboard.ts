import type { PlayerInput } from "@supermaze/sim";

/** WASD / arrow keys -> movement; E or Space -> the single context action (edge-triggered). */
export class KeyboardInput {
  private readonly down = new Set<string>();
  private actionPending = false;

  constructor(target: Window = window) {
    target.addEventListener("keydown", (e) => {
      if (!this.down.has(e.code) && (e.code === "KeyE" || e.code === "Space")) this.actionPending = true;
      this.down.add(e.code);
      if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
    });
    target.addEventListener("keyup", (e) => this.down.delete(e.code));
    target.addEventListener("blur", () => this.down.clear());
  }

  read(): PlayerInput {
    const has = (...codes: string[]) => codes.some((c) => this.down.has(c));
    const moveX = (has("KeyD", "ArrowRight") ? 1 : 0) - (has("KeyA", "ArrowLeft") ? 1 : 0);
    const moveY = (has("KeyS", "ArrowDown") ? 1 : 0) - (has("KeyW", "ArrowUp") ? 1 : 0);
    const input: PlayerInput = { moveX, moveY };
    if (this.actionPending) {
      input.action = true;
      this.actionPending = false;
    }
    return input;
  }
}
