import { t } from "../i18n/index.js";

/** UI names for game terms. One place, so the HUD and buttons agree. */
export const ITEM_LABEL: Record<string, string> = {
  oneWayDoor: t("hud.item.oneWayDoor"),
  obstacle: t("hud.item.obstacle"),
  hammer: t("hud.item.hammer"),
  trap: t("hud.item.trap"),
  teleportNode: t("hud.item.teleportNode"),
};

/** One-glyph fallback for item kinds that have no icon in itemIcons.ts. */
export const ITEM_GLYPH: Record<string, string> = {
  oneWayDoor: t("hud.glyph.oneWayDoor"),
  obstacle: t("hud.glyph.obstacle"),
  hammer: t("hud.glyph.hammer"),
  trap: t("hud.glyph.trap"),
  teleportNode: t("hud.glyph.teleportNode"),
};

/** Tower run skills: name, icon and one line on what they do. */
export const SKILL_INFO: Record<string, { label: string; icon: string; blurb: string }> = {
  sprint: { label: t("hud.skill.sprint.label"), icon: "⚡", blurb: t("hud.skill.sprint.blurb") },
  eagleEye: { label: t("hud.skill.eagleEye.label"), icon: "🦅", blurb: t("hud.skill.eagleEye.blurb") },
  amulet: { label: t("hud.skill.amulet.label"), icon: "🛡️", blurb: t("hud.skill.amulet.blurb") },
  lantern: { label: t("hud.skill.lantern.label"), icon: "🔦", blurb: t("hud.skill.lantern.blurb") },
  timeStop: { label: t("hud.skill.timeStop.label"), icon: "⏸️", blurb: t("hud.skill.timeStop.blurb") },
  jump: { label: t("hud.skill.jump.label"), icon: "🦘", blurb: t("hud.skill.jump.blurb") },
  pierce: { label: t("hud.skill.pierce.label"), icon: "✨", blurb: t("hud.skill.pierce.blurb") },
  warp: { label: t("hud.skill.warp.label"), icon: "🌀", blurb: t("hud.skill.warp.blurb") },
  supply: { label: t("hud.skill.supply.label"), icon: "🎁", blurb: t("hud.skill.supply.blurb") },
};

export const ACTION_LABEL: Record<string, string> = {
  climb: t("hud.action.climb"),
  switch: t("hud.action.switch"),
  pickUpNode: t("hud.action.pickUpNode"),
  useItem: t("hud.action.useItem"),
};
