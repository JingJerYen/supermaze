import type * as THREE from "three";
import {
  canContinue,
  continueRun,
  DEFAULT_TUNING,
  judgeFloor,
  planFloor,
  recordFloor,
  rotateMap,
  SeededRandom,
  SKILL_KINDS,
  startTowerRun,
  type FloorPlan,
  type SimulationState,
  type SkillKind,
  type TowerRunState,
} from "@supermaze/sim";
import type { ResultsActions } from "../hud/results.js";
import { MAP_POOL } from "../maps.js";
import { Match } from "../match.js";
import { showRewardedAd } from "../monetize/ads.js";
import { isPremium } from "../monetize/premium.js";
import { loadProfile } from "../profile.js";
import { FloorPrep } from "./floorPrep.js";
import { FloorSelect } from "./floorSelect.js";
import { createLocalMode } from "./local.js";
import { loadReachedFloor, loadTowerBest, noteReachedFloor, saveBest } from "./towerProgress.js";

const PLAYER_ID = "local"; // createLocalMode's id for you

/**
 * Single-player tower run (CLAUDE.md section 4.1). The rules live in the sim
 * (`planFloor`, `judgeFloor`, `recordFloor`, `continueRun`); this class only
 * plays one floor after another and turns the run into result-screen text and
 * buttons. The best run total (runs from floor 1 only) and the highest floor
 * played are kept in this browser. Free players watch a rewarded ad to
 * continue or to pick a skill; the full version skips the ads, takes two
 * skills a floor and may start on any floor already played.
 */
export class TowerRun {
  private run: TowerRunState;
  private plan: FloorPlan | null = null;
  private match: Match | null = null;
  private verdict: ResultsActions | null = null;
  private prep: FloorPrep | null = null;
  private select: FloorSelect | null = null;
  private readonly floorsTotal = DEFAULT_TUNING.towerRun.floors.length;

  constructor(
    private readonly root: HTMLElement,
    private readonly renderer: THREE.WebGLRenderer,
    private readonly onHome: (notice?: string) => void,
  ) {
    this.run = startTowerRun(Date.now() >>> 0);
  }

  /** A new run: the full version first picks the starting floor once a later one has been played. */
  start(): void {
    this.dispose();
    const reached = loadReachedFloor();
    if (!isPremium() || reached <= 1) {
      this.begin(1);
      return;
    }
    this.select = new FloorSelect(this.root, this.renderer, reached, loadProfile(), (floor) => this.begin(floor), () => this.quit());
  }

  dispose(): void {
    this.match?.dispose();
    this.match = null;
    this.prep?.dispose();
    this.prep = null;
    this.select?.dispose();
    this.select = null;
  }

  private begin(floor: number): void {
    this.run = startTowerRun(Date.now() >>> 0, floor);
    this.prepare();
  }

  /** Before every floor: the floor's skill (section 4.1); who you are comes from the home screen's character setup. */
  private prepare(): void {
    this.dispose();
    this.prep = new FloorPrep(
      this.root,
      this.renderer,
      this.run.floor,
      this.floorsTotal,
      loadProfile(),
      randomSkill(this.run.seed, this.run.floor),
      isPremium(),
      (skills) => this.playFloor(skills),
      () => this.quit(),
    );
  }

  private playFloor(skills: SkillKind[]): void {
    this.dispose();
    noteReachedFloor(this.run.floor);
    const profile = loadProfile();
    this.verdict = null;
    this.plan = planFloor(this.run, MAP_POOL);
    if (!this.plan) {
      this.onHome("沒有可用的地圖，無法開始爬塔挑戰");
      return;
    }
    const plan = this.plan;
    const mode = createLocalMode(rotateMap(plan.map, plan.rotation), {
      players: plan.participants,
      seed: plan.seed,
      name: profile.name,
      character: profile.character,
      skill: skills[0] ?? null,
      skill2: skills[1] ?? null,
      tuning: plan.tuning,
      endWhenYouClimb: true,
      onFinish: (state) => this.finishFloor(state),
      results: () => this.verdict ?? { endsAt: null, buttons: [] },
      caption: () => `第 ${plan.floor} / ${this.floorsTotal} 層　分數前 ${plan.passRank} 名晉級　總分 ${this.run.totalScore}`,
      onHome: () => this.quit(),
    });
    this.match = new Match(this.root, this.renderer, mode);
  }

  private finishFloor(state: SimulationState): void {
    const plan = this.plan;
    if (!plan) return;
    const outcome = judgeFloor(state, PLAYER_ID, plan.passRank);
    this.run = recordFloor(this.run, plan, outcome);
    const run = this.run;
    const best = loadTowerBest();
    // Only a run from the bottom floor competes for the best total.
    const record = run.startFloor === 1 && (!best || run.totalScore > best.score);
    if (record) saveBest({ score: run.totalScore, floor: plan.floor });
    const where = `分數第 ${outcome.rank} 名`;
    const total = `總分 ${run.totalScore}（到達第 ${plan.floor} 層）`;
    const bestLine = record ? "新紀錄！" : best ? `最佳紀錄：總分 ${best.score}（到達第 ${best.floor} 層）` : "";
    const home = { label: "回首頁", run: () => this.quit() };

    if (run.status === "cleared") {
      this.verdict = {
        endsAt: null,
        note: {
          title: outcome.passed ? `登頂成功！完成全部 ${this.floorsTotal} 層` : `完成全部 ${this.floorsTotal} 層`,
          tone: outcome.passed ? "pass" : "info",
          lines: [total, bestLine].filter(Boolean),
        },
        buttons: [{ label: "再挑戰一次", primary: true, run: () => this.restart() }, home],
      };
    } else if (run.status === "stopped") {
      const left = DEFAULT_TUNING.towerRun.maxContinues - run.continues;
      const carryOn = canContinue(run)
        ? { label: `${isPremium() ? "" : "📺 看廣告"}繼續（剩 ${left} 次）`, primary: true, run: () => void this.continueAfterFail() }
        : { label: "再挑戰一次", primary: true, run: () => this.restart() };
      const used = canContinue(run) ? "" : `這次挑戰的 ${DEFAULT_TUNING.towerRun.maxContinues} 次繼續已用完`;
      this.verdict = {
        endsAt: null,
        note: { title: `挑戰結束：${where}，需要前 ${plan.passRank} 名`, tone: "fail", lines: [total, bestLine, used].filter(Boolean) },
        buttons: [home, carryOn],
      };
    } else {
      this.verdict = {
        endsAt: null,
        note: { title: `晉級！${where}`, tone: "pass", lines: [`總分 ${run.totalScore}　下一層：第 ${run.floor} / ${this.floorsTotal} 層`] },
        buttons: [{ label: `前往第 ${run.floor} 層`, primary: true, run: () => this.prepare() }, home],
      };
    }
  }

  /** After a failed floor: an ad (none with the full version), then on to the next floor with the score kept. */
  private async continueAfterFail(): Promise<void> {
    if (!canContinue(this.run)) return;
    if (!isPremium() && !(await showRewardedAd("繼續挑戰下一層"))) return;
    this.run = continueRun(this.run);
    this.prepare();
  }

  private restart(): void {
    this.start();
  }

  private quit(): void {
    this.dispose();
    this.onHome();
  }
}

/** The skill a floor offers a free player, drawn from the run seed so it is the same each time the floor is prepared. */
function randomSkill(runSeed: number, floor: number): SkillKind {
  return new SeededRandom((runSeed ^ Math.imul(floor, 0x85ebca6b)) >>> 0).pick(SKILL_KINDS);
}
