import * as THREE from "three";
import type { MapGrid, MoverState, PlayerState } from "@supermaze/sim";
import { climbPhase, climbTotalSec, faceOf, type Face } from "./climbSequence.js";
import { PlayerView } from "./playerView.js";
import { spreadTargets } from "./spread.js";
import { TEAM_COLORS, teamColorIndex } from "./teamColors.js";
import { CLIENT_TUNING } from "../tuning.js";

const EMPTY: ReadonlySet<string> = new Set();

/** Owns one PlayerView per player id, creating and removing them as snapshots change. */
export class PlayerViews {
  private readonly views = new Map<string, PlayerView>();
  /** Eased on-screen offset of each player from the separation pass. */
  private readonly spread = new Map<string, { x: number; z: number }>();
  private lastTick = -1;
  /**
   * Seconds of drawn frames. Climbs are timed on this clock, not on ticks: the
   * simulation stops ticking once the round ends, and a climb that ends the
   * round must still play out.
   */
  private clockSec = 0;
  /** Climbs being animated: where the player stood, which face, and when it began. */
  private readonly climbs = new Map<string, { face: Face; from: { x: number; y: number }; startSec: number }>();
  private towerCenter = { x: 0, z: 0 };

  /** Needed to turn tiles into tower faces. */
  configure(towerCenter: { x: number; z: number }): void {
    this.towerCenter = towerCenter;
  }

  /** Climbs in progress for the tower animation, with seconds elapsed. */
  activeClimbs(): { face: Face; t: number }[] {
    const out: { face: Face; t: number }[] = [];
    for (const c of this.climbs.values()) out.push({ face: c.face, t: this.clockSec - c.startSec });
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
    nudge: { x: number; y: number } | null = null,
  ): void {
    const newTick = tick !== this.lastTick;
    // Ticks going back means a new round (or a rules demo starting over): drop leftover climbs.
    if (tick < this.lastTick) this.climbs.clear();
    this.lastTick = tick;
    this.clockSec += dtSec;
    for (const [id, p] of Object.entries(to)) {
      const view = this.views.get(id) ?? this.create(id, p.teamId);
      if (newTick) triggerOneShots(view, from[id], p);
      const prevState = from[id];
      if (newTick && prevState && prevState.phase === "maze" && p.phase === "tower") {
        this.climbs.set(id, { face: faceOf(prevState.mover.from, this.towerCenter), from: prevState.mover.from, startSec: this.clockSec });
      }
      const climb = this.climbs.get(id);
      if (climb) {
        const t = this.clockSec - climb.startSec;
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
      if (nudge && id === meId) {
        // What is left of a corrected prediction, eased away by the mode (tile y is world z).
        view.mesh.position.x += nudge.x;
        view.mesh.position.z += nudge.y;
      }
      view.setSelfMarker(id === meId && p.phase === "maze");
      view.setGhost(ghostIds.has(id));
    }
    for (const [id, view] of this.views) {
      if (!to[id]) {
        this.scene.remove(view.mesh);
        this.views.delete(id);
      }
    }
    separate(this.views, to, this.spread, dtSec);
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
 * Visual-only separation: the offsets from `spreadTargets`, eased over time so
 * joining, leaving and passing by never pop. The simulation is never touched.
 */
function separate(views: Map<string, PlayerView>, to: Record<string, PlayerState>, eased: Map<string, { x: number; z: number }>, dtSec: number): void {
  const t = CLIENT_TUNING.separation;
  const ids = Object.keys(to).filter((id) => to[id]!.phase === "maze" && views.get(id)?.mesh.visible);
  const target = spreadTargets(
    ids.map((id) => {
      const p = views.get(id)!.mesh.position;
      return { id, x: p.x, y: p.y, z: p.z };
    }),
    t,
  );
  const k = 1 - Math.exp(-t.easePerSec * dtSec);
  for (const id of ids) {
    const want = target.get(id) ?? { x: 0, z: 0 };
    const now = eased.get(id) ?? { x: 0, z: 0 };
    now.x += (want.x - now.x) * k;
    now.z += (want.z - now.z) * k;
    eased.set(id, now);
    const pos = views.get(id)!.mesh.position;
    pos.x += now.x;
    pos.z += now.z;
  }
  for (const id of eased.keys()) if (!ids.includes(id)) eased.delete(id);
}

/** Play short animations for things that happened between two consecutive states. */
function triggerOneShots(view: PlayerView, prev: PlayerState | undefined, curr: PlayerState): void {
  if (!prev) return;
  const usedOldest = curr.items.length === prev.items.length - 1 && curr.items.every((k, i) => k === prev.items[i + 1]);
  if (usedOldest && prev.items[0] === "hammer") view.swingHammer();
  else if ((prev.keyId === null && curr.keyId !== null) || curr.items.length > prev.items.length) view.pickUp();
}
