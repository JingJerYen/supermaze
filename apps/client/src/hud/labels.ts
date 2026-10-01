/** Chinese UI strings for game terms. One place, so the HUD and buttons agree. */
export const ITEM_LABEL: Record<string, string> = {
  oneWayDoor: "單向門",
  obstacle: "障礙物",
  hammer: "鐵鎚",
  trap: "陷阱",
  teleportNode: "傳送點",
};

/** One-glyph fallback for item kinds that have no icon in itemIcons.ts. */
export const ITEM_GLYPH: Record<string, string> = {
  oneWayDoor: "門",
  obstacle: "障",
  hammer: "鎚",
  trap: "阱",
  teleportNode: "傳",
};

/** Tower run skills: name, icon and one line on what they do. */
export const SKILL_INFO: Record<string, { label: string; icon: string; blurb: string }> = {
  sprint: { label: "衝刺", icon: "⚡", blurb: "一段時間內跑得更快" },
  eagleEye: { label: "鷹眼", icon: "🦅", blurb: "從高空看整張地圖" },
  amulet: { label: "護身符", icon: "🛡️", blurb: "擋下一次陷阱或鬼抓" },
  lantern: { label: "點燈", icon: "🔦", blurb: "黑暗中看得更遠（關燈時才能用）" },
  timeStop: { label: "時間暫停", icon: "⏸️", blurb: "所有對手停住不動" },
  jump: { label: "跳", icon: "🦘", blurb: "跳上面前的牆，或從牆頂跳下" },
  pierce: { label: "穿透", icon: "✨", blurb: "穿過障礙物、單向門與陷阱" },
  warp: { label: "隨機傳送", icon: "🌀", blurb: "瞬間移到隨機的位置" },
  supply: { label: "補給", icon: "🎁", blurb: "背包補滿隨機道具" },
};

export const ACTION_LABEL: Record<string, string> = {
  climb: "登塔",
  switch: "開關",
  pickUpNode: "收回傳送點",
  useItem: "用道具",
};
