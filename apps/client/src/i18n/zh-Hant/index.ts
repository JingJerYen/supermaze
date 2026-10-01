import { common } from "./common.js";
import { hud } from "./hud.js";
import { lobby } from "./lobby.js";
import { modes } from "./modes.js";
import { rules } from "./rules.js";

/** The original wording; its keys are the full set every language must carry. */
export const ZH_HANT = { ...common, ...hud, ...lobby, ...modes, ...rules };
export type MessageKey = keyof typeof ZH_HANT;
