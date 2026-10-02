/** Text for the rules area (keys start with "rules."). */
export const rules = {
  "rules.goal.title": "目標：拿鑰匙，回塔登頂",
  "rules.goal.line1": "每個人都要在迷宮裡找到一把自己的鑰匙，鑰匙上方有一道光柱。",
  "rules.goal.line2": "拿到後走回塔的任何一扇門前，面向門，按下動作鍵就會登上塔頂。",
  "rules.goal.line3": "登塔之後不能再回迷宮，越早登頂名次分數越高。",

  "rules.move.title": "移動：點一下轉身，按住才走",
  "rules.move.line1": "輕點方向鍵，角色只會原地轉身，不會移動。",
  "rules.move.line2": "按住方向鍵才會開始走。道具永遠放在你面前那一格，所以先轉身再放。",
  "rules.move.line3": "走道只有一格寬，但玩家之間可以互相穿過，不會卡住。",

  "rules.levels.title": "樓梯、牆頂與橋",
  "rules.levels.line1": "迷宮有兩層：地面的道路，以及牆的頂面。兩層都可以走。",
  "rules.levels.line2": "只有樓梯能上下牆頂，不能跳上去也不能跳下來。",
  "rules.levels.line3": "橋把兩段牆頂接起來，橋下的道路照常通行。鑰匙和道具箱也可能在牆頂上。",

  "rules.bag.title": "道具箱與背包",
  "rules.bag.line1": "走過道具箱就會打開，內容隨機。背包最多三件，滿了就開不了箱。",
  "rules.bag.line2": "背包先進先出：右下角的大圓鈕就是下一件，按下去就用它，不能挑。",
  "rules.bag.line3": "不想要大圓鈕裡那件？按它上方的丟棄鍵丟掉，後面的就會往右遞補上來。",

  "rules.obstacleHammer.title": "障礙物與鐵鎚",
  "rules.obstacleHammer.line1": "障礙物放在面前一格，會擋住所有人，包括你自己和隊友。",
  "rules.obstacleHammer.line2": "它 {obstacleSec} 秒後自己消失，或被鐵鎚敲掉。",
  "rules.obstacleHammer.line3": "鐵鎚可以敲掉面前的障礙物、陷阱、單向門與傳送點。揮空也會消耗掉。",

  "rules.door.title": "單向門",
  "rules.door.line1": "單向門放在面前一格，通行方向就是你放下時面對的方向，地上有箭頭。",
  "rules.door.line2": "順著箭頭可以通過，反方向會被擋住。",
  "rules.door.line3": "對所有人都有效，包括放的人。{doorSec} 秒後消失。",

  "rules.trap.title": "定身陷阱",
  "rules.trap.line1": "陷阱放在面前一格。第一個踩上去的人會被鐵籠罩住，{trapFreezeSec} 秒內不能移動，也不能用道具。",
  "rules.trap.line2": "陷阱抓到一個人就消失，沒人踩的話 {trapSec} 秒後消失。",
  "rules.trap.line3": "誰踩到都算，包括你自己。抓到別隊的人可以得分。",

  "rules.teleport.title": "傳送點",
  "rules.teleport.line1": "傳送點要放兩個才會連線。放下後是地上一塊隊伍顏色的圓盤，連線時有光柱。",
  "rules.teleport.line2": "走上其中一個，就會瞬間出現在另一個。只有自己隊能用。",
  "rules.teleport.line3": "站在自己隊的傳送點上按動作鍵可以收回背包，換地方再放。",

  "rules.fixtures.title": "地圖上原本就有的機關",
  "rules.fixtures.line1": "有些障礙物、陷阱和單向門一開局就在地圖上，一律是紫色。",
  "rules.fixtures.line2": "它們不會自己消失，只有鐵鎚能敲掉。陷阱抓到一個人後也會消失。",
  "rules.fixtures.line3": "被擋住去路時，去開道具箱找鐵鎚。",

  "rules.lights.title": "電燈開關與黑暗",
  "rules.lights.line1": "站在發光的開關格上按動作鍵，整張地圖所有人一起關燈或開燈。",
  "rules.lights.line2": "黑暗中只看得到周圍一小圈，小地圖也看不到別人，適合躲鬼、甩開對手；CPU 的視野也會變小。鑰匙的光柱仍然看得見。",
  "rules.lights.line3": "每個開關只能用一次。要再切換，得去找下一個還亮著的開關。",

  "rules.ghost.title": "鬼抓人",
  "rules.ghost.line1": "每隔一段時間會有一方變成鬼 {ghostDurationSec} 秒，開始前畫面上方會先倒數。",
  "rules.ghost.line2": "鬼跑得比較快，被碰到會掉光道具、定身 {caughtFreezeSec} 秒；沒有鑰匙的鬼還會偷走你的鑰匙。",
  "rules.ghost.line3": "已經登塔的人不受影響，所以有鑰匙就早點登塔。",

  "rules.scoring.title": "計分與勝負",
  "rules.scoring.line1": "兩隊對戰：先讓全隊都登上塔頂的隊伍獲勝，該隊每個人的分數加倍。",
  "rules.scoring.line2": "個人對戰：回合結束時分數最高的人獲勝。",
  "rules.scoring.line3": "只剩最後一個人還沒登塔，或時間到，回合就結束。沒登塔的人拿不到名次分數。",

  "rules.towerRun.title": "爬塔挑戰（單機）",
  "rules.towerRun.line1": "單機是 {floors} 層的爬塔挑戰，每層和 CPU 比分數，越往上越難。",
  "rules.towerRun.line2": "你一登塔這層就結算，分數排前一半就晉級，各層分數加成總分。",
  "rules.towerRun.line3": "每層開打前選一個技能，按 R 或技能鍵用一次。沒晉級可以按「繼續」，每次挑戰最多 2 次。",

  // Names of the demo players, shown over their heads and in the HUD's notices.
  "rules.name.you": "你",
  "rules.name.foe": "對手",

  // The scoring card's table.
  "rules.table.placement": "登塔名次（第 1 名起）",
  "rules.table.keyFound": "拿到鑰匙",
  "rules.table.ghostCatch": "當鬼抓到人",
  "rules.table.trapCatch": "陷阱抓到別隊",
  "rules.table.lightSwitch": "開燈或關燈",
  "rules.table.leftoverItem": "登塔時每件剩餘道具",
  "rules.table.winMultiplier": "勝隊加成（兩隊對戰）",

  // The tower-run card's table.
  "rules.table.passRank": "晉級名次",
  "rules.table.passRankItem": "{n} 人前 {rank} 名",
  "rules.table.listSep": "・",
  "rules.table.cpu": "CPU",
  "rules.table.cpuValue": "{min}～{max} 個，越往上越強",
  "rules.table.floors": "第 {from}～{to} 層",
  "rules.table.map.easy": "簡單地圖",
  "rules.table.map.medium": "中等地圖",
  "rules.table.map.hard": "困難地圖",
  "rules.table.specialFloors": "第 {floors} 層",
  "rules.table.floorSep": "、",

  // The rules screen around the cards.
  "rules.screen.page": "遊戲規則 {page} / {total}",
  "rules.screen.prev": "上一張",
  "rules.screen.next": "下一張",
  "rules.screen.home": "回首頁",
} as const;
