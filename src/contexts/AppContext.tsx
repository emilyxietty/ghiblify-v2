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

const STORAGE_KEY = "ghiblify_widgets";

export const THEME_NAMES = [
  "ghibli",
  "spirited",
  "howls",
  "totoro",
  "ponyo",
  "sky",
  "sakura",
  "meadow",
  "pastel",
  "cream",
  "mint",
  "bloom",
  "mono",
] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

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

  // background
  backgroundFilters: BackgroundFilters;
  updateBackgroundFilters: (f: Partial<BackgroundFilters>) => void;
  backgroundSelection: Record<string, boolean>;
  updateBackgroundSelection: (movieKey: string, value: boolean) => void;

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

// Widgets that should default to hidden (everything else defaults visible).
const HIDDEN_BY_DEFAULT: ReadonlySet<WidgetKey> = new Set<WidgetKey>(["bookmarks"]);

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
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
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
  todo.darkMode = readBool("todo_darkMode", todo.darkMode);
  todo.collapsed = readBool("todo_collapsed", todo.collapsed);

  const avatar = state.avatar.settings;
  avatar.selectedAvatar =
    localStorage.getItem("avatar_selected") || avatar.selectedAvatar;
  avatar.size = readInt("avatar_size", avatar.size);

  const ql = state.quicklinks.settings;
  ql.width = readInt("quicklinks_width", ql.width);
  ql.height = readInt("quicklinks_height", ql.height);
  ql.darkMode = readBool("quicklinks_darkMode", ql.darkMode);
  if (localStorage.getItem("quicklinks_grid") !== null) {
    ql.gridMode = readBool("quicklinks_grid", ql.gridMode);
  }
  ql.links = readJSON("quick_links", ql.links);

  const sb = state.searchbar.settings;
  sb.width = readInt("searchbar_width", sb.width);
  sb.height = readInt("searchbar_height", sb.height);
  sb.darkMode = readBool("searchbar_darkMode", sb.darkMode);

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

  // Modern blob — apply diffs onto defaults
  const blob = readJSON<Record<string, any> | null>(STORAGE_KEY, null);
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

  const [backgroundFilters, setBackgroundFilters] = useState<BackgroundFilters>(
    () =>
      readJSON<BackgroundFilters>("background_filters", {
        blur: 0,
        brightness: 100,
        contrast: 100,
        saturation: 100,
      })
  );

  const [backgroundSelection, setBackgroundSelection] = useState<
    Record<string, boolean>
  >(() => readJSON<Record<string, boolean>>("background_selection", {}));

  const [appearance, setAppearance] = useState<AppearanceSettings>(() => {
    const saved = readJSON<Partial<AppearanceSettings>>("ghiblify_appearance", {});
    return { ...DEFAULT_APPEARANCE, ...saved };
  });

  // Apply appearance to document root: theme class + contrast class.
  useEffect(() => {
    const root = document.documentElement;
    THEME_NAMES.forEach((t) => root.classList.remove(`theme-${t}`));
    root.classList.add(`theme-${appearance.theme}`);
    root.classList.toggle("high-contrast", appearance.highContrast);
  }, [appearance]);

  const [widgets, setWidgets] = useState<WidgetsState>(loadInitialWidgets);

  // Persist on every widgets change. Skip the very first render so we don't
  // overwrite the value we just loaded.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    persistWidgets(widgets);
  }, [widgets]);

  const toggleEditMode = () => {
    setShowWidgetEdits((prev) => !prev);
    setIsDragging(false);
  };

  const updateBackgroundFilters = (filters: Partial<BackgroundFilters>) => {
    setBackgroundFilters((prev) => {
      const next = { ...prev, ...filters };
      localStorage.setItem("background_filters", JSON.stringify(next));
      return next;
    });
  };

  const updateBackgroundSelection = (movieKey: string, value: boolean) => {
    setBackgroundSelection((prev) => {
      const next = { ...prev, [movieKey]: value };
      localStorage.setItem("background_selection", JSON.stringify(next));
      return next;
    });
  };

  const updateAppearance = (patch: Partial<AppearanceSettings>) => {
    setAppearance((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem("ghiblify_appearance", JSON.stringify(next));
      return next;
    });
  };

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
      // Preserve user-created content. Links live inside settings (legacy
      // shape from the localStorage migration) but they're user data, not
      // config — resetting positions/sizes shouldn't wipe them.
      next.quicklinks.settings.links = prev.quicklinks.settings.links;
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
        backgroundFilters,
        updateBackgroundFilters,
        backgroundSelection,
        updateBackgroundSelection,
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
