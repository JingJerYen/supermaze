import type * as THREE from "three";
import { capName, sanitizeCharacter } from "@supermaze/protocol";
import { defaultNameFor, FALLBACK_NAME } from "./characterNames.js";
import { CharacterPreview } from "./render/characterPreview.js";

/**
 * Who the player is, set once on the home screen's character setup and used
 * everywhere: online rooms and the tower run alike. Kept in this browser.
 */
export interface Profile {
  name: string;
  /** Picked character, or null for the id-based default. */
  character: string | null;
}

const NAME_KEY = "supermaze.name";
const CHAR_KEY = "supermaze.character";

/** The saved profile; a player who never set a name gets their character's default name. */
export function loadProfile(): Profile {
  const character = sanitizeCharacter(read(CHAR_KEY));
  return {
    name: capName((read(NAME_KEY) ?? "").trim()) || defaultNameFor(character) || FALLBACK_NAME,
    character,
  };
}

/** Whether the player has typed a name of their own (else it follows the character's default). */
export function hasOwnName(): boolean {
  return !!(read(NAME_KEY) ?? "").trim();
}

export function saveProfile(p: Profile): void {
  write(NAME_KEY, capName(p.name.trim()) || FALLBACK_NAME);
  if (p.character) write(CHAR_KEY, p.character);
}

let portraitCache: Map<string, string> | null = null;

/** Head-and-shoulders portraits of every character, drawn once with the game's renderer. */
export function portraits(renderer: THREE.WebGLRenderer): Map<string, string> {
  portraitCache ??= CharacterPreview.portraits(renderer);
  return portraitCache;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}
