import type { MapGrid, SimulationState } from "@supermaze/sim";
import { TEAM_COLORS, teamColorIndex } from "../render/teamColors.js";
import { towerGeometry } from "../render/mapMesh.js";
import { CLIENT_TUNING } from "../tuning.js";

const CSS = `
.mm{position:fixed;left:max(12px,env(safe-area-inset-left));bottom:var(--mm-bottom);background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.25);border-radius:10px;padding:4px;pointer-events:none}
.mm canvas{display:block;image-rendering:pixelated}
`;

/**
 * Minimap (CLAUDE.md section 7). In the maze it is deliberately bare: the map's
 * outline, your own dot and the tower icon, nothing else. On the tower top it
 * becomes the full layout with every player, matching the overview camera.
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
    // Sits just above the d-pad, whatever size the pad is tuned to.
    const d = CLIENT_TUNING.dpad;
    this.wrap.style.setProperty("--mm-bottom", `calc(max(${d.marginPx}px, env(safe-area-inset-bottom)) + ${d.sizePx + 12}px)`);
    this.canvas = document.createElement("canvas");
    this.cell = Math.max(3, Math.floor(150 / Math.max(grid.width, grid.height)));
    this.canvas.width = grid.width * this.cell * 2;
    this.canvas.height = grid.height * this.cell * 2;
    this.canvas.style.width = `${grid.width * this.cell}px`;
    this.canvas.style.height = `${grid.height * this.cell}px`;
    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.scale(2, 2);
    const tg = towerGeometry(grid);
    this.tower = { x: tg.center.x, z: tg.center.z, w: tg.footW, d: tg.footD };
    this.wrap.appendChild(this.canvas);
    parent.appendChild(this.wrap);
  }

  update(state: SimulationState, meId: string | null): void {
    const me = meId ? state.players[meId] : undefined;
    if (!me) return;
    const onTower = me.phase === "tower";
    const key = onTower
      ? `T|${Object.values(state.players).map((p) => `${p.id}:${p.mover.from.x},${p.mover.from.y},${p.phase}`).join(";")}|${state.lightsOn}`
      : `M|${me.mover.from.x},${me.mover.from.y}`;
    if (key === this.lastKey) return;
    this.lastKey = key;

    const c = this.cell;
    const ctx = this.ctx;
    const W = this.grid.width * c;
    const H = this.grid.height * c;
    ctx.clearRect(0, 0, W, H);

    if (onTower) {
      for (let y = 0; y < this.grid.height; y++) {
        for (let x = 0; x < this.grid.width; x++) {
          const kind = this.grid.kindAt(x, y);
          if (kind === "void") continue;
          ctx.fillStyle =
            kind === "wall" ? "#8e9bb3" : kind === "tower" ? "#d9534f" : kind === "stairs" ? "#c2a96a" : kind === "bridge" ? "#b08a5a" : "#3a4356";
          ctx.fillRect(x * c, y * c, c, c);
        }
      }
      ctx.fillStyle = "#9be7ff";
      for (const s of Object.values(state.switches)) {
        if (!s.used) ctx.fillRect(s.pos.x * c + c / 3, s.pos.y * c + c / 3, c / 3, c / 3);
      }
      for (const p of Object.values(state.players)) {
        if (p.phase === "tower") continue;
        const color = `#${(TEAM_COLORS[teamColorIndex(p.teamId) % TEAM_COLORS.length] as number).toString(16).padStart(6, "0")}`;
        dot(ctx, p.mover.from.x * c + c / 2, p.mover.from.y * c + c / 2, c * 0.4, color);
      }
      return;
    }

    // Maze view: outline, tower icon, own dot. No layout, no one else.
    ctx.strokeStyle = "rgba(255,255,255,.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    ctx.fillStyle = "#d9534f";
    ctx.fillRect((this.tower.x - this.tower.w / 2 + 0.5) * c, (this.tower.z - this.tower.d / 2 + 0.5) * c, this.tower.w * c, this.tower.d * c);
    dot(ctx, me.mover.from.x * c + c / 2, me.mover.from.y * c + c / 2, c * 0.5, "#ffffff");
  }

  dispose(): void {
    this.wrap.remove();
  }
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.6)";
  ctx.lineWidth = 1;
  ctx.stroke();
}
