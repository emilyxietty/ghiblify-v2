/**
 * Demo-mode `chrome` shim
 * ============================================================================
 *
 * Lets the real newtab app run on an ordinary web page (the embedded
 * demo on emilyxietty.github.io) instead of a chrome-extension:// one.
 *
 * Almost every `chrome.*` call site in src/ is already guarded with
 * `typeof chrome !== "undefined"`, so the app degrades on the web
 * without this file - it just degrades into a version with no
 * bookmarks, no search, and no backgrounds (useBackground and
 * useInfoConfig call `chrome.runtime.getURL` unguarded). The shim
 * fills in a small, honest subset so the demo behaves like the
 * extension:
 *
 *   runtime.getURL   - resolve against the demo page instead of the
 *                      extension root, so background.json /
 *                      movie_metadata.json / assets all load
 *   storage.*        - in-memory; nothing survives a reload
 *   bookmarks.*      - a fixed fake tree, mutable in-session
 *   permissions.*    - everything reads as granted (nothing to prompt)
 *   search.query     - opens the query in a real new tab
 *
 * `localStorage` is replaced with an in-memory Storage too. The demo is
 * same-origin with the portfolio site, so the app's mirror writes would
 * otherwise pile up in the host page's storage - and the point of the
 * demo is that it saves nothing. The cost is that anything relying on
 * the cross-tab `storage` event (Pomodoro leader election) is a
 * single-tab no-op here, which is correct for one embedded iframe.
 *
 * This module must be imported FIRST - src/demo/index.tsx does that.
 * hybridStorage and i18n capture `chrome` and read the mirror at module
 * scope, so anything that lands before this runs sees a plain web page.
 */

declare const __DEMO_VERSION__: string;

type AnyFn = (...args: never[]) => unknown;

const isFn = (v: unknown): v is AnyFn => typeof v === "function";

// Every shimmed method accepts both the MV3 promise form and the
// legacy callback form, because src/ uses both (chromePermissions.ts
// probes for `.then`, legacyMigrations.ts passes callbacks).
const settle = <T>(value: T, cb?: unknown): Promise<T> => {
  if (isFn(cb)) {
    (cb as (v: T) => void)(value);
    return Promise.resolve(value);
  }
  return Promise.resolve(value);
};

// --- Event ------------------------------------------------------------------

interface DemoEvent {
  addListener: (fn: AnyFn) => void;
  removeListener: (fn: AnyFn) => void;
  hasListener: (fn: AnyFn) => boolean;
}

const createEvent = () => {
  const listeners = new Set<AnyFn>();
  const event: DemoEvent = {
    addListener: (fn) => {
      listeners.add(fn);
    },
    removeListener: (fn) => {
      listeners.delete(fn);
    },
    hasListener: (fn) => listeners.has(fn),
  };
  const emit = (...args: unknown[]) => {
    for (const fn of Array.from(listeners)) {
      try {
        (fn as (...a: unknown[]) => void)(...args);
      } catch (e) {
        console.debug("[demo] listener error", e);
      }
    }
  };
  return { event, emit };
};

// --- localStorage → memory --------------------------------------------------

const createMemoryStorage = (seed: Record<string, string>): Storage => {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
  } as unknown as Storage;
};

Object.defineProperty(window, "localStorage", {
  configurable: true,
  // The welcome/guide overlay is gated on this flag and would otherwise
  // cover the dashboard on every single load of the embedded demo -
  // the visitor came to see the widgets, not the tour.
  value: createMemoryStorage({ ghiblify_guide_seen: "true" }),
});

// --- storage ----------------------------------------------------------------

const { event: onChanged, emit: emitChanged } = createEvent();

type Changes = Record<string, { oldValue?: unknown; newValue?: unknown }>;

const createStorageArea = (areaName: "local" | "sync") => {
  const data = new Map<string, unknown>();

  const selected = (keys: unknown): Record<string, unknown> => {
    if (keys == null) return Object.fromEntries(data);
    const out: Record<string, unknown> = {};
    if (typeof keys === "string") {
      if (data.has(keys)) out[keys] = data.get(keys);
      return out;
    }
    if (Array.isArray(keys)) {
      for (const k of keys) if (data.has(k)) out[k] = data.get(k);
      return out;
    }
    for (const [k, fallback] of Object.entries(keys as object))
      out[k] = data.has(k) ? data.get(k) : fallback;
    return out;
  };

  return {
    get: (keys?: unknown, cb?: unknown) =>
      isFn(keys) ? settle(selected(null), keys) : settle(selected(keys), cb),
    set: (items: Record<string, unknown>, cb?: unknown) => {
      const changes: Changes = {};
      for (const [k, v] of Object.entries(items)) {
        changes[k] = { oldValue: data.get(k), newValue: v };
        data.set(k, v);
      }
      emitChanged(changes, areaName);
      return settle(undefined, cb);
    },
    remove: (keys: string | string[], cb?: unknown) => {
      const list = Array.isArray(keys) ? keys : [keys];
      const changes: Changes = {};
      for (const k of list) {
        if (!data.has(k)) continue;
        changes[k] = { oldValue: data.get(k), newValue: undefined };
        data.delete(k);
      }
      if (Object.keys(changes).length) emitChanged(changes, areaName);
      return settle(undefined, cb);
    },
    clear: (cb?: unknown) => {
      const changes: Changes = {};
      for (const [k, v] of data) changes[k] = { oldValue: v };
      data.clear();
      if (Object.keys(changes).length) emitChanged(changes, areaName);
      return settle(undefined, cb);
    },
    getBytesInUse: (_keys?: unknown, cb?: unknown) => settle(0, cb),
  };
};

// --- bookmarks --------------------------------------------------------------

interface DemoNode {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  children?: DemoNode[];
}

let nextId = 100;

const bookmarkRoot: DemoNode = {
  id: "0",
  title: "",
  children: [
    {
      id: "1",
      parentId: "0",
      title: "Bookmarks bar",
      children: [
        { id: "10", parentId: "1", title: "Studio Ghibli", url: "https://www.ghibli.jp/" },
        {
          id: "11",
          parentId: "1",
          title: "Ghiblify on the Chrome Web Store",
          url: "https://chromewebstore.google.com/detail/Ghiblify/kdaipjfpbngmcginhhahacjkkkpbaefh",
        },
        {
          id: "12",
          parentId: "1",
          title: "Ghibli",
          children: [
            { id: "120", parentId: "12", title: "Spirited Away", url: "https://en.wikipedia.org/wiki/Spirited_Away" },
            { id: "121", parentId: "12", title: "My Neighbor Totoro", url: "https://en.wikipedia.org/wiki/My_Neighbor_Totoro" },
            { id: "122", parentId: "12", title: "Howl's Moving Castle", url: "https://en.wikipedia.org/wiki/Howl%27s_Moving_Castle_(film)" },
            { id: "123", parentId: "12", title: "Ponyo", url: "https://en.wikipedia.org/wiki/Ponyo" },
          ],
        },
        { id: "13", parentId: "1", title: "GitHub", url: "https://github.com/" },
        { id: "14", parentId: "1", title: "Figma", url: "https://www.figma.com/" },
      ],
    },
    {
      id: "2",
      parentId: "0",
      title: "Other bookmarks",
      children: [
        { id: "20", parentId: "2", title: "Emily Xie", url: "https://emilyxietty.github.io/" },
        { id: "21", parentId: "2", title: "Open-Meteo", url: "https://open-meteo.com/" },
        {
          id: "22",
          parentId: "2",
          title: "Reading",
          children: [
            { id: "220", parentId: "22", title: "MDN", url: "https://developer.mozilla.org/" },
            { id: "221", parentId: "22", title: "React", url: "https://react.dev/" },
          ],
        },
      ],
    },
  ],
};

const walk = (node: DemoNode, fn: (n: DemoNode, parent: DemoNode | null) => void, parent: DemoNode | null = null) => {
  fn(node, parent);
  for (const child of node.children ?? []) walk(child, fn, node);
};

const findNode = (id: string): { node: DemoNode; parent: DemoNode | null } | null => {
  let hit: { node: DemoNode; parent: DemoNode | null } | null = null;
  walk(bookmarkRoot, (node, parent) => {
    if (node.id === id) hit = { node, parent };
  });
  return hit;
};

// Chrome hands out plain data, not live references - and the panel's
// drag-and-drop reorders its own copy of the tree, so returning the
// mutable originals would let the UI edit our source of truth behind
// our back and desync the two.
const snapshot = (node: DemoNode, index = 0): DemoNode & { index: number } => ({
  ...node,
  index,
  ...(node.children
    ? { children: node.children.map((c, i) => snapshot(c, i)) }
    : {}),
});

const {
  event: onBookmarkChanged,
  emit: emitBookmarkChanged,
} = createEvent();
const { event: onBookmarkCreated, emit: emitBookmarkCreated } = createEvent();
const { event: onBookmarkRemoved, emit: emitBookmarkRemoved } = createEvent();
const { event: onBookmarkMoved, emit: emitBookmarkMoved } = createEvent();

const detach = (id: string): DemoNode | null => {
  const hit = findNode(id);
  if (!hit?.parent?.children) return null;
  const idx = hit.parent.children.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  return hit.parent.children.splice(idx, 1)[0];
};

const bookmarks = {
  getTree: (cb?: unknown) => settle([snapshot(bookmarkRoot)], cb),
  getSubTree: (id: string, cb?: unknown) => {
    const hit = findNode(id);
    return settle(hit ? [snapshot(hit.node)] : [], cb);
  },
  get: (id: string | string[], cb?: unknown) => {
    const ids = Array.isArray(id) ? id : [id];
    const found = ids
      .map((i) => findNode(i)?.node)
      .filter((n): n is DemoNode => !!n)
      .map((n) => snapshot(n));
    return settle(found, cb);
  },
  create: (bookmark: { parentId?: string; title?: string; url?: string; index?: number }, cb?: unknown) => {
    const parent = findNode(bookmark.parentId ?? "1")?.node ?? bookmarkRoot;
    if (!parent.children) parent.children = [];
    const node: DemoNode = {
      id: String(nextId++),
      parentId: parent.id,
      title: bookmark.title ?? "",
      ...(bookmark.url ? { url: bookmark.url } : { children: [] }),
    };
    const at = bookmark.index ?? parent.children.length;
    parent.children.splice(at, 0, node);
    emitBookmarkCreated(node.id, snapshot(node, at));
    return settle(snapshot(node, at), cb);
  },
  update: (id: string, changes: { title?: string; url?: string }, cb?: unknown) => {
    const hit = findNode(id);
    if (!hit) return settle(undefined, cb);
    if (changes.title !== undefined) hit.node.title = changes.title;
    if (changes.url !== undefined) hit.node.url = changes.url;
    emitBookmarkChanged(id, changes);
    return settle(snapshot(hit.node), cb);
  },
  move: (id: string, dest: { parentId?: string; index?: number }, cb?: unknown) => {
    const node = detach(id);
    if (!node) return settle(undefined, cb);
    const parent = findNode(dest.parentId ?? node.parentId ?? "1")?.node ?? bookmarkRoot;
    if (!parent.children) parent.children = [];
    const at = dest.index === undefined ? parent.children.length : Math.min(dest.index, parent.children.length);
    node.parentId = parent.id;
    parent.children.splice(at, 0, node);
    emitBookmarkMoved(id, { parentId: parent.id, index: at });
    return settle(snapshot(node, at), cb);
  },
  remove: (id: string, cb?: unknown) => {
    const node = detach(id);
    if (node) emitBookmarkRemoved(id, { parentId: node.parentId, node: snapshot(node) });
    return settle(undefined, cb);
  },
  removeTree: (id: string, cb?: unknown) => bookmarks.remove(id, cb),
  search: (query: string | { query?: string }, cb?: unknown) => {
    const q = (typeof query === "string" ? query : query.query ?? "").toLowerCase();
    const out: DemoNode[] = [];
    walk(bookmarkRoot, (n) => {
      if (!n.url) return;
      if (n.title.toLowerCase().includes(q) || n.url.toLowerCase().includes(q))
        out.push(snapshot(n));
    });
    return settle(out, cb);
  },
  onChanged: onBookmarkChanged,
  onCreated: onBookmarkCreated,
  onRemoved: onBookmarkRemoved,
  onMoved: onBookmarkMoved,
};

// --- permissions ------------------------------------------------------------

const { event: onPermissionAdded } = createEvent();
const { event: onPermissionRemoved } = createEvent();

// Optional permissions are an extension concept with no web analogue.
// Reporting them all as granted keeps the feature toggles in Settings
// truthful about what the demo can actually show.
const permissions = {
  contains: (_p: unknown, cb?: unknown) => settle(true, cb),
  request: (_p: unknown, cb?: unknown) => settle(true, cb),
  remove: (_p: unknown, cb?: unknown) => settle(false, cb),
  getAll: (cb?: unknown) => settle({ permissions: [], origins: [] }, cb),
  onAdded: onPermissionAdded,
  onRemoved: onPermissionRemoved,
};

// --- runtime / search -------------------------------------------------------

const runtime = {
  id: "ghiblify-demo",
  lastError: undefined,
  // Extension code writes "background.json" and "/_favicon/" alike;
  // both need to resolve against the demo page, which is served from a
  // subdirectory. Stripping the leading slash keeps absolute-looking
  // paths inside the demo folder instead of hitting the site root.
  getURL: (path: string) =>
    new URL(String(path).replace(/^\//, ""), document.baseURI).href,
  getManifest: () => ({
    name: "Ghiblify",
    version: typeof __DEMO_VERSION__ === "string" ? __DEMO_VERSION__ : "0.0.0",
  }),
};

const search = {
  query: (options: { text?: string; disposition?: string }, cb?: unknown) => {
    const text = (options?.text ?? "").trim();
    if (text) {
      // Never CURRENT_TAB: the demo lives in an iframe, and navigating
      // it away would replace the dashboard with a search results page
      // the visitor can't back out of.
      window.open(
        `https://www.google.com/search?q=${encodeURIComponent(text)}`,
        "_blank",
        "noopener"
      );
    }
    return settle(undefined, cb);
  },
};

// --- install ----------------------------------------------------------------

const demoChrome = {
  runtime,
  storage: {
    local: createStorageArea("local"),
    sync: createStorageArea("sync"),
    session: createStorageArea("local"),
    onChanged,
  },
  bookmarks,
  permissions,
  search,
};

(globalThis as unknown as { chrome: unknown }).chrome = demoChrome;

export {};
