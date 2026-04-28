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
}
export interface DateSettings {
  fontSize: number;
}
export interface GreetingSettings {
  fontSize: number;
  name: string;
}
export interface InfoSettings {
  fontSize: number;
  infoFields: InfoFields;
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
// Pomodoro is self-contained — it owns its own localStorage and runs a
// leader-election loop. Nothing in context state for it.
export type PomodoroSettings = Record<string, never>;
export interface WeatherSections {
  /** Current conditions (location + temp + condition). */
  now: boolean;
  /** 6-hour mini-forecast strip. */
  hourly: boolean;
  /** 7-day forecast strip. */
  daily: boolean;
}
export interface WeatherSettings {
  /** "C" = Celsius, "F" = Fahrenheit. */
  unit: "C" | "F";
  /** Independent toggles — any combination of now / hourly / daily.
   *  At least one must be on (enforced by the FieldSelector minSelected). */
  sections: WeatherSections;
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
}
// Bookmarks is a right-side sliding panel, not a positioned widget. It's in
// WIDGET_KEYS so its visibility lives in the same state as everything else
// and the sidebar toggle row can include it. Settings and position are
// unused.
export type BookmarksSettings = Record<string, never>;
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
  weatherSections?: boolean;
  weatherIconStyle?: boolean;
  weatherCard?: boolean;
  notesShowBorder?: boolean;
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
    settings: { fontSize: 200, is24Hour: false },
    fontSize: { min: 20, max: 250, step: 20 },
    customControls: { timeFormat: true },
  },
  date: {
    name: "Date",
    position: { x: 50, y: 50 },
    settings: { fontSize: 24 },
    fontSize: { min: 10, max: 50, step: 5 },
  },
  greeting: {
    name: "Greeting",
    position: { x: 50, y: 21.498311671763506 },
    settings: { fontSize: 28, name: "" },
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
    settings: { width: 550, height: 40, opacity: 75, blur: 10 },
    width: { min: 200, max: 800, step: 25 },
    height: { min: 20, max: 40, step: 2 },
  },
  pomodoro: {
    name: "Pomodoro",
    position: { x: 86.83040935672514, y: 57.429153924566776 },
    settings: {},
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
      sections: { now: true, hourly: false, daily: false },
      opacity: 75,
      blur: 10,
      iconStyle: "animated",
      showCard: false,
    },
    // No width/height ResizeBound — widget auto-sizes to content.
    customControls: {
      weatherUnit: true,
      weatherSections: true,
      weatherIconStyle: true,
      weatherCard: true,
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
};

export const getWidgetConfig = <K extends WidgetKey>(key: K): WidgetConfig<K> =>
  WIDGET_CONFIGS[key];
