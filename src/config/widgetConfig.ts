import type { ManualPlace } from "../utils/geocoding";
import type { HighlightTextColor } from "../utils/textHighlight";
import type { PomodoroSoundKey } from "../utils/pomodoroChime";

export interface WidgetPosition {
  x: number;
  y: number;
}

export interface InfoFields {
  japaneseTitle: boolean;
  title: boolean;
  year: boolean;
  movieLength: boolean;
  quote: boolean;
}

export interface QuicklinkItem {
  id: string;
  title: string;
  url: string;
}

// Per-widget settings: only widget-specific fields. Position and visibility
// belong to the widget shell (see WidgetEntry in AppContext), not in here.
export interface TimeSettings {
  fontSize: number;
  is24Hour: boolean;
  /** 0-200, % of the base CSS text-shadow alpha. Default 100 keeps
   *  the historical shadow exactly as-is; 0 removes it; 200 doubles
   *  the alpha for legibility on very busy/light backgrounds. */
  textShadow: number;
  /** When true, render a round analog dial (hour/minute/second hands)
   *  instead of the digital readout. is24Hour is ignored in analog
   *  mode — the dial always shows 12 numerals. */
  analog: boolean;
  highlightColor: HighlightColor;
  /** Ink on top of the highlight. "auto" picks from the highlight's
   *  luminance; light/dark are the user overruling that. */
  highlightTextColor: HighlightTextColor;
  /** 0–100 — how solid the highlight bar is. Kept apart from the colour
   *  so picking a new swatch doesn't reset it. */
  highlightOpacity: number;
  /** Type the text out on load, one character at a time, then leave it.
   *  A once-per-tab flourish, not a loop. */
  typeIn: boolean;
}
/** A highlighter bar behind the widget's text. A `#rrggbb` string turns
 *  it on and is the colour; null is off. One field rather than an
 *  enabled flag plus a colour, so the two can't disagree. */
export type HighlightColor = string | null;
export interface DateSettings {
  fontSize: number;
  textShadow: number;
  highlightColor: HighlightColor;
  /** Ink on top of the highlight. "auto" picks from the highlight's
   *  luminance; light/dark are the user overruling that. */
  highlightTextColor: HighlightTextColor;
  /** 0–100 — how solid the highlight bar is. Kept apart from the colour
   *  so picking a new swatch doesn't reset it. */
  highlightOpacity: number;
  /** Type the text out on load, one character at a time, then leave it.
   *  A once-per-tab flourish, not a loop. */
  typeIn: boolean;
}
export interface GreetingSettings {
  fontSize: number;
  name: string;
  textShadow: number;
  highlightColor: HighlightColor;
  /** Ink on top of the highlight. "auto" picks from the highlight's
   *  luminance; light/dark are the user overruling that. */
  highlightTextColor: HighlightTextColor;
  /** 0–100 — how solid the highlight bar is. Kept apart from the colour
   *  so picking a new swatch doesn't reset it. */
  highlightOpacity: number;
  /** Type the text out on load, one character at a time, then leave it.
   *  A once-per-tab flourish, not a loop. */
  typeIn: boolean;
}
export interface InfoSettings {
  fontSize: number;
  infoFields: InfoFields;
  textShadow: number;
  highlightColor: HighlightColor;
  /** Ink on top of the highlight. "auto" picks from the highlight's
   *  luminance; light/dark are the user overruling that. */
  highlightTextColor: HighlightTextColor;
  /** 0–100 — how solid the highlight bar is. Kept apart from the colour
   *  so picking a new swatch doesn't reset it. */
  highlightOpacity: number;
  /** Type the text out on load, one character at a time, then leave it.
   *  A once-per-tab flourish, not a loop. */
  typeIn: boolean;
}
export interface TodoSettings {
  width: number;
  height: number;
  collapsed: boolean;
  /** 0–100 — controls the alpha of the surface tint on non-Frost
   *  themes. Default 75. */
  opacity: number;
  /** 0–100 — controls Frost glass blur intensity. Independent from
   *  opacity so each can have its own ergonomic default. Default 25. */
  blur: number;
}
export interface AvatarSettings {
  selectedAvatar: string;
  size: number;
}
export interface QuicklinksSettings {
  width: number;
  height: number;
  gridMode: boolean;
  links: QuicklinkItem[];
  /** 0–100 — controls the alpha of link tile surfaces (non-Frost). */
  opacity: number;
  /** 0–100 — Frost blur intensity for tiles. */
  blur: number;
}
export interface SearchBarSettings {
  width: number;
  height: number;
  /** 0–100 — controls the alpha of input + button surface (non-Frost). */
  opacity: number;
  /** 0–100 — Frost blur intensity. */
  blur: number;
}
// Pomodoro owns its own localStorage for the timer state + leader
// election. The settings here are just the visual chrome — size
// preset (small / medium / large) and opacity. The card snaps
// to one of three preset footprints rather than free-resizing,
// so each size has its own dedicated layout (small hides text
// labels on controls, large gets generous breathing room).
export type PomodoroSize = "small" | "medium" | "large";

export interface PomodoroSettings {
  size: PomodoroSize;
  /** 0–100 — surface alpha, drives the card's background opacity. */
  opacity: number;
  /** Chime played when a focus or break period runs out. Synthesised
   *  at playback time — see `utils/pomodoroChime.ts`. "none" is silent. */
  sound: PomodoroSoundKey;
  /** 0–100 — chime volume. Independent of `opacity`; 0 is silent and
   *  is the same end state as `sound: "none"`. */
  soundVolume: number;
}
/**
 * How much forecast the widget shows.
 *
 * This is one scale, not three independent switches: each step is a
 * superset of the one before it. The previous model — a checkbox each
 * for now / hourly / daily, plus a separate "icons only" toggle — could
 * express states nobody wants (daily without hourly) and one that
 * doesn't render at all, which is why it needed a "keep at least one
 * on" rule and a disabled-checkbox state to police itself. A scale has
 * no invalid position to police.
 */
export const WEATHER_DETAILS = ["icon", "now", "hourly", "full"] as const;
export type WeatherDetail = (typeof WEATHER_DETAILS)[number];

/** Which strips a detail level renders. */
export const sectionsForDetail = (detail: WeatherDetail) => ({
  // "Now" is always on: every level shows current conditions, and
  // "icon" is that same block with the text stripped rather than a
  // fourth section.
  now: true,
  hourly: detail === "hourly" || detail === "full",
  daily: detail === "full",
});

/** Legacy shape, still sitting in storage for anyone upgrading. */
interface LegacyWeatherDisplay {
  sections?: { now?: boolean; hourly?: boolean; daily?: boolean };
  iconsOnly?: boolean;
}

/**
 * The detail level for a stored settings blob, migrating the old
 * checkbox trio when the new field isn't there yet. Deliberately not a
 * one-time storage migration: settings sync across devices, and a tab
 * running an older build would write the legacy shape straight back.
 */
export const resolveWeatherDetail = (
  settings: Partial<WeatherSettings> & LegacyWeatherDisplay
): WeatherDetail => {
  const stored = settings.detail;
  if (stored && (WEATHER_DETAILS as readonly string[]).includes(stored)) {
    return stored;
  }
  if (settings.iconsOnly) return "icon";
  if (settings.sections?.daily) return "full";
  if (settings.sections?.hourly) return "hourly";
  return "now";
};
export interface WeatherSettings {
  /** "C" = Celsius, "F" = Fahrenheit. */
  unit: "C" | "F";
  /** How much forecast to show — see WEATHER_DETAILS. */
  detail: WeatherDetail;
  /** 0–100 — alpha of the hourly/daily forecast cell backgrounds
   *  (non-Frost). The widget itself stays transparent; only the cells
   *  use this. */
  opacity: number;
  /** 0–100 — Frost blur intensity for the widget shell. */
  blur: number;
  /** "animated" = Meteocons SMIL-animated SVG (default — sun glints,
   *  rain falls). "still" = single-frame static variant for users who
   *  prefer no motion (or to save battery). */
  iconStyle: "animated" | "still";
  /** When true, paint a soft gradient card behind the weather
   *  content (sky-blue → rose, with rounded corners + a subtle
   *  shadow). When false, the widget keeps its current
   *  transparent-on-photo treatment. Default false so existing
   *  users see no change. */
  showCard: boolean;
  /** A city the user picked by name. When set it wins over device
   *  location and the widget needs no geolocation permission at all.
   *  null = auto-detect (the default). */
  manualPlace: ManualPlace | null;
  /** Whether the widget may ask the device where it is. Chrome won't
   *  let `geolocation` be an optional permission, so this app-level
   *  switch — not a Chrome grant — is what the privacy toggle controls:
   *  off means the API is never called. */
  useDeviceLocation: boolean;
}
// Bookmarks is a right-side sliding panel, not a positioned widget. It's in
// WIDGET_KEYS so its visibility lives in the same state as everything else
// and the sidebar toggle row can include it. Settings and position are
// unused.
export type BookmarksSettings = Record<string, never>;
// Right Sidebar is a meta-widget — toggling it on enables a persistent
// right-side dock that hosts other widgets. Position and settings are
// unused; the dock contents come from each widget's `inRightSidebar`
// flag (added in a later chunk).
export type RightSidebarSettings = Record<string, never>;
export interface NotesSettings {
  width: number;
  height: number;
  /** Free-form note body. Plain text (newlines preserved). Persisted
   *  alongside the widget. */
  content: string;
  /** When true, paint the cardborder.svg behind the textarea. When
   *  false the widget is just a plain cream rectangle (no border art).
   *  Toggled from the widget's edit-mode controls. Default true. */
  showBorder: boolean;
}

export interface WidgetSettingsMap {
  time: TimeSettings;
  date: DateSettings;
  greeting: GreetingSettings;
  info: InfoSettings;
  todo: TodoSettings;
  avatar: AvatarSettings;
  quicklinks: QuicklinksSettings;
  searchbar: SearchBarSettings;
  pomodoro: PomodoroSettings;
  bookmarks: BookmarksSettings;
  weather: WeatherSettings;
  notes: NotesSettings;
  rightSidebar: RightSidebarSettings;
}

export type WidgetKey = keyof WidgetSettingsMap;

export const WIDGET_KEYS: readonly WidgetKey[] = [
  "time",
  "date",
  "greeting",
  "info",
  "todo",
  "avatar",
  "quicklinks",
  "searchbar",
  "pomodoro",
  "bookmarks",
  "weather",
  "notes",
  "rightSidebar",
];

export const isWidgetKey = (s: string | undefined): s is WidgetKey =>
  !!s && (WIDGET_KEYS as readonly string[]).includes(s);

export interface ResizeBound {
  min: number;
  max: number;
  step: number;
}

export interface CustomControls {
  timeFormat?: boolean;
  infoFields?: boolean;
  avatarSelector?: boolean;
  gridMode?: boolean;
  darkMode?: boolean;
  weatherUnit?: boolean;
  /** Detail scale — replaces the old sections + icons-only pair. */
  weatherDetail?: boolean;
  /** Card + icon animation, as one visual group. */
  weatherStyle?: boolean;
  /** City search + "use my location" reset, in the edit overlay. */
  weatherLocation?: boolean;
  notesShowBorder?: boolean;
  pomodoroSize?: boolean;
  pomodoroSound?: boolean;
}

export interface WidgetConfig<K extends WidgetKey> {
  name: string;
  position: WidgetPosition;
  settings: WidgetSettingsMap[K];
  fontSize?: ResizeBound;
  width?: ResizeBound;
  height?: ResizeBound;
  size?: ResizeBound;
  customControls?: CustomControls;
  /** When true, width and height are tied during drag-resize — both
   *  follow the larger of the two dimensions so the widget always
   *  stays square. (Used by Notes so the cardborder.svg never
   *  letterboxes.) */
  squareLock?: boolean;
}

type WidgetConfigsType = { [K in WidgetKey]: WidgetConfig<K> };

export const WIDGET_CONFIGS: WidgetConfigsType = {
  time: {
    name: "Time",
    position: { x: 50, y: 24.77064220183486 },
    settings: {
      fontSize: 200,
      is24Hour: false,
      textShadow: 100,
      analog: false,
      highlightColor: null,
      highlightTextColor: "auto",
      highlightOpacity: 100,
      typeIn: false,
    },
    fontSize: { min: 20, max: 250, step: 20 },
    customControls: { timeFormat: true },
  },
  date: {
    name: "Date",
    position: { x: 50, y: 50 },
    settings: {
      fontSize: 24,
      textShadow: 100,
      highlightColor: null,
      highlightTextColor: "auto",
      highlightOpacity: 100,
      typeIn: false,
    },
    fontSize: { min: 10, max: 50, step: 5 },
  },
  greeting: {
    name: "Greeting",
    position: { x: 50, y: 21.498311671763506 },
    settings: {
      fontSize: 28,
      name: "",
      textShadow: 100,
      highlightColor: null,
      highlightTextColor: "auto",
      highlightOpacity: 100,
      typeIn: false,
    },
    fontSize: { min: 14, max: 60, step: 4 },
  },
  info: {
    name: "Info",
    position: { x: 50, y: 78.08870116156282 },
    settings: {
      fontSize: 16,
      infoFields: {
        japaneseTitle: true,
        title: true,
        year: true,
        movieLength: true,
        quote: true,
      },
      textShadow: 100,
      highlightColor: null,
      highlightTextColor: "auto",
      highlightOpacity: 100,
      typeIn: false,
    },
    fontSize: { min: 10, max: 50, step: 5 },
    customControls: { infoFields: true },
  },
  todo: {
    name: "Todo",
    position: { x: 13.169590643274855, y: 2 },
    settings: {
      width: 350,
      height: 200,
      collapsed: false,
      opacity: 75,
      blur: 10,
    },
    width: { min: 250, max: 600, step: 50 },
    height: { min: 200, max: 700, step: 50 },
  },
  avatar: {
    name: "Avatar",
    position: { x: 50, y: 9.914150101936801 },
    settings: { selectedAvatar: "chihiro", size: 100 },
    size: { min: 50, max: 400, step: 50 },
    customControls: { avatarSelector: true },
  },
  quicklinks: {
    name: "Quick Links",
    position: { x: 50, y: 54.791029561671756 },
    settings: {
      width: 600,
      height: 200,
      gridMode: true,
      links: [],
      opacity: 75,
      blur: 10,
    },
    width: { min: 200, max: 600, step: 100 },
    height: { min: 200, max: 700, step: 100 },
    customControls: { gridMode: true },
  },
  searchbar: {
    name: "Search Bar",
    position: { x: 50, y: 2 },
    settings: { width: 550, height: 64, opacity: 75, blur: 10 },
    width: { min: 200, max: 800, step: 25 },
    // These are reference px against a 1920-wide viewport, so they
    // render smaller on a laptop — 64 lands at ~48 real px on a 1440
    // screen, which is the Google pill's height. The floor was 20 back
    // when this was a thin input; the pill carries 34px icon buttons.
    height: { min: 48, max: 96, step: 4 },
  },
  pomodoro: {
    name: "Pomodoro",
    position: { x: 86.83040935672514, y: 57.429153924566776 },
    settings: {
      size: "medium",
      opacity: 100,
      sound: "musicbox",
      soundVolume: 70,
    },
    // No width/height ResizeBound — Pomodoro snaps to small /
    // medium / large via the right-click size radio (or the
    // EditWidget overlay) rather than free-resize, so each preset
    // has its own crafted layout.
    customControls: { pomodoroSize: true, pomodoroSound: true },
  },
  bookmarks: {
    name: "Bookmarks",
    // Position unused — bookmarks renders as a right-side panel, not a
    // positioned tile. Visible defaults to false so existing users don't
    // suddenly get a new panel.
    position: { x: 50, y: 50 },
    settings: {},
  },
  weather: {
    name: "Weather",
    position: { x: 92.44901315789474, y: 2 },
    settings: {
      unit: "C",
      detail: "now",
      opacity: 75,
      blur: 10,
      iconStyle: "animated",
      showCard: false,
      manualPlace: null,
      useDeviceLocation: true,
    },
    // No width/height ResizeBound — widget auto-sizes to content.
    customControls: {
      weatherUnit: true,
      weatherDetail: true,
      weatherStyle: true,
      weatherLocation: true,
    },
  },
  notes: {
    name: "Notes",
    position: { x: 80, y: 30 },
    // Fixed square footprint so the cardborder.svg (square) sits flush
    // against the widget's edges with no letterboxing cream gap around
    // it. Not user-resizable — no width/height ResizeBound.
    settings: { width: 260, height: 260, content: "", showBorder: true },
    customControls: { notesShowBorder: true },
  },
  rightSidebar: {
    name: "Right Sidebar",
    // Position unused — the right sidebar is a fixed-position dock,
    // not a positioned tile. Visibility drives the dock surface; the
    // dock's contents are routed there by each widget's
    // inRightSidebar flag (introduced in a later chunk).
    position: { x: 0, y: 0 },
    settings: {},
  },
};

export const getWidgetConfig = <K extends WidgetKey>(key: K): WidgetConfig<K> =>
  WIDGET_CONFIGS[key];
