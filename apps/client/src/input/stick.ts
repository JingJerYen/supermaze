import type { MoveIntent } from "@supermaze/sim";
import { CLIENT_TUNING } from "../tuning.js";
import { onUiElement } from "./touchGuard.js";

type Dir = "north" | "east" | "south" | "west";
const VECTORS: Record<Dir, MoveIntent> = {
  north: { moveX: 0, moveY: -1 },
  east: { moveX: 1, moveY: 0 },
  south: { moveX: 0, moveY: 1 },
  west: { moveX: -1, moveY: 0 },
};
const STILL: MoveIntent = { moveX: 0, moveY: 0 };

/** The local player as the stick needs it: which way they face and whether they are between tiles. */
export interface StickPlayer {
  facing: { dx: number; dy: number };
  moving: boolean;
}

const CSS = `
.stick-zone{position:fixed;z-index:4;left:0;top:0;bottom:0;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.stick{position:fixed;z-index:5;pointer-events:none;width:calc(var(--stick-r) * 2);height:calc(var(--stick-r) * 2);transform:translate(-50%,-50%);
  border-radius:50%;border:3px solid rgba(255,255,255,.55);background:rgba(255,255,255,.08);box-sizing:border-box;opacity:var(--stick-opacity)}
.stick.idle{left:calc(max(var(--dpad-pad),env(safe-area-inset-left)) + var(--stick-r));top:auto;
  bottom:max(var(--dpad-pad),env(safe-area-inset-bottom));transform:translate(-50%,0);opacity:var(--stick-idle-opacity)}
.stick-turn{position:absolute;left:50%;top:50%;width:var(--stick-turn);height:var(--stick-turn);transform:translate(-50%,-50%);
  border-radius:50%;border:2px dashed rgba(255,255,255,.35);box-sizing:border-box}
.stick-knob{position:absolute;left:50%;top:50%;width:var(--stick-knob);height:var(--stick-knob);margin:calc(var(--stick-knob) / -2) 0 0 calc(var(--stick-knob) / -2);
  border-radius:50%;background:rgba(255,255,255,.55);border:2px solid #fff;box-sizing:border-box}
.stick-knob.walk{background:rgba(255,255,255,.92)}
`;

/**
 * Floating stick, the alternative to the corner pad (settings page): a touch
 * anywhere in the left part of the screen puts the ring under the thumb, and
 * the ring follows when the thumb drags past its edge. Like the pad it only
 * ever asks for one of four directions.
 *
 * Inside the dashed inner ring the push only turns the player: a single tick
 * of input, which the sim's tap-to-turn rule (CLAUDE.md section 6) treats as
 * a turn without a step. It is sent only while standing and facing elsewhere,
 * so it never becomes a step. Past the inner ring it walks.
 */
export class StickInput {
  private readonly zone: HTMLDivElement;
  private readonly ring: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private pointerId: number | null = null;
  private centre = { x: 0, y: 0 };
  private dir: Dir | null = null;
  private walking = false;
  private player: StickPlayer | null = null;
  private tick = 0;
  /** The last turn sent, so it is not repeated before the state has had time to show it. */
  private turnSent: { dir: Dir; tick: number } | null = null;

  constructor(parent: HTMLElement) {
    const t = CLIENT_TUNING.stick;
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    const radius = `min(${t.radiusPx}px, ${t.maxRadiusVh}vh)`;
    // The minimap sits above the pad's corner; the idle ring takes the same place.
    document.documentElement.style.setProperty("--dpad-size", `calc(${radius} * 2)`);
    document.documentElement.style.setProperty("--dpad-pad", `${CLIENT_TUNING.dpad.marginPx}px`);

    this.zone = document.createElement("div");
    this.zone.className = "stick-zone";
    this.zone.style.width = `${t.zoneShare * 100}%`;
    this.ring = document.createElement("div");
    this.ring.className = "stick idle";
    this.ring.style.setProperty("--stick-r", radius);
    this.ring.style.setProperty("--stick-turn", `calc(${radius} * ${2 * t.turnShare})`);
    this.ring.style.setProperty("--stick-knob", `calc(${radius} * ${t.knobShare})`);
    this.ring.style.setProperty("--stick-opacity", String(t.opacity));
    this.ring.style.setProperty("--stick-idle-opacity", String(t.idleOpacity));
    const turn = document.createElement("div");
    turn.className = "stick-turn";
    this.knob = document.createElement("div");
    this.knob.className = "stick-knob";
    this.ring.append(turn, this.knob);
    parent.append(this.zone, this.ring);

    this.zone.addEventListener("pointerdown", (e) => {
      if (this.pointerId !== null || onUiElement(e)) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      this.pointerId = e.pointerId;
      this.zone.setPointerCapture(e.pointerId);
      this.centre = { x: e.clientX, y: e.clientY };
      this.ring.classList.remove("idle");
      this.track(e.clientX, e.clientY);
    });
    this.zone.addEventListener("pointermove", (e) => {
      if (e.pointerId === this.pointerId) this.track(e.clientX, e.clientY);
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.dir = null;
      this.walking = false;
      this.ring.classList.add("idle");
      this.ring.style.left = this.ring.style.top = "";
      this.knob.style.transform = "";
      this.knob.classList.remove("walk");
    };
    this.zone.addEventListener("pointerup", release);
    this.zone.addEventListener("pointercancel", release);
    this.zone.addEventListener("lostpointercapture", release);
  }

  /** True while a finger (or the mouse button) holds the stick. */
  get active(): boolean {
    return this.pointerId !== null;
  }

  /** The local player's facing and stride, from the state being drawn; null when there is no player. */
  setPlayer(p: StickPlayer | null): void {
    this.player = p;
  }

  /** Called once a tick. */
  read(): MoveIntent {
    this.tick++;
    if (!this.dir) return STILL;
    const v = VECTORS[this.dir];
    if (this.walking) return v;
    const p = this.player;
    if (!p || p.moving || (p.facing.dx === v.moveX && p.facing.dy === v.moveY)) return STILL;
    const sent = this.turnSent;
    if (sent && sent.dir === this.dir && this.tick - sent.tick < CLIENT_TUNING.stick.turnRetryTicks) return STILL;
    this.turnSent = { dir: this.dir, tick: this.tick };
    return v;
  }

  private track(x: number, y: number): void {
    const t = CLIENT_TUNING.stick;
    const radius = Math.min(t.radiusPx, (t.maxRadiusVh * window.innerHeight) / 100);
    let dx = x - this.centre.x;
    let dy = y - this.centre.y;
    let dist = Math.hypot(dx, dy);
    if (dist > radius) {
      // Drag the ring along so the thumb never has to come back to it.
      const pull = (dist - radius) / dist;
      this.centre = { x: this.centre.x + dx * pull, y: this.centre.y + dy * pull };
      dx = x - this.centre.x;
      dy = y - this.centre.y;
      dist = radius;
    }
    this.ring.style.left = `${this.centre.x}px`;
    this.ring.style.top = `${this.centre.y}px`;
    this.knob.style.transform = `translate(${dx}px,${dy}px)`;

    if (dist < t.deadZonePx) {
      this.dir = null;
      this.walking = false;
    } else {
      this.dir = pickDir(dx, dy, this.dir, t.switchBias);
      this.walking = dist > radius * t.turnShare;
    }
    this.knob.classList.toggle("walk", this.walking);
  }

  dispose(): void {
    this.zone.remove();
    this.ring.remove();
  }
}

/** Dominant axis of the push; staying on the current axis until the other one clearly wins. */
export function pickDir(dx: number, dy: number, current: Dir | null, bias: number): Dir {
  const horizontal = (current === "east" || current === "west")
    ? Math.abs(dy) <= Math.abs(dx) * bias
    : current === "north" || current === "south"
      ? Math.abs(dx) > Math.abs(dy) * bias
      : Math.abs(dx) >= Math.abs(dy);
  if (horizontal) return dx > 0 ? "east" : "west";
  return dy > 0 ? "south" : "north";
}
