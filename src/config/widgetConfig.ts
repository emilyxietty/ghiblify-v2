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

/** Base type-in pace: 55ms a character at 100% speed - what every
 *  type-in widget used before the pace was adjustable. */
export const TYPE_IN_BASE_MS = 55;
export const TYPE_IN_SPEED_MIN = 25;
export const TYPE_IN_SPEED_MAX = 300;

/** Milliseconds per typed character for a `typeInSpeed` percentage.
 *  Anything unset or out of range reads as 100%. */
export const typeInMsPerChar = (speed: unknown): number => {
  const pct =
    typeof speed === "number" && Number.isFinite(speed)
      ? Math.min(TYPE_IN_SPEED_MAX, Math.max(TYPE_IN_SPEED_MIN, speed))
      : 100;
  return (TYPE_IN_BASE_MS * 100) / pct;
};

/** Modes in which a widget has nothing to type: the analog clock is a
 *  dial and the calendar is a grid, so the type-in toggle and its
 *  speed are unavailable (not just hidden) there - the stored `typeIn`
 *  is left alone and comes back when the widget returns to text. One
 *  predicate for the shell, the edit panel and the right-click menu. */
export const isTypeInUnavailable = (
  storageKey: WidgetKey,
  settings: Record<string, unknown>,
): boolean =>
  (storageKey === "date" && settings.displayStyle === "calendar") ||
  (storageKey === "time" && settings.analog === true);

export type InfoFieldKey = keyof InfoFields;

/** Every Info field, in the order the widget stacks them out of the
 *  box. Also the canonical list the toggles iterate, so a new field
 *  is added in exactly one place. */
export const INFO_FIELD_KEYS: readonly InfoFieldKey[] = [
  "japaneseTitle",
  "title",
  "quote",
  "year",
  "movieLength",
];

/** Turns a stored `infoFieldOrder` into a complete, valid order:
 *  unknown keys and duplicates are dropped, and any field the stored
 *  list is missing (a field added after the order was saved) is
 *  appended in default order, so nothing can silently disappear from
 *  the widget. */
export const resolveInfoFieldOrder = (order: unknown): InfoFieldKey[] => {
  const seen = new Set<InfoFieldKey>();
  const out: InfoFieldKey[] = [];
  if (Array.isArray(order)) {
    for (const key of order) {
      if (
        (INFO_FIELD_KEYS as readonly string[]).includes(key as string) &&
        !seen.has(key as InfoFieldKey)
      ) {
        seen.add(key as InfoFieldKey);
        out.push(key as InfoFieldKey);
      }
    }
  }
  for (const key of INFO_FIELD_KEYS) if (!seen.has(key)) out.push(key);
  return out;
};

export interface QuicklinkItem {
  id: string;
  title: string;
  url: string;
}

/** The link a brand-new (or newly emptied) Quick Links falls back to.
 *  An empty widget is indistinguishable from a broken one - it renders
 *  as a blank strip with nothing to click - so it always carries at
 *  least this one. Fixed id, so re-seeding cannot pile up duplicates. */
export const QUICKLINKS_FALLBACK: QuicklinkItem = {
  id: "quicklink-default-google",
  title: "Google",
  url: "https://www.google.com",
};

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
   *  mode - the dial always shows 12 numerals. */
  analog: boolean;
  highlightColor: HighlightColor;
  /** Ink on top of the highlight. "auto" picks from the highlight's
   *  luminance; light/dark are the user overruling that. */
  highlightTextColor: HighlightTextColor;
  /** 0–100 - how solid the highlight bar is. Kept apart from the colour
   *  so picking a new swatch doesn't reset it. */
  highlightOpacity: number;
  /** Frosted-glass mode for the highlight bar - adds a backdrop blur
   *  behind the text so the wallpaper diffuses through the tint.
   *  Composes with colour + opacity (drop opacity low for near-pure
   *  glass). Absent/false = classic solid highlighter. */
  highlightFrost?: boolean;
  /** 0–100 - backdrop blur strength for a frosted highlight. */
  highlightBlur?: number;
  /** Type the text out on load, one character at a time, then leave it.
   *  A once-per-tab flourish, not a loop. */
  typeIn: boolean;
  /** Type-in pace as a percentage of the base speed (see
   *  typeInMsPerChar): 100 = the classic 55ms a character, 200 twice
   *  as fast, 50 half. */
  typeInSpeed: number;
}
/** A highlighter bar behind the widget's text. A `#rrggbb` string turns
 *  it on and is the colour; null is off. One field rather than an
 *  enabled flag plus a colour, so the two can't disagree. */
export type HighlightColor = string | null;
export type DateDisplayStyle = "long" | "short" | "slash" | "calendar";
export const DATE_DISPLAY_STYLES = [
  "long",
  "short",
  "slash",
  "calendar",
] as const satisfies readonly DateDisplayStyle[];
export interface DateSettings {
  fontSize: number;
  /** Long localized date, abbreviated date, numeric slash date, or a
   *  compact month grid with today highlighted. */
  displayStyle: DateDisplayStyle;
  textShadow: number;
  highlightColor: HighlightColor;
  /** Ink on top of the highlight. "auto" picks from the highlight's
   *  luminance; light/dark are the user overruling that. */
  highlightTextColor: HighlightTextColor;
  /** 0–100 - how solid the highlight bar is. Kept apart from the colour
   *  so picking a new swatch doesn't reset it. */
  highlightOpacity: number;
  /** Frosted-glass mode for the highlight bar - adds a backdrop blur
   *  behind the text so the wallpaper diffuses through the tint.
   *  Composes with colour + opacity (drop opacity low for near-pure
   *  glass). Absent/false = classic solid highlighter. */
  highlightFrost?: boolean;
  /** 0–100 - backdrop blur strength for a frosted highlight. */
  highlightBlur?: number;
  /** Type the text out on load, one character at a time, then leave it.
   *  A once-per-tab flourish, not a loop. */
  typeIn: boolean;
  /** Type-in pace as a percentage of the base speed (see
   *  typeInMsPerChar): 100 = the classic 55ms a character, 200 twice
   *  as fast, 50 half. */
  typeInSpeed: number;
}
export interface GreetingSettings {
  fontSize: number;
  name: string;
  textShadow: number;
  highlightColor: HighlightColor;
  /** Ink on top of the highlight. "auto" picks from the highlight's
   *  luminance; light/dark are the user overruling that. */
  highlightTextColor: HighlightTextColor;
  /** 0–100 - how solid the highlight bar is. Kept apart from the colour
   *  so picking a new swatch doesn't reset it. */
  highlightOpacity: number;
  /** Frosted-glass mode for the highlight bar - adds a backdrop blur
   *  behind the text so the wallpaper diffuses through the tint.
   *  Composes with colour + opacity (drop opacity low for near-pure
   *  glass). Absent/false = classic solid highlighter. */
  highlightFrost?: boolean;
  /** 0–100 - backdrop blur strength for a frosted highlight. */
  highlightBlur?: number;
  /** Type the text out on load, one character at a time, then leave it.
   *  A once-per-tab flourish, not a loop. */
  typeIn: boolean;
  /** Type-in pace as a percentage of the base speed (see
   *  typeInMsPerChar): 100 = the classic 55ms a character, 200 twice
   *  as fast, 50 half. */
  typeInSpeed: number;
}
export interface InfoSettings {
  fontSize: number;
  infoFields: InfoFields;
  /** Top-to-bottom order of the fields (see resolveInfoFieldOrder for
   *  how a partial or stale list is read). Reordered by dragging the
   *  rows of the right-click Fields submenu. */
  infoFieldOrder: InfoFieldKey[];
  textShadow: number;
  highlightColor: HighlightColor;
  /** Ink on top of the highlight. "auto" picks from the highlight's
   *  luminance; light/dark are the user overruling that. */
  highlightTextColor: HighlightTextColor;
  /** 0–100 - how solid the highlight bar is. Kept apart from the colour
   *  so picking a new swatch doesn't reset it. */
  highlightOpacity: number;
  /** Frosted-glass mode for the highlight bar - adds a backdrop blur
   *  behind the text so the wallpaper diffuses through the tint.
   *  Composes with colour + opacity (drop opacity low for near-pure
   *  glass). Absent/false = classic solid highlighter. */
  highlightFrost?: boolean;
  /** 0–100 - backdrop blur strength for a frosted highlight. */
  highlightBlur?: number;
  /** Type the text out on load, one character at a time, then leave it.
   *  A once-per-tab flourish, not a loop. */
  typeIn: boolean;
  /** Type-in pace as a percentage of the base speed (see
   *  typeInMsPerChar): 100 = the classic 55ms a character, 200 twice
   *  as fast, 50 half. */
  typeInSpeed: number;
}
export interface TodoSettings {
  width: number;
  height: number;
  collapsed: boolean;
  /** 0–100 - controls the alpha of the surface tint on non-Frost
   *  themes. Default 75. */
  opacity: number;
  /** 0–100 - controls Frost glass blur intensity. Independent from
   *  opacity so each can have its own ergonomic default. Default 25. */
  blur: number;
  /** Frosted-glass surface on any theme - shell-level wallpaper blur
   *  with near-transparent item cards (same glass the sticky note
   *  offers via its paper swatches). Default false. */
  frosted?: boolean;
  /** Dark ("smoked") variant of the frosted glass - same blur with a
   *  dark tint on the shell. Only meaningful while `frosted` is true.
   *  Default false (light glass). */
  frostDark?: boolean;
  /** Surface tint. null/absent = the theme's --surface-rgb. Deep-tone
   *  presets only (todo text is var(--light)) - same palette as the
   *  pomodoro card. */
  surfaceColor?: string | null;
  /** Ink on top of the surface. "auto" derives it from surfaceColor's
   *  luminance, so a pale tint gets dark text instead of the default
   *  light one. */
  textColor?: "auto" | "light" | "dark";
  /** HIGHLIGHTS: the per-row tint, separate from the widget's own
   *  background above. Rows carried the surface before it moved to the
   *  container, so these keep that look available independently. */
  rowColor?: string | null;
  rowOpacity: number;
  rowBlur: number;
  rowTextColor?: "auto" | "light" | "dark";
}
export interface AvatarSettings {
  selectedAvatar: string;
  size: number;
  /** 0-100 alpha of the surface behind the avatar. 0 (the default) is
   *  no background at all - the sprite sits straight on the wallpaper,
   *  which is how this widget has always looked. */
  opacity: number;
  /** 0-100 backdrop blur behind that surface. */
  blur: number;
  /** Surface tint. null/absent = the palette's --surface-rgb. */
  surfaceColor?: string | null;
  /** Ink override for the credit chip that sits on the surface. */
  textColor?: "auto" | "light" | "dark";
}
export interface QuicklinksSettings {
  gridMode: boolean;
  /** Number of link tiles shown across each grid page. */
  linksPerRow: number;
  /** Number of link rows shown on each grid page. */
  visibleRows: number;
  links: QuicklinkItem[];
  /** GRID mode surface: 0-100 alpha of the grid's own background. */
  opacity: number;
  /** GRID mode wallpaper blur, 0-100. */
  blur: number;
  /** LIST mode surface: 0-100 alpha of the dropdown popup. Separate
   *  from `opacity` because the two modes paint different surfaces -
   *  a floating popup wants a solid backing to stay readable, while
   *  the grid sits on the page and looks better bare. */
  listOpacity: number;
  /** LIST mode wallpaper blur, 0-100. */
  listBlur: number;
  /** Frosted-glass surface (shell-level wallpaper blur) - same model
   *  as todo/weather. Default false. */
  frosted?: boolean;
  /** Dark ("smoked") glass variant; only meaningful while frosted. */
  frostDark?: boolean;
  /** Surface tint override - an "r, g, b"-able hex. null/absent = the
   *  theme's --dark-rgb. */
  surfaceColor?: string | null;
  /** Ink on top of the surface. "auto" derives it from surfaceColor's
   *  luminance, so a pale tint gets dark text instead of the default
   *  light one. Same model as the text-highlight pill. */
  textColor?: "auto" | "light" | "dark";
}
export interface SearchBarSettings {
  width: number;
  height: number;
  /** Surface tint. null/absent = the built-in Google-style white. */
  surfaceColor?: string | null;
  /** Ink over the bar; "auto" derives it from surfaceColor. */
  textColor?: "auto" | "light" | "dark";
  /** 0–100 - controls the alpha of input + button surface (non-Frost). */
  opacity: number;
  /** 0–100 - Frost blur intensity. */
  blur: number;
}
// Pomodoro owns its own localStorage for the timer state + leader
// election. The settings here are just the visual chrome - size
// preset (small / medium / large) and opacity. The card snaps
// to one of three preset footprints rather than free-resizing,
// so each size has its own dedicated layout (small hides text
// labels on controls, large gets generous breathing room).
export type PomodoroSize = "small" | "medium" | "large";

/** What each retired preset measured. The migration reads this so a
 *  user who had picked "small" keeps a small card - now as a starting
 *  width/height they can drag from, rather than a fixed rung. */
export const POMODORO_LEGACY_DIMS: Record<
  PomodoroSize,
  { width: number; height: number }
> = {
  small: { width: 160, height: 200 },
  medium: { width: 220, height: 260 },
  large: { width: 300, height: 340 },
};

/** The break-time stickers, keyed by file. "random" (the default) picks
 *  a fresh one each time the mode flips, which is what the widget always
 *  did before the choice existed. */
export const POMODORO_IMAGE_KEYS = [
  "random",
  "catbus",
  "chibi",
  "heen",
  "mei",
  "noface",
  "sootsprite",
] as const;
export type PomodoroImageKey = (typeof POMODORO_IMAGE_KEYS)[number];
export const isPomodoroImageKey = (v: unknown): v is PomodoroImageKey =>
  typeof v === "string" &&
  (POMODORO_IMAGE_KEYS as readonly string[]).includes(v);

export interface PomodoroSettings {
  /** Free-resize footprint, driven by the canvas resize handle. */
  width: number;
  height: number;
  /** Legacy: the card used to snap to three presets. Kept optional so
   *  a saved blob can still be read, and migrated to width/height on
   *  first render - see `POMODORO_LEGACY_DIMS` below. Nothing writes
   *  it any more. */
  size?: PomodoroSize;
  /** 0–100 - surface alpha, drives the card's background opacity. */
  opacity: number;
  /** Chime played when a focus or break period runs out. Synthesised
   *  at playback time - see `utils/pomodoroChime.ts`. "none" is silent. */
  sound: PomodoroSoundKey;
  /** 0–100 - chime volume. Independent of `opacity`; 0 is silent and
   *  is the same end state as `sound: "none"`. */
  soundVolume: number;
  /** Which sticker shows during a break. Absent or "random" keeps the
   *  original behaviour: a new character every time the mode flips. */
  timerImage?: PomodoroImageKey;
  /** FOCUS-mode background. null/absent = the theme's --purple-dark. */
  cardColor?: string | null;
  textColor?: "auto" | "light" | "dark";
  /** 0-100 wallpaper blur behind the focus card. */
  blur: number;
  /** BREAK-mode background, tuned independently: the two modes are
   *  meant to read differently at a glance, so one shared colour
   *  defeated the point. null/absent = the built-in signal blue. */
  breakColor?: string | null;
  breakOpacity: number;
  breakBlur: number;
  breakTextColor?: "auto" | "light" | "dark";
}

/** Pomodoro card swatches - deep tones only; the card's text is
 *  var(--light) and must stay readable on every pick. Default (theme
 *  purple) renders as its own leading swatch, stored as null. */
export const POMODORO_CARD_PRESETS = [
  "#274a5e", // ocean
  "#2e4638", // forest
  "#4a2e50", // plum
  "#542e2e", // ember
  "#2f3136", // charcoal
] as const;
/**
 * How much forecast the widget shows.
 *
 * This is one scale, not three independent switches: each step is a
 * superset of the one before it. The previous model - a checkbox each
 * for now / hourly / daily, plus a separate "icons only" toggle - could
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
  /** Surface tint, set from the Background row's adjustments panel. It
   *  paints the widget's own surface (so it shows at every detail
   *  level, not just the ones with forecast cells) and tints the cells
   *  where there are any. null/absent = untinted. */
  surfaceColor?: string | null;
  /** Ink over that surface. "auto" derives it from surfaceColor when
   *  there is one, and otherwise leaves the palette's own ink alone;
   *  light/dark force it either way. */
  textColor?: "auto" | "light" | "dark";
  /** How much forecast to show - see WEATHER_DETAILS. */
  detail: WeatherDetail;
  /** On the canvas, show one forecast section at a time behind the same
   *  Now / Hourly / Daily tabs used by a half-width dock widget. */
  compact: boolean;
  /** 0–100 - alpha of the hourly/daily forecast cell backgrounds
   *  (non-Frost). The widget itself stays transparent; only the cells
   *  use this. */
  opacity: number;
  /** 0–100 - Frost blur intensity for the widget shell. */
  blur: number;
  /** Frosted-glass surface on any theme - shell-level wallpaper blur
   *  with near-transparent cells (same glass as todo/notes). Default
   *  false. */
  frosted?: boolean;
  /** Dark ("smoked") variant of the frosted glass - same blur with a
   *  dark tint on the shell. Only meaningful while `frosted` is true.
   *  Default false (light glass). */
  frostDark?: boolean;
  /** "animated" = Meteocons SMIL-animated SVG (default - sun glints,
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
   *  switch - not a Chrome grant - is what the privacy toggle controls:
   *  off means the API is never called. */
  useDeviceLocation: boolean;
}
// Bookmarks is a right-side sliding panel, not a positioned widget. It's in
// WIDGET_KEYS so its visibility lives in the same state as everything else
// and the sidebar toggle row can include it. Position is unused; the
// settings below are edited from the gear on the panel's heading.
export type BookmarksLayout = "tree" | "drill";
export type BookmarksSort = "manual" | "az" | "recent";
export type BookmarksDensity = "comfortable" | "compact";
export interface BookmarksSettings {
  /** "tree" nests folders inline with indentation (the original, and
   *  still the default). "drill" shows one folder at a time at full
   *  panel width with a back row - a 360px column runs out of room
   *  fast once folders nest. */
  layout: BookmarksLayout;
  /** Row height + type scale. Compact fits roughly a third more links
   *  on screen. */
  density: BookmarksDensity;
  /** Display order. "manual" is Chrome's own order, and the only one
   *  that can accept a drag - reordering under a sorted view would
   *  write a position you can't see. */
  sort: BookmarksSort;
}
// Right Sidebar is a meta-widget - toggling it on enables a persistent
// right-side dock that hosts other widgets. Its settings belong to the
// panel itself; widget-specific appearance remains in each docked
// widget's dockSettings.
export interface RightSidebarSettings {
  /** Clear by default; true applies backdrop blur to the complete dock. */
  frosted: boolean;
  /** Smoked-glass tint layered over the same blur. */
  frostDark: boolean;
}
/** Google corner - waffle apps menu + account button. Stateless. */
export interface GoogleAppsSettings {
  /** 0-100 - alpha of the cluster's surface (non-Frost). */
  opacity: number;
  /** 0-100 - Frost blur intensity. */
  blur: number;
  /** Explicit surface choice; undefined follows the palette. */
  frosted?: boolean;
  frostDark?: boolean;
  /** Custom tint from the surface chips, as #rrggbb. */
  surfaceColor?: string | null;
  /** Ink on top of the surface. "auto" derives it from surfaceColor's
   *  luminance, so a pale tint gets dark text instead of the default
   *  light one. */
  textColor?: "auto" | "light" | "dark";
}
export interface NotesSettings {
  width: number;
  height: number;
  /** Plaintext mirror of the note body (newlines preserved). Kept in
   *  lockstep with `richContent` on every persist so (a) pre-Lexical
   *  builds that only know this field still show the text if the user
   *  downgrades, and (b) the first Lexical load of a legacy note can
   *  import from it. Never read for display when `richContent`
   *  parses. */
  content: string;
  /** Serialized Lexical EditorState JSON - the rich source of truth
   *  (bold / highlight / checklists). Absent on legacy notes; the
   *  editor then imports `content` line-by-line as literal plain
   *  paragraphs so old notes render exactly as they did in the
   *  textarea era. */
  richContent?: string;
  /** When true, paint the cardborder.svg behind the textarea. When
   *  false the widget is just a plain cream rectangle (no border art).
   *  Toggled from the widget's edit-mode controls. Default true. */
  showBorder: boolean;
  /** Paper tint. null/absent = the classic cream (#fbf3df). Chosen
   *  from the preset sticky-note swatches in the edit panel. */
  paperColor?: string | null;
  /** Remove the paper fill entirely. Border art remains independently
   *  controlled by showBorder. */
  paperNone?: boolean;
  /** Frosted-glass paper - the tint goes translucent and the wallpaper
   *  blurs through the note. Default false (solid paper). */
  paperFrost?: boolean;
  /** Paper intensity (0–100). Drives the generic --widget-opacity
   *  cascade (edit-panel slider + right-click submenu). For solid paper
   *  it controls fill alpha; for frosted paper it controls blur strength.
   *  The ink and decorative border stay fully opaque. Default 100. */
  opacity?: number;
  /** The generic Background row's fields - the same quartet every card
   *  widget carries. `surfaceColor` is the paper tint (null = the
   *  classic cream, and takes precedence over the legacy `paperColor`
   *  when set); `blur` is wallpaper blur behind the paper on the 0-100
   *  scale, on the .widget shell; `textColor` is the ink - "auto" keeps
   *  the classic brown on light paper and goes white on a dark one. */
  surfaceColor?: string | null;
  blur?: number;
  textColor?: "auto" | "light" | "dark";
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
  googleApps: GoogleAppsSettings;
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
  "googleApps",
];

/**
 * Widget placement lives here so the canvas, sidebar, and dock do not
 * maintain competing lists. The order is also the default visual order for
 * each surface.
 */
export const CANVAS_WIDGET_KEYS = [
  "quicklinks",
  "time",
  "date",
  "greeting",
  "todo",
  "info",
  "avatar",
  "searchbar",
  "pomodoro",
  "weather",
  "googleApps",
  "notes",
] as const satisfies readonly WidgetKey[];

export type CanvasWidgetKey = (typeof CANVAS_WIDGET_KEYS)[number];

export const LEFT_SIDEBAR_WIDGET_KEYS = [
  "time",
  "date",
  "greeting",
  "info",
  "todo",
  "quicklinks",
  "searchbar",
  "pomodoro",
  "weather",
  "notes",
  "googleApps",
] as const satisfies readonly CanvasWidgetKey[];

export const DOCK_WIDGET_KEYS = [
  "time",
  "date",
  "info",
  "todo",
  "weather",
  "notes",
  "avatar",
] as const satisfies readonly CanvasWidgetKey[];

export type DockWidgetKey = (typeof DOCK_WIDGET_KEYS)[number];
export type DockWidthPolicy = "flexible" | "full" | "half";
export type DockWidgetAlignment = "left" | "center" | "right";

export const DOCK_ALIGNMENT_WIDGET_KEYS = [
  "time",
  "date",
  "info",
  "weather",
] as const satisfies readonly DockWidgetKey[];

const DEFAULT_DOCK_ALIGNMENTS: Partial<
  Record<WidgetKey, DockWidgetAlignment>
> = {
  time: "center",
  date: "right",
  info: "right",
  weather: "left",
};

export const supportsDockAlignment = (key: WidgetKey): boolean =>
  (DOCK_ALIGNMENT_WIDGET_KEYS as readonly WidgetKey[]).includes(key);

export const getDefaultDockAlignment = (
  key: WidgetKey,
): DockWidgetAlignment => DEFAULT_DOCK_ALIGNMENTS[key] ?? "left";

export const DEFAULT_DOCK_WIDGET_KEYS = [
  "todo",
  "weather",
  "notes",
] as const satisfies readonly DockWidgetKey[];

export const DOCK_WIDTH_POLICIES: Record<DockWidgetKey, DockWidthPolicy> = {
  time: "flexible",
  date: "flexible",
  info: "full",
  todo: "full",
  // Half OR full - a half cell is a small square tile, a full one a
  // big square. Both read fine now that the avatar sizes itself to
  // its cell instead of sitting at a fixed 80px inside it.
  avatar: "flexible",
  weather: "flexible",
  notes: "flexible",
};

export const getDockWidthPolicy = (
  key: WidgetKey,
): DockWidthPolicy | null =>
  (DOCK_WIDTH_POLICIES as Partial<Record<WidgetKey, DockWidthPolicy>>)[key] ??
  null;

/** Surface-frost resolution. Frost is a per-widget choice written by
 *  the surface chips - never something a palette turns on for you. The
 *  Frost theme used to default frost-capable widgets to glass, which
 *  meant picking that palette silently reskinned every widget
 *  background; untouched (undefined) now means solid on every theme. */
export const resolveSurfaceFrost = (stored: boolean | undefined): boolean =>
  stored === true;

export const isWidgetKey = (s: string | undefined): s is WidgetKey =>
  !!s && (WIDGET_KEYS as readonly string[]).includes(s);

export interface ResizeBound {
  min: number;
  max: number;
  step: number;
}

export interface CustomControls {
  timeFormat?: boolean;
  dateFormat?: boolean;
  infoFields?: boolean;
  avatarSelector?: boolean;
  gridMode?: boolean;
  darkMode?: boolean;
  weatherUnit?: boolean;
  /** Detail scale - replaces the old sections + icons-only pair. */
  weatherDetail?: boolean;
  weatherCompact?: boolean;
  /** Card + icon animation, as one visual group. */
  weatherStyle?: boolean;
  /** City search + "use my location" reset, in the edit overlay. */
  weatherLocation?: boolean;
  notesShowBorder?: boolean;
  /** Paper swatches + solid/frost style for the sticky note. */
  notesPaper?: boolean;
  /** Solid/frosted surface choice for the todo list. */
  todoFrosted?: boolean;
  pomodoroSound?: boolean;
  /** Which break-time sticker shows (or random). */
  pomodoroImage?: boolean;
  /** Card colour swatches for the pomodoro focus card. */
  pomodoroColor?: boolean;
}

/** Sticky-note paper swatches - the classic pad colours. First entry
 *  is the shipped cream default (stored as null so pre-feature blobs
 *  and "never touched it" mean the same thing). */
export const NOTE_PAPER_PRESETS = [
  "#fbf3df", // cream (default)
  "#fff3a8", // canary yellow
  "#ffd9e8", // pink
  "#d6ecff", // sky blue
  "#ddf3d9", // mint
  "#e8ddff", // lavender
] as const;

export interface WidgetConfig<K extends WidgetKey> {
  name: string;
  position: WidgetPosition;
  settings: WidgetSettingsMap[K];
  fontSize?: ResizeBound;
  width?: ResizeBound;
  height?: ResizeBound;
  size?: ResizeBound;
  customControls?: CustomControls;
  /** When true, width and height are tied during drag-resize - both
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
      highlightOpacity: 50,
      highlightBlur: 60,
      typeIn: false,
      typeInSpeed: 100,
    },
    fontSize: { min: 20, max: 250, step: 20 },
    customControls: { timeFormat: true },
  },
  date: {
    name: "Date",
    position: { x: 50, y: 50 },
    settings: {
      fontSize: 24,
      displayStyle: "long",
      textShadow: 100,
      highlightColor: null,
      highlightTextColor: "auto",
      highlightOpacity: 50,
      highlightBlur: 60,
      typeIn: false,
      typeInSpeed: 100,
    },
    fontSize: { min: 10, max: 50, step: 5 },
    customControls: { dateFormat: true },
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
      highlightOpacity: 50,
      highlightBlur: 60,
      typeIn: false,
      typeInSpeed: 100,
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
      infoFieldOrder: [...INFO_FIELD_KEYS],
      textShadow: 100,
      highlightColor: null,
      highlightTextColor: "auto",
      highlightOpacity: 50,
      highlightBlur: 60,
      typeIn: false,
      typeInSpeed: 100,
    },
    fontSize: { min: 10, max: 50, step: 5 },
    customControls: { infoFields: true },
  },
  todo: {
    name: "Todo",
    position: { x: 13.169590643274855, y: 2 },
    settings: {
      width: 350,
      height: 350,
      collapsed: false,
      opacity: 0,
      rowOpacity: 75,
      rowBlur: 10,
      blur: 10,
      // `frosted` intentionally absent: undefined = follow the theme
      // (Frost palette ⇒ glass). The chips write true/false explicitly.
      surfaceColor: null,
    },
    width: { min: 250, max: 600, step: 50 },
    height: { min: 200, max: 700, step: 50 },
    customControls: { todoFrosted: true },
  },
  avatar: {
    name: "Avatar",
    position: { x: 50, y: 9.914150101936801 },
    // opacity 0 = no background until asked for, same as googleApps
    // and quicklinks. blur 0 for the same reason: a blur with no tint
    // would smear a rectangle behind a transparent sprite.
    settings: {
      selectedAvatar: "chihiro",
      size: 100,
      opacity: 0,
      blur: 0,
    },
    size: { min: 50, max: 400, step: 50 },
    // todoFrosted = the shared surface row (colour swatch + tuning),
    // the same control todo, quicklinks and googleApps use.
    customControls: { avatarSelector: true, todoFrosted: true },
  },
  quicklinks: {
    name: "Quick Links",
    position: { x: 50, y: 54.791029561671756 },
    settings: {
      gridMode: true,
      linksPerRow: 5,
      visibleRows: 1,
      links: [QUICKLINKS_FALLBACK],
      opacity: 0,
      blur: 0,
      listOpacity: 95,
      listBlur: 0,
      // `frosted` intentionally absent - see the todo note.
      surfaceColor: null,
    },
    // todoFrosted = the shared surface-chips row (theme/colours/glass).
    customControls: { gridMode: true, todoFrosted: true },
  },
  searchbar: {
    name: "Search Bar",
    position: { x: 50, y: 2 },
    settings: { width: 550, height: 64, opacity: 75, blur: 10 },
    width: { min: 200, max: 800, step: 25 },
    customControls: { todoFrosted: true },
    // These are reference px against a 1920-wide viewport, so they
    // render smaller on a laptop - 64 lands at ~48 real px on a 1440
    // screen, which is the Google pill's height. The floor was 20 back
    // when this was a thin input; the pill carries 34px icon buttons.
    height: { min: 48, max: 96, step: 4 },
  },
  pomodoro: {
    name: "Pomodoro",
    // Right edge, vertically centred - same anchoring maths as notes,
    // against the medium card's ~290px height.
    position: { x: 88, y: 37 },
    settings: {
      // The old "medium" preset, so nothing moves for existing users.
      width: 220,
      height: 260,
      opacity: 100,
      blur: 0,
      breakOpacity: 100,
      breakBlur: 0,
      sound: "musicbox",
      soundVolume: 70,
      cardColor: null,
    },
    // Free-resize, like todo and notes. This replaced a small /
    // medium / large radio: three rungs meant the card was almost
    // never the size you wanted, and the layout inside is fluid
    // (container queries) rather than three crafted breakpoints, so
    // there is nothing left for presets to buy.
    width: { min: 150, max: 460, step: 10 },
    height: { min: 190, max: 520, step: 10 },
    customControls: {
      pomodoroSound: true,
      pomodoroImage: true,
      pomodoroColor: true,
    },
  },
  bookmarks: {
    name: "Bookmarks",
    // Position unused - bookmarks renders as a right-side panel, not a
    // positioned tile. Visible defaults to false so existing users don't
    // suddenly get a new panel.
    position: { x: 50, y: 50 },
    settings: {
      layout: "tree",
      density: "comfortable",
      sort: "manual",
    },
  },
  weather: {
    name: "Weather",
    position: { x: 92.44901315789474, y: 2 },
    settings: {
      unit: "C",
      detail: "now",
      compact: false,
      // Fully transparent by default, on every palette - the surface
      // only appears once the user gives it opacity, a colour, or the
      // weather card.
      opacity: 0,
      blur: 0,
      iconStyle: "animated",
      showCard: false,
      manualPlace: null,
      useDeviceLocation: true,
      // `frosted` intentionally absent - see the todo note.
    },
    // No width/height ResizeBound - widget auto-sizes to content.
    customControls: {
      // The generic Background control - the same colour / ink /
      // opacity / blur row and tuning flyout every card widget uses.
      // Weather adds nothing of its own on top of it.
      todoFrosted: true,
      weatherUnit: true,
      weatherDetail: true,
      weatherCompact: true,
      weatherStyle: true,
      weatherLocation: true,
    },
  },
  notes: {
    name: "Notes",
    // Left edge, vertically centred. x is the widget's CENTRE (the
    // shell is translate(-50%, 0)) and y is its TOP, so the y sits half
    // the note's height (260px, ~24vh) above the 50% line.
    position: { x: 12, y: 38 },
    // Square footprint so the cardborder.svg (square) sits flush
    // against the widget's edges with no letterboxing cream gap
    // around it. squareLock ties the two axes during drag-resize so
    // the note stays square at every size; identical bounds on both
    // axes keep the snapped values aligned.
    settings: {
      width: 260,
      height: 260,
      content: "",
      showBorder: true,
      paperColor: null,
      paperNone: false,
      paperFrost: false,
      opacity: 100,
      surfaceColor: null,
      blur: 0,
      textColor: "auto",
    },
    width: { min: 200, max: 600, step: 20 },
    height: { min: 200, max: 600, step: 20 },
    squareLock: true,
    // todoFrosted = the shared Background row (paper tint / ink /
    // opacity / blur), with the sticky-pad colours as its palette.
    customControls: { notesShowBorder: true, todoFrosted: true },
  },
  googleApps: {
    name: "Google apps",
    // Top-right region, mirroring Google's own NTP cluster - inset a
    // touch from the true corner so it clears the weather widget and
    // the screen edge.
    position: { x: 93, y: 5 },
    // Clear by default, like todo and quicklinks. 75 was used briefly
    // because a solid colour picked at 0 alpha painted nothing, but the
    // picker now raises the alpha on first pick, so 0 is safe and the
    // widget matches its own "no background" state on first open.
    settings: { opacity: 0, blur: 10 },
    // todoFrosted = the shared surface-chips row (theme / colours /
    // glass), the same control todo and quicklinks use.
    customControls: { todoFrosted: true },
  },
  rightSidebar: {
    name: "Right Sidebar",
    // Position unused - the right sidebar is a fixed-position dock,
    // not a positioned tile. Visibility drives the dock surface; the
    // dock's contents are routed there by each widget's
    // inRightSidebar flag (introduced in a later chunk).
    position: { x: 0, y: 0 },
    settings: { frosted: false, frostDark: false },
  },
};

export const getWidgetConfig = <K extends WidgetKey>(key: K): WidgetConfig<K> =>
  WIDGET_CONFIGS[key];
