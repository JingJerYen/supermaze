import type { MoveIntent } from "@supermaze/sim";
import { CLIENT_TUNING } from "../tuning.js";

/**
 * Floating virtual stick, modelled on game-pedestrian-hell/src/touch.ts:
 * a finger (or the left mouse button) pressed anywhere on the play area spawns
 * the stick right there; dragging sets the direction and, past the dead zone,
 * an analogue magnitude that reaches 1 at `fullRangePx`. Release stops. Only
 * the first pointer counts; presses on buttons or overlay panels are ignored.
 */
export class TouchInput {
  private readonly base: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private pointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  /** Current stick vector in screen space (x right, y down), length 0..1; zero when not held. */
  private readonly axis = { x: 0, y: 0 };
  private readonly onDown: (e: PointerEvent) => void;
  private readonly onMove: (e: PointerEvent) => void;
  private readonly onUp: (e: PointerEvent) => void;
  private readonly onTouchStart: (e: TouchEvent) => void;

  constructor(parent: HTMLElement) {
    const t = CLIENT_TUNING.stick;
    this.base = document.createElement("div");
    Object.assign(this.base.style, {
      position: "fixed",
      display: "none",
      width: `${t.baseSizePx}px`,
      height: `${t.baseSizePx}px`,
      borderRadius: "50%",
      border: "2px solid rgba(255,255,255,0.5)",
      background: "rgba(255,255,255,0.12)",
      transform: "translate(-50%, -50%)",
      pointerEvents: "none",
      zIndex: "5",
    } satisfies Partial<CSSStyleDeclaration>);
    this.knob = document.createElement("div");
    Object.assign(this.knob.style, {
      position: "absolute",
      left: "50%",
      top: "50%",
      width: `${t.knobSizePx}px`,
      height: `${t.knobSizePx}px`,
      borderRadius: "50%",
      background: "rgba(255,255,255,0.55)",
      transform: "translate(-50%, -50%)",
    } satisfies Partial<CSSStyleDeclaration>);
    this.base.appendChild(this.knob);
    parent.appendChild(this.base);

    // Mobile browsers: block pull-to-refresh and double-tap zoom on the play area.
    this.onTouchStart = (e) => {
      if (!onUiElement(e)) e.preventDefault();
    };
    window.addEventListener("touchstart", this.onTouchStart, { passive: false });

    this.onDown = (e) => {
      if (this.pointerId !== null) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (onUiElement(e)) return;
      this.pointerId = e.pointerId;
      this.originX = e.clientX;
      this.originY = e.clientY;
      this.base.style.left = `${e.clientX}px`;
      this.base.style.top = `${e.clientY}px`;
      this.base.style.display = "block";
      this.moveKnob(0, 0);
    };
    this.onMove = (e) => {
      if (e.pointerId !== this.pointerId) return;
      const dx = e.clientX - this.originX;
      const dy = e.clientY - this.originY;
      this.setAxis(dx, dy);
      const len = Math.hypot(dx, dy);
      const scale = len > t.knobRangePx ? t.knobRangePx / len : 1;
      this.moveKnob(dx * scale, dy * scale);
    };
    this.onUp = (e) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.axis.x = this.axis.y = 0;
      this.base.style.display = "none";
    };
    window.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointercancel", this.onUp);
  }

  get active(): boolean {
    return this.pointerId !== null;
  }

  read(): MoveIntent {
    return { moveX: this.axis.x, moveY: this.axis.y };
  }

  private moveKnob(dx: number, dy: number): void {
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  private setAxis(dx: number, dy: number): void {
    const { deadZonePx, fullRangePx } = CLIENT_TUNING.stick;
    const len = Math.hypot(dx, dy);
    if (len < deadZonePx) {
      this.axis.x = this.axis.y = 0;
      return;
    }
    // Linear from the dead zone to full range; direction is the raw drag direction.
    const mag = Math.min(1, (len - deadZonePx) / (fullRangePx - deadZonePx));
    this.axis.x = (dx / len) * mag;
    this.axis.y = (dy / len) * mag;
  }

  dispose(): void {
    window.removeEventListener("touchstart", this.onTouchStart);
    window.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("pointercancel", this.onUp);
    this.base.remove();
  }
}

/** Presses on buttons, inputs or overlay panels belong to those elements, not to the stick. */
function onUiElement(e: Event): boolean {
  const target = e.target as HTMLElement | null;
  return !!target?.closest?.("button, input, select, a, .rs, .lb");
}
