import { generateMap, type GenerateOptions } from "../map/gen/generate.js";
import { MAP_DIFFICULTIES, type MapData, type MapDifficulty } from "../map/types.js";
import type { QuarterTurns } from "../map/transform.js";
import { SeededRandom } from "../random/seeded.js";
import type { SimulationState } from "../simulation.js";
import { DEFAULT_TUNING, type FloorMod, type TowerFloor, type Tuning } from "../tuning/index.js";
import type { PlayerId } from "../types.js";

/**
 * Single-player tower run (CLAUDE.md section 4.1): floor after floor against
 * CPUs, each floor a normal solo round. You pass a floor when your score ranks
 * in the first half. A failed floor stops the run and shows the total; from
 * there you may continue to the next floor (`towerRun.maxContinues` times a
 * run; a continue costs an ad, or nothing with the full version) with the
 * score carried on. A run starts on floor 1, or with the full version on any
 * floor already reached up to the top of the table (`startFloor`). There is
 * no last floor: past the table every floor is played on a map generated from
 * its seed, against the table's last CPUs. Pure functions over a small state,
 * so the client only orchestrates and everything here is testable.
 */
export interface TowerRunState {
  /** Run seed; every floor's draw derives from it. */
  seed: number;
  /** 1-based floor being played; after a floor is recorded, the next one to play. */
  floor: number;
  totalScore: number;
  /**
   * playing: the next floor is ready. stopped: the last floor was failed; the
   * run ends here unless you continue.
   */
  status: "playing" | "stopped";
  /** Times the run was continued after a failed floor. */
  continues: number;
  /** Floor the run started on: 1, or a later one picked with the full version. */
  startFloor: number;
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
  /** The map, authored or generated; the caller applies `rotation`. */
  map: MapData;
  /** Past the floor table: `map` was generated for this floor. */
  generated: boolean;
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

export function startTowerRun(seed: number, startFloor = 1, tuning: Tuning = DEFAULT_TUNING): TowerRunState {
  const floor = Math.min(Math.max(1, Math.floor(startFloor)), tuning.towerRun.floors.length);
  return { seed: seed >>> 0, floor, totalScore: 0, status: "playing", continues: 0, startFloor: floor, history: [] };
}

/** Worst score rank that still passes: the first half, at least first. */
export function passRank(participants: number, tuning: Tuning = DEFAULT_TUNING): number {
  return Math.max(1, Math.floor(participants * tuning.towerRun.passShare));
}

/** Whether `floor` is past the floor table, so it is played on a generated map. */
export function isGeneratedFloor(floor: number, tuning: Tuning = DEFAULT_TUNING): boolean {
  return floor > tuning.towerRun.floors.length;
}

/**
 * What a floor is: its row of the table, or past the table the last row's
 * CPUs on a hard map, with every `endless.specialEvery`-th floor special
 * (lights off and the ghost pack in turn).
 */
export function floorSpec(floor: number, tuning: Tuning = DEFAULT_TUNING): TowerFloor | null {
  const floors = tuning.towerRun.floors;
  const last = floors[floors.length - 1];
  if (floor < 1 || !last) return null;
  if (floor <= floors.length) return floors[floor - 1] ?? null;
  const past = floor - floors.length;
  const every = tuning.towerRun.endless.specialEvery;
  const mods: FloorMod[] = every > 0 && past % every === 0 ? [(past / every) % 2 === 1 ? "dark" : "ghostPack"] : [];
  return { ...last, map: "hard", mods };
}

/**
 * The current floor's round. On the table its map comes from the floor's
 * difficulty among maps that take this many participants; when there is none,
 * from the nearest difficulty (harder first). The map just played is avoided
 * when another fits. Past the table the map is generated from the floor seed,
 * dressed in one of the themes the given maps use. Null only when no map at
 * all takes this many participants.
 */
export function planFloor(run: TowerRunState, maps: readonly MapData[], tuning: Tuning = DEFAULT_TUNING): FloorPlan | null {
  const spec = floorSpec(run.floor, tuning);
  if (!spec) return null;
  const participants = spec.cpus + 1;
  const seed = floorSeed(run.seed, run.floor);
  const rng = new SeededRandom(seed);
  const plan = (map: MapData, generated: boolean): FloorPlan => ({
    floor: run.floor,
    spec,
    participants,
    seed,
    map,
    generated,
    rotation: rng.nextInt(0, 3) as QuarterTurns,
    tuning: { ...tuning, cpu: { ...tuning.cpu, visionTiles: spec.cpuVisionTiles, speedMultiplier: spec.cpuSpeed } },
    passRank: passRank(participants, tuning),
  });

  if (isGeneratedFloor(run.floor, tuning)) {
    const themes = [...new Set(maps.map((m) => m.theme ?? "stone"))].sort();
    const theme = themes.length > 0 ? rng.pick(themes) : "stone";
    return plan(generateMap((seed ^ 0x5bd1e995) >>> 0, endlessMapOptions(run.floor, theme, tuning), tuning), true);
  }

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
  return plan(rng.pick(pool), false);
}

/** The generated map for `floor`: fixtures grow by one of each kind every `moreFixturesEvery` floors, up to the caps. */
export function endlessMapOptions(floor: number, theme: string, tuning: Tuning = DEFAULT_TUNING): GenerateOptions {
  const e = tuning.towerRun.endless;
  const more = Math.floor((floor - tuning.towerRun.floors.length - 1) / Math.max(1, e.moreFixturesEvery));
  return {
    width: e.width,
    height: e.height,
    timeLimitSec: e.timeLimitSec,
    stairs: e.stairs,
    bridges: e.bridges,
    theme,
    traps: Math.min(e.maxTraps, e.traps + more),
    obstacles: Math.min(e.maxObstacles, e.obstacles + more),
    doors: Math.min(e.maxDoors, e.doors + more),
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

/** The run after a floor: on to the next floor, stopped there on a fail. */
export function recordFloor(run: TowerRunState, plan: FloorPlan, outcome: FloorOutcome): TowerRunState {
  if (run.status !== "playing") return run;
  const history = [
    ...run.history,
    { floor: run.floor, mapId: plan.map.id, participants: plan.participants, rank: outcome.rank, passRank: plan.passRank, passed: outcome.passed, score: outcome.score },
  ];
  const totalScore = run.totalScore + outcome.score;
  return { ...run, history, totalScore, floor: run.floor + 1, status: outcome.passed ? "playing" : "stopped" };
}

/** Whether a failed run may still carry on: `towerRun.maxContinues` continues a run. */
export function canContinue(run: TowerRunState, tuning: Tuning = DEFAULT_TUNING): boolean {
  return run.status === "stopped" && run.continues < tuning.towerRun.maxContinues;
}

/** Carry on after a failed floor: the next floor, score kept. */
export function continueRun(run: TowerRunState, tuning: Tuning = DEFAULT_TUNING): TowerRunState {
  if (!canContinue(run, tuning)) return run;
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
