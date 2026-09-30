import type { CharacterId } from "@supermaze/protocol";

/**
 * The name prefilled in the name field for each character (character setup);
 * the player can clear or change it. At most NAME_MAX_CHARS (6) characters
 * each; a test checks. Every character must have one (the type insists).
 * The a..f letters match the portraits' order in the picker: males on the
 * first row, females on the second.
 */
export const DEFAULT_NAMES: Record<CharacterId, string> = {
  "character-male-a": "男生A",
  "character-male-b": "男生B",
  "character-male-c": "男生C",
  "character-male-d": "男生D",
  "character-male-e": "男生E",
  "character-male-f": "男生F",
  "character-female-a": "女生A",
  "character-female-b": "女生B",
  "character-female-c": "女生C",
  "character-female-d": "女生D",
  "character-female-e": "女生E",
  "character-female-f": "女生F",
};

/** The default name for `character`, or null when it has none (no pick yet). */
export function defaultNameFor(character: string | null | undefined): string | null {
  return character ? (DEFAULT_NAMES[character as CharacterId] ?? null) : null;
}
