import * as THREE from "three";
import { CLIENT_TUNING } from "../tuning.js";
import type { CharacterPreview } from "./characterPreview.js";
import { Confetti } from "./confetti.js";

interface Move {
  clip: string;
  weight: number;
  /** Lift at the top of the move (hops), world units. */
  hop?: number;
  /** A full turn in the air. */
  flip?: boolean;
  /** Loop the clip for this long instead of playing it once. */
  loopSec?: number;
  /** Stay in the clip's last pose this long before going back to idle. */
  holdSec?: number;
}

const T = CLIENT_TUNING.show;
/** The repertoire, from the character model's own clips; weights set how often each comes up. */
const MOVES: Move[] = [
  { clip: "emote-yes", weight: 3 },
  { clip: "emote-no", weight: 1 },
  { clip: "jump", weight: 2, hop: T.hop },
  { clip: "jump", weight: 1.2, hop: T.flipHop, flip: true },
  { clip: "attack-kick-right", weight: 1.5 },
  { clip: "attack-kick-left", weight: 1 },
  { clip: "attack-melee-right", weight: 1.5 },
  { clip: "attack-melee-left", weight: 1 },
  { clip: "sprint", weight: 1.5, loopSec: T.runSec },
  { clip: "pick-up", weight: 1 },
  { clip: "interact-right", weight: 1 },
  { clip: "die", weight: 0.6, holdSec: T.playDeadSec },
];
const CHEER = MOVES[0]!;
const FLIP = MOVES[3]!;

/**
 * The achievements page's character: instead of turning on the spot it goes
 * through a routine of the model's own moves (cheers, hops, flips, kicks,
 * running on the spot, playing dead), glancing around between them. A tap
 * starts a move at once; `celebrate` throws confetti and flips for joy.
 * Purely for show.
 */
export class ShowRoutine {
  private act: { move: Move; action: THREE.AnimationAction; t: number; dur: number } | null = null;
  private pause = 1.2;
  private yaw = 0;
  private yawTarget = 0;
  private queue: Move[] = [];
  private readonly confetti: Confetti;

  constructor(private readonly preview: CharacterPreview) {
    this.confetti = new Confetti(preview.scene);
    preview.setDirector((dt) => this.update(dt));
    // The hello wave from show() may still be playing: it counts as the first move, so it ends the same way.
    const wave = preview.current?.clip(CHEER.clip);
    if (wave?.isRunning()) this.act = { move: CHEER, action: wave, t: wave.time, dur: wave.getClip().duration };
  }

  dispose(): void {
    this.preview.setDirector(null);
    this.confetti.dispose();
  }

  /** Do something now (a tap on the character). */
  poke(): void {
    if (this.act && this.act.t < 0.4) return;
    this.start(pick());
  }

  /** New achievements: confetti, a flip and a cheer. */
  celebrate(): void {
    this.confetti.burst(new THREE.Vector3(0, 1.4, 0));
    this.queue = [CHEER];
    this.start(FLIP);
  }

  private update(dt: number): void {
    this.confetti.update(dt);
    const holder = this.preview.holder;
    const act = this.act;
    if (act) {
      act.t += dt;
      const k = Math.min(act.t / act.dur, 1);
      holder.position.y = act.move.hop ? act.move.hop * Math.sin(Math.PI * Math.min(act.t / clipLength(act), 1)) : 0;
      holder.rotation.y = this.yaw + (act.move.flip ? Math.PI * 2 * smooth(Math.min(act.t / clipLength(act), 1)) : 0);
      if (k >= 1) this.finish();
      return;
    }
    // Between moves: look around a little.
    this.yaw += (this.yawTarget - this.yaw) * Math.min(1, dt * 3);
    holder.rotation.y = this.yaw;
    holder.position.y = 0;
    this.pause -= dt;
    if (this.pause <= 0) this.start(this.queue.shift() ?? pick());
  }

  private start(move: Move): void {
    const rig = this.preview.current;
    const action = rig?.clip(move.clip);
    if (!rig || !action) return;
    if (this.act) this.act.action.fadeOut(T.fadeSec);
    rig.idle?.fadeOut(T.fadeSec);
    action.reset();
    action.setLoop(move.loopSec ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = true;
    action.fadeIn(T.fadeSec).play();
    this.yawTarget = 0;
    const length = action.getClip().duration;
    this.act = { move, action, t: 0, dur: (move.loopSec ?? length) + (move.holdSec ?? 0) };
  }

  private finish(): void {
    const rig = this.preview.current;
    this.act?.action.fadeOut(T.fadeSec * 1.5);
    rig?.idle?.reset().fadeIn(T.fadeSec * 1.5).play();
    this.act = null;
    if (this.queue.length > 0) {
      this.pause = 0.15;
      return;
    }
    this.pause = T.pauseMinSec + Math.random() * (T.pauseMaxSec - T.pauseMinSec);
    this.yawTarget = (Math.random() * 2 - 1) * T.lookYaw;
  }
}

function pick(): Move {
  let r = Math.random() * MOVES.reduce((sum, m) => sum + m.weight, 0);
  for (const m of MOVES) if ((r -= m.weight) <= 0) return m;
  return CHEER;
}

function clipLength(act: { action: THREE.AnimationAction; dur: number }): number {
  return Math.max(0.2, Math.min(act.action.getClip().duration, act.dur));
}

function smooth(x: number): number {
  return x * x * (3 - 2 * x);
}
