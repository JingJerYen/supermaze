import { CHARACTER_IDS, type CharacterId } from "@supermaze/protocol";
import { SeededRandom } from "@supermaze/sim";
import { locale, type Locale } from "./i18n/index.js";

/**
 * Names per language. `fallback` is the name of a player who has picked no
 * character and typed no name; `names` is the one prefilled in the name field
 * for each character (character setup), which the player can clear or change.
 * At most NAME_MAX_CHARS (6) characters each and all different within a
 * language; a test checks. Every character must have one (the type insists).
 * The a..f letters match the portraits' order in the picker: males on the
 * first row, females on the second.
 *
 * The Chinese names are in-jokes chosen by the designer; the English ones are
 * placeholders until someone picks names that land the same way.
 */
const NAMES: Record<Locale, { fallback: string; names: Record<CharacterId, string> }> = {
  "zh-Hant": {
    fallback: "玩家",
    names: {
      "character-male-a": "杰哥~", // glasses, green shirt
      "character-male-b": "初四了阿伯", // bald, big beard
      "character-male-c": "正義哥", // police
      "character-male-d": "霸總", // suit and tie
      "character-male-e": "周餅輪", // glasses, white shirt, braces
      "character-male-f": "8+9", // scowl, overalls
      "character-female-a": "阮月嬌", // hair bun, purple top
      "character-female-b": "國民女友", // two buns, yellow top
      "character-female-c": "房東阿姨", // grey hair bun
      "character-female-d": "法拉利姊", // grey jacket, earrings
      "character-female-e": "女版張凌赫", // short black hair, white shirt
      "character-female-f": "煞氣a小妹", // long hair, eye shadow
    },
  },
  en: {
    fallback: "Player",
    names: {
      "character-male-a": "Jerry~",
      "character-male-b": "Gramps",
      "character-male-c": "Sarge",
      "character-male-d": "Boss",
      "character-male-e": "Nerdy",
      "character-male-f": "Punk",
      "character-female-a": "Mabel",
      "character-female-b": "Honey",
      "character-female-c": "Madam",
      "character-female-d": "Diva",
      "character-female-e": "Ace",
      "character-female-f": "Rebel",
    },
  },
};

/** The names of `lang` (default: the page's language). */
export function namesFor(lang: Locale = locale): { fallback: string; names: Record<CharacterId, string> } {
  return NAMES[lang];
}

/** The name of a player who has picked no character and typed no name. */
export const FALLBACK_NAME = NAMES[locale].fallback;

/** This page's prefilled name for each character. */
export const DEFAULT_NAMES: Record<CharacterId, string> = NAMES[locale].names;

/** The default name for `character`, or null when it has none (no pick yet). */
export function defaultNameFor(character: string | null | undefined): string | null {
  return character ? (DEFAULT_NAMES[character as CharacterId] ?? null) : null;
}

/**
 * Characters and names for `count` CPU opponents: each a different character,
 * none the same as `taken` (the player's), named with that character's
 * default name. Shuffled by `seed`, so every floor has its own line-up and a
 * replay has the same one. When there are more CPUs than characters left,
 * characters repeat.
 */
export function cpuCast(count: number, seed: number, taken: readonly (string | null)[]): { character: CharacterId; name: string }[] {
  const free = CHARACTER_IDS.filter((c) => !taken.includes(c));
  const pool = [...(free.length > 0 ? free : CHARACTER_IDS)];
  const rng = new SeededRandom(seed);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    [pool[i], pool[j]] = [pool[j] as CharacterId, pool[i] as CharacterId];
  }
  return Array.from({ length: count }, (_, i) => {
    const character = pool[i % pool.length] as CharacterId;
    return { character, name: DEFAULT_NAMES[character] };
  });
}
