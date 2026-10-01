import { passRank, type FixtureSpec, type ItemKind, type MapData, type SimEvent, type Tuning } from "@supermaze/sim";
import { fill, t } from "../i18n/index.js";
import type { Cmd } from "./puppet.js";

/**
 * A rules card: a few lines of text next to a short scene that the real
 * simulation plays on a tiny map (CLAUDE.md section 17.1). Data only, a few
 * hundred bytes per card; the models and textures are the game's own.
 */
export interface DemoScene {
  id: string;
  title: string;
  /** Up to three lines. `{name}` placeholders are filled from the live tuning by `ruleText`, so durations never go stale. */
  text: string[];
  map: MapData;
  /** In spawn order: the first stands on the south door, the second on the east one. */
  participants: { id: string; teamId: string; name: string }[];
  /** The player the camera follows and whose bag the HUD shows. */
  me: string;
  teamMode: "teams" | "solo";
  seed: number;
  tuning(base: Tuning): Tuning;
  scripts: Record<string, Cmd[]>;
  /** Seconds the ending stays on screen before the scene starts over. */
  holdSec: number;
  /** Event types one run must produce, in this order; checked by the tests so a rule change cannot silently break a card. */
  expect: SimEvent["type"][];
  /** Optional two-column table under the text (the scoring card); built from the live tuning so it never goes stale. */
  table?(tuning: Tuning): [string, string][];
}

/** A card's lines with the real game's numbers filled in (the demos themselves may run on shortened timings). */
export function ruleText(scene: DemoScene, tuning: Tuning): string[] {
  const values: Record<string, number> = {
    obstacleSec: tuning.placeables.lifetimeSec.obstacle,
    doorSec: tuning.placeables.lifetimeSec.oneWayDoor,
    trapSec: tuning.placeables.lifetimeSec.trap,
    trapFreezeSec: tuning.placeables.trapFreezeSec,
    caughtFreezeSec: tuning.ghostEvent.caughtFreezeSec,
    ghostWarningSec: tuning.ghostEvent.warningSec,
    ghostDurationSec: tuning.ghostEvent.durationSec,
    floors: tuning.towerRun.floors.length,
  };
  return scene.text.map((line) => fill(line, values));
}

const N = { dx: 0, dy: -1 };
const S = { dx: 0, dy: 1 };
const W = { dx: -1, dy: 0 };
const E = { dx: 1, dy: 0 };

const weights = (...kinds: ItemKind[]): Tuning["itemBoxes"]["weights"] => {
  const w = { oneWayDoor: 0, obstacle: 0, hammer: 0, trap: 0, teleportNode: 0 };
  for (const k of kinds) w[k] = 1;
  return w;
};

/** Demos start at once (no 3-2-1) and, unless a scene says otherwise, without boxes or ghost events. */
const quiet = (base: Tuning): Tuning => ({
  ...base,
  round: { ...base.round, startFreezeSec: 0, introSec: 0 },
  itemBoxes: { ...base.itemBoxes, perParticipant: 0 },
  ghostEvent: { ...base.ghostEvent, intervalSec: 9999 },
});

type Tile = [x: number, y: number, layer?: "road" | "wallTop"];
const tiles = (list: Tile[]) => list.map(([x, y, layer]) => ({ x, y, layer: layer ?? ("road" as const) }));

const map = (
  id: string,
  rows: string[],
  spawns: { keys?: Tile[]; boxes?: Tile[]; switches?: Tile[] },
  fixtures: FixtureSpec[] = [],
): MapData => ({
  id: `rules-${id}`,
  name: id,
  theme: "stone",
  supportedParticipants: [1, 2],
  lightSwitchCount: spawns.switches?.length ?? 0,
  timeLimitSec: 600,
  rows,
  spawns: { keys: tiles(spawns.keys ?? []), itemBoxes: tiles(spawns.boxes ?? []), lightSwitches: tiles(spawns.switches ?? []) },
  fixtures,
});

/** Card ids as the dictionary spells them (`rules.<id>.title`, `.line1`…`.line3`). */
type CardId = "goal" | "move" | "levels" | "bag" | "obstacleHammer" | "door" | "trap" | "teleport" | "fixtures" | "lights" | "ghost" | "scoring" | "towerRun";

/** A card's title and lines in the page's language, placeholders still unfilled (`ruleText` fills them). */
const card = (id: CardId): Pick<DemoScene, "title" | "text"> => ({
  title: t(`rules.${id}.title`),
  text: [t(`rules.${id}.line1`), t(`rules.${id}.line2`), t(`rules.${id}.line3`)],
});

const solo = [{ id: "me", teamId: "A", name: t("rules.name.you") }];
const duo = [
  { id: "me", teamId: "B", name: t("rules.name.you") },
  { id: "foe", teamId: "A", name: t("rules.name.foe") },
];

/**
 * Demo maps have no walls: everything that is not floor is void (`X`), which
 * draws nothing, so no wall ever stands between the camera and the action.
 * Walls appear only where the card is about them (stairs and wall tops) or
 * where a light switch needs one to hang on, and then behind the path.
 *
 * RING is a loop round a one-tile tower at (5,3) with a stub to each door; the
 * first player starts on the south door (5,4), the second on the east one (6,3).
 */
const RING = ["XXXXXXXXXXX", "X.........X", "X.XXX.XXX.X", "X....T....X", "X.XXX.XXX.X", "X.........X", "XXXXXXXXXXX"];

export const RULE_SCENES: DemoScene[] = [
  {
    id: "goal",
    ...card("goal"),
    map: map("goal", RING, { keys: [[9, 1]] }),
    participants: solo,
    me: "me",
    teamMode: "solo",
    seed: 1,
    tuning: quiet,
    scripts: {
      me: [{ do: "wait", sec: 0.8 }, { do: "goto", x: 9, y: 1 }, { do: "wait", sec: 0.6 }, { do: "goto", x: 5, y: 4 }, { do: "face", ...N }, { do: "wait", sec: 0.5 }, { do: "act" }],
    },
    // Long enough for the whole climb: door, walk-in, the light up the tower and the camera's swing to the overview.
    holdSec: 7.5,
    expect: ["keyPickedUp", "towerClimbed"],
  },
  {
    id: "move",
    ...card("move"),
    map: map("move", RING, { keys: [[9, 1]] }),
    participants: solo,
    me: "me",
    teamMode: "solo",
    seed: 1,
    tuning: quiet,
    scripts: {
      me: [
        { do: "wait", sec: 0.8 },
        { do: "face", ...W },
        { do: "wait", sec: 0.7 },
        { do: "face", ...E },
        { do: "wait", sec: 0.7 },
        { do: "face", ...S },
        { do: "wait", sec: 0.5 },
        { do: "goto", x: 5, y: 5 },
        { do: "goto", x: 2, y: 5 },
        { do: "wait", sec: 0.5 },
        { do: "face", ...E },
        { do: "wait", sec: 0.5 },
        { do: "goto", x: 5, y: 5 },
      ],
    },
    holdSec: 1.2,
    expect: [],
  },
  {
    id: "levels",
    ...card("levels"),
    // The wall stands along the back row, so nothing on the floor is hidden behind it.
    map: map("levels", ["XXXXX.XXXXX", "X.S##=##S.X", "X.XXX.XXX.X", "X....T....X", "X.XXX.XXX.X", "X.........X", "XXXXXXXXXXX"], { keys: [[4, 1, "wallTop"]] }),
    participants: solo,
    me: "me",
    teamMode: "solo",
    seed: 1,
    tuning: quiet,
    scripts: {
      me: [
        { do: "wait", sec: 0.6 },
        { do: "goto", x: 1, y: 1 },
        { do: "wait", sec: 0.4 },
        { do: "goto", x: 4, y: 1, layer: "wallTop" },
        { do: "wait", sec: 0.5 },
        { do: "goto", x: 7, y: 1, layer: "wallTop" },
        { do: "goto", x: 9, y: 1 },
        { do: "goto", x: 9, y: 5 },
      ],
    },
    holdSec: 1.5,
    expect: ["keyPickedUp"],
  },
  {
    id: "bag",
    ...card("bag"),
    map: map("bag", RING, { keys: [[9, 1]], boxes: [[3, 5], [1, 5], [1, 3]] }),
    participants: solo,
    me: "me",
    teamMode: "solo",
    seed: 3,
    tuning: (base) => ({ ...quiet(base), itemBoxes: { perParticipant: 3, weights: weights("obstacle", "trap", "oneWayDoor") } }),
    scripts: {
      me: [
        { do: "wait", sec: 0.6 },
        { do: "goto", x: 3, y: 5 },
        { do: "goto", x: 1, y: 5 },
        { do: "goto", x: 1, y: 3 },
        { do: "wait", sec: 0.8 },
        { do: "discard" },
        { do: "wait", sec: 0.8 },
        { do: "face", ...E },
        { do: "wait", sec: 0.4 },
        { do: "act" },
      ],
    },
    holdSec: 2,
    expect: ["boxOpened", "boxOpened", "boxOpened", "itemDiscarded", "itemUsed"],
  },
  {
    id: "obstacle-hammer",
    ...card("obstacleHammer"),
    map: map("obstacle", RING, { keys: [[1, 1]], boxes: [[3, 5], [7, 5]] }),
    participants: solo,
    me: "me",
    teamMode: "solo",
    seed: 1, // chosen so the first box gives an obstacle and the second a hammer; the test guards it
    // A one-item bag keeps the scene tidy: the box that reappears on the way back stays shut.
    tuning: (base) => ({ ...quiet(base), inventory: { capacity: 1 }, itemBoxes: { perParticipant: 2, weights: weights("obstacle", "hammer") } }),
    scripts: {
      me: [
        { do: "wait", sec: 0.6 },
        { do: "goto", x: 3, y: 5 }, // first box
        { do: "goto", x: 2, y: 5 },
        { do: "face", ...W },
        { do: "wait", sec: 0.5 },
        { do: "act" }, // obstacle on (1,5)
        { do: "push", ...W, sec: 0.9 }, // blocked by it
        { do: "goto", x: 7, y: 5 }, // second box
        { do: "goto", x: 2, y: 5 },
        { do: "face", ...W },
        { do: "wait", sec: 0.4 },
        { do: "act" }, // hammer
        { do: "wait", sec: 0.4 },
        { do: "goto", x: 1, y: 1 }, // through, up to the key
      ],
    },
    holdSec: 2,
    expect: ["boxOpened", "placeablePlaced", "boxOpened", "placeableDestroyed", "keyPickedUp"],
  },
  {
    id: "door",
    ...card("door"),
    map: map("door", RING, { keys: [[9, 1]], boxes: [[7, 5]] }),
    participants: solo,
    me: "me",
    teamMode: "solo",
    seed: 1,
    tuning: (base) => ({ ...quiet(base), itemBoxes: { perParticipant: 1, weights: weights("oneWayDoor") } }),
    scripts: {
      me: [
        { do: "wait", sec: 0.6 },
        { do: "goto", x: 7, y: 5 },
        { do: "goto", x: 4, y: 5 },
        { do: "face", ...W },
        { do: "wait", sec: 0.5 },
        { do: "act" }, // door on (3,5), passing west
        { do: "wait", sec: 0.5 },
        { do: "goto", x: 2, y: 5 }, // with the arrow: through
        { do: "wait", sec: 0.4 },
        { do: "push", ...E, sec: 1.2 }, // against it: refused
      ],
    },
    holdSec: 1.5,
    expect: ["boxOpened", "placeablePlaced"],
  },
  {
    id: "trap",
    ...card("trap"),
    map: map("trap", RING, { keys: [[1, 1], [7, 1]], boxes: [[3, 5], [5, 1]] }),
    participants: duo,
    me: "me",
    teamMode: "teams",
    seed: 1,
    tuning: (base) => ({ ...quiet(base), inventory: { capacity: 1 }, itemBoxes: { perParticipant: 1, weights: weights("trap") } }),
    scripts: {
      me: [
        { do: "wait", sec: 0.5 },
        { do: "goto", x: 3, y: 5 },
        { do: "goto", x: 2, y: 5 },
        { do: "face", ...W },
        { do: "wait", sec: 0.4 },
        { do: "act" }, // trap on (1,5)
        { do: "wait", sec: 0.3 },
        { do: "goto", x: 4, y: 5 },
      ],
      foe: [{ do: "wait", sec: 2.2 }, { do: "goto", x: 9, y: 5 }, { do: "goto", x: 1, y: 5 }],
    },
    holdSec: 3.5,
    expect: ["boxOpened", "placeablePlaced", "trapTriggered"],
  },
  {
    id: "teleport",
    ...card("teleport"),
    map: map("teleport", RING, { keys: [[1, 3]], boxes: [[3, 5], [7, 5]] }),
    participants: solo,
    me: "me",
    teamMode: "solo",
    seed: 1,
    // A two-item bag: once both nodes are carried, the box that reappears stays shut.
    tuning: (base) => ({ ...quiet(base), inventory: { capacity: 2 }, itemBoxes: { perParticipant: 2, weights: weights("teleportNode") } }),
    scripts: {
      me: [
        { do: "wait", sec: 0.5 },
        { do: "goto", x: 3, y: 5 },
        { do: "goto", x: 7, y: 5 },
        { do: "goto", x: 8, y: 5 },
        { do: "face", ...E },
        { do: "wait", sec: 0.3 },
        { do: "act" }, // first node on (9,5)
        { do: "goto", x: 2, y: 1 },
        { do: "face", ...W },
        { do: "wait", sec: 0.3 },
        { do: "act" }, // second node on (1,1): paired
        { do: "wait", sec: 0.8 },
        { do: "push", ...W, sec: 0.6 }, // step on: arrive at (9,5)
      ],
    },
    holdSec: 2.5,
    expect: ["nodePlaced", "nodePlaced", "teleported"],
  },
  {
    id: "fixtures",
    ...card("fixtures"),
    // Two permanent obstacles (the O markers) seal the corner that holds the key.
    map: map("fixtures", ["XXXXXXXXXXX", "X.O.......X", "XOXXX.XXX.X", "X....T....X", "X.XXX.XXX.X", "X.........X", "XXXXXXXXXXX"], { keys: [[1, 1]], boxes: [[7, 5]] }),
    participants: solo,
    me: "me",
    teamMode: "solo",
    seed: 1,
    tuning: (base) => ({ ...quiet(base), itemBoxes: { perParticipant: 1, weights: weights("hammer") } }),
    scripts: {
      me: [
        { do: "wait", sec: 0.5 },
        { do: "goto", x: 1, y: 3 },
        { do: "push", ...N, sec: 0.9 }, // the rusty obstacle does not budge
        { do: "goto", x: 7, y: 5 }, // a box: a hammer
        { do: "goto", x: 1, y: 3 },
        { do: "face", ...N },
        { do: "wait", sec: 0.4 },
        { do: "act" },
        { do: "wait", sec: 0.4 },
        { do: "goto", x: 1, y: 1 }, // the key
        { do: "goto", x: 4, y: 3 }, // west door
        { do: "face", ...E },
        { do: "wait", sec: 0.4 },
        { do: "act" },
      ],
    },
    holdSec: 7.5,
    expect: ["boxOpened", "placeableDestroyed", "keyPickedUp", "towerClimbed"],
  },
  {
    id: "lights",
    ...card("lights"),
    // Each switch hangs on a single wall block behind its tile.
    map: map("lights", ["XXXXXXXXXXX", "X.........X", "X.XXX.XXX.X", "X....T....X", "X.#XX.XX#.X", "X.........X", "XXXXXXXXXXX"], { keys: [[5, 1]], switches: [[2, 5], [8, 5]] }),
    participants: solo,
    me: "me",
    teamMode: "solo",
    seed: 1,
    tuning: quiet,
    scripts: {
      me: [
        { do: "wait", sec: 0.6 },
        { do: "goto", x: 2, y: 5 },
        { do: "wait", sec: 0.4 },
        { do: "act" }, // lights out
        { do: "wait", sec: 1.2 },
        { do: "goto", x: 8, y: 5 },
        { do: "wait", sec: 0.4 },
        { do: "act" }, // lights on
      ],
    },
    holdSec: 2,
    expect: ["lightsToggled", "lightsToggled"],
  },
  {
    id: "ghost",
    ...card("ghost"),
    map: map("ghost", RING, { keys: [[2, 3], [8, 3]] }),
    participants: duo,
    me: "me",
    teamMode: "teams",
    seed: 1,
    tuning: (base) => ({
      ...quiet(base),
      ghostEvent: { ...base.ghostEvent, intervalSec: 1.5, warningSec: 3, durationSec: 7, caughtFreezeSec: 2.5 },
    }),
    scripts: {
      me: [{ do: "wait", sec: 1 }, { do: "goto", x: 1, y: 5 }, { do: "wait", sec: 2.4 }, { do: "goto", x: 1, y: 1 }, { do: "goto", x: 9, y: 1 }, { do: "goto", x: 9, y: 5 }],
      foe: [{ do: "wait", sec: 4.5 }, { do: "chase", id: "me", sec: 6 }],
    },
    holdSec: 2.5,
    expect: ["ghostWarning", "ghostStarted", "playerCaught"],
  },
  {
    id: "scoring",
    ...card("scoring"),
    map: map("scoring", RING, { keys: [[9, 5]] }),
    participants: solo,
    me: "me",
    teamMode: "solo",
    seed: 1,
    tuning: quiet,
    scripts: {
      me: [{ do: "wait", sec: 0.8 }, { do: "goto", x: 9, y: 5 }, { do: "wait", sec: 0.5 }, { do: "goto", x: 5, y: 4 }, { do: "face", ...N }, { do: "wait", sec: 0.5 }, { do: "act" }],
    },
    holdSec: 7.5,
    expect: ["keyPickedUp", "towerClimbed"],
    table: (tuning) => [
      [t("rules.table.placement"), tuning.scoring.towerPlacement.join(" / ")],
      [t("rules.table.keyFound"), `+${tuning.scoring.keyFound}`],
      [t("rules.table.ghostCatch"), `+${tuning.scoring.ghostCatch}`],
      [t("rules.table.trapCatch"), `+${tuning.scoring.trapCatch}`],
      [t("rules.table.lightSwitch"), `+${tuning.scoring.lightSwitch}`],
      [t("rules.table.leftoverItem"), `+${tuning.scoring.leftoverItem}`],
      [t("rules.table.winMultiplier"), `×${tuning.scoring.winningTeamMultiplier}`],
    ],
  },
  {
    id: "tower-run",
    ...card("towerRun"),
    map: map("tower-run", RING, { keys: [[9, 5], [1, 1]] }),
    participants: duo,
    me: "me",
    teamMode: "solo",
    seed: 1,
    tuning: quiet,
    scripts: {
      me: [{ do: "wait", sec: 1.2 }, { do: "goto", x: 9, y: 5 }, { do: "wait", sec: 0.3 }, { do: "goto", x: 5, y: 4 }, { do: "face", ...N }, { do: "wait", sec: 0.4 }, { do: "act" }],
      foe: [{ do: "wait", sec: 0.3 }, { do: "goto", x: 1, y: 1 }, { do: "goto", x: 4, y: 1 }],
    },
    holdSec: 7.5,
    expect: ["keyPickedUp", "keyPickedUp", "towerClimbed"],
    table: (tuning) => {
      const floors = tuning.towerRun.floors;
      const bands: [string, string][] = [];
      for (let i = 0; i < floors.length; ) {
        let j = i;
        while (j + 1 < floors.length && floors[j + 1]!.map === floors[i]!.map) j++;
        bands.push([t("rules.table.floors", { from: i + 1, to: j + 1 }), t(`rules.table.map.${floors[i]!.map}`)]);
        i = j + 1;
      }
      const cpus = floors.map((f) => f.cpus);
      const sizes = [...new Set(cpus.map((c) => c + 1))].sort((a, b) => a - b);
      return [
        [t("rules.table.passRank"), sizes.map((n) => t("rules.table.passRankItem", { n, rank: passRank(n, tuning) })).join(t("rules.table.listSep"))],
        [t("rules.table.cpu"), t("rules.table.cpuValue", { min: Math.min(...cpus), max: Math.max(...cpus) })],
        ...bands,
      ];
    },
  },
];
