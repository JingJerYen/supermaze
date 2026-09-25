import * as THREE from "three";
import type { MapGrid, MoverState, PlayerState } from "@supermaze/sim";
import { PlayerView } from "./playerView.js";

const TEAM_COLORS = [0xffb347, 0x5ec8ff, 0x8bff7a, 0xff7ad9, 0xfff17a, 0xc79aff, 0xff8a5c, 0x7affd6];

/** Owns one PlayerView per player id, creating and removing them as snapshots change. */
export class PlayerViews {
  private readonly views = new Map<string, PlayerView>();
  private readonly teamIndex = new Map<string, number>();

  constructor(private readonly scene: THREE.Scene, private readonly grid: MapGrid) {}

  /** Draw every player in `to`, blending from its state in `from` when present. */
  update(from: Record<string, PlayerState>, to: Record<string, PlayerState>, alpha: number): void {
    for (const [id, p] of Object.entries(to)) {
      const view = this.views.get(id) ?? this.create(id, p.teamId);
      const prev: MoverState = from[id]?.mover ?? p.mover;
      view.update(this.grid, prev, p.mover, alpha);
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
    let idx = this.teamIndex.get(teamId);
    if (idx === undefined) {
      idx = this.teamIndex.size;
      this.teamIndex.set(teamId, idx);
    }
    const view = new PlayerView(TEAM_COLORS[idx % TEAM_COLORS.length] as number);
    this.scene.add(view.mesh);
    this.views.set(id, view);
    return view;
  }
}
