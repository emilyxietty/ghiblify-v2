import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  AvatarSettings,
  DateSettings,
  InfoFields,
  InfoSettings,
  QuicklinksSettings,
  SearchBarSettings,
  TimeSettings,
  TodoSettings,
  WIDGET_CONFIGS,
} from "../config/widgetConfig";

export interface BackgroundFilters {
  blur: number;
  brightness: number;
  contrast: number;
  saturation: number;
}

interface WidgetVisibility {
  time: boolean;
  date: boolean;
  info: boolean;
  todo: boolean;
  avatar: boolean;
  quicklinks: boolean;
  searchbar: boolean;
  pomodoro: boolean;
}

// Widget settings interfaces moved to widgetConfig.ts

interface AppContextType {
  pomodoroSettings: import("../config/widgetConfig").PomodoroSettings;
  updatePomodoroSettings: (
    settings: Partial<import("../config/widgetConfig").PomodoroSettings>
  ) => void;
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  showWidgetEdits: boolean;
  toggleEditMode: () => void;
  backgroundFilters: BackgroundFilters;
  updateBackgroundFilters: (filters: Partial<BackgroundFilters>) => void;
  widgetVisibility: WidgetVisibility;
  toggleWidgetVisibility: (widget: keyof WidgetVisibility) => void;
  setWidgetsTemporarilyHidden: (hidden: boolean) => void;

  infoSettings: InfoSettings;
  updateInfoSettings: (
    settings: Partial<InfoSettings>,
    options?: { persist?: boolean }
  ) => void;
  timeSettings: TimeSettings;
  updateTimeSettings: (
    settings: Partial<TimeSettings>,
    options?: { persist?: boolean }
  ) => void;
  dateSettings: DateSettings;
  avatarSettings: AvatarSettings;
  todoSettings: TodoSettings;
  todoCollapsed: boolean;
  updateTodoCollapsed: (collapsed: boolean) => void;
  widgetPositions: Record<string, { x: number; y: number }>;
  updateWidgetPosition: (
    storageKey: string,
    pos: { x: number; y: number }
  ) => void;
  updateDateSettings: (
    settings: Partial<DateSettings>,
    options?: { persist?: boolean }
  ) => void;
  updateAvatarSettings: (
    settings: Partial<AvatarSettings>,
    options?: { persist?: boolean }
  ) => void;
  updateTodoSettings: (
    settings: Partial<TodoSettings>,
    options?: { persist?: boolean }
  ) => void;
  backgroundSelection: Record<string, boolean>;
  updateBackgroundSelection: (movieKey: string, value: boolean) => void;
  quicklinksSettings: QuicklinksSettings;
  updateQuicklinksSettings: (settings: Partial<QuicklinksSettings>) => void;
  searchbarSettings: SearchBarSettings;
  updateSearchbarSettings: (settings: Partial<SearchBarSettings>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Centralized drag state for all widgets
  const [isDragging, setIsDragging] = useState(false);
  const [showWidgetEdits, setShowWidgetEdits] = useState(false);
  const [backgroundFilters, setBackgroundFilters] = useState<BackgroundFilters>(
    () => {
      const saved = localStorage.getItem("background_filters");
      return saved
        ? JSON.parse(saved)
        : { blur: 0, brightness: 100, saturation: 100 };
    }
  );
  const [widgetVisibility, setWidgetVisibility] = useState<WidgetVisibility>(
    () => {
      const timeVisible = localStorage.getItem("time_switch") !== "off";
      const dateVisible = localStorage.getItem("date_switch") !== "off";
      const infoVisible = localStorage.getItem("info_switch") !== "off";
      const todoVisible = localStorage.getItem("todo_switch") !== "off";
      const avatarVisible = localStorage.getItem("avatar_switch") !== "off";
      const quicklinksVisible =
        localStorage.getItem("quicklinks_switch") !== "off";
      const searchbarVisible =
        localStorage.getItem("searchbar_switch") !== "off";
      const pomodoroVisible = localStorage.getItem("pomodoro_switch") !== "off";
      return {
        time: timeVisible,
        date: dateVisible,
        info: infoVisible,
        todo: todoVisible,
        avatar: avatarVisible,
        quicklinks: quicklinksVisible,
        searchbar: searchbarVisible,
        pomodoro: pomodoroVisible,
      };
    }
  );
  // Pomodoro widget settings
  const [pomodoroSettings, setPomodoroSettings] = useState<
    import("../config/widgetConfig").PomodoroSettings
  >(() => {
    const saved = localStorage.getItem("pomodoro_settings");
    return saved
      ? JSON.parse(saved)
      : {
          duration: 1500,
          breakDuration: 300,
          isActive: false,
          position: { x: 50, y: 60 },
        };
  });

  // Hide all widgets except Pomodoro when timer is active
  const [widgetsTemporarilyHidden, setWidgetsTemporarilyHiddenState] =
    useState(false);
  const setWidgetsTemporarilyHidden = (hidden: boolean) => {
    setWidgetsTemporarilyHiddenState(hidden);
    if (hidden) {
      setWidgetVisibility((prev) => ({
        time: false,
        date: false,
        info: false,
        todo: false,
        avatar: false,
        quicklinks: false,
        searchbar: false,
        pomodoro: true,
      }));
    } else {
      setWidgetVisibility((prev) => {
        // Restore all widgets except Pomodoro to visible (or use localStorage)
        const timeVisible = localStorage.getItem("time_switch") !== "off";
        const dateVisible = localStorage.getItem("date_switch") !== "off";
        const infoVisible = localStorage.getItem("info_switch") !== "off";
        const todoVisible = localStorage.getItem("todo_switch") !== "off";
        const avatarVisible = localStorage.getItem("avatar_switch") !== "off";
        const quicklinksVisible =
          localStorage.getItem("quicklinks_switch") !== "off";
        const searchbarVisible =
          localStorage.getItem("searchbar_switch") !== "off";
        const pomodoroVisible =
          localStorage.getItem("pomodoro_switch") !== "off";
        return {
          time: timeVisible,
          date: dateVisible,
          info: infoVisible,
          todo: todoVisible,
          avatar: avatarVisible,
          quicklinks: quicklinksVisible,
          searchbar: searchbarVisible,
          pomodoro: pomodoroVisible,
        };
      });
    }
  };

  const updatePomodoroSettings = (
    settings: Partial<import("../config/widgetConfig").PomodoroSettings>
  ) => {
    setPomodoroSettings((prev) => {
      const next = { ...prev, ...settings };
      localStorage.setItem("pomodoro_settings", JSON.stringify(next));
      return next;
    });
  };
  const [infoSettings, setInfoSettings] = useState<InfoSettings>(() => {
    // Use WIDGET_CONFIGS.info.defaults as fallback
    const savedFields = localStorage.getItem("info_selectedFields");
    const selectedFields = savedFields
      ? JSON.parse(savedFields)
      : Object.keys(WIDGET_CONFIGS.info.defaults.infoFields);
    const infoFields: InfoFields = {
      japaneseTitle: selectedFields.includes("japaneseTitle"),
      title: selectedFields.includes("title"),
      year: selectedFields.includes("year"),
      movieLength: selectedFields.includes("movieLength"),
      quote: selectedFields.includes("quote"),
    };
    const savedFontSize = localStorage.getItem("info_fontSize");
    const fontSize = savedFontSize
      ? parseInt(savedFontSize)
      : WIDGET_CONFIGS.info.defaults.fontSize;
    const position = WIDGET_CONFIGS.info.defaults.position;
    return { infoFields, fontSize, position };
  });
  const [timeSettings, setTimeSettings] = useState<TimeSettings>(() => {
    const savedFontSize = localStorage.getItem("time_fontSize");
    const fontSize = savedFontSize
      ? parseInt(savedFontSize)
      : WIDGET_CONFIGS.time.defaults.fontSize;
    const is24Hour =
      localStorage.getItem("time_is24Hour") === "true"
        ? true
        : WIDGET_CONFIGS.time.defaults.is24Hour;
    const position = WIDGET_CONFIGS.time.defaults.position;
    return { fontSize, is24Hour, position };
  });
  const [dateSettings, setDateSettings] = useState<DateSettings>(() => {
    const savedFontSize = localStorage.getItem("date_fontSize");
    const fontSize = savedFontSize
      ? parseInt(savedFontSize)
      : WIDGET_CONFIGS.date.defaults.fontSize;
    const position = WIDGET_CONFIGS.date.defaults.position;
    return { fontSize, position };
  });
  const [avatarSettings, setAvatarSettings] = useState<AvatarSettings>(() => {
    const selected =
      localStorage.getItem("avatar_selected") ||
      WIDGET_CONFIGS.avatar.defaults.selectedAvatar;
    const size = parseInt(
      localStorage.getItem("avatar_size") ||
        WIDGET_CONFIGS.avatar.defaults.size.toString()
    );
    const position = WIDGET_CONFIGS.avatar.defaults.position;
    return { selectedAvatar: selected, size, position };
  });
  const [todoSettings, setTodoSettings] = useState<TodoSettings>(() => {
    const width = parseInt(
      localStorage.getItem("todo_width") ||
        WIDGET_CONFIGS.todo.defaults.width.toString()
    );
    const height = parseInt(
      localStorage.getItem("todo_height") ||
        WIDGET_CONFIGS.todo.defaults.height.toString()
    );
    const darkMode =
      localStorage.getItem("todo_darkMode") === "true"
        ? true
        : WIDGET_CONFIGS.todo.defaults.darkMode;
    const position = WIDGET_CONFIGS.todo.defaults.position;
    return { width, height, darkMode, position };
  });

  const [quicklinksSettings, setQuicklinksSettings] =
    useState<QuicklinksSettings>(() => {
      const width = parseInt(
        localStorage.getItem("quicklinks_width") ||
          WIDGET_CONFIGS.quicklinks.defaults.width.toString()
      );
      const height = parseInt(
        localStorage.getItem("quicklinks_height") ||
          WIDGET_CONFIGS.quicklinks.defaults.height.toString()
      );
      const links = JSON.parse(localStorage.getItem("quick_links") || "[]");
      const gridMode =
        localStorage.getItem("quicklinks_grid") !== null
          ? localStorage.getItem("quicklinks_grid") === "true"
          : WIDGET_CONFIGS.quicklinks.defaults.gridMode;
      const darkMode =
        localStorage.getItem("quicklinks_darkMode") === "true"
          ? true
          : WIDGET_CONFIGS.quicklinks.defaults.darkMode;
      const position = WIDGET_CONFIGS.quicklinks.defaults.position;
      return { width, height, links, gridMode, darkMode, position };
    });
  const [searchbarSettings, setSearchbarSettings] = useState<SearchBarSettings>(
    () => {
      const width = parseInt(
        localStorage.getItem("searchbar_width") ||
          WIDGET_CONFIGS.searchbar.defaults.width.toString()
      );
      // Provide fallback if height is undefined
      const defaultHeight = WIDGET_CONFIGS.searchbar.defaults.height ?? 40;
      const height = parseInt(
        localStorage.getItem("searchbar_height") || defaultHeight.toString()
      );
      const darkMode =
        localStorage.getItem("searchbar_darkMode") === "true"
          ? true
          : WIDGET_CONFIGS.searchbar.defaults.darkMode;
      const position = WIDGET_CONFIGS.searchbar.defaults.position;
      return { width, height, darkMode, position };
    }
  );

  const [widgetPositions, setWidgetPositions] = useState<
    Record<string, { x: number; y: number }>
  >(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.endsWith("_x")) {
          const base = key.slice(0, -2);
          const xRaw = localStorage.getItem(key);
          const yRaw = localStorage.getItem(`${base}_y`);
          const x = xRaw ? parseFloat(xRaw) : NaN;
          const y = yRaw ? parseFloat(yRaw) : NaN;
          if (!isNaN(x) && !isNaN(y)) {
            positions[base] = { x, y };
          }
        }
      }
    } catch (err) {
      console.log(
        "AppContext: error reading widget positions from localStorage",
        err
      );
    }
    return positions;
  });

  const updateWidgetPosition = (
    storageKey: string,
    pos: { x: number; y: number }
  ) => {
    setWidgetPositions((prev) => ({ ...prev, [storageKey]: pos }));
    try {
      localStorage.setItem(`${storageKey}_x`, pos.x.toString());
      localStorage.setItem(`${storageKey}_y`, pos.y.toString());
      console.log("AppContext: persisted position", storageKey, pos);
    } catch (err) {
      console.log("AppContext: failed to persist position", storageKey, err);
    }
  };

  // persisted collapsed state for the todo widget (so its open/collapsed
  // state survives page reloads and is globally accessible)
  const [todoCollapsed, setTodoCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("todo_collapsed") === "true";
  });

  useEffect(() => {
    console.log("[AppContext] todo_collapsed state changed:", todoCollapsed);
  }, [todoCollapsed]);

  const updateTodoCollapsed = (collapsed: boolean) => {
    setTodoCollapsed(collapsed);
    try {
      localStorage.setItem("todo_collapsed", collapsed.toString());
      console.log("AppContext: persisted todo_collapsed", collapsed);
    } catch (err) {
      console.log("AppContext: failed to persist todo_collapsed", err);
    }
  };

  const [backgroundSelection, setBackgroundSelection] = useState<
    Record<string, boolean>
  >(() => {
    try {
      const saved = localStorage.getItem("background_selection");
      return saved ? JSON.parse(saved) : {};
    } catch (err) {
      console.log("AppContext: failed to read background_selection", err);
      return {};
    }
  });

  const updateBackgroundSelection = (movieKey: string, value: boolean) => {
    setBackgroundSelection((prev) => {
      const next = { ...prev, [movieKey]: value };
      try {
        localStorage.setItem("background_selection", JSON.stringify(next));
        console.log("AppContext: persisted background_selection", next);
      } catch (err) {
        console.log("AppContext: failed to persist background_selection", err);
      }
      return next;
    });
  };

  const toggleEditMode = () => {
    setShowWidgetEdits((prev) => !prev);
    setIsDragging(false); // Always reset drag state on edit mode toggle
  };

  const updateBackgroundFilters = (filters: Partial<BackgroundFilters>) => {
    setBackgroundFilters((prev) => ({ ...prev, ...filters }));
    const newFilters = { ...backgroundFilters, ...filters };
    localStorage.setItem("background_filters", JSON.stringify(newFilters));
    console.log("AppContext: updateBackgroundFilters", newFilters);
  };

  const toggleWidgetVisibility = (widget: keyof WidgetVisibility) => {
    setWidgetVisibility((prev) => {
      const newVisibility = {
        ...prev,
        [widget]: !prev[widget],
      };
      try {
        const key = `${String(widget).toLowerCase()}_switch`;
        localStorage.setItem(key, newVisibility[widget] ? "on" : "off");
      } catch (err) {
        console.warn("AppContext: failed to persist widget visibility", err);
      }
      console.log(
        "AppContext: toggleWidgetVisibility",
        widget,
        newVisibility[widget]
      );
      return newVisibility;
    });
  };
  const updateInfoSettings = (
    settings: Partial<InfoSettings>,
    options?: { persist?: boolean }
  ) => {
    console.log("AppContext: updateInfoSettings called", settings);
    setInfoSettings((prev) => {
      const next = { ...prev, ...settings };
      if (settings.infoFields) {
        const selected: string[] = Object.entries(settings.infoFields)
          .filter(([_, v]) => v)
          .map(([k]) => k);
        localStorage.setItem("info_selectedFields", JSON.stringify(selected));
        console.log("AppContext: persisted info_selectedFields", selected);
      }
      if (settings.fontSize !== undefined) {
        localStorage.setItem("info_fontSize", next.fontSize.toString());
        console.log("AppContext: persisted info_fontSize", next.fontSize);
      }
      if (settings.position) {
        localStorage.setItem("info_x", settings.position.x.toString());
        localStorage.setItem("info_y", settings.position.y.toString());
      }
      return next;
    });
  };

  const updateTimeSettings = (
    settings: Partial<TimeSettings>,
    options?: { persist?: boolean }
  ) => {
    console.log("AppContext: updateTimeSettings called", settings);
    setTimeSettings((prev) => {
      const next = { ...prev, ...settings };
      if (settings.fontSize !== undefined) {
        localStorage.setItem("time_fontSize", next.fontSize.toString());
        console.log("AppContext: persisted time_fontSize", next.fontSize);
      }
      if (settings.is24Hour !== undefined) {
        localStorage.setItem("time_is24Hour", next.is24Hour.toString());
        console.log("AppContext: persisted time_is24Hour", next.is24Hour);
      }
      if (settings.position) {
        localStorage.setItem("time_x", settings.position.x.toString());
        localStorage.setItem("time_y", settings.position.y.toString());
      }
      return next;
    });
  };

  const updateDateSettings = (
    settings: Partial<DateSettings>,
    options?: { persist?: boolean }
  ) => {
    console.log("AppContext: updateDateSettings called", settings);
    setDateSettings((prev) => {
      const next = { ...prev, ...settings };
      if (settings.fontSize !== undefined) {
        localStorage.setItem("date_fontSize", next.fontSize.toString());
        console.log("AppContext: persisted date_fontSize", next.fontSize);
      }
      if (settings.position) {
        localStorage.setItem("date_x", settings.position.x.toString());
        localStorage.setItem("date_y", settings.position.y.toString());
      }
      return next;
    });
  };

  const updateAvatarSettings = (
    settings: Partial<AvatarSettings>,
    options?: { persist?: boolean }
  ) => {
    console.log("AppContext: updateAvatarSettings called", settings);
    setAvatarSettings((prev) => {
      const next = { ...prev, ...settings };
      if (settings.selectedAvatar !== undefined) {
        localStorage.setItem("avatar_selected", next.selectedAvatar);
        console.log(
          "AppContext: persisted avatar_selected",
          next.selectedAvatar
        );
      }
      if (settings.size !== undefined) {
        localStorage.setItem("avatar_size", next.size.toString());
        console.log("AppContext: persisted avatar_size", next.size);
      }
      if (settings.position) {
        localStorage.setItem("avatar_x", settings.position.x.toString());
        localStorage.setItem("avatar_y", settings.position.y.toString());
      }
      return next;
    });
  };

  const updateTodoSettings = (
    settings: Partial<TodoSettings>,
    options?: { persist?: boolean }
  ) => {
    console.log("AppContext: updateTodoSettings called", settings);
    setTodoSettings((prev) => {
      const next = { ...prev, ...settings };
      if (settings.width !== undefined) {
        localStorage.setItem("todo_width", next.width.toString());
        console.log("AppContext: persisted todo_width", next.width);
      }
      if (settings.height !== undefined) {
        localStorage.setItem("todo_height", next.height.toString());
        console.log("AppContext: persisted todo_height", next.height);
      }
      if (settings.darkMode !== undefined) {
        localStorage.setItem("todo_darkMode", next.darkMode.toString());
        console.log("AppContext: persisted todo_darkMode", next.darkMode);
      }
      if (settings.position) {
        localStorage.setItem("todo_x", settings.position.x.toString());
        localStorage.setItem("todo_y", settings.position.y.toString());
      }
      return next;
    });
  };

  const updateQuicklinksSettings = (settings: Partial<QuicklinksSettings>) => {
    setQuicklinksSettings((prev) => {
      const updated = { ...prev, ...settings };
      if (settings.width !== undefined) {
        localStorage.setItem("quicklinks_width", updated.width.toString());
      }
      if (settings.height !== undefined) {
        localStorage.setItem("quicklinks_height", updated.height.toString());
      }
      if (settings.links !== undefined) {
        localStorage.setItem("quick_links", JSON.stringify(updated.links));
      }
      if (settings.gridMode !== undefined) {
        localStorage.setItem(
          "quicklinks_grid",
          settings.gridMode ? "true" : "false"
        );
      }
      if (settings.darkMode !== undefined) {
        localStorage.setItem(
          "quicklinks_darkMode",
          settings.darkMode ? "true" : "false"
        );
      }
      if (settings.position) {
        localStorage.setItem("quicklinks_x", settings.position.x.toString());
        localStorage.setItem("quicklinks_y", settings.position.y.toString());
      }
      return updated;
    });
  };

  const updateSearchbarSettings = (settings: Partial<SearchBarSettings>) => {
    setSearchbarSettings((prev) => {
      const updated = { ...prev, ...settings };
      console.log("updateSearchbarSettings called", settings, updated);
      if (settings.width !== undefined) {
        localStorage.setItem("searchbar_width", updated.width.toString());
      }
      if (settings.height !== undefined && updated.height !== undefined) {
        localStorage.setItem("searchbar_height", String(updated.height));
      }
      if (typeof updated.darkMode === "boolean") {
        localStorage.setItem("searchbar_darkMode", updated.darkMode.toString());
      }
      if (settings.position) {
        localStorage.setItem("searchbar_x", settings.position.x.toString());
        localStorage.setItem("searchbar_y", settings.position.y.toString());
      }
      return updated;
    });
  };

  return (
    <AppContext.Provider
      value={{
        showWidgetEdits,
        toggleEditMode,
        backgroundFilters,
        updateBackgroundFilters,
        widgetVisibility,
        toggleWidgetVisibility,
        widgetPositions,
        updateWidgetPosition,
        infoSettings,
        backgroundSelection,
        updateBackgroundSelection,
        updateInfoSettings,
        timeSettings,
        updateTimeSettings,
        dateSettings,
        avatarSettings,
        todoSettings,
        todoCollapsed,
        updateTodoCollapsed,
        updateDateSettings,
        updateAvatarSettings,
        updateTodoSettings,
        quicklinksSettings,
        updateQuicklinksSettings,
        searchbarSettings,
        updateSearchbarSettings,
        pomodoroSettings,
        updatePomodoroSettings,
        setWidgetsTemporarilyHidden,
        isDragging,
        setIsDragging,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within AppProvider");
  }
  return context;
};
