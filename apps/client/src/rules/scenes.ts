import type { ItemKind, MapData, SimEvent, Tuning } from "@supermaze/sim";
import type { Cmd } from "./puppet.js";

/**
 * A rules card: a few lines of text next to a short scene that the real
 * simulation plays on a tiny map (CLAUDE.md section 17.1). Data only, a few
 * hundred bytes per card; the models and textures are the game's own.
 */
export interface DemoScene {
  id: string;
  title: string;
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
}

const N = { dx: 0, dy: -1 };
const W = { dx: -1, dy: 0 };

const weights = (...kinds: ItemKind[]): Tuning["itemBoxes"]["weights"] => {
  const w = { oneWayDoor: 0, obstacle: 0, hammer: 0, trap: 0, teleportNode: 0 };
  for (const k of kinds) w[k] = 1;
  return w;
};

/** Demos start at once (no 3-2-1) and, unless a scene says otherwise, without boxes or ghost events. */
const quiet = (base: Tuning): Tuning => ({
  ...base,
  round: { ...base.round, startFreezeSec: 0 },
  itemBoxes: { ...base.itemBoxes, perParticipant: 0 },
  ghostEvent: { ...base.ghostEvent, intervalSec: 9999 },
});

const map = (id: string, rows: string[], spawns: NonNullable<MapData["spawns"]>): MapData => ({
  id: `rules-${id}`,
  name: id,
  theme: "stone",
  supportedParticipants: [1, 2],
  lightSwitchCount: 0,
  timeLimitSec: 600,
  rows,
  spawns,
});

/** A ring corridor round a one-tile tower with a stub to each door. */
const SMALL = ["#########", "#.......#", "#.##.##.#", "#.##T##.#", "#.##.##.#", "#.......#", "#########"];
const WIDE = ["###########", "#.........#", "#.###.###.#", "#....T....#", "#.###.###.#", "#.........#", "###########"];

export const RULE_SCENES: DemoScene[] = [
  {
    id: "goal",
    title: "目標：拿鑰匙，回塔登頂",
    text: [
      "每個人都要在迷宮裡找到一把自己的鑰匙，鑰匙上方有一道光柱。",
      "拿到後走回塔的任何一扇門前，面向門，按下動作鍵就會登上塔頂。",
      "登塔之後不能再回迷宮，越早登頂名次分數越高。",
    ],
    map: map("goal", SMALL, { keys: [{ x: 7, y: 1, layer: "road" }], itemBoxes: [], lightSwitches: [] }),
    participants: [{ id: "me", teamId: "A", name: "你" }],
    me: "me",
    teamMode: "solo",
    seed: 1,
    tuning: quiet,
    scripts: {
      me: [{ do: "wait", sec: 0.8 }, { do: "goto", x: 7, y: 1 }, { do: "wait", sec: 0.6 }, { do: "goto", x: 4, y: 4 }, { do: "face", ...N }, { do: "wait", sec: 0.5 }, { do: "act" }],
    },
    holdSec: 4.5,
    expect: ["keyPickedUp", "towerClimbed"],
  },
  {
    id: "obstacle-hammer",
    title: "障礙物與鐵鎚",
    text: [
      "道具箱開出什麼是隨機的。背包先進先出，動作鍵永遠使用最左邊那一件。",
      "障礙物放在面前一格，會擋住所有人，包括你自己，大約十秒後消失。",
      "鐵鎚可以敲掉面前的障礙物、陷阱、單向門與傳送點。",
    ],
    map: map("obstacle", WIDE, {
      keys: [{ x: 1, y: 1, layer: "road" }],
      itemBoxes: [{ x: 3, y: 5, layer: "road" }, { x: 7, y: 5, layer: "road" }],
      lightSwitches: [],
    }),
    participants: [{ id: "me", teamId: "A", name: "你" }],
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
    id: "ghost",
    title: "鬼抓人",
    text: [
      "每隔一段時間，其中一隊會變成鬼，畫面上方會先倒數預告。",
      "鬼跑得比較快，碰到你就算抓到：你的道具全部消失並被定身幾秒，鑰匙不會掉。",
      "當鬼的時候不能撿東西、不能用道具、也不能登塔。已經在塔頂的人不受影響。",
    ],
    map: map("ghost", WIDE, { keys: [{ x: 2, y: 3, layer: "road" }, { x: 8, y: 3, layer: "road" }], itemBoxes: [], lightSwitches: [] }),
    participants: [
      { id: "me", teamId: "B", name: "你" },
      { id: "ghost", teamId: "A", name: "對手" },
    ],
    me: "me",
    teamMode: "teams",
    seed: 1,
    tuning: (base) => ({
      ...quiet(base),
      ghostEvent: { ...base.ghostEvent, intervalSec: 1.5, warningSec: 3, durationSec: 7, caughtFreezeSec: 2.5 },
    }),
    scripts: {
      me: [{ do: "wait", sec: 1 }, { do: "goto", x: 1, y: 5 }, { do: "wait", sec: 2.4 }, { do: "goto", x: 1, y: 1 }, { do: "goto", x: 9, y: 1 }, { do: "goto", x: 9, y: 5 }],
      ghost: [{ do: "wait", sec: 4.5 }, { do: "chase", id: "me", sec: 6 }],
    },
    holdSec: 2.5,
    expect: ["ghostWarning", "ghostStarted", "playerCaught"],
  },
];
