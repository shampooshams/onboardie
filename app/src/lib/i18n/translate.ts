import { en, type MessageKey } from "./en";
import { de } from "./de";

export type Lang = "en" | "de";
export type { MessageKey };

const MESSAGES: Record<Lang, Record<MessageKey, string>> = { en, de };

type Vars = Record<string, string | number>;

/** Translates a key without React, e.g. in server functions that get the language passed in. */
export function translate(lang: Lang, key: MessageKey, vars?: Vars) {
  const template = MESSAGES[lang][key] ?? en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "de";
}

/** Server-function inputs carry the UI language; anything unexpected falls back to English. */
export function langFrom(value: unknown): Lang {
  return isLang(value) ? value : "en";
}
