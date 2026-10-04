import type * as THREE from "three";
import { rotateMap, SeededRandom, SKILL_KINDS, type SimEvent, type SimulationState, type SkillKind } from "@supermaze/sim";
import type { ResultsActions } from "../hud/results.js";
import { t } from "../i18n/index.js";
import { MAPS } from "../maps.js";
import { Match } from "../match.js";
import { isPremium } from "../monetize/premium.js";
import { loadProfile } from "../profile.js";
import { FloorPrep } from "./floorPrep.js";
import { createLocalMode } from "./local.js";

const PLAYER_ID = "local"; // createLocalMode's id for you

/**
 * The maps a night is played on: easy ones with few dead ends and no fixture
 * that could shut the player in, so there is always a way round a ghost
 * (CLAUDE.md section 4.4).
 */
export const NIGHT_MAPS = ["maze-20", "maze-02", "maze-18", "maze-11"];

/** Ghosts still in the maze. */
export function ghostsLeft(state: SimulationState): number {
  return Object.values(state.players).filter((p) => p.monster).length;
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
      { title: t("modes.night.title"), lines: [t("modes.night.goal", n), t("modes.night.howTo")], start: t("modes.night.start") },
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
    const map = MAPS[rng.pick(NIGHT_MAPS)] ?? Object.values(MAPS)[0]!;
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
    return left > 0 ? t("modes.night.caption", { n: left, lives: "❤️".repeat(lives) || "—" }) : t("modes.night.captionClear", { lives: "❤️".repeat(lives) || "—" });
  }

  /** Big notices for the moments that matter: a ghost gone, dawn, the key, a life lost. */
  private notice(prev: SimulationState, next: SimulationState, events: readonly SimEvent[]): void {
    this.current = next;
    const banished = events.filter((e) => e.type === "ghostBanished");
    if (banished.some((e) => e.type === "ghostBanished" && e.by === "light")) this.notices.push(t("modes.night.dawn"));
    else if (banished.length > 0) this.notices.push(t("modes.night.banished", { n: ghostsLeft(next) }));
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
