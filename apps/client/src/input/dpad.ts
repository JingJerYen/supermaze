import type { MoveIntent } from "@supermaze/sim";
import { CLIENT_TUNING } from "../tuning.js";

type Dir = "north" | "east" | "south" | "west";
const DIRS: Dir[] = ["north", "east", "south", "west"];
const VECTORS: Record<Dir, MoveIntent> = {
  north: { moveX: 0, moveY: -1 },
  east: { moveX: 1, moveY: 0 },
  south: { moveX: 0, moveY: 1 },
  west: { moveX: -1, moveY: 0 },
};
const STILL: MoveIntent = { moveX: 0, moveY: 0 };

const CSS = `
.dpad{position:fixed;z-index:5;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;
  left:max(var(--dpad-pad),env(safe-area-inset-left));bottom:max(var(--dpad-pad),env(safe-area-inset-bottom));
  width:var(--dpad-size);height:var(--dpad-size);opacity:var(--dpad-opacity)}
@media (hover:hover) and (pointer:fine){.dpad{opacity:var(--dpad-opacity-desktop)}}
.dpad-key{position:absolute;width:33.34%;height:33.34%;border-radius:22%;background:rgba(255,255,255,.14);border:2px solid rgba(255,255,255,.45);
  display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.85);font-size:calc(var(--dpad-size) * .13);line-height:1;pointer-events:none}
.dpad-key.on{background:rgba(255,255,255,.55);color:#222;border-color:#fff}
.dpad-key.north{left:33.33%;top:0}
.dpad-key.east{left:66.66%;top:33.33%;transform:rotate(90deg)}
.dpad-key.south{left:33.33%;top:66.66%;transform:rotate(180deg)}
.dpad-key.west{left:0;top:33.33%;transform:rotate(-90deg)}
.dpad-hub{position:absolute;left:33.33%;top:33.33%;width:33.34%;height:33.34%;border-radius:50%;background:rgba(255,255,255,.08);pointer-events:none}
`;

/**
 * Fixed four-way pad in the bottom-left corner, Game Boy style, replacing the
 * floating stick (2026-09-26). Since 2026-10-02 the joystick in the same
 * corner (`stick.ts`) is the default; the settings page offers this pad. The sim only ever wants one of four directions,
 * so the pad emits -1/0/1 per axis: a tap turns the player, a hold walks.
 *
 * The whole cross is one pointer-capture surface: the direction is whichever
 * arm the finger is nearest to, re-evaluated on every move, so sliding from
 * "up" to "right" without lifting changes direction with no gap. Only the
 * first pointer on the pad counts; a second finger is free for the action
 * button. Works with the mouse on desktop too.
 */
export class DpadInput {
  private readonly root: HTMLDivElement;
  private readonly keys = {} as Record<Dir, HTMLDivElement>;
  private pointerId: number | null = null;
  private dir: Dir | null = null;

  constructor(parent: HTMLElement) {
    const t = CLIENT_TUNING.dpad;
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    this.root = document.createElement("div");
    this.root.className = "dpad";
    // On the document root so other overlays (the minimap) can stay clear of the pad.
    document.documentElement.style.setProperty("--dpad-size", `min(${t.sizePx}px, ${t.maxHeightVh}vh)`);
    document.documentElement.style.setProperty("--dpad-pad", `${t.marginPx}px`);
    this.root.style.setProperty("--dpad-opacity", String(t.opacity));
    this.root.style.setProperty("--dpad-opacity-desktop", String(t.opacityDesktop));
    const hub = document.createElement("div");
    hub.className = "dpad-hub";
    this.root.appendChild(hub);
    for (const d of DIRS) {
      const k = document.createElement("div");
      k.className = `dpad-key ${d}`;
      k.textContent = "▲";
      this.root.appendChild(k);
      this.keys[d] = k;
    }
    parent.appendChild(this.root);

    this.root.addEventListener("pointerdown", (e) => {
      if (this.pointerId !== null) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      this.pointerId = e.pointerId;
      this.root.setPointerCapture(e.pointerId);
      this.setDir(this.dirAt(e.clientX, e.clientY));
    });
    this.root.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.pointerId) return;
      this.setDir(this.dirAt(e.clientX, e.clientY));
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.setDir(null);
    };
    this.root.addEventListener("pointerup", release);
    this.root.addEventListener("pointercancel", release);
    this.root.addEventListener("lostpointercapture", release);
  }

  /** True while a finger (or the mouse button) is down on the pad. */
  get active(): boolean {
    return this.pointerId !== null;
  }

  read(): MoveIntent {
    return this.dir ? VECTORS[this.dir] : STILL;
  }

  /** Nearest arm to the point, or null inside the hub dead zone. */
  private dirAt(clientX: number, clientY: number): Dir | null {
    const r = this.root.getBoundingClientRect();
    const dx = clientX - (r.left + r.width / 2);
    const dy = clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < CLIENT_TUNING.dpad.deadZonePx) return null;
    if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "east" : "west";
    return dy > 0 ? "south" : "north";
  }

  private setDir(dir: Dir | null): void {
    if (dir === this.dir) return;
    if (this.dir) this.keys[this.dir].classList.remove("on");
    if (dir) this.keys[dir].classList.add("on");
    this.dir = dir;
  }

  dispose(): void {
    this.root.remove();
  }
}
