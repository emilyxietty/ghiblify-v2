export interface WidgetConfig {
  name: string;
  storageKey: string;
  fontSize: {
    min?: number;
    max?: number;
    default: number;
    step?: number;
    enabled: boolean;
  };
  darkMode?: { enabled: boolean; default: boolean };
  width?: {
    min: number;
    max: number;
    default: number;
    step: number;
    enabled: boolean;
  };
  height?: {
    min: number;
    max: number;
    default: number;
    step: number;
    enabled: boolean;
  };
  size?: {
    min: number;
    max: number;
    default: number;
    step: number;
    enabled: boolean;
  };
  customControls?: {
    timeFormat?: boolean;
    infoFields?: boolean;
    avatarSelector?: boolean;
  };
}

export const WIDGET_CONFIGS: Record<string, WidgetConfig> = {
  time: {
    name: "Time",
    storageKey: "time_position",
    fontSize: {
      min: 20,
      max: 250,
      default: 72,
      step: 20,
      enabled: true,
    },
    customControls: {
      timeFormat: true,
    },
  },
  date: {
    name: "Date",
    storageKey: "date_position",
    fontSize: {
      min: 10,
      max: 50,
      default: 24,
      step: 5,
      enabled: true,
    },
  },
  info: {
    name: "Info",
    storageKey: "info_position",
    fontSize: {
      min: 10,
      max: 50,
      default: 16,
      step: 5,
      enabled: true,
    },
    customControls: {
      infoFields: true,
    },
  },
  todo: {
    name: "Todo",
    storageKey: "todo_position",
    fontSize: {
      default: 14,
      enabled: false,
    },
    darkMode: {
      enabled: true,
      default: false,
    },
    width: {
      min: 250,
      max: 600,
      default: 350,
      step: 50,
      enabled: true,
    },
    height: {
      min: 100,
      max: 700,
      default: 500,
      step: 50,
      enabled: true,
    },
  },
  avatar: {
    name: "Avatar",
    storageKey: "avatar_position",
    fontSize: {
      min: 10,
      max: 50,
      default: 14,
      step: 5,
      enabled: false,
    },
    size: {
      min: 100,
      max: 400,
      default: 200,
      step: 50,
      enabled: true,
    },
    customControls: {
      avatarSelector: true,
    },
  },
};

export const getWidgetConfig = (storageKey?: string): WidgetConfig | null => {
  if (!storageKey) return null;
  const baseKey = storageKey.replace(/_position$/, "");
  return WIDGET_CONFIGS[baseKey] || null;
};
