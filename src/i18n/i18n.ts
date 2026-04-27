/**
 * Tiny i18n layer — no external deps. Strings live in /src/i18n/locales/<code>.json
 * keyed by dotted path. `t("sidebar.headings.widgets")` resolves to the matching
 * leaf string. `t("widgets.toggle.show", { name: "Time" })` interpolates {{name}}.
 *
 * Adding a new locale:
 *   1. Drop a new JSON file in /src/i18n/locales/ matching the en.json shape.
 *   2. Register it in `dictionaries` below.
 *   3. Call `setLocale("xx")` to switch.
 *
 * Missing keys fall back to returning the key itself (so it's obvious in the UI
 * which strings haven't been translated yet).
 */

import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import pt from "./locales/pt.json";
import zh from "./locales/zh.json";

type Dict = Record<string, unknown>;

const dictionaries: Record<string, Dict> = {
  en: en as Dict,
  ja: ja as Dict,
  ko: ko as Dict,
  es: es as Dict,
  fr: fr as Dict,
  pt: pt as Dict,
  zh: zh as Dict,
};

// Languages exposed in the UI picker. The `label` is shown in the
// language's own script so a user who doesn't read English can still
// recognize their tongue. Missing translations fall back to English
// at lookup time, so partial locale files are safe to ship.
export interface LanguageOption {
  code: string;
  label: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "pt", label: "Português" },
  { code: "zh", label: "中文" },
];

import {
  readSync as readPersisted,
  subscribe as subscribePersisted,
  write as writePersisted,
} from "../storage/hybridStorage";

const STORAGE_KEY = "ghiblify_locale";

const readPersistedLocale = (): string => {
  const v = readPersisted<string | null>(STORAGE_KEY, null);
  if (v && dictionaries[v]) return v;
  return "en";
};

let currentLocale: string = readPersistedLocale();
const listeners = new Set<() => void>();

// Note: <html lang> is intentionally NOT mutated when the user
// switches locale — the page markup stays English-tagged regardless,
// which keeps Chrome's "translate this page" prompt and other
// browser-language heuristics consistent.

export function setLocale(locale: string): void {
  if (!dictionaries[locale]) {
    console.warn(`[i18n] Unknown locale "${locale}", staying on "${currentLocale}"`);
    return;
  }
  currentLocale = locale;
  writePersisted(STORAGE_KEY, locale);
  listeners.forEach((l) => l());
}

// Cross-device sync — when chrome.storage.sync delivers a remote
// locale update from another Chrome install, switch to it without
// requiring a reload. Skip if the value is already what we have.
subscribePersisted(STORAGE_KEY, (next) => {
  if (typeof next !== "string" || !dictionaries[next]) return;
  if (next === currentLocale) return;
  currentLocale = next;
  listeners.forEach((l) => l());
});

export function getLocale(): string {
  return currentLocale;
}

export function t(
  key: string,
  vars?: Record<string, string | number>
): string {
  const dict = dictionaries[currentLocale] || dictionaries.en;
  const fallback = dictionaries.en;

  const lookup = (d: Dict): string | undefined => {
    let cur: unknown = d;
    for (const part of key.split(".")) {
      if (cur && typeof cur === "object" && part in (cur as Dict)) {
        cur = (cur as Dict)[part];
      } else {
        return undefined;
      }
    }
    return typeof cur === "string" ? cur : undefined;
  };

  let value = lookup(dict) ?? lookup(fallback);
  if (value == null) return key;

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replace(new RegExp(`{{\\s*${k}\\s*}}`, "g"), String(v));
    }
  }
  return value;
}

// Lightweight React hook so components re-render on locale change.
import { useEffect, useState } from "react";

export function useT(): typeof t {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((v) => v + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return t;
}
