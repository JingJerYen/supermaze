import type { MessageKey } from "../zh-Hant/index.js";
import { achievements } from "./achievements.js";
import { common } from "./common.js";
import { hud } from "./hud.js";
import { lobby } from "./lobby.js";
import { modes } from "./modes.js";
import { rules } from "./rules.js";

export const EN: Record<MessageKey, string> = { ...achievements, ...common, ...hud, ...lobby, ...modes, ...rules };
