/**
 * Every balance-affecting number lives here (CLAUDE.md section 12).
 * Units are in the field names or comments. Values in `defaults.ts` are
 * initial playtest values only.
 */
export interface Tuning {
  /** Simulation ticks per second. */
  tickRate: number;

  round: {
    /** Hard upper bound for a round, seconds. Formula-based adjustment is a phase-1 topic. */
    timeLimitSec: number;
    /** Counts every participant, human or CPU. Solo play is 1 human + 1 CPU = 2. */
    minParticipants: number;
    maxParticipants: number;
    /**
     * On timeout with no complete team, compare climbed members as an absolute
     * count or as a fraction of team size. Undecided for uneven teams (CLAUDE.md 16).
     */
    timeoutClimbMetric: "count" | "ratio";
  };

  teams: {
    /** Fixed at 2 by the rules; kept as data so validation code reads it from one place. */
    count: number;
    /** Largest allowed difference in team sizes. */
    maxSizeDifference: number;
  };

  movement: {
    /** Normal player speed, tiles per second. */
    speedTilesPerSec: number;
    /**
     * Tap-to-turn: from standstill, pushing a new direction turns the player at
     * once but only starts walking after the push has been held this long.
     * Releasing earlier leaves the player facing the new way without moving.
     */
    turnDelaySec: number;
  };

  connection: {
    /** How long a dropped player may reconnect before staying CPU-controlled for the round, seconds. */
    reconnectWindowSec: number;
  };

  keys: {
    /** Keys generated per participant. Spec fixes this at exactly 1. */
    perParticipant: number;
  };

  inventory: {
    /** Max items a player can carry at once. */
    capacity: number;
  };

  itemBoxes: {
    /** Boxes on the field per active participant. Spec: 2. */
    perParticipant: number;
    /** Relative draw weights per item kind. */
    weights: Record<ItemKind, number>;
  };

  lighting: {
    /** Minimum number of switches on a map. Must be even. */
    switchCountMin: number;
    /** Visible radius in the dark for players inside the maze, in tiles. */
    darkRadiusMazeTiles: number;
    /** Visible radius in the dark for players on the tower top, in tiles. */
    darkRadiusTowerTiles: number;
  };

  teleport: {
    /** Nodes a team may own at once, counting bags and the map. Spec: 2 (one pair). */
    maxNodesPerTeam: number;
  };

  placeables: {
    /**
     * Development switch. False: every non-teleport item places a passable
     * placeholder block that lives `placeholderLifetimeSec`; nothing else happens.
     * True: doors block, obstacles block, hammers break, traps freeze.
     */
    effectsEnabled: boolean;
    /** Lifetime of placeholder blocks while effects are disabled, seconds. */
    placeholderLifetimeSec: number;
    /** Lifetime on the field, seconds, per placeable kind (effects enabled). */
    lifetimeSec: Record<PlaceableKind, number>;
    /** How long a trapped player stays frozen, seconds. */
    trapFreezeSec: number;
  };

  ghostEvent: {
    /** Time between the end of one event and the start of the next warning, seconds. */
    intervalSec: number;
    /** Countdown shown before the ghost team becomes active, seconds. */
    warningSec: number;
    /** Active chase duration, seconds. */
    durationSec: number;
    /** Ghost movement speed relative to a normal player. Initial range 1.10-1.15. */
    speedMultiplier: number;
    /** Freeze applied to a caught player, seconds. */
    caughtFreezeSec: number;
    /** Protection window after the freeze ends, seconds. */
    caughtProtectionSec: number;
  };

  scoring: {
    /** Score by tower-top arrival order; index 0 is first. Beyond the array length use the last value. */
    towerPlacement: number[];
    /** Awarded once when a player first obtains their key. */
    keyFound: number;
    /** Awarded per unused inventory item when climbing the tower. Same for every item kind. */
    leftoverItem: number;
    /** Awarded to a ghost per successful catch. */
    ghostCatch: number;
    /** Multiplier applied to the winning team's round score. */
    winningTeamMultiplier: number;
  };
}

export type ItemKind = "oneWayDoor" | "obstacle" | "hammer" | "trap" | "teleportNode";

/** Items that exist on the field after use. Teleport nodes are persistent and handled separately. */
export type PlaceableKind = "oneWayDoor" | "obstacle" | "trap";
