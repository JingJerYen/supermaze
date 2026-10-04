import type { CpuDifficulty, FloorMod, TowerFloor, Tuning } from "./types.js";

/**
 * Initial playtest values. Nothing here is final; see CLAUDE.md sections 3, 8-13.
 * Change numbers here, never inside game logic.
 */
export const DEFAULT_TUNING: Tuning = {
  tickRate: 20,

  round: {
    extraSecPerParticipant: 30,
    minParticipants: 2,
    maxParticipants: 6,
    timeoutClimbMetric: "count",
    startFreezeSec: 3,
    // Opening fly-in: the wide front shot holds ~2.75 s (client tuning intro.holdShare), then 2.25 s to close in.
    introSec: 5,
  },

  teams: {
    count: 2,
  },

  movement: {
    speedTilesPerSec: 4,
    turnDelaySec: 0.12,
  },

  connection: {
    reconnectWindowSec: 30,
  },

  keys: {
    perParticipant: 1,
  },

  inventory: {
    capacity: 3,
  },

  itemBoxes: {
    perParticipant: 2,
    weights: {
      oneWayDoor: 17,
      obstacle: 21,
      hammer: 30,
      trap: 17,
      teleportNode: 15,
    },
  },

  lighting: {
    switchCountMin: 2,
    darkRadiusMazeTiles: 3,
    darkRadiusTowerTiles: 6,
  },

  teleport: {
    maxNodesPerTeam: 2,
  },

  placeables: {
    lifetimeSec: {
      oneWayDoor: 40,
      obstacle: 40,
      trap: 40,
    },
    trapFreezeSec: 7,
  },

  ghostEvent: {
    intervalSec: null,
    firstWarningShare: 0.2,
    intervalShare: 0.2,
    warningSec: 10,
    durationSec: 15,
    speedMultiplier: 1.5,
    caughtFreezeSec: 7,
    caughtProtectionSec: 10,
    catchRadiusTiles: 0.6,
  },

  cpu: {
    visionTiles: 3,
    pauseMinSec: 0.4,
    pauseMaxSec: 1.5,
    speedMultiplier: 0.5,
    darkVisionPenaltyTiles: 1,
    difficulties: {
      easy: { visionTiles: 3, speedMultiplier: 0.5 },
      hard: { visionTiles: 4, speedMultiplier: 0.6 },
    },
  },

  skills: {
    sprint: { durationSec: 15, speedMultiplier: 1.5 },
    eagleEye: { durationSec: 10 },
    lantern: { durationSec: 20, darkRadiusTiles: 6 },
    timeStop: { freezeSec: 15 },
    pierce: { durationSec: 10 },
  },

  night: {
    ghostCount: 8,
    lives: 3,
    timeLimitSec: 480,
    ghostSpeed: 0.4,
    ghostVisionTiles: 3,
    ghostMinStartSteps: 12,
    lightStunSec: 30,
    // Only traps and hammers: half each.
    boxWeights: { trap: 50, hammer: 50, obstacle: 0, oneWayDoor: 0, teleportNode: 0 },
  },

  towerRun: {
    passShare: 0.5,
    maxContinues: 2,
    // map difficulty, CPUs, CPU vision (tiles), CPU speed, special rules. CPU counts are odd so the
    // participants are even and "the first half" is exact. Floors 1-6 easy maps, 7-14 medium, 15-20 hard.
    // Special floors: every third from 6, lights off and the ghost pack in turn
    // (the pack floors all have 3 or more CPUs).
    floors: floors([
      ["easy", 1, 2, 0.4],
      ["easy", 1, 2, 0.4],
      ["easy", 3, 2, 0.4],
      ["easy", 3, 2, 0.45],
      ["easy", 1, 2, 0.45],
      ["easy", 3, 2, 0.45, ["dark"]],
      ["medium", 3, 3, 0.5],
      ["medium", 1, 3, 0.5],
      ["medium", 3, 3, 0.5, ["ghostPack"]],
      ["medium", 3, 3, 0.5],
      ["medium", 3, 3, 0.55],
      ["medium", 3, 3, 0.55, ["dark"]],
      ["medium", 5, 3, 0.55],
      ["medium", 5, 3, 0.55],
      ["hard", 3, 4, 0.6, ["ghostPack"]],
      ["hard", 5, 4, 0.6],
      ["hard", 3, 4, 0.6],
      ["hard", 5, 4, 0.65, ["dark"]],
      ["hard", 5, 4, 0.65],
      ["hard", 5, 4, 0.7, ["ghostPack"]],
    ]),
    // Floor 21 on: a hard map generated on the spot each floor, the CPUs of floor 20,
    // a special floor every third (23 dark, 26 ghost pack, ...) and a few more fixtures as you climb.
    endless: {
      specialEvery: 3,
      width: 43,
      height: 31,
      timeLimitSec: 300,
      stairs: 12,
      bridges: 8,
      traps: 6,
      obstacles: 1,
      doors: 2,
      moreFixturesEvery: 4,
      maxTraps: 12,
      maxObstacles: 4,
      maxDoors: 5,
    },
  },

  scoring: {
    towerPlacement: [80, 40, 20, 10, 5, 0],
    keyFound: 20,
    leftoverItem: 5,
    ghostCatch: 20,
    trapCatch: 10,
    lightSwitch: 10,
    winningTeamMultiplier: 2,
  },
};

function floors(rows: [TowerFloor["map"], number, number, number, FloorMod[]?][]): TowerFloor[] {
  return rows.map(([map, cpus, cpuVisionTiles, cpuSpeed, mods]) => ({ map, cpus, cpuVisionTiles, cpuSpeed, mods: mods ?? [] }));
}

/** `base` with the CPU strength preset for `level` applied (single-player difficulty). */
export function withCpuDifficulty(level: CpuDifficulty, base: Tuning = DEFAULT_TUNING): Tuning {
  return { ...base, cpu: { ...base.cpu, ...base.cpu.difficulties[level] } };
}

/** Shallow-merge overrides onto the defaults. Deep merge is intentionally not provided yet. */
export function withTuning(overrides: Partial<Tuning>): Tuning {
  return { ...DEFAULT_TUNING, ...overrides };
}
