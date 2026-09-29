import type * as THREE from "three";
import {
  DEFAULT_TUNING,
  floorsCleared,
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
  /** Floors cleared. */
  floors: number;
  score: number;
}

/** Best run in this browser, or null (none yet, or storage unavailable). */
export function loadTowerBest(): TowerBest | null {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    const v = raw ? (JSON.parse(raw) as TowerBest) : null;
    return v && typeof v.floors === "number" && typeof v.score === "number" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Single-player tower run (CLAUDE.md section 4.1). The rules live in the sim
 * (`planFloor`, `judgeFloor`, `recordFloor`); this class only plays one floor
 * after another and turns the run into result-screen text and buttons.
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
      caption: () => `第 ${plan.floor} / ${this.floorsTotal} 層　${hearts(this.run.hearts)}　前 ${plan.passRank} 名登塔晉級`,
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
    const where = outcome.place === null ? "沒有登上塔" : `第 ${outcome.place} 名登塔`;
    const status = `${hearts(run.hearts)}　總分 ${run.totalScore}`;
    const quit = { label: "回首頁", run: () => this.quit() };

    if (run.status === "cleared" || run.status === "over") {
      const best = loadTowerBest();
      const cleared = floorsCleared(run);
      const record = !best || cleared > best.floors || (cleared === best.floors && run.totalScore > best.score);
      if (record) saveBest({ floors: cleared, score: run.totalScore });
      this.verdict = {
        endsAt: null,
        note: {
          title: run.status === "cleared" ? `登頂成功！通過全部 ${this.floorsTotal} 層` : `挑戰結束：${where}，心用完了`,
          tone: run.status === "cleared" ? "pass" : "fail",
          lines: [
            `通過 ${cleared} 層，總分 ${run.totalScore}`,
            record ? "新紀錄！" : best ? `最佳紀錄：通過 ${best.floors} 層，${best.score} 分` : "",
          ].filter(Boolean),
        },
        buttons: [{ label: "再挑戰一次", primary: true, run: () => this.restart() }, quit],
      };
    } else if (outcome.passed) {
      this.verdict = {
        endsAt: null,
        note: { title: `晉級！${where}`, tone: "pass", lines: [`下一層：第 ${run.floor} / ${this.floorsTotal} 層　${status}`] },
        buttons: [{ label: `前往第 ${run.floor} 層`, primary: true, run: () => this.playFloor() }, quit],
      };
    } else {
      this.verdict = {
        endsAt: null,
        note: {
          title: `未晉級：${where}，需要前 ${plan.passRank} 名`,
          tone: "fail",
          lines: [`失去一顆心，重新挑戰第 ${run.floor} 層（換一張地圖）　${status}`],
        },
        buttons: [{ label: `重新挑戰第 ${run.floor} 層`, primary: true, run: () => this.playFloor() }, quit],
      };
    }
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

function hearts(n: number): string {
  const total = DEFAULT_TUNING.towerRun.hearts;
  return "❤".repeat(Math.max(0, n)) + "♡".repeat(Math.max(0, total - n));
}

function saveBest(best: TowerBest): void {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    /* storage unavailable */
  }
}
