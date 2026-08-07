import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DEFAULT_DOCK_WIDGET_KEYS,
  DockWidgetAlignment,
  getDefaultDockAlignment,
  WidgetKey,
  WidgetPosition,
  WidgetSettingsMap,
  WIDGET_CONFIGS,
  WIDGET_KEYS,
} from "../config/widgetConfig";
import {
  readFilters,
  readParallax,
  readSelection,
  writeFilters,
  writeParallax,
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
  writeBatch as writePersistedBatch,
} from "../storage/hybridStorage";
import { setProportionalScaling } from "../utils/viewportScale";

const STORAGE_KEY = "ghiblify_widgets";
const SCHEMA_VERSION_KEY = "ghiblify_widgets_schema_version";
const CURRENT_WIDGET_SCHEMA_VERSION = 7;
const LEGACY_DOCK_BACKGROUND_KEY = "ghiblify_dock_show_bg";

// Per-widget, the fields stored as REFERENCE-VIEWPORT pixels (i.e.,
// "px as if at 1920px viewport width"). Used by the v2 migration
// to normalize a user's existing pixel values away from their
// current viewport into the canonical reference frame.
const REFERENCE_PX_FIELDS: Partial<Record<WidgetKey, readonly string[]>> = {
  time: ["fontSize"],
  date: ["fontSize"],
  greeting: ["fontSize"],
  info: ["fontSize"],
  todo: ["width", "height"],
  searchbar: ["width", "height"],
  notes: ["width", "height"],
  avatar: ["size"],
};

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
 *  text + accents (CSS only - no new vars needed at the call site). */
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

// Available cursor presets. "default" leaves the OS cursor untouched
// and shows nothing extra. The others render a sprite, trail, or
// soft colour halo BESIDE the OS cursor (we never replace the
// cursor itself - see CursorEffect.tsx).
//
//   companion  - single sprite that eases toward the cursor
//   trail      - particles emit + drift behind the cursor
//   glow       - soft colour halo follows the cursor
export const CURSOR_NAMES = [
  "default",
  "soot",
  "sparkle",
  "petal",
  "bubble",
  "heart",
  "leaf",
  "strawberry",
  // The folded paper birds from Spirited Away.
  "shikigami",
] as const;
export type CursorName = (typeof CURSOR_NAMES)[number];

// Bundled cute fonts (see public/assets/fonts/ + @font-face rules in
// App.css). "default" means the system stack - no font file loaded.
// Adding a new font: drop a woff2 in /public/assets/fonts/, add its
// @font-face + html.font-<key> override in App.css, and append the
// key here. The picker auto-renders.
export const FONT_NAMES = [
  "default",
  "fredoka",
  "space-mono",
] as const;
export type FontName = (typeof FONT_NAMES)[number];

/** How round every surface in the app is. Drives the --radius-* scale
 *  (see App.css) through a class on <html>, so one setting moves widget
 *  shells, inputs, popovers and modals together. */
export const CORNER_STYLES = ["square", "rounded", "pill"] as const;
export type CornerStyle = (typeof CORNER_STYLES)[number];

export interface AppearanceSettings {
  theme: ThemeName;
  highContrast: boolean;
  cursor: CursorName;
  font: FontName;
  /** When true (default), widget size settings (width / height /
   *  fontSize / size) are interpreted as "px at a 1920px-wide
   *  reference viewport" and scaled to the current viewport on
   *  render - so a widget looks proportionally the same on a 27"
   *  monitor and a 13" laptop. When false, the stored pixel
   *  numbers are used as-is. Toggled from the LeftSidebar's
   *  "Widget Settings" modal. Default ON preserves prior behavior. */
  proportionalScaling: boolean;
  /** Corner softness for every surface. Default "rounded" is the scale
   *  the app has always shipped. */
  corners: CornerStyle;
}

/** A stored cursor that no longer exists (the retired "rainbow" trail)
 *  falls back to the plain pointer rather than leaving the picker with
 *  nothing selected. */
export const normalizeCursor = (value: unknown): CursorName =>
  (CURSOR_NAMES as readonly string[]).includes(value as string)
    ? (value as CursorName)
    : "default";

const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: "ghibli",
  highContrast: false,
  cursor: "default",
  font: "default",
  proportionalScaling: true,
  corners: "rounded",
};

export interface BackgroundFilters {
  blur: number;
  brightness: number;
  contrast: number;
  saturation: number;
}

export type WidgetDockWidth = "half" | "full";
export type WidgetSurface = "canvas" | "dock";
export interface WidgetDockLayoutPatch {
  dockWidth?: WidgetDockWidth;
  dockAlignment?: DockWidgetAlignment;
}

export type WidgetEntry<K extends WidgetKey> = {
  visible: boolean;
  position: WidgetPosition;
  /** When true, render an instance of this widget in the right dock
   *  IN ADDITION to its canvas placement. Independent of `visible`:
   *  a widget can be shown on the canvas, in the dock, in both, or
   *  in neither. Only takes effect while the `rightSidebar` widget
   *  is enabled. */
  inRightSidebar: boolean;
  /** How wide this widget renders inside the dock - either the full
   *  column or half (so two widgets share a row). Only meaningful
   *  for widgets the picker / context-menu opts in (Weather, Time,
   *  Date, Avatar, Notes). Other dock widgets always span full. */
  dockWidth: WidgetDockWidth;
  /** Horizontal content alignment used only by the right-dock copy.
   *  Kept outside widget settings so changing the dock composition
   *  never alters the same widget on the canvas. */
  dockAlignment: DockWidgetAlignment;
  /** Position of this widget within the right dock's vertical
   *  stack. Lower values render first. Defaults to a per-widget
   *  fallback so newly-docked widgets land at a stable position
   *  before the user has reordered anything. The dock editor's Up/Down
   *  controls update dockOrder for every
   *  currently-docked widget so the indices stay sequential. */
  dockOrder: number;
  settings: WidgetSettingsMap[K];
  /** Overrides applied on top of `settings` when this widget renders
   *  inside the right dock. Lets the user keep e.g. a different
   *  weather unit / forecast layout in the dock vs the canvas
   *  without forking the widget logic. Empty by default - when
   *  empty, the dock instance reads canvas settings unchanged. */
  dockSettings: Partial<WidgetSettingsMap[K]>;
};

export type WidgetsState = { [K in WidgetKey]: WidgetEntry<K> };

/** Guide spotlight targets. Some steps use the value only to control
 *  whether the sidebar is visible; the rest also pulse the named region. */
export type SidebarSpotlight =
  | "welcome"
  | "canvas"
  | "shortcuts"
  | "guide"
  | "widgets"
  | "widgetEdit"
  | "palette"
  | "background"
  | null;

interface AppContextType {
  // global UI
  isDragging: boolean;
  setIsDragging: (b: boolean) => void;
  showWidgetEdits: boolean;
  toggleEditMode: () => void;
  showGuide: boolean;
  setShowGuide: (b: boolean) => void;
  /** Drives a "spotlight" tour effect on the LeftSidebar: when set,
   *  the sidebar force-opens itself above any modal backdrop and a
   *  CSS pulse animation highlights the relevant region (the Guide
   *  button, the widget toggle grid, etc.). Welcome modal slides set
   *  this; null clears it. */
  sidebarSpotlight: SidebarSpotlight;
  setSidebarSpotlight: (s: SidebarSpotlight) => void;
  /** When non-null, only this single widget shows its EditWidget overlay
   *  (triggered by the D+pencil affordance on a single widget).
   *  showWidgetEdits is the global "edit all widgets" mode and is
   *  independent. */
  editingWidgetKey: WidgetKey | null;
  setEditingWidgetKey: (k: WidgetKey | null) => void;

  // background
  backgroundFilters: BackgroundFilters;
  updateBackgroundFilters: (f: Partial<BackgroundFilters>) => void;
  /** Soft cursor-driven parallax on the background photo. Toggled
   *  from the sidebar's filters section, persisted with the rest
   *  of the background prefs. */
  backgroundParallax: boolean;
  setBackgroundParallax: (on: boolean) => void;
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

  // widgets - single source of truth
  /** Widget state as the app should *render* it - the committed
   *  settings with any live hover preview merged on top. */
  widgets: WidgetsState;
  /** Widget state as it is actually saved. Menus and settings UI read
   *  this so a hover preview can't make a radio look already-selected. */
  widgetsCommitted: WidgetsState;
  /** Overlay a settings patch for one widget without saving it, so a
   *  menu row can demo what picking it would do. null clears. */
  previewWidgetSettings: (
    key: WidgetKey,
    patch: Record<string, unknown> | null,
    surface?: WidgetSurface
  ) => void;
  /** Temporarily recompose one dock widget while the user hovers a
   *  layout choice. null restores all saved dock layout values. */
  previewWidgetDockLayout: (
    key: WidgetKey,
    patch: WidgetDockLayoutPatch | null,
  ) => void;
  toggleWidgetVisibility: (key: WidgetKey) => void;
  updateWidgetPosition: (key: WidgetKey, pos: WidgetPosition) => void;
  updateWidgetSettings: <K extends WidgetKey>(
    key: K,
    patch: Partial<WidgetSettingsMap[K]>
  ) => void;
  /** Patch the dock-only override layer for a widget. Has no effect
   *  on the canvas instance - the canvas reads `settings`. */
  updateWidgetDockSettings: <K extends WidgetKey>(
    key: K,
    patch: Partial<WidgetSettingsMap[K]>
  ) => void;
  /** Move a widget between the canvas and the right dock. The dock
   *  must already be enabled (rightSidebar widget visible) for the
   *  move to be visible; toggling this off restores canvas
   *  positioning. */
  setWidgetInRightSidebar: (key: WidgetKey, value: boolean) => void;
  /** Set how wide a widget should render inside the dock. "full"
   *  spans the column; "half" lets two widgets share a row. Stored
   *  per-widget so users can mix half + full. */
  setWidgetDockWidth: (key: WidgetKey, value: WidgetDockWidth) => void;
  setWidgetDockAlignment: (
    key: WidgetKey,
    value: DockWidgetAlignment,
  ) => void;
  /** Reorder docked widgets. Pass the array of currently-docked
   *  keys in the new desired order; this rewrites every entry's
   *  `dockOrder` to its index in the array so the sequence stays
   *  contiguous. Other widgets' dockOrder is left alone. */
  reorderDockedWidgets: (orderedKeys: WidgetKey[]) => void;
  /** Reset every dock-only field on every widget back to defaults
   *  (Todo/Weather/Notes membership, full width, canonical order,
   *  dockSettings={}). The canvas-side
   *  state (visible, position, settings) is left alone. */
  resetRightSidebar: () => void;

  resetAllWidgets: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Widgets that default to hidden - keeps the first-load page calm and
// uncluttered. Users opt them in via the sidebar toggles.
const HIDDEN_BY_DEFAULT: ReadonlySet<WidgetKey> = new Set<WidgetKey>([
  "searchbar",
  "quicklinks",
  "avatar",
  "pomodoro",
  "notes",
  "rightSidebar",
  "googleApps",
]);

const DOCKED_BY_DEFAULT: ReadonlySet<WidgetKey> = new Set<WidgetKey>(
  DEFAULT_DOCK_WIDGET_KEYS,
);

const buildDefaultWidgets = (): WidgetsState => {
  const out = {} as WidgetsState;
  for (const key of WIDGET_KEYS) {
    const cfg = WIDGET_CONFIGS[key];
    (out as Record<WidgetKey, unknown>)[key] = {
      visible: !HIDDEN_BY_DEFAULT.has(key),
      position: { ...cfg.position },
      inRightSidebar: DOCKED_BY_DEFAULT.has(key),
      dockWidth: "full" as WidgetDockWidth,
      dockAlignment: getDefaultDockAlignment(key),
      // Default order matches the canonical WIDGET_KEYS index so a
      // freshly-docked widget lands at a stable position before the
      // user has reordered anything. The dock ordering controls
      // reassigns sequential integers across all docked widgets.
      dockOrder: WIDGET_KEYS.indexOf(key),
      settings: structuredClone(cfg.settings),
      dockSettings: {},
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
    // true, but bookmarks defaults to false - so toggling it on differs
    // from default and MUST be persisted).
    const defaultVisible = !HIDDEN_BY_DEFAULT.has(key);
    if (entry.visible !== defaultVisible) out.visible = entry.visible;
    if (!positionsEqual(entry.position, cfg.position))
      out.position = entry.position;
    const defaultInRightSidebar = DOCKED_BY_DEFAULT.has(key);
    if (entry.inRightSidebar !== defaultInRightSidebar)
      out.inRightSidebar = entry.inRightSidebar;
    if (entry.dockWidth !== "full") out.dockWidth = entry.dockWidth;
    if (entry.dockAlignment !== getDefaultDockAlignment(key))
      out.dockAlignment = entry.dockAlignment;
    if (entry.dockOrder !== WIDGET_KEYS.indexOf(key))
      out.dockOrder = entry.dockOrder;
    const settingsDiff = diffSettings(entry.settings, cfg.settings);
    if (Object.keys(settingsDiff).length > 0) out.settings = settingsDiff;
    if (entry.dockSettings && Object.keys(entry.dockSettings).length > 0)
      out.dockSettings = entry.dockSettings;
    if (Object.keys(out).length > 0) minimal[key] = out;
  }
  if (Object.keys(minimal).length === 0) {
    removePersisted(STORAGE_KEY);
  } else {
    writePersisted(STORAGE_KEY, minimal);
  }
};

const persistWidgetMigration = (
  blob: Record<string, any>,
  schemaVersion: number,
) => {
  writePersistedBatch({
    [STORAGE_KEY]: blob,
    [SCHEMA_VERSION_KEY]: schemaVersion,
  });
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
  // when the modern blob exists - the legacy entry is only present
  // for users coming from the v1 extension. Cleared after read so
  // it's idempotent.
  const legacyQL = readLegacyQuickLinks();
  if (legacyQL && legacyQL.length) {
    defaults.quicklinks.settings.links = legacyQL;
    clearLegacyQuickLinks();
  }

  // Modern blob - apply diffs onto defaults. Done after the legacy
  // pull so a user with both legacy AND modern data keeps their
  // modern set (legacy is treated as a seed for first-run only).
  const blob = readPersisted<Record<string, any> | null>(STORAGE_KEY, null);
  if (blob) {
    let schemaVersion = readPersisted<number>(SCHEMA_VERSION_KEY, 1);
    const upgradingFrom240 = schemaVersion <= 2;
    const legacyDockBackground = readPersisted<boolean | null>(
      LEGACY_DOCK_BACKGROUND_KEY,
      null,
    );

    // Schema-v2 migration: stored size fields used to be raw px;
    // now they're "px at a 1920 reference viewport". A user whose
    // widgets were sized at e.g. 1280px wide needs their values
    // multiplied by 1920/1280 so that when the widget code later
    // scales back (storedRef * currentVw / 1920), the on-screen
    // size is identical to before the migration.
    //
    // Safe to run synchronously here because `window.innerWidth` is
    // available at module-load time inside the new-tab page.
    if (schemaVersion < 2 && typeof window !== "undefined") {
      const referenceWidth = 1920;
      const currentWidth = window.innerWidth || referenceWidth;
      const scale = referenceWidth / currentWidth;
      for (const key of WIDGET_KEYS) {
        const stored = blob[key];
        if (!stored?.settings) continue;
        const fields = REFERENCE_PX_FIELDS[key];
        if (!fields) continue;
        for (const field of fields) {
          const v = stored.settings[field];
          if (typeof v === "number" && isFinite(v)) {
            stored.settings[field] = v * scale;
          }
        }
      }
      schemaVersion = 2;
      persistWidgetMigration(blob, schemaVersion);
    }

    // Schema-v3: quicklinks' surface split into a pair per mode. Before
    // this, ONE `opacity`/`blur` drove both the grid tiles and the list
    // popup; now the list reads listOpacity/listBlur, whose defaults
    // (95/0) differ from the grid's (0/0). Without this, anyone who had
    // deliberately tuned their list surface would silently get the new
    // default instead of their own value.
    //
    // An existing Quick Links entry may only contain visibility or
    // position because the old values matched defaults. Recreate those
    // old defaults before translating so an enabled widget keeps its look.
    if (schemaVersion < 3) {
      if (blob.notes && blob.notes.position === undefined) {
        blob.notes.position = { x: 80, y: 30 };
      }
      if (blob.pomodoro && blob.pomodoro.position === undefined) {
        blob.pomodoro.position = {
          x: 86.83040935672514,
          y: 57.429153924566776,
        };
      }
      const qlEntry = blob.quicklinks;
      if (qlEntry) {
        qlEntry.settings ??= {};
        const ql = qlEntry.settings;
        const oldOpacity =
          typeof ql.opacity === "number" ? ql.opacity : 75;
        const oldBlur = typeof ql.blur === "number" ? ql.blur : 10;
        if (ql.listOpacity === undefined) ql.listOpacity = oldOpacity;
        if (ql.listBlur === undefined) ql.listBlur = oldBlur;
        ql.opacity = oldOpacity;
        ql.blur = oldBlur;

        const oldWidth = typeof ql.width === "number" ? ql.width : 600;
        const oldHeight = typeof ql.height === "number" ? ql.height : 200;
        if (ql.linksPerRow === undefined) {
          ql.linksPerRow = Math.max(
            2,
            Math.min(6, Math.round(oldWidth / 100) - 1),
          );
        }
        if (ql.visibleRows === undefined) {
          ql.visibleRows = Math.max(
            1,
            Math.min(4, Math.round(oldHeight / 100) - 1),
          );
        }
      }
      // Todo's `opacity` used to tint each ROW; now it tints the
      // widget's own background and the rows read rowOpacity. Carry
      // the stored value across to the rows and leave the new
      // background clear, which reproduces exactly what the user had.
      blob.todo ??= {};
      blob.todo.settings ??= {};
      const td = blob.todo.settings;
      if (td.height === undefined) td.height = 200;
      if (td.rowOpacity === undefined) td.rowOpacity = td.opacity ?? 75;
      if (td.rowBlur === undefined && typeof td.blur === "number") {
        td.rowBlur = td.blur;
      }
      if (typeof td.surfaceColor === "string" && td.rowColor === undefined) {
        td.rowColor = td.surfaceColor;
      }
      td.opacity = 0;

      const dockTd = blob.todo.dockSettings;
      if (dockTd && typeof dockTd === "object") {
        if (
          dockTd.rowOpacity === undefined &&
          typeof dockTd.opacity === "number"
        ) {
          dockTd.rowOpacity = dockTd.opacity;
        }
        if (dockTd.rowBlur === undefined && typeof dockTd.blur === "number") {
          dockTd.rowBlur = dockTd.blur;
        }
        if (
          typeof dockTd.surfaceColor === "string" &&
          dockTd.rowColor === undefined
        ) {
          dockTd.rowColor = dockTd.surfaceColor;
        }
        if (typeof dockTd.opacity === "number") dockTd.opacity = 0;
      }
      schemaVersion = 3;
      persistWidgetMigration(blob, schemaVersion);
    }

    // Schema-v4: the text widgets' highlight now defaults to 50%
    // rather than fully solid. Anyone who already picked a highlight
    // colour but never touched the opacity has nothing stored, so they
    // would silently see their pill go half-transparent. Pin the old
    // value for them; widgets with no colour set have no pill to
    // change, so they're left alone and pick up the new default.
    if (schemaVersion < 4) {
      for (const key of ["time", "date", "greeting", "info"] as const) {
        const entry = blob[key];
        if (!entry) continue;
        for (const settings of [entry.settings, entry.dockSettings]) {
          if (
            settings &&
            typeof settings.highlightColor === "string" &&
            settings.highlightOpacity === undefined
          ) {
            settings.highlightOpacity = 100;
          }
        }
      }
      schemaVersion = 4;
      persistWidgetMigration(blob, schemaVersion);
    }

    // Schema-v5: Todo, Weather, and Notes now seed a fresh right dock.
    // The old persisted format omitted false membership values, so pin
    // those omissions to false for existing users before applying the new
    // defaults. Explicitly docked widgets already carry true and stay put.
    if (schemaVersion < 5) {
      for (const key of DEFAULT_DOCK_WIDGET_KEYS) {
        blob[key] ??= {};
        if (blob[key].inRightSidebar === undefined) {
          blob[key].inRightSidebar = false;
        }
      }
      schemaVersion = 5;
      persistWidgetMigration(blob, schemaVersion);
    }

    // Schema-v6: the right-dock panel background is now a three-way
    // surface choice. Preserve the old enabled switch as Frost. In 2.4,
    // an absent key also meant enabled because that switch defaulted on.
    if (schemaVersion < 6) {
      blob.rightSidebar ??= {};
      blob.rightSidebar.settings ??= {};
      const settings = blob.rightSidebar.settings;
      if (settings.panelBackground === true && settings.frosted === undefined) {
        settings.frosted = true;
        settings.frostDark = false;
      } else if (upgradingFrom240 && settings.frosted === undefined) {
        settings.frosted = legacyDockBackground !== false;
        settings.frostDark = false;
      }
      delete settings.panelBackground;
      for (const entry of Object.values(blob)) {
        if (entry && typeof entry === "object") delete entry.showBackground;
      }
      schemaVersion = 6;
      persistWidgetMigration(blob, schemaVersion);
    }

    if (schemaVersion < 7) {
      const settings = blob.quicklinks?.settings;
      if (settings) {
        const oldWidth =
          typeof settings.width === "number" ? settings.width : 600;
        const oldHeight =
          typeof settings.height === "number" ? settings.height : 200;
        if (settings.linksPerRow === undefined) {
          settings.linksPerRow = Math.max(
            2,
            Math.min(6, Math.round(oldWidth / 100) - 1),
          );
        }
        if (settings.visibleRows === undefined) {
          settings.visibleRows = Math.max(
            1,
            Math.min(4, Math.round(oldHeight / 100) - 1),
          );
        }
        delete settings.width;
        delete settings.height;
      }
      schemaVersion = 7;
      persistWidgetMigration(blob, schemaVersion);
    }
    removePersisted(LEGACY_DOCK_BACKGROUND_KEY);

    for (const key of WIDGET_KEYS) {
      const entry = defaults[key];
      const stored = blob[key];
      if (!stored) continue;
      if (stored.visible !== undefined) entry.visible = !!stored.visible;
      if (stored.position) entry.position = stored.position;
      if (stored.inRightSidebar !== undefined)
        entry.inRightSidebar = !!stored.inRightSidebar;
      if (stored.dockWidth === "half" || stored.dockWidth === "full")
        entry.dockWidth = stored.dockWidth;
      if (
        stored.dockAlignment === "left" ||
        stored.dockAlignment === "center" ||
        stored.dockAlignment === "right"
      )
        entry.dockAlignment = stored.dockAlignment;
      if (typeof stored.dockOrder === "number")
        entry.dockOrder = stored.dockOrder;
      if (stored.settings)
        entry.settings = { ...entry.settings, ...stored.settings };
      if (stored.dockSettings && typeof stored.dockSettings === "object")
        entry.dockSettings = { ...stored.dockSettings };
    }
    if (defaults.date.settings.displayStyle === "calendar") {
      defaults.date.settings.typeIn = false;
    }
    if (legacyQL && legacyQL.length) {
      // Persist the freshly-imported quick links into the modern
      // blob so subsequent loads find them in the new schema.
      persistWidgets(defaults);
    }
    return defaults;
  } else {
    // Fresh install (no stored blob yet) - defaults are already
    // authored at the 1920 reference baseline, so mark the schema
    // as migrated so the migration block above never runs for new
    // users.
    const schemaVersion = readPersisted<number | null>(
      SCHEMA_VERSION_KEY,
      null,
    );
    if (schemaVersion !== null && schemaVersion <= 2) {
      defaults.todo.settings.height = 200;
      const legacyDockBackground = readPersisted<boolean | null>(
        LEGACY_DOCK_BACKGROUND_KEY,
        null,
      );
      defaults.rightSidebar.settings.frosted =
        legacyDockBackground !== false;
      defaults.rightSidebar.settings.frostDark = false;
      removePersisted(LEGACY_DOCK_BACKGROUND_KEY);
    }
    if (schemaVersion !== null && schemaVersion < 5) {
      for (const key of DEFAULT_DOCK_WIDGET_KEYS) {
        defaults[key].inRightSidebar = false;
      }
    }
  }

  // No modern blob - migrate from legacy (no-op if no legacy keys exist)
  const migrated = migrateLegacy(defaults);
  persistWidgets(migrated);
  writePersisted(SCHEMA_VERSION_KEY, CURRENT_WIDGET_SCHEMA_VERSION);
  clearLegacyKeys();
  return migrated;
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [showWidgetEdits, setShowWidgetEdits] = useState(false);
  // Open the guide automatically the first time a user ever opens this
  // extension, then flip a localStorage flag so it stays closed thereafter.
  const [sidebarSpotlight, setSidebarSpotlight] =
    useState<SidebarSpotlight>(null);
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

  const [backgroundParallax, setBackgroundParallaxState] = useState<boolean>(
    () => readParallax()
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
    // Corner style - html.corners-<key> reassigns --radius-unit, which
    // the whole --radius-* scale derives from. "rounded" is the base
    // scale, so it needs no class.
    CORNER_STYLES.forEach((c) => root.classList.remove(`corners-${c}`));
    if ((appearance.corners ?? "rounded") !== "rounded") {
      root.classList.add(`corners-${appearance.corners}`);
    }
    // Font class - "default" means the system stack so no class is
    // applied; otherwise html.font-<key> sets --app-font via App.css.
    FONT_NAMES.forEach((f) => root.classList.remove(`font-${f}`));
    if (appearance.font !== "default") {
      root.classList.add(`font-${appearance.font}`);
    }
    // Mirror the proportional-scaling toggle into viewportScale's
    // module-level flag. `setProportionalScaling` notifies its own
    // subscribers (via `useScaledPx`), so all widgets re-render
    // through the right toScreenPx branch the moment the user
    // toggles this in the modal.
    setProportionalScaling(appearance.proportionalScaling !== false);
  }, [appearance]);

  const [widgets, setWidgets] = useState<WidgetsState>(loadInitialWidgets);

  // Live hover preview. Kept out of `widgets` entirely - it must never
  // be persisted, and menus need to keep seeing the committed value to
  // render their selection marks correctly.
  const [settingsPreview, setSettingsPreview] = useState<{
    key: WidgetKey;
    patch: Record<string, unknown>;
    surface: WidgetSurface;
  } | null>(null);
  const [dockLayoutPreview, setDockLayoutPreview] = useState<{
    key: WidgetKey;
    patch: WidgetDockLayoutPatch;
  } | null>(null);
  const previewWidgetSettings = useCallback(
    (
      key: WidgetKey,
      patch: Record<string, unknown> | null,
      surface: WidgetSurface = "canvas",
    ) => setSettingsPreview(patch ? { key, patch, surface } : null),
    [],
  );
  const previewWidgetDockLayout = useCallback(
    (key: WidgetKey, patch: WidgetDockLayoutPatch | null) =>
      setDockLayoutPreview(patch ? { key, patch } : null),
    [],
  );

  const widgetsForRender = useMemo(() => {
    let next = widgets;
    if (settingsPreview) {
      const { key, patch, surface } = settingsPreview;
      next = {
        ...next,
        [key]: {
          ...next[key],
          ...(surface === "dock"
            ? { dockSettings: { ...next[key].dockSettings, ...patch } }
            : { settings: { ...next[key].settings, ...patch } }),
        },
      } as WidgetsState;
    }
    if (dockLayoutPreview) {
      const { key, patch } = dockLayoutPreview;
      next = {
        ...next,
        [key]: { ...next[key], ...patch },
      } as WidgetsState;
    }
    return next;
  }, [widgets, settingsPreview, dockLayoutPreview]);

  // Debounced persist - coalesces high-frequency state changes
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

  // The legacy global edit state remains for guided-tour compatibility.
  // Normal editing is per-widget.
  const toggleEditMode = () => {
    setShowWidgetEdits((prev) => {
      setIsDragging(false);
      return !prev;
    });
  };

  const setBackgroundParallax = (on: boolean) => {
    setBackgroundParallaxState(on);
    writeParallax(on);
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

  // Cross-device sync - when chrome.storage.sync delivers a remote
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

  const updateWidgetDockSettings = <K extends WidgetKey>(
    key: K,
    patch: Partial<WidgetSettingsMap[K]>
  ) => {
    setWidgets((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        dockSettings: { ...prev[key].dockSettings, ...patch },
      },
    }));
  };

  const setWidgetInRightSidebar = (key: WidgetKey, value: boolean) => {
    setWidgets((prev) => ({
      ...prev,
      [key]: { ...prev[key], inRightSidebar: value },
    }));
    // Nudge the dock to peek open when a widget lands in it, so the
    // user sees where their widget went instead of watching it
    // "vanish" off the canvas. RightDock listens for this event.
    if (value) {
      window.dispatchEvent(new CustomEvent("ghiblify:rightDock:peek"));
    }
  };

  const setWidgetDockWidth = (key: WidgetKey, value: WidgetDockWidth) => {
    setWidgets((prev) => ({
      ...prev,
      [key]: { ...prev[key], dockWidth: value },
    }));
  };

  const setWidgetDockAlignment = (
    key: WidgetKey,
    value: DockWidgetAlignment,
  ) => {
    setWidgets((prev) => ({
      ...prev,
      [key]: { ...prev[key], dockAlignment: value },
    }));
  };

  const reorderDockedWidgets = (orderedKeys: WidgetKey[]) => {
    setWidgets((prev) => {
      const next = { ...prev };
      const entries = next as Record<WidgetKey, WidgetEntry<WidgetKey>>;
      orderedKeys.forEach((key, idx) => {
        entries[key] = { ...entries[key], dockOrder: idx };
      });
      return next;
    });
  };

  const resetRightSidebar = () => {
    setWidgets((prev) => {
      const next = { ...prev };
      const entries = next as Record<WidgetKey, WidgetEntry<WidgetKey>>;
      (WIDGET_KEYS as readonly WidgetKey[]).forEach((key) => {
        entries[key] = {
          ...entries[key],
          inRightSidebar: DOCKED_BY_DEFAULT.has(key),
          dockWidth: "full",
          dockAlignment: getDefaultDockAlignment(key),
          dockOrder: WIDGET_KEYS.indexOf(key),
          dockSettings: {},
          ...(key === "rightSidebar"
            ? {
                settings: structuredClone(
                  WIDGET_CONFIGS.rightSidebar.settings,
                ),
              }
            : {}),
        };
      });
      return next;
    });
  };

  const resetAllWidgets = () => {
    // No confirm here. Every caller already asks - the settings modal
    // puts up its own dialog first - so this fired a second, native
    // browser prompt on top of it. It was also the one piece of
    // user-facing copy in the app that was hardcoded English rather
    // than going through i18n.
    setWidgets((prev) => {
      const next = buildDefaultWidgets();
      // Preserve user-created content. Todo items already live under
      // their own storage key, outside the widget-layout reset.
      next.quicklinks.settings.links = prev.quicklinks.settings.links;
      next.greeting.settings.name = prev.greeting.settings.name;
      next.notes.settings.content = prev.notes.settings.content;
      next.notes.settings.richContent = prev.notes.settings.richContent;
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
        showGuide,
        setShowGuide,
        sidebarSpotlight,
        setSidebarSpotlight,
        editingWidgetKey,
        setEditingWidgetKey,
        backgroundFilters,
        updateBackgroundFilters,
        backgroundParallax,
        setBackgroundParallax,
        backgroundSelection,
        updateBackgroundSelection,
        currentBackground,
        setCurrentBackground,
        appearance,
        updateAppearance,
        widgets: widgetsForRender,
        widgetsCommitted: widgets,
        previewWidgetSettings,
        previewWidgetDockLayout,
        toggleWidgetVisibility,
        updateWidgetPosition,
        updateWidgetSettings,
        updateWidgetDockSettings,
        setWidgetInRightSidebar,
        setWidgetDockWidth,
        setWidgetDockAlignment,
        reorderDockedWidgets,
        resetRightSidebar,
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
