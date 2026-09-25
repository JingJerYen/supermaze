import type { Tuning } from "./types.js";

/**
 * Initial playtest values. Nothing here is final; see CLAUDE.md sections 3, 8-13.
 * Change numbers here, never inside game logic.
 */
export const DEFAULT_TUNING: Tuning = {
  tickRate: 20,

  round: {
    timeLimitSec: 12 * 60,
    minParticipants: 2,
    maxParticipants: 8,
  },

  movement: {
    speedTilesPerSec: 4,
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

  placeables: {
    lifetimeSec: {
      oneWayDoor: 10,
      obstacle: 10,
      trap: 10,
    },
    trapFreezeSec: 3,
  },

  ghostEvent: {
    intervalSec: 180,
    warningSec: 60,
    durationSec: 45,
    speedMultiplier: 1.12,
    caughtFreezeSec: 3,
    caughtProtectionSec: 5,
  },

  scoring: {
    towerPlacement: [100, 80, 65, 50, 40, 30, 20, 10],
    keyFound: 30,
    leftoverItem: 10,
    ghostCatch: 40,
    winningTeamMultiplier: 2,
  },
};

/** Shallow-merge overrides onto the defaults. Deep merge is intentionally not provided yet. */
export function withTuning(overrides: Partial<Tuning>): Tuning {
  return { ...DEFAULT_TUNING, ...overrides };
}
