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

// English is the fallback baseline — always present so any missing
// translation in another locale falls through to a real string. The
// other 12 locales are loaded lazily on demand via dynamic import so
// they DON'T ship in the initial JS bundle. Vite splits each
// `import("./locales/<code>.json")` into its own chunk that's only
// fetched when the user picks that language. After the dynamic
// import resolves, the dictionary populates and listeners notify so
// the UI re-renders with translated strings.
import en from "./locales/en.json";

type Dict = Record<string, unknown>;

const dictionaries: Record<string, Dict> = {
  en: en as Dict,
};

// Lazy loaders. Keys here are the supported codes. Listing them
// statically (rather than `import(\`./locales/${code}.json\`)` from a
// variable) lets Vite see each as a separate chunk at build time. */
const loaders: Record<string, () => Promise<Dict>> = {
  ja: () => import("./locales/ja.json").then((m) => m.default as Dict),
  ko: () => import("./locales/ko.json").then((m) => m.default as Dict),
  es: () => import("./locales/es.json").then((m) => m.default as Dict),
  fr: () => import("./locales/fr.json").then((m) => m.default as Dict),
  pt: () => import("./locales/pt.json").then((m) => m.default as Dict),
  zh: () => import("./locales/zh.json").then((m) => m.default as Dict),
};

// Track in-flight loads so concurrent setLocale calls share one
// network/parse pass instead of fetching the same chunk twice.
const inflight: Record<string, Promise<Dict> | undefined> = {};

const ensureLoaded = (code: string): Promise<Dict> => {
  if (dictionaries[code]) return Promise.resolve(dictionaries[code]);
  const loader = loaders[code];
  if (!loader) return Promise.resolve(dictionaries.en);
  if (inflight[code]) return inflight[code]!;
  const p = loader()
    .then((dict) => {
      dictionaries[code] = dict;
      delete inflight[code];
      // Wake up the UI so anything that already rendered with the
      // English fallback can re-render with the proper strings.
      listeners.forEach((l) => l());
      return dict;
    })
    .catch((err) => {
      delete inflight[code];
      console.warn(`[i18n] Failed to load locale "${code}":`, err);
      return dictionaries.en;
    });
  inflight[code] = p;
  return p;
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

const isKnownLocale = (code: string): boolean =>
  code === "en" || code in loaders;

const readPersistedLocale = (): string => {
  const v = readPersisted<string | null>(STORAGE_KEY, null);
  if (v && isKnownLocale(v)) return v;
  return "en";
};

let currentLocale: string = readPersistedLocale();
const listeners = new Set<() => void>();

// Boot — kick off the saved locale's load (no-op for en, fire and
// forget for everything else). Until the chunk arrives, lookups
// fall back to en so the first paint is never blank.
if (currentLocale !== "en") ensureLoaded(currentLocale);

// Note: <html lang> is intentionally NOT mutated when the user
// switches locale — the page markup stays English-tagged regardless,
// which keeps Chrome's "translate this page" prompt and other
// browser-language heuristics consistent.

export function setLocale(locale: string): void {
  if (!isKnownLocale(locale)) {
    console.warn(`[i18n] Unknown locale "${locale}", staying on "${currentLocale}"`);
    return;
  }
  currentLocale = locale;
  writePersisted(STORAGE_KEY, locale);
  // Fire listeners now so the picker UI flips immediately. The
  // strings might still be in English for a beat while the chunk
  // loads — `ensureLoaded` fires a second notify on resolve so the
  // UI re-renders with the proper translations.
  listeners.forEach((l) => l());
  if (locale !== "en") ensureLoaded(locale);
}

// Cross-device sync — when chrome.storage.sync delivers a remote
// locale update from another Chrome install, switch to it without
// requiring a reload. Skip if the value is already what we have.
subscribePersisted(STORAGE_KEY, (next) => {
  if (typeof next !== "string" || !isKnownLocale(next)) return;
  if (next === currentLocale) return;
  currentLocale = next;
  listeners.forEach((l) => l());
  if (next !== "en") ensureLoaded(next);
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
