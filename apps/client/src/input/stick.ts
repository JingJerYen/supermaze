import type { MoveIntent } from "@supermaze/sim";
import { CLIENT_TUNING } from "../tuning.js";

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
.stick{position:fixed;z-index:5;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;
  left:max(var(--dpad-pad),env(safe-area-inset-left));bottom:max(var(--dpad-pad),env(safe-area-inset-bottom));
  width:calc(var(--stick-r) * 2);height:calc(var(--stick-r) * 2);border-radius:50%;box-sizing:border-box;
  border:4px solid rgba(255,255,255,.8);background:radial-gradient(circle,rgba(255,255,255,.1) 0,rgba(255,255,255,.2) 100%);
  box-shadow:0 0 0 2px rgba(0,0,0,.25),inset 0 0 0 2px rgba(0,0,0,.2);opacity:var(--stick-opacity)}
@media (hover:hover) and (pointer:fine){.stick{opacity:var(--stick-opacity-desktop)}}
.stick-turn{position:absolute;left:50%;top:50%;width:var(--stick-turn);height:var(--stick-turn);transform:translate(-50%,-50%);
  border-radius:50%;border:2px dashed rgba(255,255,255,.55);box-sizing:border-box;pointer-events:none}
.stick-arrow{position:absolute;left:50%;top:50%;width:0;height:0;pointer-events:none;color:rgba(255,255,255,.75);font-size:calc(var(--stick-r) * .26);line-height:1}
.stick-arrow::before{content:"▲";position:absolute;transform:translate(-50%,calc(var(--stick-r) * -0.86))}
.stick-arrow.on{color:#ffd23f}
.stick-arrow.east{transform:rotate(90deg)}.stick-arrow.south{transform:rotate(180deg)}.stick-arrow.west{transform:rotate(-90deg)}
.stick-knob{position:absolute;left:50%;top:50%;width:var(--stick-knob);height:var(--stick-knob);margin:calc(var(--stick-knob) / -2) 0 0 calc(var(--stick-knob) / -2);
  border-radius:50%;background:rgba(255,255,255,.6);border:2px solid #fff;box-sizing:border-box;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,.35)}
.stick-knob.walk{background:rgba(255,255,255,.95)}
`;

/**
 * Joystick, the default touch control (the corner pad is the settings page's
 * alternative): a ring fixed in the bottom-left corner, drawn plainly so it is
 * clear where to press. Only a press inside the ring starts it; the thumb may
 * then wander outside and the knob stays on the rim.
 *
 * Inside the dashed inner ring the push only turns the player: a single tick
 * of input, which the sim's tap-to-turn rule (CLAUDE.md section 6) treats as
 * a turn without a step. It is sent only while standing and facing elsewhere,
 * so it never becomes a step. Past the inner ring it walks: one of four
 * directions, or near a diagonal both of its directions, which the sim reads
 * as "carry on, and turn into the other one at the first opening".
 */
export class StickInput {
  private readonly ring: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private readonly arrows = {} as Record<Dir, HTMLDivElement>;
  private pointerId: number | null = null;
  private dir: Dir | null = null;
  /** The second direction of a diagonal push (walking only), or null. */
  private side: Dir | null = null;
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
    // On the document root so the minimap stays clear of the ring, as it does of the pad.
    document.documentElement.style.setProperty("--dpad-size", `calc(${radius} * 2)`);
    document.documentElement.style.setProperty("--dpad-pad", `${CLIENT_TUNING.dpad.marginPx}px`);

    this.ring = document.createElement("div");
    this.ring.className = "stick";
    this.ring.style.setProperty("--stick-r", radius);
    this.ring.style.setProperty("--stick-turn", `calc(${radius} * ${2 * t.turnShare})`);
    this.ring.style.setProperty("--stick-knob", `calc(${radius} * ${t.knobShare})`);
    this.ring.style.setProperty("--stick-opacity", String(t.opacity));
    this.ring.style.setProperty("--stick-opacity-desktop", String(t.opacityDesktop));
    const turn = document.createElement("div");
    turn.className = "stick-turn";
    this.ring.appendChild(turn);
    for (const d of Object.keys(VECTORS) as Dir[]) {
      const a = document.createElement("div");
      a.className = `stick-arrow ${d}`;
      this.ring.appendChild(a);
      this.arrows[d] = a;
    }
    this.knob = document.createElement("div");
    this.knob.className = "stick-knob";
    this.ring.appendChild(this.knob);
    parent.appendChild(this.ring);

    this.ring.addEventListener("pointerdown", (e) => {
      if (this.pointerId !== null) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const { x, y, radius: r } = this.centre();
      // The element is square; its corners outside the circle do not count.
      if (Math.hypot(e.clientX - x, e.clientY - y) > r * t.hitShare) return;
      e.preventDefault();
      e.stopPropagation();
      this.pointerId = e.pointerId;
      this.ring.setPointerCapture(e.pointerId);
      this.track(e.clientX, e.clientY);
    });
    this.ring.addEventListener("pointermove", (e) => {
      if (e.pointerId === this.pointerId) this.track(e.clientX, e.clientY);
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.setDir(null, false, null);
      this.knob.style.transform = "";
    };
    this.ring.addEventListener("pointerup", release);
    this.ring.addEventListener("pointercancel", release);
    this.ring.addEventListener("lostpointercapture", release);
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
    if (this.walking) {
      // A diagonal sends both; the sim turns into the side one at the first opening.
      const s = this.side ? VECTORS[this.side] : STILL;
      return { moveX: v.moveX + s.moveX, moveY: v.moveY + s.moveY };
    }
    const p = this.player;
    if (!p || p.moving || (p.facing.dx === v.moveX && p.facing.dy === v.moveY)) return STILL;
    const sent = this.turnSent;
    if (sent && sent.dir === this.dir && this.tick - sent.tick < CLIENT_TUNING.stick.turnRetryTicks) return STILL;
    this.turnSent = { dir: this.dir, tick: this.tick };
    return v;
  }

  /** The ring's centre and radius on screen. */
  private centre(): { x: number; y: number; radius: number } {
    const r = this.ring.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, radius: r.width / 2 };
  }

  private track(px: number, py: number): void {
    const t = CLIENT_TUNING.stick;
    const { x, y, radius } = this.centre();
    const dx = px - x;
    const dy = py - y;
    const dist = Math.hypot(dx, dy);
    // The knob stays on the rim when the thumb strays outside.
    const travel = radius - this.knob.offsetWidth / 2;
    const shown = dist > travel ? travel / dist : 1;
    this.knob.style.transform = `translate(${dx * shown}px,${dy * shown}px)`;
    if (dist < t.deadZonePx) this.setDir(null, false, null);
    else {
      const dir = pickDir(dx, dy, this.dir, t.switchBias);
      const walking = dist > radius * t.turnShare;
      this.setDir(dir, walking, walking ? diagonalSide(dx, dy, dir, t.diagonalHalfDeg) : null);
    }
  }

  private setDir(dir: Dir | null, walking: boolean, side: Dir | null): void {
    for (const d of Object.keys(this.arrows) as Dir[]) this.arrows[d].classList.toggle("on", d === dir || d === side);
    this.dir = dir;
    this.side = side;
    this.walking = walking;
    this.knob.classList.toggle("walk", walking);
  }

  dispose(): void {
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

/**
 * The second direction of a diagonal push: the other axis, when the push
 * lies within `halfDeg` of a 45-degree line. Null for a push close to
 * `dir`'s own axis.
 */
export function diagonalSide(dx: number, dy: number, dir: Dir, halfDeg: number): Dir | null {
  const horizontal = dir === "east" || dir === "west";
  const major = Math.abs(horizontal ? dx : dy);
  const minor = horizontal ? dy : dx;
  if (Math.abs(minor) < major * Math.tan(((45 - halfDeg) * Math.PI) / 180)) return null;
  if (horizontal) return minor > 0 ? "south" : "north";
  return minor > 0 ? "east" : "west";
}
