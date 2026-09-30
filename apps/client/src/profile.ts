import type * as THREE from "three";
import { capName, sanitizeCharacter } from "@supermaze/protocol";
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
export const DEFAULT_NAME = "玩家";

export function loadProfile(): Profile {
  return {
    name: capName((read(NAME_KEY) ?? "").trim()) || DEFAULT_NAME,
    character: sanitizeCharacter(read(CHAR_KEY)),
  };
}

export function saveProfile(p: Profile): void {
  write(NAME_KEY, capName(p.name.trim()) || DEFAULT_NAME);
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
