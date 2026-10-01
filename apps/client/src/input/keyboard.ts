import type { PlayerInput } from "@supermaze/sim";

/**
 * WASD / arrow keys -> movement; E or Space -> the single context action; Q ->
 * discard the oldest item; R -> cast the skill, T -> the second skill (all edge-triggered).
 */
export class KeyboardInput {
  private readonly down = new Set<string>();
  private actionPending = false;
  private discardPending = false;
  private skillPending = false;
  private skill2Pending = false;

  constructor(target: Window = window) {
    target.addEventListener("keydown", (e) => {
      if (!this.down.has(e.code) && (e.code === "KeyE" || e.code === "Space")) this.actionPending = true;
      if (!this.down.has(e.code) && e.code === "KeyQ") this.discardPending = true;
      if (!this.down.has(e.code) && e.code === "KeyR") this.skillPending = true;
      if (!this.down.has(e.code) && e.code === "KeyT") this.skill2Pending = true;
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
    if (this.discardPending) {
      input.discard = true;
      this.discardPending = false;
    }
    if (this.skillPending) {
      input.skill = true;
      this.skillPending = false;
    }
    if (this.skill2Pending) {
      input.skill2 = true;
      this.skill2Pending = false;
    }
    return input;
  }
}
