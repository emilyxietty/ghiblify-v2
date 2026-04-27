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
 * critical surface — restoring widget layout / theme / language needs
 * to happen during React's initial state setup so the page paints
 * with the user's saved state, not defaults that flash + flicker.
 * Synchronous reads from a `localStorage` mirror solve that, while
 * `chrome.storage` keeps the source-of-truth honest and unlocks
 * cross-device sync for the `.sync`-tiered keys.
 *
 * ## Tiers
 *
 * - `sync`  — small, portable (locale, appearance). 100 KB total
 *   / 8 KB per item / 1800 writes per hour.
 * - `local` — bigger blobs that don't need to follow you across
 *   devices (widget settings, todos, background prefs, install
 *   flags). ~10 MB.
 *
 * Anything cross-tab-sensitive that needs a synchronous `storage`
 * event (Pomodoro leader election) or location-tied caches (weather)
 * STAYS on plain localStorage and is NOT registered here.
 *
 * ## API surface
 *
 *   readSync(key, fallback)  — instant read from the mirror
 *   write(key, value)        — write to BOTH (mirror sync, chrome async)
 *   remove(key)              — remove from BOTH
 *   subscribe(key, fn)       — fires on any chrome.storage change
 *                              for that key (this tab, sibling tab,
 *                              or remote sync from another device)
 *   migrateOnce()            — one-time copy of pre-hybrid
 *                              localStorage values into chrome.storage
 *
 * Values are arbitrary JSON-serializable data. The mirror stringifies;
 * chrome.storage stores the parsed structure natively.
 */

type Area = "sync" | "local";

// Registry of every key managed by this layer + which chrome.storage
// area owns its source-of-truth. Adding a new persistent key? Add it
// here and use the API below — DO NOT call localStorage directly for
// these keys. Pomodoro and weather caches are intentionally NOT here
// (they stay on plain localStorage; see their files).
export const HYBRID_KEYS: Record<string, Area> = {
  // Tiny portable preferences — sync across the user's devices.
  ghiblify_locale: "sync",
  ghiblify_appearance: "sync",
  // Larger blobs that don't need to follow the user across devices.
  // Could be promoted to "sync" later if quota allows.
  ghiblify_widgets: "local",
  ghiblify_background: "local",
  ghiblify_todo: "local",
  // Per-install flag.
  ghiblify_guide_seen: "local",
};

// Single combined gate for ALL one-time setup work — both v1 (jQuery)
// data cleanup AND the localStorage→chrome.storage migration. Replaces
// the previous pair of flags (`ghiblify_legacy_cleaned`,
// `ghiblify_hybrid_migrated`); see runOneTimeSetup below.
const SETUP_FLAG = "ghiblify_setup_done";
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
    /* quota exceeded / private mode — ignore */
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
 * (async, source of truth). Fire-and-forget — chrome.storage
 * failures fall back to the mirror.
 */
export const write = (key: string, value: unknown): void => {
  writeMirror(key, value);
  const area = areaFor(key);
  if (!area || !hasChromeStorage) return;
  try {
    chromeNs.storage[area].set({ [key]: value });
  } catch {
    /* ignore — mirror still holds it */
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

// Internal worker — copy any existing localStorage values for
// registered keys into chrome.storage. Idempotent; safe to call
// multiple times (the only effect of a re-run is rewriting the same
// values, which is harmless). Caller is responsible for gating.
const performHybridMigration = async (): Promise<void> => {
  if (!hasChromeStorage) return;

  // Bucket pending writes by area so we can issue at most two
  // chrome.storage.set calls instead of one per key.
  const pending: Record<Area, Record<string, unknown>> = {
    sync: {},
    local: {},
  };

  for (const [key, area] of Object.entries(HYBRID_KEYS)) {
    const raw = localStorage.getItem(key);
    if (raw == null) continue;
    try {
      pending[area][key] = JSON.parse(raw);
    } catch {
      // Stored as a non-JSON string (legacy "true"/"false" flags).
      // Preserve as-is so the parse-on-read path still recovers it.
      pending[area][key] = raw;
    }
  }

  const setArea = (area: Area, payload: Record<string, unknown>) =>
    new Promise<void>((resolve) => {
      if (Object.keys(payload).length === 0) return resolve();
      try {
        chromeNs.storage[area].set(payload, () => resolve());
      } catch {
        resolve();
      }
    });

  await Promise.all([setArea("sync", pending.sync), setArea("local", pending.local)]);
};

/**
 * Single combined entry point for all one-time install work:
 *   1. Drain v1 (jQuery) Ghiblify storage entries that the new app
 *      no longer reads (cleanup callback supplied by the caller —
 *      avoids a circular import with legacyMigrations).
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
  let already = false;
  try {
    already = localStorage.getItem(SETUP_FLAG) === "true";
  } catch {
    return;
  }
  if (already) return;

  try {
    cleanLegacy();
  } catch {
    /* ignore — workers are themselves idempotent and try-wrapped */
  }

  await performHybridMigration();

  try {
    localStorage.setItem(SETUP_FLAG, "true");
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
