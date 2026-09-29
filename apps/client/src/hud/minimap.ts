import type { MapGrid, SimulationState } from "@supermaze/sim";
import { minimapDots } from "./minimapModel.js";
import { towerGeometry } from "../render/tower.js";
import { CLIENT_TUNING } from "../tuning.js";

const CSS = `
.mm{position:fixed;left:max(12px,env(safe-area-inset-left));bottom:calc(max(var(--dpad-pad,18px),env(safe-area-inset-bottom)) + var(--dpad-size,150px) + 10px);background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.25);border-radius:10px;padding:4px;pointer-events:none}
.mm canvas{display:block;image-rendering:pixelated;width:calc(var(--mm-box) * var(--mm-wide));height:auto}
`;

/**
 * Minimap (CLAUDE.md section 7): the map's outline, the tower, and a dot for
 * every player. The same picture in the maze and on the tower top; it never
 * shows the layout, keys, boxes or switches.
 */
export class Minimap {
  private readonly wrap: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cell: number;
  private readonly tower: { x: number; z: number; w: number; d: number };
  private lastKey = "";

  constructor(parent: HTMLElement, private readonly grid: MapGrid) {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    this.wrap = document.createElement("div");
    this.wrap.className = "mm";
    this.canvas = document.createElement("canvas");
    const t = CLIENT_TUNING.minimap;
    const longest = Math.max(grid.width, grid.height);
    this.cell = Math.max(3, Math.floor(t.boxPx / longest));
    this.canvas.width = grid.width * this.cell * 2;
    this.canvas.height = grid.height * this.cell * 2;
    // Fixed footprint whatever the map: the longer side of the map always spans the
    // same box, the shorter side scales with the aspect ratio. A bigger or rotated
    // map only gets smaller cells, never a bigger minimap.
    this.wrap.style.setProperty("--mm-box", `min(${t.boxPx}px, ${t.maxVh}vh)`);
    this.wrap.style.setProperty("--mm-wide", String(grid.width / longest));
    this.canvas.style.aspectRatio = `${grid.width} / ${grid.height}`;
    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.scale(2, 2);
    const tg = towerGeometry(grid);
    this.tower = { x: tg.center.x, z: tg.center.z, w: tg.footW, d: tg.footD };
    this.wrap.appendChild(this.canvas);
    parent.appendChild(this.wrap);
  }

  update(state: SimulationState, meId: string | null): void {
    const dots = minimapDots(state, meId);
    const key = dots.map((d) => `${d.id}:${d.x},${d.y},${d.onTower ? 1 : 0},${d.color}`).join(";");
    if (key === this.lastKey) return;
    this.lastKey = key;

    const c = this.cell;
    const ctx = this.ctx;
    const W = this.grid.width * c;
    const H = this.grid.height * c;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,255,255,.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    ctx.fillStyle = "#d9534f";
    ctx.fillRect((this.tower.x - this.tower.w / 2 + 0.5) * c, (this.tower.z - this.tower.d / 2 + 0.5) * c, this.tower.w * c, this.tower.d * c);

    const t = CLIENT_TUNING.minimap;
    for (const d of dots) {
      // Your own dot is bigger and ringed in white, so you find yourself among team-mates of the same colour.
      const r = c * (d.self ? t.selfDot : t.otherDot) * (d.onTower ? t.towerDotScale : 1);
      dot(ctx, d.x * c + c / 2, d.y * c + c / 2, r, d.color, d.self ? "#ffffff" : "rgba(0,0,0,.6)");
    }
  }

  dispose(): void {
    this.wrap.remove();
  }
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, rim: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rim;
  ctx.lineWidth = 1;
  ctx.stroke();
}
