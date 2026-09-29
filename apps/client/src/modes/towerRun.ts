import type * as THREE from "three";
import {
  continueRun,
  DEFAULT_TUNING,
  judgeFloor,
  planFloor,
  recordFloor,
  rotateMap,
  startTowerRun,
  type FloorPlan,
  type SimulationState,
  type TowerRunState,
} from "@supermaze/sim";
import type { ResultsActions } from "../hud/results.js";
import { MAP_POOL } from "../maps.js";
import { Match } from "../match.js";
import { createLocalMode } from "./local.js";

const BEST_KEY = "supermaze.towerBest";
const PLAYER_ID = "local"; // createLocalMode's id for you

export interface TowerBest {
  /** Highest run total so far. */
  score: number;
  /** Floor that run had reached. */
  floor: number;
}

/** Best run in this browser, or null (none yet, or storage unavailable). */
export function loadTowerBest(): TowerBest | null {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    const v = raw ? (JSON.parse(raw) as TowerBest) : null;
    return v && typeof v.floor === "number" && typeof v.score === "number" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Single-player tower run (CLAUDE.md section 4.1). The rules live in the sim
 * (`planFloor`, `judgeFloor`, `recordFloor`, `continueRun`); this class only
 * plays one floor after another and turns the run into result-screen text and
 * buttons. The best run total is kept in this browser.
 */
export class TowerRun {
  private run: TowerRunState;
  private plan: FloorPlan | null = null;
  private match: Match | null = null;
  private verdict: ResultsActions | null = null;
  private readonly floorsTotal = DEFAULT_TUNING.towerRun.floors.length;

  constructor(
    private readonly root: HTMLElement,
    private readonly renderer: THREE.WebGLRenderer,
    private readonly name: string,
    private readonly onHome: (notice?: string) => void,
  ) {
    this.run = startTowerRun(Date.now() >>> 0);
  }

  start(): void {
    this.playFloor();
  }

  dispose(): void {
    this.match?.dispose();
    this.match = null;
  }

  private playFloor(): void {
    this.dispose();
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
      name: this.name,
      tuning: plan.tuning,
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
    const record = !best || run.totalScore > best.score;
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
      this.verdict = {
        endsAt: null,
        note: { title: `挑戰結束：${where}，需要前 ${plan.passRank} 名`, tone: "fail", lines: [total, bestLine].filter(Boolean) },
        buttons: [home, { label: "繼續", primary: true, run: () => void this.continueAfterFail() }],
      };
    } else {
      this.verdict = {
        endsAt: null,
        note: { title: `晉級！${where}`, tone: "pass", lines: [`總分 ${run.totalScore}　下一層：第 ${run.floor} / ${this.floorsTotal} 層`] },
        buttons: [{ label: `前往第 ${run.floor} 層`, primary: true, run: () => this.playFloor() }, home],
      };
    }
  }

  /** After a failed floor: pass the continue gate, then on to the next floor with the score kept. */
  private async continueAfterFail(): Promise<void> {
    if (this.run.status !== "stopped" || !(await continueGate())) return;
    this.run = continueRun(this.run);
    this.playFloor();
  }

  private restart(): void {
    this.run = startTowerRun(Date.now() >>> 0);
    this.playFloor();
  }

  private quit(): void {
    this.dispose();
    this.onHome();
  }
}

/**
 * What a continue costs. Free for now; once the game ships this is where an ad
 * or a payment goes, resolving false when the player backs out.
 */
async function continueGate(): Promise<boolean> {
  return true;
}

function saveBest(best: TowerBest): void {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    /* storage unavailable */
  }
}
