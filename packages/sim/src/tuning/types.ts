import type { MapDifficulty } from "../map/types.js";

/**
 * Every balance-affecting number lives here (CLAUDE.md section 12).
 * Units are in the field names or comments. Values in `defaults.ts` are
 * initial playtest values only.
 */
export interface Tuning {
  /** Simulation ticks per second. */
  tickRate: number;

  round: {
    /**
     * Seconds added to the map's own `timeLimitSec` for every participant beyond
     * the second (CPUs included). The base length is map data, not tuning.
     */
    extraSecPerParticipant: number;
    /** Counts every participant, human or CPU. Solo play is 1 human + 1 CPU = 2. */
    minParticipants: number;
    maxParticipants: number;
    /**
     * On timeout with no complete team, compare climbed members as an absolute
     * count or as a fraction of team size. Undecided for uneven teams (CLAUDE.md 16).
     */
    timeoutClimbMetric: "count" | "ratio";
    /**
     * Start freeze (CLAUDE.md section 4): for this long after `start()` nobody can
     * move or act. Ticks still advance and every schedule runs; the state's
     * `freezeUntilTick` lets clients draw the 3-2-1 countdown.
     */
    startFreezeSec: number;
    /**
     * Opening fly-in before the countdown (CLAUDE.md section 4): added in front of
     * the start freeze, so nobody moves during it either. The round clock and the
     * ghost schedule start after it, so it costs no playing time. Seconds.
     */
    introSec: number;
  };

  teams: {
    /** Fixed at 2 by the rules; kept as data so validation code reads it from one place. */
    count: number;
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
    /** Lifetime on the field, seconds, per placeable kind. */
    lifetimeSec: Record<PlaceableKind, number>;
    /** How long a trapped player stays frozen, seconds. */
    trapFreezeSec: number;
  };

  ghostEvent: {
    /**
     * Fixed schedule override, seconds: the wait before the first warning and
     * between the end of one event and the next warning. Null (the default)
     * uses the shares below, so the schedule follows the length of the round.
     */
    intervalSec: number | null;
    /** First warning after this share of the round length (0.2 = a fifth of the way in). */
    firstWarningShare: number;
    /** Wait between the end of one event and the next warning, as a share of the round length. */
    intervalShare: number;
    /** Countdown shown before the ghost team becomes active, seconds. */
    warningSec: number;
    /** Active chase duration, seconds. */
    durationSec: number;
    /** Ghost movement speed relative to a normal player. */
    speedMultiplier: number;
    /** Freeze applied to a caught player, seconds. */
    caughtFreezeSec: number;
    /** Protection window after the freeze ends, seconds. */
    caughtProtectionSec: number;
    /** A ghost catches a runner when their continuous positions are closer than this, tiles. */
    catchRadiusTiles: number;
  };

  cpu: {
    /**
     * How far a CPU notices keys and runners, tiles (straight-line, any layer),
     * standing in for what a human sees on screen. Beyond it the CPU explores.
     */
    visionTiles: number;
    /** Pause after reaching a wander target or picking something up, seconds; drawn uniformly. */
    pauseMinSec: number;
    pauseMaxSec: number;
    /** Walking speed of cpu-controlled players relative to humans. Stacks with the ghost multiplier. */
    speedMultiplier: number;
    /** Tiles taken off `visionTiles` while the map is dark (section 8); sight never drops below 0. */
    darkVisionPenaltyTiles: number;
    /** Single-player strength presets; each replaces `visionTiles` and `speedMultiplier`. */
    difficulties: Record<CpuDifficulty, { visionTiles: number; speedMultiplier: number }>;
  };

  /** One-shot skills of the tower run (section 4.1); one per floor, cast once. */
  skills: {
    sprint: { durationSec: number; speedMultiplier: number };
    /** A look from above, like the tower top's. */
    eagleEye: { durationSec: number };
    /** Only in the dark: the circle of light around the player grows to `darkRadiusTiles`. */
    lantern: { durationSec: number; darkRadiusTiles: number };
    /** Everyone else in the maze is frozen for this long. */
    timeStop: { freezeSec: number };
    /** Obstacles, one-way doors and traps let the player through for this long. */
    pierce: { durationSec: number };
  };

  /** Night parade, the second single-player mode (CLAUDE.md section 4.4). */
  night: {
    /** Ghosts in the maze from the start; all must be banished before the player may climb. */
    ghostCount: number;
    /** Catches the player can take; the last one ends the round. */
    lives: number;
    /** Round length, seconds. */
    timeLimitSec: number;
    /** Ghost speed as a share of the player's. */
    ghostSpeed: number;
    /** How far a ghost notices the player with the lights on, tiles (one less in the dark, `cpu.darkVisionPenaltyTiles`). */
    ghostVisionTiles: number;
    /** Ghosts start at least this far (path steps) from the tower spawn, when the map allows. */
    ghostMinStartSteps: number;
    /** Seconds a switch keeps the lights on; every ghost lies helpless meanwhile. */
    lightStunSec: number;
    /** Item box weights for the round (the race's own are `itemBoxes.weights`). */
    boxWeights: Record<ItemKind, number>;
  };

  /** Single-player tower run (CLAUDE.md section 4.1). */
  towerRun: {
    /**
     * Share of the participants who pass a floor, by score rank: you pass when
     * you rank within the first max(1, floor(participants x passShare)).
     */
    passShare: number;
    /** Continues after a failed floor, per run, in the free game (the full version has no limit). */
    maxContinues: number;
    /** Bottom floor first. Past the last one the run goes on with `endless`. */
    floors: TowerFloor[];
    /** Floors past the table (section 4.1): a map generated for each, CPUs as on the last table floor. */
    endless: EndlessFloors;
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
    /** Awarded to a trap's owner when it catches a player of another team. Own team and self score nothing. */
    trapCatch: number;
    /** Awarded for flipping a light switch, on or off. */
    lightSwitch: number;
    /** Multiplier applied to the winning team's round score. */
    winningTeamMultiplier: number;
  };
}

export type CpuDifficulty = "easy" | "hard";

/** One floor of the tower run: which maps, how many CPUs and how strong. */
export interface TowerFloor {
  /** Map difficulty the floor draws from (map JSON `difficulty`). */
  map: MapDifficulty;
  /** CPU opponents; participants are these plus you. */
  cpus: number;
  /** Replaces `cpu.visionTiles` on this floor, tiles. */
  cpuVisionTiles: number;
  /** Replaces `cpu.speedMultiplier` on this floor. */
  cpuSpeed: number;
  /** Special rules for this floor (section 4.1); empty on an ordinary floor. */
  mods: FloorMod[];
}

/** How the tower run's generated floors are made (section 4.1). */
export interface EndlessFloors {
  /** Every this many floors past the table is a special floor, lights off and the ghost pack in turn. */
  specialEvery: number;
  /** Generated map size in tiles: odd, three more than a multiple of four (31, 35, 39, 43, 47). */
  width: number;
  height: number;
  /** Round length for two participants, seconds (as a map file's `timeLimitSec`). */
  timeLimitSec: number;
  /** Stairs onto the wall tops and bridges between them on each generated map (as many as fit). */
  stairs: number;
  bridges: number;
  /** Fixtures on the first generated floor. */
  traps: number;
  obstacles: number;
  doors: number;
  /** One more of each fixture kind every this many generated floors, up to the caps. */
  moreFixturesEvery: number;
  maxTraps: number;
  maxObstacles: number;
  maxDoors: number;
}

/**
 * A tower run special floor rule. `dark`: the round starts with the lights off
 * (same switches as usual). `ghostPack`: at every ghost event all the CPUs turn
 * ghost together and hunt you.
 */
export type FloorMod = "dark" | "ghostPack";

export type ItemKind = "oneWayDoor" | "obstacle" | "hammer" | "trap" | "teleportNode";

/** Items that exist on the field after use. Teleport nodes are persistent and handled separately. */
export type PlaceableKind = "oneWayDoor" | "obstacle" | "trap";
