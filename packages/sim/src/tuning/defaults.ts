import type { CpuDifficulty, TowerFloor, Tuning } from "./types.js";

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
      oneWayDoor: 20,
      obstacle: 25,
      hammer: 20,
      trap: 20,
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
      oneWayDoor: 50,
      obstacle: 50,
      trap: 40,
    },
    trapFreezeSec: 8,
  },

  ghostEvent: {
    intervalSec: null,
    firstWarningShare: 0.2,
    intervalShare: 0.2,
    warningSec: 10,
    durationSec: 15,
    speedMultiplier: 1.5,
    caughtFreezeSec: 8,
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

  towerRun: {
    passShare: 0.5,
    // map difficulty, CPUs, CPU vision (tiles), CPU speed. CPU counts are odd so the
    // participants are even and "the first half" is exact. Medium maps take at most 4.
    floors: floors([
      ["easy", 1, 2, 0.45],
      ["easy", 1, 2, 0.5],
      ["easy", 3, 2, 0.45],
      ["easy", 3, 3, 0.5],
      ["medium", 1, 3, 0.5],
      ["medium", 3, 3, 0.5],
      ["medium", 3, 3, 0.55],
      ["hard", 1, 3, 0.5],
      ["hard", 1, 3, 0.55],
      ["hard", 3, 3, 0.55],
      ["hard", 3, 4, 0.55],
      ["hard", 3, 4, 0.6],
      ["hard", 5, 4, 0.55],
      ["hard", 5, 4, 0.6],
      ["hard", 3, 4, 0.65],
      ["hard", 5, 4, 0.65],
      ["hard", 3, 5, 0.7],
      ["hard", 5, 5, 0.7],
      ["hard", 5, 5, 0.75],
      ["hard", 5, 6, 0.8],
    ]),
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

function floors(rows: [TowerFloor["map"], number, number, number][]): TowerFloor[] {
  return rows.map(([map, cpus, cpuVisionTiles, cpuSpeed]) => ({ map, cpus, cpuVisionTiles, cpuSpeed }));
}

/** `base` with the CPU strength preset for `level` applied (single-player difficulty). */
export function withCpuDifficulty(level: CpuDifficulty, base: Tuning = DEFAULT_TUNING): Tuning {
  return { ...base, cpu: { ...base.cpu, ...base.cpu.difficulties[level] } };
}

/** Shallow-merge overrides onto the defaults. Deep merge is intentionally not provided yet. */
export function withTuning(overrides: Partial<Tuning>): Tuning {
  return { ...DEFAULT_TUNING, ...overrides };
}
