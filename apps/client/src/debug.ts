/**
 * Always-on debug overlay. Exists before any gameplay so problems can be described
 * precisely ("fps drops to 30 when 4 players are visible") instead of "feels off".
 */
export interface DebugStats {
  fps: number;
  tick: number;
  objects: number;
  extra?: Record<string, string | number>;
}

export class DebugOverlay {
  private readonly el: HTMLDivElement;
  private frames = 0;
  private lastFpsSample = performance.now();
  private fps = 0;

  constructor(parent: HTMLElement) {
    this.el = document.createElement("div");
    Object.assign(this.el.style, {
      position: "fixed",
      top: "8px",
      left: "8px",
      padding: "6px 8px",
      font: "12px/1.4 monospace",
      color: "#cfe3ff",
      background: "rgba(0,0,0,0.55)",
      pointerEvents: "none",
      whiteSpace: "pre",
      zIndex: "10",
    } satisfies Partial<CSSStyleDeclaration>);
    parent.appendChild(this.el);
  }

  /** Call once per rendered frame. */
  frame(stats: Omit<DebugStats, "fps">): void {
    this.frames++;
    const now = performance.now();
    if (now - this.lastFpsSample >= 500) {
      this.fps = Math.round((this.frames * 1000) / (now - this.lastFpsSample));
      this.frames = 0;
      this.lastFpsSample = now;
    }
    const lines = [`fps ${this.fps}`, `tick ${stats.tick}`, `objects ${stats.objects}`];
    for (const [k, v] of Object.entries(stats.extra ?? {})) lines.push(`${k} ${v}`);
    this.el.textContent = lines.join("\n");
  }
}
