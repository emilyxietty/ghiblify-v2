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
export interface TimeSettings { fontSize: number; is24Hour: boolean }
export interface DateSettings { fontSize: number }
export interface InfoSettings { fontSize: number; infoFields: InfoFields }
export interface TodoSettings {
  width: number;
  height: number;
  darkMode: boolean;
  collapsed: boolean;
  /** 0–100 — controls the alpha of the surface tint. Default 50. */
  opacity: number;
}
export interface AvatarSettings { selectedAvatar: string; size: number }
export interface QuicklinksSettings {
  width: number;
  height: number;
  gridMode: boolean;
  darkMode: boolean;
  links: QuicklinkItem[];
  /** 0–100 — controls the alpha of link tile surfaces. */
  opacity: number;
}
export interface SearchBarSettings {
  width: number;
  height: number;
  darkMode: boolean;
  /** 0–100 — controls the alpha of input + button surface. */
  opacity: number;
}
// Pomodoro is self-contained — it owns its own localStorage and runs a
// leader-election loop. Nothing in context state for it.
export type PomodoroSettings = Record<string, never>;
// Bookmarks is a right-side sliding panel, not a positioned widget. It's in
// WIDGET_KEYS so its visibility lives in the same state as everything else
// and the sidebar toggle row can include it. Settings and position are
// unused.
export type BookmarksSettings = Record<string, never>;

export interface WidgetSettingsMap {
  time: TimeSettings;
  date: DateSettings;
  info: InfoSettings;
  todo: TodoSettings;
  avatar: AvatarSettings;
  quicklinks: QuicklinksSettings;
  searchbar: SearchBarSettings;
  pomodoro: PomodoroSettings;
  bookmarks: BookmarksSettings;
}

export type WidgetKey = keyof WidgetSettingsMap;

export const WIDGET_KEYS: readonly WidgetKey[] = [
  "time",
  "date",
  "info",
  "todo",
  "avatar",
  "quicklinks",
  "searchbar",
  "pomodoro",
  "bookmarks",
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
}

type WidgetConfigsType = { [K in WidgetKey]: WidgetConfig<K> };

export const WIDGET_CONFIGS: WidgetConfigsType = {
  time: {
    name: "Time",
    position: { x: 50, y: 9.609292502639917 },
    settings: { fontSize: 200, is24Hour: false },
    fontSize: { min: 20, max: 250, step: 20 },
    customControls: { timeFormat: true },
  },
  date: {
    name: "Date",
    position: { x: 50, y: 32.89334741288279 },
    settings: { fontSize: 24 },
    fontSize: { min: 10, max: 50, step: 5 },
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
    settings: { width: 350, height: 200, darkMode: false, collapsed: false, opacity: 50 },
    width: { min: 250, max: 600, step: 50 },
    height: { min: 200, max: 700, step: 50 },
    customControls: { darkMode: true },
  },
  avatar: {
    name: "Avatar",
    position: { x: 5.859649122807017, y: 86.06124604012672 },
    settings: { selectedAvatar: "chihiro", size: 100 },
    size: { min: 50, max: 400, step: 50 },
    customControls: { avatarSelector: true },
  },
  quicklinks: {
    name: "Quick Links",
    position: { x: 50, y: 50 },
    settings: {
      width: 600,
      height: 200,
      gridMode: true,
      darkMode: false,
      links: [],
      opacity: 50,
    },
    width: { min: 200, max: 600, step: 100 },
    height: { min: 200, max: 700, step: 100 },
    customControls: { gridMode: true, darkMode: true },
  },
  searchbar: {
    name: "Search Bar",
    position: { x: 50, y: 39.54593453009504 },
    settings: { width: 550, height: 40, darkMode: false, opacity: 50 },
    width: { min: 200, max: 800, step: 25 },
    height: { min: 20, max: 40, step: 2 },
    customControls: { darkMode: true },
  },
  pomodoro: {
    name: "Pomodoro",
    position: { x: 86.88888888888889, y: 2 },
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
};

export const getWidgetConfig = <K extends WidgetKey>(key: K): WidgetConfig<K> =>
  WIDGET_CONFIGS[key];
