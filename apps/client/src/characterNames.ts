import { CHARACTER_IDS, type CharacterId } from "@supermaze/protocol";
import { SeededRandom } from "@supermaze/sim";

/** The name of a player who has picked no character and typed no name. */
export const FALLBACK_NAME = "玩家";

/**
 * The name prefilled in the name field for each character (character setup);
 * the player can clear or change it. At most NAME_MAX_CHARS (6) characters
 * each and all different; a test checks. Every character must have one (the
 * type insists).
 * The a..f letters match the portraits' order in the picker: males on the
 * first row, females on the second.
 */
export const DEFAULT_NAMES: Record<CharacterId, string> = {
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
};

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
