import * as THREE from "three";
import type { MapGrid, MoverState, PlayerState } from "@supermaze/sim";
import { climbPhase, climbTotalSec, faceOf, type Face } from "./climbSequence.js";
import { PlayerView } from "./playerView.js";
import { TEAM_COLORS, teamColorIndex } from "./teamColors.js";
import { CLIENT_TUNING } from "../tuning.js";

const EMPTY: ReadonlySet<string> = new Set();

/** Owns one PlayerView per player id, creating and removing them as snapshots change. */
export class PlayerViews {
  private readonly views = new Map<string, PlayerView>();
  private lastTick = -1;
  /** Climbs being animated: where the player stood, which face, and when it began. */
  private readonly climbs = new Map<string, { face: Face; from: { x: number; y: number }; startTick: number }>();
  private tickRate = 20;
  private towerCenter = { x: 0, z: 0 };

  /** Needed to turn ticks into seconds and tiles into faces. */
  configure(tickRate: number, towerCenter: { x: number; z: number }): void {
    this.tickRate = tickRate;
    this.towerCenter = towerCenter;
  }

  /** Climbs in progress for the tower animation, with seconds elapsed. */
  activeClimbs(tick: number): { face: Face; t: number }[] {
    const out: { face: Face; t: number }[] = [];
    for (const c of this.climbs.values()) out.push({ face: c.face, t: (tick - c.startTick) / this.tickRate });
    return out;
  }

  constructor(private readonly scene: THREE.Scene, private readonly grid: MapGrid) {}

  /** Draw every player in `to`, blending from its state in `from` when present. */
  update(
    from: Record<string, PlayerState>,
    to: Record<string, PlayerState>,
    alpha: number,
    tick: number,
    dtSec: number,
    meId: string | null = null,
    ghostIds: ReadonlySet<string> = EMPTY,
  ): void {
    const newTick = tick !== this.lastTick;
    this.lastTick = tick;
    for (const [id, p] of Object.entries(to)) {
      const view = this.views.get(id) ?? this.create(id, p.teamId);
      if (newTick) triggerOneShots(view, from[id], p);
      const prevState = from[id];
      if (newTick && prevState && prevState.phase === "maze" && p.phase === "tower") {
        this.climbs.set(id, { face: faceOf(prevState.mover.from, this.towerCenter), from: prevState.mover.from, startTick: tick });
      }
      const climb = this.climbs.get(id);
      if (climb) {
        const t = (tick - climb.startTick) / this.tickRate;
        if (t >= climbTotalSec()) {
          this.climbs.delete(id);
        } else {
          const ph = climbPhase(t);
          // Walk from the entry tile one tile toward the tower, then vanish inside until the ascent ends.
          const dir = { x: this.towerCenter.x - climb.from.x, z: this.towerCenter.z - climb.from.y };
          const len = Math.hypot(dir.x, dir.z) || 1;
          const step = Math.min(ph.walkIn, 1) * 0.95;
          view.setGhostPose(climb.from.x + (dir.x / len) * step, climb.from.y + (dir.z / len) * step, ph.walkIn < 1, dtSec);
          view.setFacing({ dx: Math.sign(Math.round(dir.x)), dy: Math.sign(Math.round(dir.z)) });
          view.setVisible(ph.walkIn < 1);
          continue;
        }
      }
      view.setVisible(true);
      let prev: MoverState = from[id]?.mover ?? p.mover;
      // A teleport jumps across the map; do not slide through the walls to get there.
      if (Math.abs(prev.from.x - p.mover.from.x) + Math.abs(prev.from.y - p.mover.from.y) > 1.5) prev = p.mover;
      view.update(this.grid, prev, p.mover, alpha, dtSec);
      view.setFacing(p.mover.facing);
      view.setFrozen(p.frozenUntilTick > tick);
      view.setCaged(p.frozenUntilTick > tick && p.frozenBy === "trap");
      view.setDowned(p.frozenUntilTick > tick && p.frozenBy === "ghost");
      view.setSelfMarker(id === meId && p.phase === "maze");
      view.setGhost(ghostIds.has(id));
    }
    for (const [id, view] of this.views) {
      if (!to[id]) {
        this.scene.remove(view.mesh);
        this.views.delete(id);
      }
    }
    separate(this.views, to);
  }

  position(id: string): THREE.Vector3 | null {
    return this.views.get(id)?.mesh.position ?? null;
  }

  private create(id: string, teamId: string): PlayerView {
    const view = new PlayerView(id, TEAM_COLORS[teamColorIndex(teamId) % TEAM_COLORS.length] as number);
    this.scene.add(view.mesh);
    this.views.set(id, view);
    return view;
  }
}

/**
 * Visual-only separation: characters standing on or walking through each other
 * are pushed apart on screen, growing smoothly from nothing at `radius` to half
 * the radius each when exactly overlapping, so nobody pops. Recomputed from the
 * interpolated positions every frame; the simulation is untouched.
 */
function separate(views: Map<string, PlayerView>, to: Record<string, PlayerState>): void {
  const R = CLIENT_TUNING.separation.radius;
  const ids = Object.keys(to)
    .filter((id) => to[id]!.phase === "maze" && views.get(id)?.mesh.visible)
    .sort();
  if (ids.length < 2) return;
  const push = new Map<string, { x: number; z: number }>();
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = views.get(ids[i]!)!.mesh.position;
      const b = views.get(ids[j]!)!.mesh.position;
      let dx = b.x - a.x;
      let dz = b.z - a.z;
      const d = Math.hypot(dx, b.y - a.y, dz);
      if (d >= R) continue;
      if (Math.hypot(dx, dz) < 1e-4) {
        dx = 1; // exactly on top of each other (spawn): split along x, lower id to the west
        dz = 0;
      } else {
        const h = Math.hypot(dx, dz);
        dx /= h;
        dz /= h;
      }
      const s = (R - d) / 2;
      const pa = push.get(ids[i]!) ?? { x: 0, z: 0 };
      const pb = push.get(ids[j]!) ?? { x: 0, z: 0 };
      pa.x -= dx * s; pa.z -= dz * s;
      pb.x += dx * s; pb.z += dz * s;
      push.set(ids[i]!, pa);
      push.set(ids[j]!, pb);
    }
  }
  for (const [id, p] of push) {
    const pos = views.get(id)!.mesh.position;
    pos.x += p.x;
    pos.z += p.z;
  }
}

/** Play short animations for things that happened between two consecutive states. */
function triggerOneShots(view: PlayerView, prev: PlayerState | undefined, curr: PlayerState): void {
  if (!prev) return;
  const usedOldest = curr.items.length === prev.items.length - 1 && curr.items.every((k, i) => k === prev.items[i + 1]);
  if (usedOldest && prev.items[0] === "hammer") view.swingHammer();
  else if ((prev.keyId === null && curr.keyId !== null) || curr.items.length > prev.items.length) view.pickUp();
}
