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

export interface InfoFields {
  japaneseTitle: boolean;
  title: boolean;
  year: boolean;
  movieLength: boolean;
  quote: boolean;
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
  infoFields: InfoFields;
  updateInfoFields: (fields: InfoFields) => void;
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
      const avatarVisible = localStorage.getItem("avatar_switch") !== "off";
      return {
        time: timeVisible,
        date: dateVisible,
        info: infoVisible,
        todo: todoVisible,
        avatar: avatarVisible, // Added avatar
      };
    }
  );
  const [infoFields, setInfoFields] = useState<InfoFields>(() => {
    const saved = localStorage.getItem("info_selectedFields");
    const selectedFields = saved
      ? JSON.parse(saved)
      : ["japaneseTitle", "title", "year", "movieLength", "quote"];

    return {
      japaneseTitle: selectedFields.includes("japaneseTitle"),
      title: selectedFields.includes("title"),
      year: selectedFields.includes("year"),
      movieLength: selectedFields.includes("movieLength"),
      quote: selectedFields.includes("quote"),
    };
  });

  const toggleEditMode = () => {
    setShowWidgetEdits((prev) => !prev);
  };

  const updateBackgroundFilters = (filters: Partial<BackgroundFilters>) => {
    setBackgroundFilters((prev) => ({ ...prev, ...filters }));
    const newFilters = { ...backgroundFilters, ...filters };
    localStorage.setItem("background_filters", JSON.stringify(newFilters));
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
      return newVisibility;
    });
  };

  const updateInfoFields = (fields: InfoFields) => {
    setInfoFields(fields);
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
        infoFields,
        updateInfoFields,
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
