import { EN } from "./en/index.js";
import { ZH_HANT, type MessageKey } from "./zh-Hant/index.js";

/**
 * Translated text (CLAUDE.md section 17.1). Every string a player reads comes
 * from `t(key)`; the dictionaries are zh-Hant/ (the original wording) and en/,
 * one file per area of the game, and the type system makes every English
 * area carry every Chinese key. `{name}` in a message is filled from the
 * params.
 *
 * The language follows the device (navigator.languages): any Chinese gets
 * zh-Hant, anything else gets English. `?lang=en` or `?lang=zh-Hant` picks one
 * and remembers it in this browser (`supermaze.lang`).
 */
export type Locale = "zh-Hant" | "en";
export type { MessageKey };

export const LOCALES: readonly Locale[] = ["zh-Hant", "en"];
const DICTS: Record<Locale, Readonly<Record<MessageKey, string>>> = { "zh-Hant": ZH_HANT, en: EN };
const KEY = "supermaze.lang";

/** The first of `wanted` (BCP 47 tags, most preferred first) we have; English when none. */
export function pickLocale(wanted: readonly string[]): Locale {
  for (const tag of wanted) {
    const lang = tag.toLowerCase();
    if (lang.startsWith("zh")) return "zh-Hant";
    if (lang.startsWith("en")) return "en";
  }
  return "en";
}

function detect(): Locale {
  if (typeof window === "undefined") return "zh-Hant"; // tests and tools: the original wording
  const asked = new URLSearchParams(location.search).get("lang");
  try {
    if (asked && (LOCALES as readonly string[]).includes(asked)) localStorage.setItem(KEY, asked);
    const saved = localStorage.getItem(KEY);
    if (saved && (LOCALES as readonly string[]).includes(saved)) return saved as Locale;
  } catch {
    /* storage unavailable: follow the device */
  }
  return pickLocale(navigator.languages?.length ? navigator.languages : [navigator.language ?? ""]);
}

/** The language of this page, fixed at load. */
export const locale: Locale = detect();

/** `key` in `lang` (default: the page's language), with `{name}` placeholders filled from `params`. */
export function t(key: MessageKey, params?: Readonly<Record<string, string | number>>, lang: Locale = locale): string {
  const text = DICTS[lang][key] ?? ZH_HANT[key] ?? key;
  return params ? fill(text, params) : text;
}

/** Fills `{name}` placeholders; unknown names stay as written so a typo shows on screen. */
export function fill(text: string, params: Readonly<Record<string, string | number>>): string {
  return text.replace(/\{(\w+)\}/g, (all, name: string) => (name in params ? String(params[name]) : all));
}

/** Page language and title; called once at startup. */
export function applyDocumentLocale(): void {
  document.documentElement.lang = locale;
  document.title = t("app.title");
}
