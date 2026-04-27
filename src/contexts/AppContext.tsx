import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  WidgetKey,
  WidgetPosition,
  WidgetSettingsMap,
  WIDGET_CONFIGS,
  WIDGET_KEYS,
} from "../config/widgetConfig";
import {
  readFilters,
  readSelection,
  writeFilters,
  writeSelection,
} from "../storage/backgroundStorage";
import {
  clearLegacyQuickLinks,
  readLegacyQuickLinks,
} from "../storage/legacyMigrations";
import {
  readSync as readPersisted,
  remove as removePersisted,
  subscribe as subscribePersisted,
  write as writePersisted,
} from "../storage/hybridStorage";

const STORAGE_KEY = "ghiblify_widgets";

export const THEME_NAMES = [
  "ghibli",
  "spirited",
  "howls",
  "totoro",
  "ponyo",
  "sky",
  "butter",
  "mint",
  "spring",
  "peony",
  "light",
  "dark",
  "frost",
] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

/** Palettes whose `--dark` surface is actually a soft/light tone, with
 *  `--light` set to a dark text color. Determines which mode flag the
 *  app applies to <html> so widget surfaces can pick contrast-safe
 *  text + accents (CSS only — no new vars needed at the call site). */
export const LIGHT_MODE_THEMES: ReadonlySet<ThemeName> = new Set<ThemeName>([
  "butter",
  "mint",
  "spring",
  "peony",
  "light",
]);

// Legacy theme name → current name. Applied at load time so users
// who saved a preference under one of the older / dropped names
// don't end up with no palette. Removed names that have no obvious
// successor (sakura, meadow, pastel) fall back to ghibli.
const LEGACY_THEME_RENAMES: Record<string, ThemeName> = {
  mono: "light",
  cream: "butter",
  bloom: "spring",
  cotton: "peony",
  sakura: "ghibli",
  meadow: "ghibli",
  pastel: "ghibli",
};

export interface AppearanceSettings {
  theme: ThemeName;
  highContrast: boolean;
}

const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: "ghibli",
  highContrast: false,
};

export interface BackgroundFilters {
  blur: number;
  brightness: number;
  contrast: number;
  saturation: number;
}

export type WidgetEntry<K extends WidgetKey> = {
  visible: boolean;
  position: WidgetPosition;
  settings: WidgetSettingsMap[K];
};

export type WidgetsState = { [K in WidgetKey]: WidgetEntry<K> };

interface AppContextType {
  // global UI
  isDragging: boolean;
  setIsDragging: (b: boolean) => void;
  showWidgetEdits: boolean;
  toggleEditMode: () => void;
  /** Drag Mode lets the user reposition any widget by left-click +
   *  drag — no Shift required. Toggled from the sidebar's "Drag Mode"
   *  button or any widget's right-click "Drag widget" item. Stays on
   *  until "Done" is clicked. Independent of edit mode (the two
   *  modes are visual-cue siblings; either can be on alone). */
  dragMode: boolean;
  setDragMode: (b: boolean) => void;
  toggleDragMode: () => void;
  showGuide: boolean;
  setShowGuide: (b: boolean) => void;
  /** Drives a "spotlight" tour effect on the LeftSidebar: when set,
   *  the sidebar force-opens itself above any modal backdrop and a
   *  CSS pulse animation highlights the relevant region (the Guide
   *  button, the widget toggle grid, etc.). Welcome modal slides set
   *  this; null clears it. */
  sidebarSpotlight: "guide" | "widgets" | "palette" | "background" | null;
  setSidebarSpotlight: (s: "guide" | "widgets" | "palette" | "background" | null) => void;
  /** When non-null, only this single widget shows its EditWidget overlay
   *  (triggered by the Shift+pencil affordance on a single widget).
   *  showWidgetEdits is the global "edit all widgets" mode and is
   *  independent. */
  editingWidgetKey: WidgetKey | null;
  setEditingWidgetKey: (k: WidgetKey | null) => void;

  // background
  backgroundFilters: BackgroundFilters;
  updateBackgroundFilters: (f: Partial<BackgroundFilters>) => void;
  backgroundSelection: Record<string, boolean>;
  updateBackgroundSelection: (movieKey: string, value: boolean) => void;
  /** URL of the photo currently painted by `<Background>`. Set by
   *  `AppContent` whenever `useBackground` resolves a new image, so
   *  any consumer (e.g. the sidebar trash button) can act on it. */
  currentBackground: string;
  setCurrentBackground: (url: string) => void;

  // appearance (theme, widget opacity, contrast)
  appearance: AppearanceSettings;
  updateAppearance: (patch: Partial<AppearanceSettings>) => void;

  // widgets — single source of truth
  widgets: WidgetsState;
  toggleWidgetVisibility: (key: WidgetKey) => void;
  updateWidgetPosition: (key: WidgetKey, pos: WidgetPosition) => void;
  updateWidgetSettings: <K extends WidgetKey>(
    key: K,
    patch: Partial<WidgetSettingsMap[K]>
  ) => void;

  resetAllWidgets: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Widgets that default to hidden — keeps the first-load page calm and
// uncluttered. Users opt them in via the sidebar toggles.
const HIDDEN_BY_DEFAULT: ReadonlySet<WidgetKey> = new Set<WidgetKey>([
  "searchbar",
  "quicklinks",
  "avatar",
  "pomodoro",
  "notes",
]);

const buildDefaultWidgets = (): WidgetsState => {
  const out = {} as WidgetsState;
  for (const key of WIDGET_KEYS) {
    const cfg = WIDGET_CONFIGS[key];
    (out as Record<WidgetKey, unknown>)[key] = {
      visible: !HIDDEN_BY_DEFAULT.has(key),
      position: { ...cfg.position },
      settings: structuredClone(cfg.settings),
    };
  }
  return out;
};

const positionsEqual = (a: WidgetPosition, b: WidgetPosition) =>
  a.x === b.x && a.y === b.y;

const diffSettings = <K extends WidgetKey>(
  current: WidgetSettingsMap[K],
  defaults: WidgetSettingsMap[K]
): Partial<WidgetSettingsMap[K]> => {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(current) as Array<keyof WidgetSettingsMap[K]>) {
    if (JSON.stringify(current[k]) !== JSON.stringify(defaults[k])) {
      out[k as string] = current[k];
    }
  }
  return out as Partial<WidgetSettingsMap[K]>;
};

const persistWidgets = (state: WidgetsState) => {
  const minimal: Record<string, unknown> = {};
  for (const key of WIDGET_KEYS) {
    const cfg = WIDGET_CONFIGS[key];
    const entry = state[key];
    const out: Record<string, unknown> = {};
    // Compare visible against the widget's actual default (most default to
    // true, but bookmarks defaults to false — so toggling it on differs
    // from default and MUST be persisted).
    const defaultVisible = !HIDDEN_BY_DEFAULT.has(key);
    if (entry.visible !== defaultVisible) out.visible = entry.visible;
    if (!positionsEqual(entry.position, cfg.position))
      out.position = entry.position;
    const settingsDiff = diffSettings(entry.settings, cfg.settings);
    if (Object.keys(settingsDiff).length > 0) out.settings = settingsDiff;
    if (Object.keys(out).length > 0) minimal[key] = out;
  }
  if (Object.keys(minimal).length === 0) {
    removePersisted(STORAGE_KEY);
  } else {
    writePersisted(STORAGE_KEY, minimal);
  }
};

// Read a localStorage int, or fall back. Empty string → fallback.
const readInt = (key: string, fallback: number): number => {
  const v = localStorage.getItem(key);
  if (v == null || v === "") return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

const readBool = (key: string, fallback: boolean): boolean => {
  const v = localStorage.getItem(key);
  if (v == null) return fallback;
  return v === "true";
};

const readJSON = <T,>(key: string, fallback: T): T => {
  const v = localStorage.getItem(key);
  if (v == null) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
};

// One-time migration from the legacy storage layout (per-key + widgets_state
// blob) to the new ghiblify_widgets blob. After running once, the legacy
// keys are deleted.
const migrateLegacy = (defaults: WidgetsState): WidgetsState => {
  const state = defaults;
  const legacyBlob = readJSON<Record<string, any> | null>("widgets_state", null);

  for (const key of WIDGET_KEYS) {
    const entry = state[key];
    const blobEntry = legacyBlob?.[key];

    // visibility
    const switchVal = localStorage.getItem(`${key}_switch`);
    if (blobEntry?.visible !== undefined) entry.visible = !!blobEntry.visible;
    else if (switchVal !== null) entry.visible = switchVal !== "off";

    // position
    if (blobEntry?.position?.x != null && blobEntry?.position?.y != null) {
      entry.position = blobEntry.position;
    } else {
      const lx = localStorage.getItem(`${key}_x`);
      const ly = localStorage.getItem(`${key}_y`);
      if (lx !== null && ly !== null) {
        entry.position = { x: parseFloat(lx), y: parseFloat(ly) };
      }
    }
  }

  // per-widget settings
  const time = state.time.settings;
  time.fontSize = readInt("time_fontSize", time.fontSize);
  time.is24Hour = readBool("time_is24Hour", time.is24Hour);

  const date = state.date.settings;
  date.fontSize = readInt("date_fontSize", date.fontSize);

  const info = state.info.settings;
  info.fontSize = readInt("info_fontSize", info.fontSize);
  const savedFields = readJSON<string[] | null>("info_selectedFields", null);
  if (savedFields) {
    info.infoFields = {
      japaneseTitle: savedFields.includes("japaneseTitle"),
      title: savedFields.includes("title"),
      year: savedFields.includes("year"),
      movieLength: savedFields.includes("movieLength"),
      quote: savedFields.includes("quote"),
    };
  }

  const todo = state.todo.settings;
  todo.width = readInt("todo_width", todo.width);
  todo.height = readInt("todo_height", todo.height);
  todo.collapsed = readBool("todo_collapsed", todo.collapsed);

  const avatar = state.avatar.settings;
  avatar.selectedAvatar =
    localStorage.getItem("avatar_selected") || avatar.selectedAvatar;
  avatar.size = readInt("avatar_size", avatar.size);

  const ql = state.quicklinks.settings;
  ql.width = readInt("quicklinks_width", ql.width);
  ql.height = readInt("quicklinks_height", ql.height);
  if (localStorage.getItem("quicklinks_grid") !== null) {
    ql.gridMode = readBool("quicklinks_grid", ql.gridMode);
  }
  ql.links = readJSON("quick_links", ql.links);

  const sb = state.searchbar.settings;
  sb.width = readInt("searchbar_width", sb.width);
  sb.height = readInt("searchbar_height", sb.height);

  return state;
};

const LEGACY_KEYS = [
  "widgets_state",
  "info_selectedFields",
  "info_fontSize",
  "time_fontSize",
  "time_is24Hour",
  "date_fontSize",
  "avatar_selected",
  "avatar_size",
  "todo_width",
  "todo_height",
  "todo_darkMode",
  "todo_collapsed",
  "quick_links",
  "quicklinks_grid",
  "quicklinks_darkMode",
  "quicklinks_width",
  "quicklinks_height",
  "searchbar_width",
  "searchbar_height",
  "searchbar_darkMode",
  "pomodoro_settings",
];

const clearLegacyKeys = () => {
  for (const key of WIDGET_KEYS) {
    localStorage.removeItem(`${key}_x`);
    localStorage.removeItem(`${key}_y`);
    localStorage.removeItem(`${key}_switch`);
  }
  for (const k of LEGACY_KEYS) localStorage.removeItem(k);
};

const loadInitialWidgets = (): WidgetsState => {
  const defaults = buildDefaultWidgets();

  // One-time pull from the previous (jQuery) Ghiblify extension's
  // `localStorage.quickLinks` (HTML strings). Always attempted, even
  // when the modern blob exists — the legacy entry is only present
  // for users coming from the v1 extension. Cleared after read so
  // it's idempotent.
  const legacyQL = readLegacyQuickLinks();
  if (legacyQL && legacyQL.length) {
    defaults.quicklinks.settings.links = legacyQL;
    clearLegacyQuickLinks();
  }

  // Modern blob — apply diffs onto defaults. Done after the legacy
  // pull so a user with both legacy AND modern data keeps their
  // modern set (legacy is treated as a seed for first-run only).
  const blob = readPersisted<Record<string, any> | null>(STORAGE_KEY, null);
  if (blob) {
    for (const key of WIDGET_KEYS) {
      const entry = defaults[key];
      const stored = blob[key];
      if (!stored) continue;
      if (stored.visible !== undefined) entry.visible = !!stored.visible;
      if (stored.position) entry.position = stored.position;
      if (stored.settings)
        entry.settings = { ...entry.settings, ...stored.settings };
    }
    if (legacyQL && legacyQL.length) {
      // Persist the freshly-imported quick links into the modern
      // blob so subsequent loads find them in the new schema.
      persistWidgets(defaults);
    }
    return defaults;
  }

  // No modern blob — migrate from legacy (no-op if no legacy keys exist)
  const migrated = migrateLegacy(defaults);
  persistWidgets(migrated);
  clearLegacyKeys();
  return migrated;
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [showWidgetEdits, setShowWidgetEdits] = useState(false);
  const [dragMode, setDragMode] = useState(false);
  // Open the guide automatically the first time a user ever opens this
  // extension, then flip a localStorage flag so it stays closed thereafter.
  const [sidebarSpotlight, setSidebarSpotlight] = useState<
    "guide" | "widgets" | "palette" | "background" | null
  >(null);
  const [currentBackground, setCurrentBackground] = useState<string>("");
  const [showGuide, setShowGuide] = useState(
    () => readPersisted<boolean>("ghiblify_guide_seen", false) !== true
  );
  useEffect(() => {
    if (!showGuide) return;
    writePersisted("ghiblify_guide_seen", true);
  }, [showGuide]);
  const [editingWidgetKey, setEditingWidgetKey] = useState<WidgetKey | null>(
    null
  );

  const [backgroundFilters, setBackgroundFilters] = useState<BackgroundFilters>(
    () => readFilters()
  );

  const [backgroundSelection, setBackgroundSelection] = useState<
    Record<string, boolean>
  >(() => readSelection());

  const [appearance, setAppearance] = useState<AppearanceSettings>(() => {
    const saved = readPersisted<Partial<AppearanceSettings>>(
      "ghiblify_appearance",
      {}
    );
    // Map any legacy / renamed / removed theme names to their
    // current equivalents (see LEGACY_THEME_RENAMES at the top of
    // the file). Catches "mono" → "light" plus the recent renames
    // (cream→butter, bloom→spring, cotton→peony) and the dropped
    // names (sakura/meadow/pastel) that fall back to "ghibli".
    const remapped =
      saved.theme && LEGACY_THEME_RENAMES[saved.theme as string];
    if (remapped) saved.theme = remapped;
    return { ...DEFAULT_APPEARANCE, ...saved };
  });

  // Apply appearance to document root: theme class + contrast class +
  // palette mode (light/dark) so widget surfaces can pick the right
  // text contrast without each widget needing its own toggle.
  useEffect(() => {
    const root = document.documentElement;
    THEME_NAMES.forEach((t) => root.classList.remove(`theme-${t}`));
    root.classList.add(`theme-${appearance.theme}`);
    root.classList.toggle("high-contrast", appearance.highContrast);
    root.classList.toggle(
      "palette-light",
      LIGHT_MODE_THEMES.has(appearance.theme)
    );
    root.classList.toggle(
      "palette-dark",
      !LIGHT_MODE_THEMES.has(appearance.theme)
    );
  }, [appearance]);

  const [widgets, setWidgets] = useState<WidgetsState>(loadInitialWidgets);

  // Debounced persist — coalesces high-frequency state changes
  // (resize-drag fires on every mousemove → updateWidgetSettings →
  // setWidgets, which without this debounce would write the whole
  // blob to localStorage + chrome.storage on every pixel of a
  // resize). 250 ms is invisible to the user but flattens the storm
  // into one write per gesture. Skip the very first render so we
  // don't overwrite the value we just loaded.
  const isFirstRender = useRef(true);
  const pendingPersistRef = useRef<{
    timer: number | null;
    value: WidgetsState | null;
  }>({ timer: null, value: null });
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const pending = pendingPersistRef.current;
    pending.value = widgets;
    if (pending.timer != null) window.clearTimeout(pending.timer);
    pending.timer = window.setTimeout(() => {
      if (pending.value) persistWidgets(pending.value);
      pending.timer = null;
    }, 250);
  }, [widgets]);

  // Flush any pending debounced widgets-write when the tab is hidden
  // or unmounting, so a quick close-mid-resize / quick navigation
  // doesn't drop the last gesture's state.
  useEffect(() => {
    const flush = () => {
      const pending = pendingPersistRef.current;
      if (pending.timer != null && pending.value) {
        window.clearTimeout(pending.timer);
        pending.timer = null;
        persistWidgets(pending.value);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  // Edit mode and Drag mode are mutually exclusive — turning one on
  // turns the other off. Single-widget edit mode (`editingWidgetKey`)
  // is a peer of edit mode, so entering drag mode also clears it.
  const toggleEditMode = () => {
    setShowWidgetEdits((prev) => {
      const next = !prev;
      if (next) setDragMode(false);
      setIsDragging(false);
      return next;
    });
  };

  const setDragModeExclusive = (b: boolean) => {
    setDragMode(b);
    if (b) {
      setShowWidgetEdits(false);
      setEditingWidgetKey(null);
    }
  };

  const toggleDragMode = () => setDragModeExclusive(!dragMode);

  const setEditingWidgetKeyExclusive = (k: WidgetKey | null) => {
    setEditingWidgetKey(k);
    if (k) setDragMode(false);
  };

  const updateBackgroundFilters = (filters: Partial<BackgroundFilters>) => {
    setBackgroundFilters((prev) => {
      const next = { ...prev, ...filters };
      writeFilters(next);
      return next;
    });
  };

  const updateBackgroundSelection = (movieKey: string, value: boolean) => {
    setBackgroundSelection((prev) => {
      const next = { ...prev, [movieKey]: value };
      writeSelection(next);
      return next;
    });
  };

  const updateAppearance = (patch: Partial<AppearanceSettings>) => {
    setAppearance((prev) => {
      const next = { ...prev, ...patch };
      writePersisted("ghiblify_appearance", next);
      return next;
    });
  };

  // Cross-device sync — when chrome.storage.sync delivers a remote
  // appearance update from a sibling Chrome install, mirror it into
  // local React state without bouncing back through writePersisted
  // (the mirror has already been updated by the hybrid layer).
  useEffect(() => {
    return subscribePersisted("ghiblify_appearance", (next) => {
      if (!next || typeof next !== "object") return;
      setAppearance((prev) => ({ ...prev, ...(next as AppearanceSettings) }));
    });
  }, []);

  const toggleWidgetVisibility = (key: WidgetKey) => {
    setWidgets((prev) => ({
      ...prev,
      [key]: { ...prev[key], visible: !prev[key].visible },
    }));
  };

  const updateWidgetPosition = (key: WidgetKey, pos: WidgetPosition) => {
    setWidgets((prev) => ({
      ...prev,
      [key]: { ...prev[key], position: pos },
    }));
  };

  const updateWidgetSettings = <K extends WidgetKey>(
    key: K,
    patch: Partial<WidgetSettingsMap[K]>
  ) => {
    setWidgets((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        settings: { ...prev[key].settings, ...patch },
      },
    }));
  };

  const resetAllWidgets = () => {
    if (!window.confirm("Are you sure you want to reset all widgets to default?"))
      return;
    setWidgets((prev) => {
      const next = buildDefaultWidgets();
      // Preserve user-created content — links and the greeting name
      // are user data, not config. Resetting positions/sizes
      // shouldn't make the user retype their name or rebuild their
      // bookmark grid.
      next.quicklinks.settings.links = prev.quicklinks.settings.links;
      next.greeting.settings.name = prev.greeting.settings.name;
      return next;
    });
  };

  return (
    <AppContext.Provider
      value={{
        isDragging,
        setIsDragging,
        showWidgetEdits,
        toggleEditMode,
        dragMode,
        setDragMode: setDragModeExclusive,
        toggleDragMode,
        showGuide,
        setShowGuide,
        sidebarSpotlight,
        setSidebarSpotlight,
        editingWidgetKey,
        setEditingWidgetKey: setEditingWidgetKeyExclusive,
        backgroundFilters,
        updateBackgroundFilters,
        backgroundSelection,
        updateBackgroundSelection,
        currentBackground,
        setCurrentBackground,
        appearance,
        updateAppearance,
        widgets,
        toggleWidgetVisibility,
        updateWidgetPosition,
        updateWidgetSettings,
        resetAllWidgets,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
};

// Type-safe accessor for a single widget's settings.
export const useWidgetSettings = <K extends WidgetKey>(
  key: K
): WidgetSettingsMap[K] => useAppContext().widgets[key].settings;
