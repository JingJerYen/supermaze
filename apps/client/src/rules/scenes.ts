import type { FixtureSpec, ItemKind, MapData, SimEvent, Tuning } from "@supermaze/sim";
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
  };
  return scene.text.map((line) => line.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole)));
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
  round: { ...base.round, startFreezeSec: 0 },
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

const solo = [{ id: "me", teamId: "A", name: "你" }];
const duo = [
  { id: "me", teamId: "B", name: "你" },
  { id: "foe", teamId: "A", name: "對手" },
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
    title: "目標：拿鑰匙，回塔登頂",
    text: [
      "每個人都要在迷宮裡找到一把自己的鑰匙，鑰匙上方有一道光柱。",
      "拿到後走回塔的任何一扇門前，面向門，按下動作鍵就會登上塔頂。",
      "登塔之後不能再回迷宮，越早登頂名次分數越高。",
    ],
    map: map("goal", RING, { keys: [[9, 1]] }),
    participants: solo,
    me: "me",
    teamMode: "solo",
    seed: 1,
    tuning: quiet,
    scripts: {
      me: [{ do: "wait", sec: 0.8 }, { do: "goto", x: 9, y: 1 }, { do: "wait", sec: 0.6 }, { do: "goto", x: 5, y: 4 }, { do: "face", ...N }, { do: "wait", sec: 0.5 }, { do: "act" }],
    },
    holdSec: 4.5,
    expect: ["keyPickedUp", "towerClimbed"],
  },
  {
    id: "move",
    title: "移動：點一下轉身，按住才走",
    text: [
      "輕點方向鍵，角色只會原地轉身，不會移動。",
      "按住方向鍵才會開始走。道具永遠放在你面前那一格，所以先轉身再放。",
      "走道只有一格寬，但玩家之間可以互相穿過，不會卡住。",
    ],
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
    title: "樓梯、牆頂與橋",
    text: [
      "迷宮有兩層：地面的道路，以及牆的頂面。兩層都可以走。",
      "只有樓梯能上下牆頂，不能跳上去也不能跳下來。",
      "橋把兩段牆頂接起來，橋下的道路照常通行。鑰匙和道具箱也可能在牆頂上。",
    ],
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
    title: "道具箱與背包",
    text: [
      "走過道具箱就會打開，內容隨機。背包最多三件，滿了就開不了箱。",
      "背包先進先出：動作鍵永遠使用最左邊那一件，不能挑。",
      "不想要最左邊那件？按丟棄鍵把它丟掉，後面的就會遞補上來。",
    ],
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
    title: "障礙物與鐵鎚",
    text: [
      "障礙物放在面前一格，會擋住所有人，包括你自己和隊友。",
      "它 {obstacleSec} 秒後自己消失，或被鐵鎚敲掉。",
      "鐵鎚可以敲掉面前的障礙物、陷阱、單向門與傳送點。揮空也會消耗掉。",
    ],
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
    title: "單向門",
    text: [
      "單向門放在面前一格，通行方向就是你放下時面對的方向，地上有箭頭。",
      "順著箭頭可以通過，反方向會被擋住。",
      "對所有人都有效，包括放的人。{doorSec} 秒後消失。",
    ],
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
    title: "定身陷阱",
    text: [
      "陷阱放在面前一格。第一個踩上去的人會被鐵籠罩住，{trapFreezeSec} 秒內不能移動。",
      "陷阱抓到一個人就消失，沒人踩的話 {trapSec} 秒後消失。",
      "誰踩到都算，包括你自己。抓到別隊的人可以得分。",
    ],
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
    title: "傳送點",
    text: [
      "傳送點要放兩個才會連線。放下後是地上一塊隊伍顏色的圓盤，連線時有光柱。",
      "走上其中一個，就會瞬間出現在另一個。只有自己隊能用。",
      "站在自己隊的傳送點上按動作鍵可以收回背包，換地方再放。",
    ],
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
    title: "地圖上原本就有的機關",
    text: [
      "有些障礙物、陷阱和單向門一開局就在地圖上，顏色偏鏽、比較暗。",
      "它們不會自己消失，只有鐵鎚能敲掉。陷阱抓到一個人後也會消失。",
      "被擋住去路時，去開道具箱找鐵鎚。",
    ],
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
    holdSec: 4.5,
    expect: ["boxOpened", "placeableDestroyed", "keyPickedUp", "towerClimbed"],
  },
  {
    id: "lights",
    title: "電燈開關與黑暗",
    text: [
      "站在發光的開關格上按動作鍵，整張地圖所有人一起關燈或開燈。",
      "黑暗中只看得到自己周圍一小圈，鑰匙的光柱仍然看得見。",
      "每個開關只能用一次。要再切換，得去找下一個還亮著的開關。",
    ],
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
    title: "鬼抓人",
    text: [
      "每隔一段時間，其中一方會變成鬼 {ghostDurationSec} 秒，畫面上方會先倒數 {ghostWarningSec} 秒預告。",
      "鬼跑得比較快，碰到你就算抓到：道具全部消失、定身 {caughtFreezeSec} 秒。沒有鑰匙的鬼還會偷走你的鑰匙。",
      "當鬼的時候不能撿東西、不能用道具、也不能登塔。已經在塔頂的人不受影響，所以有鑰匙就早點登塔。",
    ],
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
    title: "計分與勝負",
    text: [
      "兩隊對戰：先讓全隊都登上塔頂的隊伍獲勝，該隊每個人的分數加倍。",
      "個人對戰：回合結束時分數最高的人獲勝。",
      "只剩最後一個人還沒登塔，或時間到，回合就結束。沒登塔的人拿不到名次分數。",
    ],
    map: map("scoring", RING, { keys: [[9, 5]] }),
    participants: solo,
    me: "me",
    teamMode: "solo",
    seed: 1,
    tuning: quiet,
    scripts: {
      me: [{ do: "wait", sec: 0.8 }, { do: "goto", x: 9, y: 5 }, { do: "wait", sec: 0.5 }, { do: "goto", x: 5, y: 4 }, { do: "face", ...N }, { do: "wait", sec: 0.5 }, { do: "act" }],
    },
    holdSec: 4.5,
    expect: ["keyPickedUp", "towerClimbed"],
    table: (t) => [
      ["登塔名次（第 1 名起）", t.scoring.towerPlacement.join(" / ")],
      ["拿到鑰匙", `+${t.scoring.keyFound}`],
      ["當鬼抓到人", `+${t.scoring.ghostCatch}`],
      ["陷阱抓到別隊", `+${t.scoring.trapCatch}`],
      ["開燈或關燈", `+${t.scoring.lightSwitch}`],
      ["登塔時每件剩餘道具", `+${t.scoring.leftoverItem}`],
      ["勝隊加成（兩隊對戰）", `×${t.scoring.winningTeamMultiplier}`],
    ],
  },
];
