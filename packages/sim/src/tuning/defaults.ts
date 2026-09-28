import type { CpuDifficulty, Tuning } from "./types.js";

/**
 * Initial playtest values. Nothing here is final; see CLAUDE.md sections 3, 8-13.
 * Change numbers here, never inside game logic.
 */
export const DEFAULT_TUNING: Tuning = {
  tickRate: 20,

  round: {
    timeLimitSec: 12 * 60,
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
    intervalSec: 60,
    warningSec: 20,
    durationSec: 20,
    speedMultiplier: 1.5,
    caughtFreezeSec: 10,
    caughtProtectionSec: 10,
    catchRadiusTiles: 0.6,
  },

  cpu: {
    visionTiles: 3,
    pauseMinSec: 0.4,
    pauseMaxSec: 1.5,
    speedMultiplier: 0.6,
    darkVisionPenaltyTiles: 1,
    difficulties: {
      easy: { visionTiles: 3, speedMultiplier: 0.5 },
      hard: { visionTiles: 4, speedMultiplier: 0.5 },
    },
  },

  scoring: {
    towerPlacement: [80, 40, 20, 10, 5, 0],
    keyFound: 20,
    leftoverItem: 5,
    ghostCatch: 20,
    winningTeamMultiplier: 2,
  },
};

/** `base` with the CPU strength preset for `level` applied (single-player difficulty). */
export function withCpuDifficulty(level: CpuDifficulty, base: Tuning = DEFAULT_TUNING): Tuning {
  return { ...base, cpu: { ...base.cpu, ...base.cpu.difficulties[level] } };
}

/** Shallow-merge overrides onto the defaults. Deep merge is intentionally not provided yet. */
export function withTuning(overrides: Partial<Tuning>): Tuning {
  return { ...DEFAULT_TUNING, ...overrides };
}
