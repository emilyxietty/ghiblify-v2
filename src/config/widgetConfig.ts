// Shared types
// WidgetConfigMap type for dynamic access
export type WidgetConfigMap = {
  time: WidgetConfig<TimeSettings>;
  date: WidgetConfig<DateSettings>;
  info: WidgetConfig<InfoSettings>;
  todo: WidgetConfig<TodoSettings>;
  avatar: WidgetConfig<AvatarSettings>;
  quicklinks: WidgetConfig<QuicklinksSettings>;
  searchbar: WidgetConfig<SearchBarSettings>;
  pomodoro: WidgetConfig<PomodoroSettings>;
  [key: string]: WidgetConfig<any>;
};

export interface WidgetPosition {
  x: number;
  y: number;
}

export interface BaseWidgetSettings {
  position?: WidgetPosition;
  darkMode?: boolean;
}

export interface InfoFields {
  japaneseTitle: boolean;
  title: boolean;
  year: boolean;
  movieLength: boolean;
  quote: boolean;
}

export interface InfoSettings extends BaseWidgetSettings {
  infoFields: InfoFields;
  fontSize: number;
}

export interface TimeSettings extends BaseWidgetSettings {
  fontSize: number;
  is24Hour: boolean;
}

export interface DateSettings extends BaseWidgetSettings {
  fontSize: number;
}

export interface TodoSettings extends BaseWidgetSettings {
  width: number;
  height: number;
  darkMode: boolean;
}

export interface PomodoroSettings extends BaseWidgetSettings {
  duration: number;
  breakDuration: number;
  isActive: boolean;
}

export interface AvatarSettings extends BaseWidgetSettings {
  selectedAvatar: string;
  size: number;
}

export interface QuicklinksSettings extends BaseWidgetSettings {
  width: number;
  height: number;
  links: Array<{ id: string; title: string; url: string }>;
  gridMode?: boolean;
}

export interface SearchBarSettings extends BaseWidgetSettings {
  width: number;
  height?: number;
}

export interface WidgetConfig<TSettings> {
  name: string;
  storageKey: string;
  fontSize?: {
    min?: number;
    max?: number;
    step?: number;
    enabled: boolean;
  };
  darkMode?: boolean;
  width?: {
    min: number;
    max: number;
    step: number;
    enabled: boolean;
  };
  height?: {
    min: number;
    max: number;
    step: number;
    enabled: boolean;
  };
  size?: {
    min: number;
    max: number;
    step: number;
    enabled: boolean;
  };
  customControls?: {
    timeFormat?: boolean;
    infoFields?: boolean;
    avatarSelector?: boolean;
    gridMode?: boolean;
  };
  localStorageKeys?: string[];
  defaults: TSettings;
}

export const WIDGET_CONFIGS: WidgetConfigMap = {
  time: {
    name: "Time",
    storageKey: "time",
    fontSize: {
      min: 20,
      max: 250,
      step: 20,
      enabled: true,
    },
    defaults: {
      fontSize: 200,
      is24Hour: false,
      position: { x: 50, y: 9.609292502639917 },
    } as TimeSettings,
  } as WidgetConfig<TimeSettings>,
  date: {
    name: "Date",
    storageKey: "date",
    fontSize: {
      min: 10,
      max: 50,
      step: 5,
      enabled: true,
    },
    defaults: {
      fontSize: 24,
      position: { x: 50, y: 32.89334741288279 },
    } as DateSettings,
  } as WidgetConfig<DateSettings>,
  info: {
    name: "Info",
    storageKey: "info",
    fontSize: {
      min: 10,
      max: 50,
      step: 5,
      enabled: true,
    },
    customControls: {
      infoFields: true,
    },
    defaults: {
      infoFields: {
        japaneseTitle: true,
        title: true,
        year: true,
        movieLength: true,
        quote: true,
      },
      fontSize: 16,
      position: { x: 50, y: 78.08870116156282 },
    } as InfoSettings,
  } as WidgetConfig<InfoSettings>,
  todo: {
    name: "Todo",
    storageKey: "todo",
    fontSize: {
      enabled: false,
    },
    darkMode: true,
    width: {
      min: 250,
      max: 600,
      step: 50,
      enabled: true,
    },
    height: {
      min: 200,
      max: 700,
      step: 50,
      enabled: true,
    },
    defaults: {
      width: 350,
      height: 200,
      darkMode: false,
      position: { x: 13.169590643274855, y: 2 },
    } as TodoSettings,
  } as WidgetConfig<TodoSettings>,
  avatar: {
    name: "Avatar",
    storageKey: "avatar",
    size: {
      min: 50,
      max: 400,
      step: 50,
      enabled: true,
    },
    customControls: {
      avatarSelector: true,
    },
    defaults: {
      selectedAvatar: "chihiro",
      size: 100,
      position: { x: 5.859649122807017, y: 86.06124604012672 },
    } as AvatarSettings,
  } as WidgetConfig<AvatarSettings>,
  quicklinks: {
    name: "Quick Links",
    storageKey: "quicklinks",
    width: {
      min: 200,
      max: 600,
      step: 100,
      enabled: true,
    },
    height: {
      min: 200,
      max: 700,
      step: 100,
      enabled: true,
    },
    customControls: {
      gridMode: true,
    },
    localStorageKeys: ["quicklinks_grid", "quicklinks_size"],
    darkMode: true,
    defaults: {
      width: 600,
      height: 200,
      gridMode: true,
      position: { x: 50, y: 50 },
      darkMode: false,
    } as QuicklinksSettings,
  } as WidgetConfig<QuicklinksSettings>,
  searchbar: {
    name: "Search Bar",
    storageKey: "searchbar",
    width: {
      min: 200,
      max: 800,
      step: 25,
      enabled: true,
    },
    height: {
      min: 20,
      max: 40,
      step: 2,
      enabled: true,
    },
    darkMode: true,
    defaults: {
      width: 550,
      height: 40,
      darkMode: false,
      position: { x: 50, y: 39.54593453009504 },
    } as SearchBarSettings,
  } as WidgetConfig<SearchBarSettings>,
  pomodoro: {
    name: "Pomodoro",
    storageKey: "pomodoro",
    defaults: {
      duration: 1500, // 25 min
      breakDuration: 300, // 5 min
      isActive: false,
      position: { x: 50, y: 60 },
    } as PomodoroSettings,
  } as WidgetConfig<PomodoroSettings>,
};

export const getWidgetConfig = (
  storageKey?: string
): WidgetConfig<any> | null => {
  if (!storageKey) return null;
  const baseKey = storageKey.replace(/$/, "");
  return WIDGET_CONFIGS[baseKey] || null;
};
