// Single combined entry for everything that customizes the rotating
// photo background:
//   favorites — URLs always kept in the rotation pool
//   blacklist — URLs that should never appear
//   selection — which movies the user has enabled / disabled
//   filters   — blur / brightness / contrast / saturation sliders
//
// All four used to live in their own keys (background_selection,
// background_filters, ghiblify_favorites, ghiblify_blacklist) which
// muddled the namespace and meant four separate migrations every
// time the shape changed. Now everything lives inside
// `ghiblify_background` and migrates from the four legacy keys on
// first load (idempotent — runs once per page load and is a no-op
// once cleaned up).
//
// Persistence flows through hybridStorage — chrome.storage.local is
// the source of truth, with a localStorage mirror for synchronous
// first-paint reads. See ../storage/hybridStorage.ts.

import {
  readSync as readPersisted,
  write as writePersisted,
  remove as removePersisted,
} from "./hybridStorage";

export interface BackgroundFilters {
  blur: number;
  brightness: number;
  contrast: number;
  saturation: number;
}

interface BackgroundBlob {
  favorites?: string[];
  blacklist?: string[];
  selection?: Record<string, boolean>;
  filters?: BackgroundFilters;
  /** When true, the photo gently shifts in response to cursor
   *  position to create a soft parallax / depth effect. Default
   *  false (static, identical to legacy behavior). */
  parallax?: boolean;
}

const KEY = "ghiblify_background";

export const DEFAULT_FILTERS: BackgroundFilters = {
  blur: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100,
};

const LEGACY_KEYS = [
  "ghiblify_favorites",
  "ghiblify_blacklist",
  "background_selection",
  "background_filters",
];

const readBlob = (): BackgroundBlob => {
  const parsed = readPersisted<BackgroundBlob | null>(KEY, null);
  return parsed && typeof parsed === "object" ? parsed : {};
};

const writeBlob = (next: BackgroundBlob) => {
  if (Object.keys(next).length === 0) {
    removePersisted(KEY);
  } else {
    writePersisted(KEY, next);
  }
};

const tryParseArray = (raw: string | null): string[] | null => {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : null;
  } catch {
    return null;
  }
};

const tryParseRecord = (
  raw: string | null
): Record<string, boolean> | null => {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : null;
  } catch {
    return null;
  }
};

const tryParseFilters = (raw: string | null): BackgroundFilters | null => {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    return { ...DEFAULT_FILTERS, ...obj };
  } catch {
    return null;
  }
};

const migrateLegacy = () => {
  try {
    if (localStorage.getItem(KEY)) {
      // Already migrated — sweep up any legacy stragglers.
      LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
      return;
    }
    const blob: BackgroundBlob = {};
    const favorites = tryParseArray(localStorage.getItem("ghiblify_favorites"));
    if (favorites && favorites.length) blob.favorites = favorites;
    const blacklist = tryParseArray(localStorage.getItem("ghiblify_blacklist"));
    if (blacklist && blacklist.length) blob.blacklist = blacklist;
    const selection = tryParseRecord(
      localStorage.getItem("background_selection")
    );
    if (selection && Object.keys(selection).length) blob.selection = selection;
    const filters = tryParseFilters(localStorage.getItem("background_filters"));
    if (filters) blob.filters = filters;
    if (Object.keys(blob).length) writeBlob(blob);
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
};
migrateLegacy();

// Favorites
export const readFavorites = (): string[] => readBlob().favorites ?? [];
export const writeFavorites = (favs: string[]) => {
  const next = readBlob();
  if (favs.length) next.favorites = favs;
  else delete next.favorites;
  writeBlob(next);
};

// Blacklist
export const readBlacklist = (): string[] => readBlob().blacklist ?? [];
export const writeBlacklist = (bl: string[]) => {
  const next = readBlob();
  if (bl.length) next.blacklist = bl;
  else delete next.blacklist;
  writeBlob(next);
};

// Selection (per-movie enabled flags)
export const readSelection = (): Record<string, boolean> =>
  readBlob().selection ?? {};
export const writeSelection = (sel: Record<string, boolean>) => {
  const next = readBlob();
  next.selection = sel;
  writeBlob(next);
};

// Filters
export const readFilters = (): BackgroundFilters => ({
  ...DEFAULT_FILTERS,
  ...readBlob().filters,
});
export const writeFilters = (filters: BackgroundFilters) => {
  const next = readBlob();
  next.filters = filters;
  writeBlob(next);
};

// Parallax (boolean)
export const readParallax = (): boolean => readBlob().parallax === true;
export const writeParallax = (on: boolean) => {
  const next = readBlob();
  if (on) next.parallax = true;
  else delete next.parallax;
  writeBlob(next);
};
