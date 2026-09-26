import * as THREE from "three";
import type { MapGrid, MoverState, PlayerState } from "@supermaze/sim";
import { towerGeometry } from "./mapMesh.js";
import { PlayerView } from "./playerView.js";
import { TEAM_COLORS, teamColorIndex } from "./teamColors.js";

/** Owns one PlayerView per player id, creating and removing them as snapshots change. */
export class PlayerViews {
  private readonly views = new Map<string, PlayerView>();

  private readonly tower: ReturnType<typeof towerGeometry>;

  constructor(private readonly scene: THREE.Scene, private readonly grid: MapGrid) {
    this.tower = towerGeometry(grid);
  }

  /** Draw every player in `to`, blending from its state in `from` when present. */
  update(from: Record<string, PlayerState>, to: Record<string, PlayerState>, alpha: number, tick: number): void {
    for (const [id, p] of Object.entries(to)) {
      const view = this.views.get(id) ?? this.create(id, p.teamId);
      if (p.phase === "tower") {
        view.placeOnTower(this.tower.center, this.tower.platformTopY, p.towerArrival ?? 0);
        continue;
      }
      let prev: MoverState = from[id]?.mover ?? p.mover;
      // A teleport jumps across the map; do not slide through the walls to get there.
      if (Math.abs(prev.from.x - p.mover.from.x) + Math.abs(prev.from.y - p.mover.from.y) > 1.5) prev = p.mover;
      view.update(this.grid, prev, p.mover, alpha);
      view.setFacing(p.mover.facing);
      view.setFrozen(p.frozenUntilTick > tick);
    }
    for (const [id, view] of this.views) {
      if (!to[id]) {
        this.scene.remove(view.mesh);
        this.views.delete(id);
      }
    }
  }

  position(id: string): THREE.Vector3 | null {
    return this.views.get(id)?.mesh.position ?? null;
  }

  private create(id: string, teamId: string): PlayerView {
    const view = new PlayerView(TEAM_COLORS[teamColorIndex(teamId) % TEAM_COLORS.length] as number);
    this.scene.add(view.mesh);
    this.views.set(id, view);
    return view;
  }
}
