import type * as THREE from "three";
import { DEFAULT_TUNING, rotateMap, SeededRandom, SKILL_KINDS, type SimEvent, type SimulationState, type SkillKind } from "@supermaze/sim";
import type { ResultsActions } from "../hud/results.js";
import { t } from "../i18n/index.js";
import { NIGHT_POOL } from "../maps.js";
import { Match } from "../match.js";
import { isPremium } from "../monetize/premium.js";
import { loadProfile } from "../profile.js";
import { FloorPrep } from "./floorPrep.js";
import { createLocalMode } from "./local.js";

const PLAYER_ID = "local"; // createLocalMode's id for you

/** Ghosts still in the maze. */
export function ghostsLeft(state: SimulationState): number {
  return Object.values(state.players).filter((p) => p.monster).length;
}

/** Seconds the ghosts the lights knocked down still lie there; 0 when none is down. */
export function stunLeftSec(state: SimulationState, tickRate: number): number {
  const until = Math.max(0, ...Object.values(state.players).filter((p) => p.monster && p.frozenBy === "light").map((p) => p.frozenUntilTick));
  return Math.max(0, until - state.tick) / tickRate;
}

/**
 * Night parade (CLAUDE.md section 4.4), single round for now: the skill prep
 * screen (the same rules as a tower run floor: a random skill, or a pick
 * after an ad; two with the full version), the night itself, and the result.
 * The rules are the sim's `NightSimulation`; this class only plays it and
 * turns it into notices, a caption and result-screen text.
 */
export class NightRun {
  private match: Match | null = null;
  private prep: FloorPrep | null = null;
  private verdict: ResultsActions | null = null;
  private notices: string[] = [];
  private seed = 0;
  /** The round as of the last tick, for the caption. */
  private current: SimulationState | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly renderer: THREE.WebGLRenderer,
    private readonly onHome: () => void,
  ) {}

  start(): void {
    this.dispose();
    this.seed = Date.now() >>> 0;
    const n = { ghosts: 8, lives: 3 };
    this.prep = new FloorPrep(
      this.root,
      this.renderer,
      { title: t("modes.night.title"), lines: [t("modes.night.goal", n), t("modes.night.howTo", { sec: DEFAULT_TUNING.night.lightStunSec })], start: t("modes.night.start") },
      loadProfile(),
      new SeededRandom(this.seed).pick(SKILL_KINDS),
      isPremium(),
      (skills) => this.play(skills),
      () => this.quit(),
    );
  }

  dispose(): void {
    this.match?.dispose();
    this.match = null;
    this.prep?.dispose();
    this.prep = null;
  }

  private play(skills: SkillKind[]): void {
    this.dispose();
    const rng = new SeededRandom(this.seed ^ 0x9e3779b9);
    // The night maps (section 4.4): braided, so there is always a way round a ghost.
    const map = rng.pick(NIGHT_POOL);
    const profile = loadProfile();
    this.verdict = null;
    this.notices = [];
    const mode = createLocalMode(rotateMap(map, rng.nextInt(0, 3) as 0 | 1 | 2 | 3), {
      seed: this.seed,
      name: profile.name,
      character: profile.character,
      skill: skills[0] ?? null,
      skill2: skills[1] ?? null,
      night: { ghostName: t("modes.night.ghost") },
      onStep: (prev, next, events) => this.notice(prev, next, events),
      notices: () => this.notices.splice(0),
      onFinish: (state) => this.finish(state),
      results: () => this.verdict ?? { endsAt: null, buttons: [] },
      caption: () => this.caption(),
      onHome: () => this.quit(),
    });
    this.current = null;
    this.match = new Match(this.root, this.renderer, mode);
  }

  /** Under the clock: ghosts left and lives. */
  private caption(): string | null {
    const s = this.current;
    if (!s) return null;
    const me = s.players[PLAYER_ID];
    const lives = me?.lives ?? 0;
    const left = ghostsLeft(s);
    const hearts = "❤️".repeat(lives) || "—";
    if (left === 0) return t("modes.night.captionClear", { lives: hearts });
    const down = Math.ceil(stunLeftSec(s, DEFAULT_TUNING.tickRate));
    return down > 0 ? t("modes.night.captionStunned", { n: left, sec: down, lives: hearts }) : t("modes.night.caption", { n: left, lives: hearts });
  }

  /** Big notices for the moments that matter: a ghost gone, the lights, the ghosts back up, the key, a life lost. */
  private notice(prev: SimulationState, next: SimulationState, events: readonly SimEvent[]): void {
    this.current = next;
    const tickRate = DEFAULT_TUNING.tickRate;
    if (events.some((e) => e.type === "ghostsStunned")) {
      this.notices.push(t("modes.night.dawn", { sec: DEFAULT_TUNING.night.lightStunSec }));
    }
    if (events.some((e) => e.type === "ghostBanished")) this.notices.push(t("modes.night.banished", { n: ghostsLeft(next) }));
    if (stunLeftSec(prev, tickRate) > 0 && stunLeftSec(next, tickRate) === 0 && ghostsLeft(next) > 0) this.notices.push(t("modes.night.awake"));
    if (ghostsLeft(next) === 0 && ghostsLeft(prev) > 0) this.notices.push(t("modes.night.allGone"));
    const me = next.players[PLAYER_ID];
    const before = prev.players[PLAYER_ID];
    if (me && before && me.keyId !== null && before.keyId === null && ghostsLeft(next) > 0) this.notices.push(t("modes.night.keyLocked"));
    if (me && before && me.lives !== undefined && before.lives !== undefined && me.lives < before.lives && me.lives > 0) {
      this.notices.push(t("modes.night.lifeLost", { lives: me.lives }));
    }
  }

  private finish(state: SimulationState): void {
    const me = state.players[PLAYER_ID];
    const reason = state.result?.reason;
    const cleared = reason === "night:cleared";
    const lines = [t("modes.night.score", { score: state.result?.finalScores[PLAYER_ID] ?? me?.score ?? 0 })];
    if (!cleared) lines.push(t("modes.night.ghostsLeft", { n: ghostsLeft(state) }));
    this.verdict = {
      endsAt: null,
      title: { text: t(cleared ? "modes.tower.success" : "modes.tower.failure"), tone: cleared ? "pass" : "fail" },
      note: {
        title: t(cleared ? "modes.night.cleared" : reason === "night:caught" ? "modes.night.caught" : "modes.night.timeout"),
        tone: cleared ? "pass" : "fail",
        lines,
      },
      buttons: [
        { label: t("modes.tower.home"), back: true, run: () => this.quit() },
        { label: t("modes.night.again"), primary: true, run: () => this.start() },
      ],
    };
  }

  private quit(): void {
    this.dispose();
    this.onHome();
  }
}
