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

type Dict = Record<string, unknown>;

const dictionaries: Record<string, Dict> = {
  en: en as Dict,
};

let currentLocale: string = "en";
const listeners = new Set<() => void>();

export function setLocale(locale: string): void {
  if (!dictionaries[locale]) {
    console.warn(`[i18n] Unknown locale "${locale}", staying on "${currentLocale}"`);
    return;
  }
  currentLocale = locale;
  listeners.forEach((l) => l());
}

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
