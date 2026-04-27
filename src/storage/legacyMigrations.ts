// One-time migrations from the previous (jQuery-based) Ghiblify
// extension. The legacy app stored most things in
// `chrome.storage.local` with its own key/format conventions; this
// module rewrites the two pieces of user data we want to carry over
// (todo items + quick links) into the new schemas.
//
// Each migration is idempotent — it deletes the legacy entry once
// successfully read, so subsequent calls are no-ops.

import {
  readSync as readPersisted,
  write as writePersisted,
} from "./hybridStorage";

export interface NewTodoItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface NewQuickLink {
  id: string;
  title: string;
  url: string;
}

const newId = () =>
  Date.now().toString() + Math.random().toString(36).slice(2, 6);

// ---------------------------------------------------------------------------
// QuickLinks — legacy `localStorage.quickLinks` (NOT chrome.storage).
// Format: array of HTML strings, each a `<div class="link-item"><a href="…">
// Title</a>…</div>`. Parse the anchor out of each entry into the new
// {id, title, url} shape. Sync; safe to call from a useState initializer.
// ---------------------------------------------------------------------------
export const readLegacyQuickLinks = (): NewQuickLink[] | null => {
  try {
    const raw = localStorage.getItem("quickLinks");
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const out: NewQuickLink[] = [];
    // DOMParser is preferred over `div.innerHTML = html` here: even
    // though we only read href/textContent (so injection is harmless),
    // Web Store reviewers flag any innerHTML write as a code-smell.
    // DOMParser produces an inert document — no scripts run, no
    // resources fetched — so it's review-friendly and equivalent.
    const parser = new DOMParser();
    arr.forEach((html: unknown) => {
      if (typeof html !== "string") return;
      const doc = parser.parseFromString(html, "text/html");
      const a = doc.querySelector("a");
      if (!a) return;
      const url = a.getAttribute("href") || "";
      const title = (a.textContent || "").trim() || url;
      if (url) out.push({ id: newId(), title, url });
    });
    return out.length ? out : null;
  } catch {
    return null;
  }
};

export const clearLegacyQuickLinks = () => {
  try {
    localStorage.removeItem("quickLinks");
  } catch {
    /* ignore */
  }
};

// ---------------------------------------------------------------------------
// Todos — legacy `chrome.storage.local.todo_data` (async API).
// Format: a single string with items separated by "×". Items
// prefixed with "☑" are completed, e.g. "buy milk×☑done item×walk dog×".
// Trailing separator means we filter empty pieces.
// ---------------------------------------------------------------------------
export const readLegacyTodos = (): Promise<NewTodoItem[] | null> =>
  new Promise((resolve) => {
    const chromeNs: any =
      typeof chrome !== "undefined" ? chrome : undefined;
    const api = chromeNs?.storage?.local;
    if (!api?.get) {
      resolve(null);
      return;
    }
    try {
      api.get("todo_data", (data: { todo_data?: string }) => {
        try {
          const raw = data?.todo_data;
          if (!raw || typeof raw !== "string" || !raw.trim()) {
            resolve(null);
            return;
          }
          const items: NewTodoItem[] = raw
            .split("×")
            .filter((s) => s.length > 0)
            .map((s) => {
              const checked = s.startsWith("☑");
              const text = checked ? s.slice(1) : s;
              return { id: newId(), text, checked };
            });
          resolve(items.length ? items : null);
        } catch {
          resolve(null);
        }
      });
    } catch {
      resolve(null);
    }
  });

export const clearLegacyTodos = () => {
  const chromeNs: any = typeof chrome !== "undefined" ? chrome : undefined;
  const api = chromeNs?.storage?.local;
  if (!api?.remove) return;
  try {
    api.remove("todo_data");
  } catch {
    /* ignore */
  }
};

// ---------------------------------------------------------------------------
// One-shot wipe of every other legacy entry the v1 (jQuery) Ghiblify
// extension wrote. We keep the user data we want to carry over (todos +
// quick links — handled separately above) and discard everything else
// (per-widget positions, visibility, theme, language, filter sliders,
// favorites, blacklist, etc.) since the new app stores those in its
// own schema and the keys would otherwise sit forever in storage,
// taking up quota and confusing future debugging.
//
// Gated by a hybrid-storage flag so it runs exactly once per
// install. Idempotent: rerunning is a no-op.
// ---------------------------------------------------------------------------
const LEGACY_CLEAN_FLAG = "ghiblify_legacy_cleaned";

const LEGACY_KEYS = [
  // Theme / language
  "theme",
  "lang",
  // Time widget
  "time_switch",
  "time_left_data",
  "time_top_data",
  "time_align_data",
  "time_justify_data",
  "time_text_align_data",
  "time_date_align_data",
  "military_switch",
  // Date widget
  "date_switch",
  "date_left_data",
  "date_top_data",
  "date_align_data",
  "date_format",
  "date_justify_data",
  "date_text_align_data",
  "datetext_align_data",
  // Info widget
  "info_switch",
  "info_left_data",
  "info_top_data",
  // Search widget
  "search_switch",
  "search_left_data",
  "search_top_data",
  // Todo widget chrome
  "todo_switch",
  "todo_left_data",
  "todo_top_data",
  // Favorites / blacklist (legacy formats; the new app uses
  // ghiblify_background)
  "fav_switch",
  "fav_list",
  "black_list",
  // Background filter slider state (the new app stores this inside
  // ghiblify_background.filters)
  "filter",
];

export const cleanLegacyStorage = () => {
  if (readPersisted<boolean>(LEGACY_CLEAN_FLAG, false) === true) return;

  // localStorage entries (the v1 quickLinks lived here too — but
  // readLegacyQuickLinks already handles that one).
  LEGACY_KEYS.forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  });

  // chrome.storage.local entries — the v1 extension wrote everything
  // here. Async API; we don't wait on the callback because we don't
  // care about the result.
  const chromeNs: any = typeof chrome !== "undefined" ? chrome : undefined;
  const api = chromeNs?.storage?.local;
  if (api?.remove) {
    try {
      api.remove(LEGACY_KEYS);
    } catch {
      /* ignore */
    }
  }

  writePersisted(LEGACY_CLEAN_FLAG, true);
};
