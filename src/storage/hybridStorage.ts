/**
 * Hybrid storage layer
 * ============================================================================
 *
 * Persistence backed by `chrome.storage` (source of truth) with a
 * `localStorage` mirror for SYNCHRONOUS first-paint reads. Each
 * registered key is tiered to either `chrome.storage.sync` (portable
 * across the user's Chrome installs) or `chrome.storage.local`
 * (extension-local, larger quota).
 *
 * ## Why hybrid?
 *
 * `chrome.storage.*` is async-only. The new-tab page is a paint-
 * critical surface - restoring widget layout / theme / language needs
 * to happen during React's initial state setup so the page paints
 * with the user's saved state, not defaults that flash + flicker.
 * Synchronous reads from a `localStorage` mirror solve that, while
 * `chrome.storage` keeps the source-of-truth honest and unlocks
 * cross-device sync for the `.sync`-tiered keys.
 *
 * ## Tiers
 *
 * - `sync`  - small, portable (locale, appearance). 100 KB total
 *   / 8 KB per item / 1800 writes per hour.
 * - `local` - bigger blobs that don't need to follow you across
 *   devices (widget settings, todos, background prefs, install
 *   flags). ~10 MB.
 *
 * Anything cross-tab-sensitive that needs a synchronous `storage`
 * event (Pomodoro leader election) or location-tied caches (weather)
 * STAYS on plain localStorage and is NOT registered here.
 *
 * ## API surface
 *
 *   readSync(key, fallback)  - instant read from the mirror
 *   write(key, value)        - write to BOTH (mirror sync, chrome async)
 *   remove(key)              - remove from BOTH
 *   subscribe(key, fn)       - fires on any chrome.storage change
 *                              for that key (this tab, sibling tab,
 *                              or remote sync from another device)
 *   migrateOnce()            - one-time copy of pre-hybrid
 *                              localStorage values into chrome.storage
 *
 * Values are arbitrary JSON-serializable data. The mirror stringifies;
 * chrome.storage stores the parsed structure natively.
 */

type Area = "sync" | "local";

// Registry of every key managed by this layer + which chrome.storage
// area owns its source-of-truth. Adding a new persistent key? Add it
// here and use the API below - DO NOT call localStorage directly for
// these keys. Pomodoro and weather caches are intentionally NOT here
// (they stay on plain localStorage; see their files).
export const HYBRID_KEYS: Record<string, Area> = {
  // Tiny portable preferences - sync across the user's devices.
  ghiblify_locale: "sync",
  ghiblify_appearance: "sync",
  // Larger blobs that don't need to follow the user across devices.
  // Could be promoted to "sync" later if quota allows.
  ghiblify_widgets: "local",
  ghiblify_widgets_schema_version: "local",
  ghiblify_background: "local",
  ghiblify_todo: "local",
  // Per-install flag.
  ghiblify_guide_seen: "local",
};

// Single combined gate for ALL one-time setup work - both v1 (jQuery)
// data cleanup AND the localStorage→chrome.storage migration. Replaces
// the previous pair of flags (`ghiblify_legacy_cleaned`,
// `ghiblify_hybrid_migrated`); see runOneTimeSetup below.
const SETUP_FLAG = "ghiblify_setup_done";
const SETUP_VERSION = 2;
const LEGACY_FLAGS = [
  "ghiblify_legacy_cleaned",
  "ghiblify_hybrid_migrated",
];

type Listener = (newValue: unknown) => void;
const listeners = new Map<string, Set<Listener>>();

const chromeNs: any =
  typeof chrome !== "undefined" ? (chrome as any) : undefined;
const hasChromeStorage = !!chromeNs?.storage?.local && !!chromeNs?.storage?.sync;

const areaFor = (key: string): Area | null =>
  Object.prototype.hasOwnProperty.call(HYBRID_KEYS, key)
    ? HYBRID_KEYS[key]
    : null;

// --- Mirror (localStorage) helpers ------------------------------------------

const readMirror = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeMirror = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded / private mode - ignore */
  }
};

const removeMirror = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

// --- Public API -------------------------------------------------------------

/**
 * Synchronous read from the localStorage mirror. Use this in React
 * `useState(() => readSync(...))` initializers so the first paint
 * has saved data.
 */
export const readSync = <T>(key: string, fallback: T): T =>
  readMirror(key, fallback);

/**
 * Write to BOTH localStorage (sync, instant) and chrome.storage
 * (async, source of truth). Fire-and-forget - chrome.storage
 * failures fall back to the mirror.
 */
export const write = (key: string, value: unknown): void => {
  writeMirror(key, value);
  const area = areaFor(key);
  if (!area || !hasChromeStorage) return;
  try {
    chromeNs.storage[area].set({ [key]: value });
  } catch {
    /* ignore - mirror still holds it */
  }
};

/** Remove from both mirror and chrome.storage. */
export const remove = (key: string): void => {
  removeMirror(key);
  const area = areaFor(key);
  if (!area || !hasChromeStorage) return;
  try {
    chromeNs.storage[area].remove(key);
  } catch {
    /* ignore */
  }
};

/**
 * Subscribe to changes for a key. Fires when:
 *   - Another tab writes via this layer
 *   - chrome.storage.sync delivers a remote update from a sibling
 *     Chrome install (only for `sync`-tier keys)
 *
 * Returns an unsubscribe function.
 */
export const subscribe = (key: string, fn: Listener): (() => void) => {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(fn);
  return () => {
    listeners.get(key)?.delete(fn);
  };
};

const notify = (key: string, newValue: unknown) => {
  const set = listeners.get(key);
  if (!set) return;
  for (const fn of Array.from(set)) {
    try {
      fn(newValue);
    } catch (e) {
      console.error("[hybridStorage] listener error", key, e);
    }
  }
};

// --- chrome.storage.onChanged → mirror + listeners --------------------------

if (hasChromeStorage) {
  chromeNs.storage.onChanged.addListener(
    (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>, _area: string) => {
      for (const key of Object.keys(changes)) {
        if (!areaFor(key)) continue;
        const next = changes[key].newValue;
        if (next === undefined) {
          removeMirror(key);
        } else {
          writeMirror(key, next);
        }
        notify(key, next);
      }
    }
  );
}

// --- One-time setup ---------------------------------------------------------

// Internal worker - SEED chrome.storage from the localStorage mirror:
// copy across registered keys chrome.storage doesn't have yet, and
// leave the ones it does have alone. Idempotent. Caller gates it.
//
// "Seed, don't overwrite" is the whole contract, and it matters
// because this runs again whenever SETUP_VERSION moves - i.e. on an
// upgrade, for users who already have data. The mirror is not
// authoritative: it's localStorage, it only tracks remote changes
// while a tab is open (see the onChanged listener above), so a browser
// that was closed while another device made changes boots with a stale
// mirror. Pushing that wholesale would hand sync the older values and
// silently undo the other device's edits. Anything genuinely newer in
// the mirror reaches chrome.storage through the next `write()`
// anyway - every write goes to both layers.
const performHybridMigration = async (): Promise<void> => {
  if (!hasChromeStorage) return;

  // Bucket by area so we can issue at most two get/set pairs rather
  // than one per key.
  const mirrored: Record<Area, Record<string, unknown>> = {
    sync: {},
    local: {},
  };

  for (const [key, area] of Object.entries(HYBRID_KEYS)) {
    const raw = localStorage.getItem(key);
    if (raw == null) continue;
    try {
      mirrored[area][key] = JSON.parse(raw);
    } catch {
      // Stored as a non-JSON string (legacy "true"/"false" flags).
      // Preserve as-is so the parse-on-read path still recovers it.
      mirrored[area][key] = raw;
    }
  }

  const getArea = (area: Area, keys: string[]) =>
    new Promise<Record<string, unknown>>((resolve) => {
      if (!keys.length) return resolve({});
      try {
        chromeNs.storage[area].get(keys, (items: Record<string, unknown>) =>
          resolve(items ?? {}),
        );
      } catch {
        // Unreadable: treat everything as already present rather than
        // risk overwriting values we failed to look at.
        resolve(Object.fromEntries(keys.map((k) => [k, null])));
      }
    });

  const setArea = (area: Area, payload: Record<string, unknown>) =>
    new Promise<void>((resolve) => {
      if (Object.keys(payload).length === 0) return resolve();
      try {
        chromeNs.storage[area].set(payload, () => resolve());
      } catch {
        resolve();
      }
    });

  const seed = async (area: Area) => {
    const keys = Object.keys(mirrored[area]);
    const existing = await getArea(area, keys);
    const payload: Record<string, unknown> = {};
    for (const key of keys) {
      if (existing[key] === undefined) payload[key] = mirrored[area][key];
    }
    await setArea(area, payload);
  };

  await Promise.all([seed("sync"), seed("local")]);
};

/**
 * Single combined entry point for all one-time install work:
 *   1. Drain v1 (jQuery) Ghiblify storage entries that the new app
 *      no longer reads (cleanup callback supplied by the caller - *
 * avoids a circular import with legacyMigrations).
 *   2. Copy any existing localStorage values for registered keys
 *      into chrome.storage so cross-device sync starts working
 *      and the `storage` permission justification matches reality.
 *
 * Replaces the previous pair of separate flags (`ghiblify_legacy_cleaned`,
 * `ghiblify_hybrid_migrated`) with one combined `ghiblify_setup_done`.
 * On run, also tidies away those legacy per-step flags.
 *
 * Best-effort: any failure is swallowed and the localStorage mirror
 * keeps the app working.
 */
export const runOneTimeSetup = async (
  cleanLegacy: () => void
): Promise<void> => {
  let storedVersion: string | null = null;
  try {
    storedVersion = localStorage.getItem(SETUP_FLAG);
  } catch {
    return;
  }
  if (storedVersion === String(SETUP_VERSION)) return;

  if (storedVersion == null) {
    try {
      cleanLegacy();
    } catch {
      /* ignore - workers are themselves idempotent and try-wrapped */
    }
  }

  await performHybridMigration();

  try {
    localStorage.setItem(SETUP_FLAG, String(SETUP_VERSION));
    // Tidy the previous-build per-step flags so users don't carry
    // dead keys around forever.
    LEGACY_FLAGS.forEach((k) => localStorage.removeItem(k));
    if (hasChromeStorage) {
      try {
        chromeNs.storage.local.remove(LEGACY_FLAGS);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
};

/**
 * Boot-time mirror recovery - the fix for "my settings reset
 * themselves".
 *
 * The localStorage mirror is NOT durable: Chrome wipes an extension's
 * localStorage when the user clears browsing data (and under storage
 * pressure), while chrome.storage survives. Since the app boots
 * synchronously from the mirror alone, a wiped mirror meant booting
 * into defaults - and the first persisted change (including automatic
 * ones) then overwrote the user's REAL data in chrome.storage.
 * Quick links, todos, positions: all gone.
 *
 * This scans every registered key: where the mirror is missing a key
 * that chrome.storage still has, the mirror is restored from
 * chrome.storage. Returns true if anything was restored - the caller
 * should reload the page so the whole synchronous init path re-runs
 * against the recovered mirror.
 */
export const restoreMirrorFromChrome = async (): Promise<boolean> => {
  if (!hasChromeStorage) return false;

  const keysByArea: Record<Area, string[]> = { sync: [], local: [] };
  for (const [key, area] of Object.entries(HYBRID_KEYS)) {
    let mirrored: string | null = null;
    try {
      mirrored = localStorage.getItem(key);
    } catch {
      return false; // storage unavailable - nothing sensible to do
    }
    if (mirrored == null) keysByArea[area].push(key);
  }
  if (!keysByArea.sync.length && !keysByArea.local.length) return false;

  const getArea = (area: Area, keys: string[]) =>
    new Promise<Record<string, unknown>>((resolve) => {
      if (!keys.length) return resolve({});
      try {
        chromeNs.storage[area].get(keys, (items: Record<string, unknown>) =>
          resolve(items ?? {})
        );
      } catch {
        resolve({});
      }
    });

  const [syncItems, localItems] = await Promise.all([
    getArea("sync", keysByArea.sync),
    getArea("local", keysByArea.local),
  ]);

  let restored = false;
  for (const items of [syncItems, localItems]) {
    for (const [key, value] of Object.entries(items)) {
      if (value === undefined) continue;
      writeMirror(key, value);
      restored = true;
    }
  }
  return restored;
};

/**
 * Wipe every trace of the extension's state.
 *
 * Both layers have to go, and in that order matters less than
 * completeness: clearing only localStorage would leave chrome.storage
 * as the surviving source of truth, and the next read would faithfully
 * restore everything the user just asked to delete.
 *
 * The one-time-setup flag goes with it, so the next load re-runs setup
 * on what is now a genuinely fresh install.
 */
export const clearAll = async (): Promise<void> => {
  const clearArea = (area: Area) =>
    new Promise<void>((resolve) => {
      try {
        chromeNs.storage[area].clear(() => resolve());
      } catch {
        resolve();
      }
    });
  if (hasChromeStorage) {
    await Promise.all([clearArea("sync"), clearArea("local")]);
  }
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
};

/** Every localStorage key currently set, with its serialized size. */
export interface StoredEntry {
  key: string;
  value: string;
  bytes: number;
  /** True when the key is mirrored into chrome.storage - deleting it
   *  needs `remove()` rather than a bare localStorage.removeItem. */
  hybrid: boolean;
}

export const listStoredEntries = (): StoredEntry[] => {
  const out: StoredEntry[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key == null) continue;
      const value = localStorage.getItem(key) ?? "";
      out.push({
        key,
        value,
        // UTF-16 code units are close enough for a size hint and avoid
        // allocating a TextEncoder per key on every render.
        bytes: (key.length + value.length) * 2,
        hybrid: Object.prototype.hasOwnProperty.call(HYBRID_KEYS, key),
      });
    }
  } catch {
    /* private mode / disabled storage - nothing to show */
  }
  return out.sort((a, b) => b.bytes - a.bytes);
};
