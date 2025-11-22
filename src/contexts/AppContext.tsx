import React, { createContext, ReactNode, useContext, useState } from "react";

export interface BackgroundFilters {
  blur: number;
  brightness: number;
  saturation: number;
}

interface WidgetVisibility {
  time: boolean;
  date: boolean;
  info: boolean;
  todo: boolean;
  avatar: boolean; // Added avatar
}

interface InfoFields {
  japaneseTitle: boolean;
  title: boolean;
  year: boolean;
  movieLength: boolean;
  quote: boolean;
}

interface InfoSettings {
  infoFields: InfoFields;
  fontSize: number;
}

interface TimeSettings {
  fontSize: number;
  is24Hour: boolean;
}

interface DateSettings {
  fontSize: number;
}

interface TodoSettings {
  width: number;
  height: number;
  darkMode: boolean;
}

interface AvatarSettings {
  selectedAvatar: string;
  size: number;
}

interface AppContextType {
  showWidgetEdits: boolean;
  toggleEditMode: () => void;
  backgroundFilters: BackgroundFilters;
  updateBackgroundFilters: (filters: Partial<BackgroundFilters>) => void;
  widgetVisibility: WidgetVisibility;
  toggleWidgetVisibility: (widget: keyof WidgetVisibility) => void;
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;

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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [showWidgetEdits, setShowWidgetEdits] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
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
      const avatarVisible = localStorage.getItem("avatar_switch") !== "off"; // Added avatar
      return {
        time: timeVisible,
        date: dateVisible,
        info: infoVisible,
        todo: todoVisible,
        avatar: avatarVisible, // Added avatar
      };
    }
  );
  const [infoSettings, setInfoSettings] = useState<InfoSettings>(() => {
    // InfoFields
    const savedFields = localStorage.getItem("info_selectedFields");
    const selectedFields = savedFields
      ? JSON.parse(savedFields)
      : ["japaneseTitle", "title", "year", "movieLength", "quote"];
    const infoFields: InfoFields = {
      japaneseTitle: selectedFields.includes("japaneseTitle"),
      title: selectedFields.includes("title"),
      year: selectedFields.includes("year"),
      movieLength: selectedFields.includes("movieLength"),
      quote: selectedFields.includes("quote"),
    };
    // Font size
    const savedFontSize = localStorage.getItem("info_fontSize");
    const fontSize = savedFontSize ? parseInt(savedFontSize) : 16;
    return { infoFields, fontSize };
  });
  const [timeSettings, setTimeSettings] = useState<TimeSettings>(() => {
    const savedFontSize = localStorage.getItem("time_fontSize");
    const fontSize = savedFontSize ? parseInt(savedFontSize) : 32;
    const is24Hour = localStorage.getItem("time_is24Hour") === "true";
    return { fontSize, is24Hour };
  });
  const [dateSettings, setDateSettings] = useState<DateSettings>(() => {
    const savedFontSize = localStorage.getItem("date_fontSize");
    const fontSize = savedFontSize ? parseInt(savedFontSize) : 24;
    return { fontSize };
  });
  const [avatarSettings, setAvatarSettings] = useState<AvatarSettings>(() => {
    const selected = localStorage.getItem("avatar_selected") || "totoro";
    const size = parseInt(localStorage.getItem("avatar_size") || "100");
    return { selectedAvatar: selected, size };
  });
  const [todoSettings, setTodoSettings] = useState<TodoSettings>(() => {
    const width = parseInt(localStorage.getItem("todo_width") || "350");
    const height = parseInt(localStorage.getItem("todo_height") || "500");
    const darkMode = localStorage.getItem("todo_darkMode") === "true";
    return { width, height, darkMode };
  });

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
      localStorage.setItem(
        `${widget}_switch`,
        newVisibility[widget] ? "on" : "off"
      );
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
      return next;
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
        isDragging,
        setIsDragging,
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
