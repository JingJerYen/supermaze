import { MAP_DIFFICULTIES, type MapData, type MapDifficulty } from "../map/types.js";
import type { QuarterTurns } from "../map/transform.js";
import { SeededRandom } from "../random/seeded.js";
import type { SimulationState } from "../simulation.js";
import { DEFAULT_TUNING, type TowerFloor, type Tuning } from "../tuning/index.js";
import type { PlayerId } from "../types.js";

/**
 * Single-player tower run (CLAUDE.md section 4.1): floor after floor against
 * CPUs, each floor a normal solo round. You pass a floor when your score ranks
 * in the first half. A failed floor stops the run and shows the total; from
 * there you may continue to the next floor (the future price of a continue is
 * an ad or a payment) with the score carried on. Pure functions over a small
 * state, so the client only orchestrates and everything here is testable.
 */
export interface TowerRunState {
  /** Run seed; every floor's draw derives from it. */
  seed: number;
  /** 1-based floor being played; after a floor is recorded, the next one to play. */
  floor: number;
  totalScore: number;
  /**
   * playing: the next floor is ready. stopped: the last floor was failed; the
   * run ends here unless you continue. cleared: the last floor has been played.
   */
  status: "playing" | "stopped" | "cleared";
  /** Times the run was continued after a failed floor. */
  continues: number;
  history: FloorRecord[];
}

export interface FloorRecord {
  floor: number;
  mapId: string;
  participants: number;
  /** 1-based rank by score, ties broken by who climbed first. */
  rank: number;
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
  /** Rank at this place or better to pass. */
  passRank: number;
}

export interface FloorOutcome {
  rank: number;
  passed: boolean;
  score: number;
}

export function startTowerRun(seed: number): TowerRunState {
  return { seed: seed >>> 0, floor: 1, totalScore: 0, status: "playing", continues: 0, history: [] };
}

/** Worst score rank that still passes: the first half, at least first. */
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
  const seed = floorSeed(run.seed, run.floor);
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

/**
 * How you did on a finished round. Rank follows the solo standings: higher
 * final score first, then whoever climbed earlier (not climbing counts as
 * last); players equal on both share a rank.
 */
export function judgeFloor(state: SimulationState, playerId: PlayerId, rank: number): FloorOutcome {
  const final = (id: PlayerId) => state.result?.finalScores[id] ?? state.players[id]?.score ?? 0;
  const arrival = (id: PlayerId) => state.players[id]?.towerArrival ?? Number.POSITIVE_INFINITY;
  const score = final(playerId);
  const ahead = Object.keys(state.players).filter(
    (id) => id !== playerId && (final(id) > score || (final(id) === score && arrival(id) < arrival(playerId))),
  ).length;
  return { rank: ahead + 1, passed: ahead + 1 <= rank, score };
}

/** The run after a floor: on to the next floor on a pass, stopped on a fail, cleared after the last floor. */
export function recordFloor(run: TowerRunState, plan: FloorPlan, outcome: FloorOutcome, tuning: Tuning = DEFAULT_TUNING): TowerRunState {
  if (run.status !== "playing") return run;
  const history = [
    ...run.history,
    { floor: run.floor, mapId: plan.map.id, participants: plan.participants, rank: outcome.rank, passRank: plan.passRank, passed: outcome.passed, score: outcome.score },
  ];
  const totalScore = run.totalScore + outcome.score;
  if (run.floor >= tuning.towerRun.floors.length) return { ...run, history, totalScore, status: "cleared" };
  return { ...run, history, totalScore, floor: run.floor + 1, status: outcome.passed ? "playing" : "stopped" };
}

/** Carry on after a failed floor: the next floor, score kept. */
export function continueRun(run: TowerRunState): TowerRunState {
  if (run.status !== "stopped") return run;
  return { ...run, status: "playing", continues: run.continues + 1 };
}

function floorSeed(runSeed: number, floor: number): number {
  return (runSeed ^ Math.imul(floor, 0x9e3779b1)) >>> 0;
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
