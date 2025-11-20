import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import React, { useEffect, useReducer } from "react";
import { Button } from "../../components/Button/Button";
import { useAppContext } from "../../contexts/AppContext"; // <-- Add this import
import { getWidgetConfig } from "../../types/widgetConfig";
import { AvatarSelector } from "../AvatarSelector/AvatarSelector";
import { FieldSelector } from "../FieldSelector/FieldSelector";

interface EditWidgetProps {
  showWidgetEdits: boolean;
  localIsDragging: boolean;
  isResizing: boolean;
  storageKey?: string;
}

const INFO_FIELD_OPTIONS = [
  { value: "japaneseTitle", label: "Japanese Title" },
  { value: "title", label: "Title" },
  { value: "year", label: "Year" },
  { value: "movieLength", label: "Movie Length" },
  { value: "quote", label: "Quote" },
];

// const DEFAULT_FIELDS = [
//   "japaneseTitle",
//   "title",
//   "year",
//   "movieLength",
//   "quote",
// ];

const EditWidget: React.FC<EditWidgetProps> = ({
  showWidgetEdits,
  localIsDragging,
  isResizing,
  storageKey,
}) => {
  const { infoFields, updateInfoFields } = useAppContext();
  const widgetConfig = getWidgetConfig(storageKey);

  if (!showWidgetEdits || localIsDragging || isResizing || !storageKey)
    return null;

  // Dummy state to force re-render on settings change
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  // Listen for settings change events to re-render
  useEffect(() => {
    const handler = () => forceUpdate();
    window.addEventListener("timeSettingsChange", handler);
    window.addEventListener("infoSettingsChange", handler);
    window.addEventListener("avatarSettingsChange", handler);
    window.addEventListener(
      `${storageKey.replace(/_position$/, "")}SettingsChange`,
      handler
    );
    return () => {
      window.removeEventListener("timeSettingsChange", handler);
      window.removeEventListener("infoSettingsChange", handler);
      window.removeEventListener("avatarSettingsChange", handler);
      window.removeEventListener(
        `${storageKey.replace(/_position$/, "")}SettingsChange`,
        handler
      );
    };
  }, [storageKey]);

  // Always read current values from localStorage
  const is24Hour = localStorage.getItem("time_is24Hour") === "true";
  const darkMode = localStorage.getItem(`${storageKey}_darkMode`) === "true";
  const selectedAvatar = localStorage.getItem("avatar_selected") || "totoro";

  useEffect(() => {
    const handler = (e: Event) => {
      const saved = localStorage.getItem("info_selectedFields");
      updateInfoFields(saved ? JSON.parse(saved) : infoFields);
    };
    window.addEventListener("infoSettingsChange", handler);
    return () => window.removeEventListener("infoSettingsChange", handler);
  }, []);

  // Adjustment handlers
  const adjustFontSize = (delta: number) => {
    if (!storageKey || !widgetConfig?.fontSize) return;
    const baseKey = storageKey.replace(/_position$/, "");
    const fontSizeKey = `${baseKey}_fontSize`;
    const currentSize = parseInt(
      localStorage.getItem(fontSizeKey) ||
        widgetConfig.fontSize.default.toString()
    );
    const { min, max, step } = widgetConfig.fontSize;
    const actualDelta = delta > 0 ? step : -(step ?? 1);
    const newSize = Math.max(
      min ?? 1,
      Math.min(max ?? 1, currentSize + (actualDelta ?? 1))
    );
    localStorage.setItem(fontSizeKey, newSize.toString());
    let detail: any = { fontSize: newSize };
    if (widgetConfig.customControls?.timeFormat) {
      const is24Hour = localStorage.getItem("time_is24Hour") === "true";
      detail.is24Hour = is24Hour;
    }
    const eventName = `${baseKey}SettingsChange`;
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
    forceUpdate();
  };

  const adjustSize = (delta: number) => {
    if (!storageKey || !widgetConfig?.size) return;
    const baseKey = storageKey.replace(/_position$/, "");
    const sizeKey = `${baseKey}_size`;
    const currentSize = parseInt(
      localStorage.getItem(sizeKey) || widgetConfig.size.default.toString()
    );
    const { min, max, step } = widgetConfig.size;
    const actualDelta = delta > 0 ? step : -step;
    const newSize = Math.max(min, Math.min(max, currentSize + actualDelta));
    localStorage.setItem(sizeKey, newSize.toString());
    const eventName = `${baseKey}SettingsChange`;
    window.dispatchEvent(
      new CustomEvent(eventName, { detail: { size: newSize } })
    );
    forceUpdate();
  };

  // Toggles
  const toggleTimeFormat = () => {
    const newIs24Hour = !is24Hour;
    localStorage.setItem("time_is24Hour", newIs24Hour.toString());
    window.dispatchEvent(
      new CustomEvent("timeSettingsChange", {
        detail: { is24Hour: newIs24Hour },
      })
    );
    forceUpdate();
  };

  const handleDarkModeToggle = () => {
    const newValue = !darkMode;
    localStorage.setItem(`${storageKey}_darkMode`, newValue.toString());
    // setDarkMode(newValue);
    const baseKey = storageKey.replace(/_position$/, "");
    window.dispatchEvent(
      new CustomEvent(`${baseKey}SettingsChange`, {
        detail: { darkMode: newValue },
      })
    );
  };

  const handleInfoFieldsChange = (fields: string[]) => {
    if (fields.length === 0) return;
    localStorage.setItem("info_selectedFields", JSON.stringify(fields));
    window.dispatchEvent(
      new CustomEvent("infoSettingsChange", {
        detail: { selectedFields: fields },
      })
    );
    // Convert array to object for context
    const fieldsObj = {
      japaneseTitle: fields.includes("japaneseTitle"),
      title: fields.includes("title"),
      year: fields.includes("year"),
      movieLength: fields.includes("movieLength"),
      quote: fields.includes("quote"),
    };
    if (updateInfoFields) updateInfoFields(fieldsObj);
    forceUpdate();
  };

  const handleAvatarChange = (avatar: string) => {
    localStorage.setItem("avatar_selected", avatar);
    window.dispatchEvent(
      new CustomEvent("avatarSettingsChange", {
        detail: { selectedAvatar: avatar },
      })
    );
    forceUpdate();
  };

  // Determine which controls to show
  const fontSizeEnabled = widgetConfig?.fontSize?.enabled ?? false;
  const sizeEnabled = widgetConfig?.size?.enabled ?? false;
  const hasTimeFormat = widgetConfig?.customControls?.timeFormat ?? false;
  const hasInfoFields = widgetConfig?.customControls?.infoFields ?? false;
  const hasAvatarSelector =
    widgetConfig?.customControls?.avatarSelector ?? false;
  const hasDarkMode =
    typeof widgetConfig?.darkMode === "object"
      ? widgetConfig.darkMode.enabled
      : !!widgetConfig?.darkMode;
  const hasAnyControls =
    fontSizeEnabled ||
    hasTimeFormat ||
    hasInfoFields ||
    sizeEnabled ||
    hasAvatarSelector ||
    hasDarkMode;

  return (
    <div
      className={`widget-overlay ${!hasAnyControls ? "draggable-overlay" : ""}`}
    >
      {hasAnyControls && (
        <>
          <div className="widget-controls-container">
            {fontSizeEnabled && (
              <div className="font-size-control-wrapper">
                <div className="font-size-controls">
                  <button
                    className="font-size-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      adjustFontSize(-5);
                    }}
                    title="Decrease font size"
                  >
                    <span className="font-icon-small">-</span>
                  </button>
                  Aa
                  <button
                    className="font-size-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      adjustFontSize(5);
                    }}
                    title="Increase font size"
                  >
                    <span className="font-icon-large">+</span>
                  </button>
                </div>
              </div>
            )}
            {hasTimeFormat && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTimeFormat();
                }}
                title="Toggle 12/24 hour format"
                variant="dark"
                size="small"
                icon={is24Hour ? "12h" : "24h"}
              />
            )}
            {hasDarkMode && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDarkModeToggle();
                }}
                title="Toggle dark mode"
                variant="dark"
                size="small"
                icon={darkMode ? <DarkModeIcon /> : <LightModeIcon />}
              />
            )}
          </div>
          {hasInfoFields && (
            <FieldSelector
              options={INFO_FIELD_OPTIONS}
              selectedValues={Object.entries(infoFields)
                .filter(([_, v]) => v)
                .map(([k]) => k)}
              onChange={handleInfoFieldsChange}
              variant="dark"
              minSelected={1}
            />
          )}
          {hasAvatarSelector && (
            <AvatarSelector
              selectedAvatar={selectedAvatar}
              onChange={handleAvatarChange}
            />
          )}
        </>
      )}
    </div>
  );
};

export default EditWidget;
