import type { MoveIntent } from "@supermaze/sim";

/**
 * Floating virtual stick: the first touch anywhere becomes the stick origin,
 * dragging away from it produces a direction. Touch is a first-class input
 * (CLAUDE.md 17.1), so this exists from the very first spike.
 */
export class TouchInput {
  private origin: { x: number; y: number } | null = null;
  private current: { x: number; y: number } | null = null;
  private readonly knob: HTMLDivElement;

  constructor(surface: HTMLElement, private readonly deadZonePx = 18, private readonly maxPx = 60) {
    this.knob = document.createElement("div");
    Object.assign(this.knob.style, {
      position: "fixed",
      width: "56px",
      height: "56px",
      marginLeft: "-28px",
      marginTop: "-28px",
      borderRadius: "50%",
      border: "2px solid rgba(255,255,255,0.6)",
      background: "rgba(255,255,255,0.15)",
      pointerEvents: "none",
      display: "none",
      zIndex: "5",
    } satisfies Partial<CSSStyleDeclaration>);
    surface.appendChild(this.knob);

    surface.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      this.origin = { x: e.clientX, y: e.clientY };
      this.current = { ...this.origin };
      this.showKnob();
    });
    surface.addEventListener("pointermove", (e) => {
      if (!this.origin) return;
      this.current = { x: e.clientX, y: e.clientY };
      this.showKnob();
    });
    const end = () => {
      this.origin = null;
      this.current = null;
      this.knob.style.display = "none";
    };
    surface.addEventListener("pointerup", end);
    surface.addEventListener("pointercancel", end);
  }

  read(): MoveIntent {
    if (!this.origin || !this.current) return { moveX: 0, moveY: 0 };
    const dx = this.current.x - this.origin.x;
    const dy = this.current.y - this.origin.y;
    const len = Math.hypot(dx, dy);
    if (len < this.deadZonePx) return { moveX: 0, moveY: 0 };
    return { moveX: dx / len, moveY: dy / len };
  }

  private showKnob(): void {
    if (!this.origin || !this.current) return;
    const dx = this.current.x - this.origin.x;
    const dy = this.current.y - this.origin.y;
    const len = Math.hypot(dx, dy);
    const k = len > this.maxPx ? this.maxPx / len : 1;
    this.knob.style.display = "block";
    this.knob.style.left = `${this.origin.x + dx * k}px`;
    this.knob.style.top = `${this.origin.y + dy * k}px`;
  }
}
