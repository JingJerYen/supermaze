import { MAP_DIFFICULTIES, type MapData, type MapDifficulty } from "../map/types.js";
import type { QuarterTurns } from "../map/transform.js";
import { SeededRandom } from "../random/seeded.js";
import type { SimulationState } from "../simulation.js";
import type { PlayerId } from "../types.js";
import { DEFAULT_TUNING, type TowerFloor, type Tuning } from "../tuning/index.js";

/**
 * Single-player tower run (CLAUDE.md section 4.1): floor after floor against
 * CPUs, each floor a normal solo round. You pass a floor by climbing within the
 * first half; a failure costs a heart and the floor is played again on a fresh
 * draw. Scores add up over the whole run. Pure functions over a small state, so
 * the client only orchestrates and everything here is testable and replayable.
 */
export interface TowerRunState {
  /** Run seed; every floor's draw derives from it. */
  seed: number;
  /** 1-based floor being played (or, once over, the floor the run ended on). */
  floor: number;
  /** Failed attempts on the current floor, so a retry gets a different draw. */
  attempt: number;
  hearts: number;
  totalScore: number;
  status: "playing" | "cleared" | "over";
  history: FloorRecord[];
}

export interface FloorRecord {
  floor: number;
  mapId: string;
  participants: number;
  /** 1-based climbing place, null when you did not climb. */
  place: number | null;
  passRank: number;
  passed: boolean;
  score: number;
}

/** Everything needed to set up one floor's round. */
export interface FloorPlan {
  floor: number;
  spec: TowerFloor;
  /** You plus the CPUs. */
  participants: number;
  /** Round seed. */
  seed: number;
  /** Authored map; the caller applies `rotation`. */
  map: MapData;
  rotation: QuarterTurns;
  /** The run's tuning with this floor's CPU strength applied. */
  tuning: Tuning;
  /** Climb at this place or better to pass. */
  passRank: number;
}

export function startTowerRun(seed: number, tuning: Tuning = DEFAULT_TUNING): TowerRunState {
  return { seed: seed >>> 0, floor: 1, attempt: 0, hearts: tuning.towerRun.hearts, totalScore: 0, status: "playing", history: [] };
}

/** Worst climbing place that still passes: the first half, at least first. */
export function passRank(participants: number, tuning: Tuning = DEFAULT_TUNING): number {
  return Math.max(1, Math.floor(participants * tuning.towerRun.passShare));
}

/**
 * The current floor's round. Its map comes from the floor's difficulty among
 * maps that take this many participants; when there is none, from the nearest
 * difficulty (harder first). The map just played is avoided when another fits.
 * Null only when no map at all takes this many participants.
 */
export function planFloor(run: TowerRunState, maps: readonly MapData[], tuning: Tuning = DEFAULT_TUNING): FloorPlan | null {
  const floors = tuning.towerRun.floors;
  const spec = floors[Math.min(run.floor, floors.length) - 1];
  if (!spec) return null;
  const participants = spec.cpus + 1;
  const seed = floorSeed(run.seed, run.floor, run.attempt);
  const rng = new SeededRandom(seed);

  const fits = maps.filter((m) => m.difficulty && m.supportedParticipants.includes(participants));
  let pool: MapData[] = [];
  for (const d of byCloseness(spec.map)) {
    pool = fits.filter((m) => m.difficulty === d);
    if (pool.length > 0) break;
  }
  if (pool.length === 0) return null;
  const last = run.history[run.history.length - 1]?.mapId;
  if (pool.length > 1) pool = pool.filter((m) => m.id !== last);
  pool.sort((a, b) => a.id.localeCompare(b.id));

  return {
    floor: run.floor,
    spec,
    participants,
    seed,
    map: rng.pick(pool),
    rotation: rng.nextInt(0, 3) as QuarterTurns,
    tuning: { ...tuning, cpu: { ...tuning.cpu, visionTiles: spec.cpuVisionTiles, speedMultiplier: spec.cpuSpeed } },
    passRank: passRank(participants, tuning),
  };
}

/** How you did on a finished round. */
export function judgeFloor(state: SimulationState, playerId: PlayerId, rank: number): { place: number | null; passed: boolean; score: number } {
  const p = state.players[playerId];
  const place = p && p.phase === "tower" && p.towerArrival !== null ? p.towerArrival + 1 : null;
  const score = state.result?.finalScores[playerId] ?? p?.score ?? 0;
  return { place, passed: place !== null && place <= rank, score };
}

/** The run after a floor: next floor on a pass, a heart less and a fresh draw on a fail. */
export function recordFloor(
  run: TowerRunState,
  plan: FloorPlan,
  outcome: { place: number | null; passed: boolean; score: number },
  tuning: Tuning = DEFAULT_TUNING,
): TowerRunState {
  if (run.status !== "playing") return run;
  const history = [
    ...run.history,
    { floor: run.floor, mapId: plan.map.id, participants: plan.participants, place: outcome.place, passRank: plan.passRank, passed: outcome.passed, score: outcome.score },
  ];
  const totalScore = run.totalScore + outcome.score;
  if (outcome.passed) {
    if (run.floor >= tuning.towerRun.floors.length) return { ...run, history, totalScore, status: "cleared" };
    return { ...run, history, totalScore, floor: run.floor + 1, attempt: 0 };
  }
  const hearts = run.hearts - 1;
  return { ...run, history, totalScore, hearts, attempt: run.attempt + 1, status: hearts <= 0 ? "over" : "playing" };
}

/** Floors cleared so far (the highest floor passed). */
export function floorsCleared(run: TowerRunState): number {
  return run.history.reduce((best, r) => (r.passed ? Math.max(best, r.floor) : best), 0);
}

function floorSeed(runSeed: number, floor: number, attempt: number): number {
  return (runSeed ^ Math.imul(floor, 0x9e3779b1) ^ Math.imul(attempt + 1, 0x85ebca6b)) >>> 0;
}

/** Difficulties ordered by distance from `d`; on a tie the harder one first. */
function byCloseness(d: MapDifficulty): MapDifficulty[] {
  const i = MAP_DIFFICULTIES.indexOf(d);
  return [...MAP_DIFFICULTIES].sort((a, b) => {
    const da = Math.abs(MAP_DIFFICULTIES.indexOf(a) - i);
    const db = Math.abs(MAP_DIFFICULTIES.indexOf(b) - i);
    return da - db || MAP_DIFFICULTIES.indexOf(b) - MAP_DIFFICULTIES.indexOf(a);
  });
}
